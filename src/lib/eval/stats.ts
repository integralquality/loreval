/**
 * Aggregation over eval attempts. Pure functions — no storage, no network.
 *
 * Two deliberate distinctions run through all of this:
 *   - a transport/auth failure is NOT a wrong answer, so it is excluded from
 *     the solve rate and reported separately as `errors`;
 *   - a response we couldn't parse into moves is a *format* failure, tracked
 *     apart from planning failures so one doesn't hide the other.
 */
import { costOf } from './pricing';
import type { MoveOutcome } from './replay';
import type { EvalAttempt, EvalSession } from './types';

/** Counts per replay outcome — why a plan failed, not just that it did. */
export type OutcomeCounts = Record<MoveOutcome, number>;

/** Lower and upper bound of a proportion, as fractions. */
export interface Interval {
  low: number;
  high: number;
}

export interface Spread {
  min: number;
  max: number;
  /** Population standard deviation; 0 for a single sample. */
  stdDev: number;
}

export interface ModelStats {
  modelKey: string;
  providerId: string;
  modelId: string;
  label: string;

  /** Attempts entered for this model. */
  total: number;
  /** Attempts where the model answered (excludes transport errors). */
  completed: number;
  /** Attempts that never got an answer. */
  errors: number;
  /** Answered attempts with no parsable move list. */
  parseFailures: number;

  solved: number;
  /** solved / completed — null when nothing completed. */
  solveRate: number | null;

  /** Averages over completed attempts; null when there are none. */
  avgProposed: number | null;
  avgApplied: number | null;
  avgFailedMoves: number | null;
  /** Rejected moves / proposed moves across completed attempts. */
  illegalRate: number | null;

  /**
   * 95% Wilson score interval on the solve rate. Two successes out of two is
   * not evidence of a 100% model, and this is what says so.
   */
  solveRateInterval: Interval | null;
  /**
   * Share of models that solved it at least once in k attempts, for every
   * k up to the number run. pass@1 is the per-attempt rate; pass@n answers
   * "would it have got there given n tries".
   */
  passAtK: number[];

  /** Over solved attempts only. */
  bestMovesToWin: number | null;
  avgMovesToWin: number | null;
  /** Spread of winning move counts — one lucky run is not a capability. */
  movesToWinSpread: Spread | null;

  /**
   * Mean winning length divided by the optimum. 1.0 is perfect play, 1.2 is
   * twenty percent long. Null without a baseline or without a solve.
   */
  excessRatio: number | null;

  /** How each rejected move was rejected, summed over completed attempts. */
  outcomes: OutcomeCounts;
  /**
   * How each attempt *first* went wrong — one entry per failed attempt.
   *
   * This is the honest basis for "what does this model get wrong". A rejected
   * move leaves the agent in place while the plan assumes it moved, so the
   * rest of the plan reports 'no-agent'; `outcomes` counts that cascade, and
   * a mode taken over it names the echo rather than the cause.
   */
  rootCauses: OutcomeCounts;
  /**
   * Median index of the first move the engine refused, over attempts that had
   * one. Separates "wrong from the first step" from "nearly had it".
   */
  medianFirstFailure: number | null;

  avgDurationMs: number | null;
  durationSpread: Spread | null;
  inputTokens: number;
  outputTokens: number;
  /** Only counted where the provider reports it; see TokenUsage. */
  reasoningTokens: number;
  /** Null when no rate is known for this model. */
  costUsd: number | null;
  /** Total spend divided by successes — null when nothing solved or unpriced. */
  costPerSolve: number | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function spread(values: number[]): Spread | null {
  if (values.length === 0) return null;
  const avg = sum(values) / values.length;
  const variance = sum(values.map(v => (v - avg) ** 2)) / values.length;
  return { min: Math.min(...values), max: Math.max(...values), stdDev: Math.sqrt(variance) };
}

const EMPTY_OUTCOMES: OutcomeCounts = {
  moved: 0,
  'no-agent': 0,
  'bad-direction': 0,
  illegal: 0,
  blocked: 0,
};

/**
 * Wilson score interval for a binomial proportion.
 *
 * Chosen over the textbook normal approximation because it stays inside [0,1]
 * and stays sane at the extremes — which is exactly where eval runs live:
 * 2/2 successes gives roughly 34%-100%, not the 100%-100% that a naive
 * interval reports.
 */
export function wilsonInterval(successes: number, trials: number, z = 1.96): Interval | null {
  if (trials <= 0) return null;
  const p = successes / trials;
  const denominator = 1 + (z * z) / trials;
  const centre = p + (z * z) / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials));
  return {
    low: Math.max(0, (centre - margin) / denominator),
    high: Math.min(1, (centre + margin) / denominator),
  };
}

/**
 * pass@k over the attempts actually run, for k = 1..n.
 *
 * With n independent attempts of which c succeeded, the chance that a random
 * sample of k contains no success is C(n-c, k) / C(n, k); pass@k is one minus
 * that. This is the unbiased estimator, not `1 - (1 - rate)^k`, which
 * overstates when n is small — and n is always small here.
 */
export function passAtK(successes: number, trials: number): number[] {
  if (trials <= 0) return [];
  const out: number[] = [];
  for (let k = 1; k <= trials; k++) {
    if (trials - successes < k) {
      out.push(1);
      continue;
    }
    // Product form of C(n-c, k) / C(n, k), which avoids overflowing factorials.
    let failProbability = 1;
    for (let i = 0; i < k; i++) {
      failProbability *= (trials - successes - i) / (trials - i);
    }
    out.push(1 - failProbability);
  }
  return out;
}

/**
 * Group attempts by model and compute per-model statistics.
 *
 * `optimalMoves` is the deterministic solver's answer for the level under
 * test. Pass it and every model gets an excess-over-optimal figure; omit it
 * and the move counts stand alone, which is how they were reported before a
 * baseline existed.
 */
export function summarize(
  attempts: EvalAttempt[],
  optimalMoves?: number | null,
): ModelStats[] {
  const byModel = new Map<string, EvalAttempt[]>();
  for (const attempt of attempts) {
    const list = byModel.get(attempt.modelKey);
    if (list) list.push(attempt);
    else byModel.set(attempt.modelKey, [attempt]);
  }

  const out: ModelStats[] = [];
  for (const [modelKey, group] of byModel) {
    const head = group[0];
    const done = group.filter(a => a.status === 'done');
    const errors = group.filter(a => a.status === 'error');
    const solvedAttempts = done.filter(a => a.solved);

    const proposed = done.map(a => a.proposed ?? 0);
    const failedMoves = done.map(a => a.failedMoves ?? 0);
    const totalProposed = sum(proposed);

    const winningLengths = solvedAttempts
      .map(a => a.movesToWin)
      .filter((m): m is number => typeof m === 'number');
    const avgWinningLength = mean(winningLengths);

    // Every move the engine judged, across this model's completed attempts.
    const outcomes: OutcomeCounts = { ...EMPTY_OUTCOMES };
    for (const attempt of done) {
      for (const outcome of attempt.outcomes ?? []) outcomes[outcome]++;
    }

    const firstFailures = done
      .map(a => a.firstFailureIndex)
      .filter((i): i is number => typeof i === 'number');

    const rootCauses: OutcomeCounts = { ...EMPTY_OUTCOMES };
    for (const attempt of done) {
      if (attempt.firstFailureOutcome) rootCauses[attempt.firstFailureOutcome]++;
    }

    const durations = group
      .map(a => a.durationMs)
      .filter((d): d is number => typeof d === 'number');

    const inputTokens = sum(group.map(a => a.usage?.inputTokens ?? 0));
    const outputTokens = sum(group.map(a => a.usage?.outputTokens ?? 0));
    const cost = costOf(head.providerId, head.modelId, { inputTokens, outputTokens });

    out.push({
      modelKey,
      providerId: head.providerId,
      modelId: head.modelId,
      label: head.label,

      total: group.length,
      completed: done.length,
      errors: errors.length,
      parseFailures: done.filter(a => a.parseFailed).length,

      solved: solvedAttempts.length,
      solveRate: done.length > 0 ? solvedAttempts.length / done.length : null,

      avgProposed: mean(proposed),
      avgApplied: mean(done.map(a => a.applied ?? 0)),
      avgFailedMoves: mean(failedMoves),
      illegalRate: totalProposed > 0 ? sum(failedMoves) / totalProposed : null,

      solveRateInterval: wilsonInterval(solvedAttempts.length, done.length),
      passAtK: passAtK(solvedAttempts.length, done.length),

      bestMovesToWin: winningLengths.length ? Math.min(...winningLengths) : null,
      avgMovesToWin: avgWinningLength,
      movesToWinSpread: spread(winningLengths),

      // Measured against the mean, not the best run: the point is typical
      // play, and a minimum over a handful of attempts is a lucky draw.
      excessRatio:
        typeof optimalMoves === 'number' && optimalMoves > 0 && avgWinningLength !== null
          ? avgWinningLength / optimalMoves
          : null,

      outcomes,
      rootCauses,
      medianFirstFailure: median(firstFailures),

      avgDurationMs: mean(durations),
      durationSpread: spread(durations),
      inputTokens,
      outputTokens,
      reasoningTokens: sum(group.map(a => a.usage?.reasoningTokens ?? 0)),
      costUsd: cost,
      costPerSolve: cost !== null && solvedAttempts.length > 0 ? cost / solvedAttempts.length : null,
    });
  }

  // Strongest first: solve rate, then how close typical play came to optimal,
  // then typical winning length. The tie-breaks used to be `bestMovesToWin`,
  // which ranked on whichever run got luckiest.
  // `Infinity - Infinity` is NaN, which makes a comparator silently stop
  // sorting, so missing values are ranked last explicitly instead.
  const ascending = (x: number | null, y: number | null): number => {
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return x - y;
  };

  out.sort((a, b) => {
    const rate = (b.solveRate ?? -1) - (a.solveRate ?? -1);
    if (rate !== 0) return rate;
    const excess = ascending(a.excessRatio, b.excessRatio);
    if (excess !== 0) return excess;
    return ascending(a.avgMovesToWin, b.avgMovesToWin);
  });

  return out;
}

export interface SessionTotals {
  attempts: number;
  completed: number;
  solved: number;
  errors: number;
  solveRate: number | null;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  /**
   * Total spend, counting only models with a known rate. `unpricedModels`
   * says how many were left out, so a partial total is never mistaken for
   * a complete one.
   */
  costUsd: number | null;
  unpricedModels: number;
  /** Wall-clock sum of every attempt (not elapsed time, which overlaps). */
  totalDurationMs: number;
}

export function sessionTotals(attempts: EvalAttempt[]): SessionTotals {
  const done = attempts.filter(a => a.status === 'done');
  const solved = done.filter(a => a.solved).length;

  // Grouped here rather than via summarize(), which is far heavier and gets
  // called once per row when the session history list renders.
  const byModel = new Map<string, { providerId: string; modelId: string; input: number; output: number }>();
  for (const a of attempts) {
    const entry = byModel.get(a.modelKey) ?? {
      providerId: a.providerId,
      modelId: a.modelId,
      input: 0,
      output: 0,
    };
    entry.input += a.usage?.inputTokens ?? 0;
    entry.output += a.usage?.outputTokens ?? 0;
    byModel.set(a.modelKey, entry);
  }

  let cost: number | null = null;
  let unpriced = 0;
  for (const entry of byModel.values()) {
    const modelCost = costOf(entry.providerId, entry.modelId, {
      inputTokens: entry.input,
      outputTokens: entry.output,
    });
    if (modelCost === null) unpriced++;
    else cost = (cost ?? 0) + modelCost;
  }

  return {
    attempts: attempts.length,
    completed: done.length,
    solved,
    errors: attempts.filter(a => a.status === 'error').length,
    solveRate: done.length > 0 ? solved / done.length : null,
    inputTokens: sum(attempts.map(a => a.usage?.inputTokens ?? 0)),
    outputTokens: sum(attempts.map(a => a.usage?.outputTokens ?? 0)),
    reasoningTokens: sum(attempts.map(a => a.usage?.reasoningTokens ?? 0)),
    costUsd: cost,
    unpricedModels: unpriced,
    totalDurationMs: sum(attempts.map(a => a.durationMs ?? 0)),
  };
}

export function isFinished(session: EvalSession): boolean {
  return session.attempts.every(a => a.status === 'done' || a.status === 'error');
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

export function formatNumber(value: number | null, digits = 1): string {
  if (value === null || !isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

export function formatDuration(ms: number | null): string {
  if (ms === null || !isFinite(ms)) return '—';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** A proportion range as a compact percentage band, e.g. "34-100%". */
export function formatInterval(interval: Interval | null): string {
  if (!interval) return '—';
  return `${Math.round(interval.low * 100)}–${Math.round(interval.high * 100)}%`;
}

/** Excess over optimal as a multiplier, e.g. "1.06x". */
export function formatRatio(value: number | null): string {
  if (value === null || !isFinite(value)) return '—';
  return `${value.toFixed(2)}×`;
}

/**
 * The dominant way a model's moves were rejected, for a one-word diagnosis.
 * `moved` is excluded — it is the successes, not a failure mode.
 */
export function dominantFailure(outcomes: OutcomeCounts): MoveOutcome | null {
  const failures = (Object.entries(outcomes) as [MoveOutcome, number][]).filter(
    ([outcome, count]) => outcome !== 'moved' && count > 0,
  );
  if (failures.length === 0) return null;
  return failures.sort((a, b) => b[1] - a[1])[0][0];
}

/** What each outcome means, in the fewest words that stay accurate. */
export const OUTCOME_LABELS: Record<MoveOutcome, string> = {
  moved: 'applied',
  'no-agent': 'no agent there',
  'bad-direction': 'bad direction',
  illegal: 'into a wall',
  blocked: 'precondition unmet',
};
