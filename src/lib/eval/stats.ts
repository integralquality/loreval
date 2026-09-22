/**
 * Aggregation over eval attempts. Pure functions — no storage, no network.
 *
 * Two deliberate distinctions run through all of this:
 *   - a transport/auth failure is NOT a wrong answer, so it is excluded from
 *     the solve rate and reported separately as `errors`;
 *   - a response we couldn't parse into moves is a *format* failure, tracked
 *     apart from planning failures so one doesn't hide the other.
 */
import type { EvalAttempt, EvalSession } from './types';

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

  /** Over solved attempts only. */
  bestMovesToWin: number | null;
  avgMovesToWin: number | null;

  avgDurationMs: number | null;
  inputTokens: number;
  outputTokens: number;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Group attempts by model and compute per-model statistics. */
export function summarize(attempts: EvalAttempt[]): ModelStats[] {
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

      bestMovesToWin: solvedAttempts.length
        ? Math.min(...solvedAttempts.map(a => a.movesToWin ?? Infinity))
        : null,
      avgMovesToWin: mean(
        solvedAttempts.map(a => a.movesToWin).filter((m): m is number => typeof m === 'number'),
      ),

      avgDurationMs: mean(
        group.map(a => a.durationMs).filter((d): d is number => typeof d === 'number'),
      ),
      inputTokens: sum(group.map(a => a.usage?.inputTokens ?? 0)),
      outputTokens: sum(group.map(a => a.usage?.outputTokens ?? 0)),
    });
  }

  // Strongest first: solve rate, then fewest moves to win.
  out.sort((a, b) => {
    const rate = (b.solveRate ?? -1) - (a.solveRate ?? -1);
    if (rate !== 0) return rate;
    return (a.bestMovesToWin ?? Infinity) - (b.bestMovesToWin ?? Infinity);
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
  /** Wall-clock sum of every attempt (not elapsed time, which overlaps). */
  totalDurationMs: number;
}

export function sessionTotals(attempts: EvalAttempt[]): SessionTotals {
  const done = attempts.filter(a => a.status === 'done');
  const solved = done.filter(a => a.solved).length;
  return {
    attempts: attempts.length,
    completed: done.length,
    solved,
    errors: attempts.filter(a => a.status === 'error').length,
    solveRate: done.length > 0 ? solved / done.length : null,
    inputTokens: sum(attempts.map(a => a.usage?.inputTokens ?? 0)),
    outputTokens: sum(attempts.map(a => a.usage?.outputTokens ?? 0)),
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
