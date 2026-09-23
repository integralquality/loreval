import { describe, expect, it } from 'vitest';
import {
  dominantFailure,
  formatDuration,
  formatInterval,
  formatNumber,
  formatPercent,
  formatRatio,
  passAtK,
  sessionTotals,
  summarize,
  wilsonInterval,
} from './stats';
import { buildAttempts } from './types';
import type { EvalAttempt, EvalModelSpec } from './types';

const MODEL_A: EvalModelSpec = {
  key: 'anthropic:claude-opus-5',
  providerId: 'anthropic',
  modelId: 'claude-opus-5',
  label: 'Opus 5',
};
const MODEL_B: EvalModelSpec = {
  key: 'openai:gpt-4o',
  providerId: 'openai',
  modelId: 'gpt-4o',
  label: 'GPT-4o',
};

function done(spec: EvalModelSpec, attempt: number, over: Partial<EvalAttempt> = {}): EvalAttempt {
  return {
    id: `${spec.key}#${attempt}`,
    modelKey: spec.key,
    providerId: spec.providerId,
    modelId: spec.modelId,
    label: spec.label,
    attempt,
    status: 'done',
    solved: false,
    proposed: 10,
    applied: 8,
    failedMoves: 2,
    firstFailureIndex: 3,
    movesToWin: null,
    durationMs: 1000,
    ...over,
  };
}

describe('buildAttempts', () => {
  it('creates one pending attempt per model per run', () => {
    const attempts = buildAttempts([MODEL_A, MODEL_B], 3);
    expect(attempts).toHaveLength(6);
    expect(attempts.every(a => a.status === 'pending')).toBe(true);
    expect(attempts.filter(a => a.modelKey === MODEL_A.key).map(a => a.attempt)).toEqual([1, 2, 3]);
  });

  it('gives every attempt a unique id', () => {
    const ids = buildAttempts([MODEL_A, MODEL_B], 2).map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('summarize', () => {
  it('computes the solve rate over completed attempts', () => {
    const stats = summarize([
      done(MODEL_A, 1, { solved: true, movesToWin: 6 }),
      done(MODEL_A, 2, { solved: false }),
      done(MODEL_A, 3, { solved: true, movesToWin: 8 }),
    ]);
    expect(stats).toHaveLength(1);
    expect(stats[0].solved).toBe(2);
    expect(stats[0].completed).toBe(3);
    expect(stats[0].solveRate).toBeCloseTo(2 / 3);
  });

  it('excludes transport errors from the solve rate and counts them apart', () => {
    const stats = summarize([
      done(MODEL_A, 1, { solved: true, movesToWin: 5 }),
      { ...done(MODEL_A, 2), status: 'error', error: 'rate limited' },
    ]);
    expect(stats[0].total).toBe(2);
    expect(stats[0].completed).toBe(1);
    expect(stats[0].errors).toBe(1);
    expect(stats[0].solveRate).toBe(1);
  });

  it('counts unparsable responses separately from wrong plans', () => {
    const stats = summarize([
      done(MODEL_A, 1, { parseFailed: true, proposed: 0, applied: 0, failedMoves: 0 }),
      done(MODEL_A, 2, { solved: false }),
    ]);
    expect(stats[0].parseFailures).toBe(1);
    expect(stats[0].completed).toBe(2);
    expect(stats[0].solveRate).toBe(0);
  });

  it('derives the illegal-move rate from totals, not per-attempt averages', () => {
    const stats = summarize([
      done(MODEL_A, 1, { proposed: 10, failedMoves: 1 }),
      done(MODEL_A, 2, { proposed: 30, failedMoves: 9 }),
    ]);
    expect(stats[0].illegalRate).toBeCloseTo(10 / 40);
  });

  it('reports best and average moves to win over solved attempts only', () => {
    const stats = summarize([
      done(MODEL_A, 1, { solved: true, movesToWin: 12 }),
      done(MODEL_A, 2, { solved: true, movesToWin: 8 }),
      done(MODEL_A, 3, { solved: false, movesToWin: null }),
    ]);
    expect(stats[0].bestMovesToWin).toBe(8);
    expect(stats[0].avgMovesToWin).toBe(10);
  });

  it('sums token usage across attempts', () => {
    const stats = summarize([
      done(MODEL_A, 1, { usage: { inputTokens: 100, outputTokens: 20 } }),
      done(MODEL_A, 2, { usage: { inputTokens: 150, outputTokens: 30 } }),
    ]);
    expect(stats[0].inputTokens).toBe(250);
    expect(stats[0].outputTokens).toBe(50);
  });

  it('groups by model and ranks the stronger model first', () => {
    const stats = summarize([
      done(MODEL_A, 1, { solved: false }),
      done(MODEL_B, 1, { solved: true, movesToWin: 7 }),
    ]);
    expect(stats.map(s => s.modelKey)).toEqual([MODEL_B.key, MODEL_A.key]);
  });

  it('breaks a solve-rate tie by typical moves to win', () => {
    const stats = summarize([
      done(MODEL_A, 1, { solved: true, movesToWin: 20 }),
      done(MODEL_B, 1, { solved: true, movesToWin: 9 }),
    ]);
    expect(stats[0].modelKey).toBe(MODEL_B.key);
  });

  it('returns nulls rather than NaN when nothing completed', () => {
    const stats = summarize([{ ...done(MODEL_A, 1), status: 'error', error: 'boom' }]);
    expect(stats[0].solveRate).toBeNull();
    expect(stats[0].avgProposed).toBeNull();
    expect(stats[0].illegalRate).toBeNull();
    expect(stats[0].bestMovesToWin).toBeNull();
  });

  it('returns an empty list for no attempts', () => {
    expect(summarize([])).toEqual([]);
  });
});

describe('sessionTotals', () => {
  it('aggregates across every model', () => {
    const totals = sessionTotals([
      done(MODEL_A, 1, { solved: true, movesToWin: 5, usage: { inputTokens: 10, outputTokens: 5 } }),
      done(MODEL_B, 1, { solved: false, usage: { inputTokens: 20, outputTokens: 7 } }),
      { ...done(MODEL_B, 2), status: 'error', error: 'nope' },
    ]);
    expect(totals.attempts).toBe(3);
    expect(totals.completed).toBe(2);
    expect(totals.solved).toBe(1);
    expect(totals.errors).toBe(1);
    expect(totals.solveRate).toBe(0.5);
    expect(totals.inputTokens).toBe(30);
    expect(totals.outputTokens).toBe(12);
  });

  it('handles an empty session', () => {
    const totals = sessionTotals([]);
    expect(totals.attempts).toBe(0);
    expect(totals.solveRate).toBeNull();
  });
});

describe('formatters', () => {
  it('renders percentages and em-dashes for missing values', () => {
    expect(formatPercent(0.666)).toBe('67%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(null)).toBe('—');
  });

  it('keeps integers whole and rounds fractions', () => {
    expect(formatNumber(12)).toBe('12');
    expect(formatNumber(12.345)).toBe('12.3');
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(Infinity)).toBe('—');
  });

  it('switches from milliseconds to seconds', () => {
    expect(formatDuration(420)).toBe('420ms');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(null)).toBe('—');
  });
});

describe('wilsonInterval', () => {
  /**
   * The reason this exists: a table showing "2/2 = 100%" implies a certainty
   * the sample cannot support. The interval says so out loud.
   */
  it('does not claim certainty from two successes out of two', () => {
    const interval = wilsonInterval(2, 2)!;
    expect(interval.high).toBe(1);
    expect(interval.low).toBeGreaterThan(0.3);
    expect(interval.low).toBeLessThan(0.4);
  });

  it('narrows as the sample grows', () => {
    const few = wilsonInterval(5, 10)!;
    const many = wilsonInterval(50, 100)!;
    expect(many.high - many.low).toBeLessThan(few.high - few.low);
  });

  it('stays inside [0,1] at the extremes', () => {
    const none = wilsonInterval(0, 3)!;
    const all = wilsonInterval(3, 3)!;
    expect(none.low).toBe(0);
    expect(all.high).toBe(1);
  });

  it('returns null with no trials', () => {
    expect(wilsonInterval(0, 0)).toBeNull();
  });
});

describe('passAtK', () => {
  it('starts at the per-attempt rate', () => {
    expect(passAtK(1, 4)[0]).toBeCloseTo(0.25);
  });

  it('reaches certainty once k covers every failure', () => {
    // 1 success in 4: any sample of 4 must include it.
    expect(passAtK(1, 4)[3]).toBe(1);
  });

  it('stays at zero when nothing succeeded', () => {
    expect(passAtK(0, 3)).toEqual([0, 0, 0]);
  });

  it('is monotonically non-decreasing in k', () => {
    const curve = passAtK(2, 5);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
    }
  });

  it('uses the unbiased estimator, not 1-(1-rate)^k', () => {
    // 1 success in 2 attempts. The naive form gives 0.75 at k=2; the true
    // answer is 1, because a sample of 2 from 2 always contains the success.
    expect(passAtK(1, 2)[1]).toBe(1);
  });
});

describe('failure taxonomy', () => {
  it('counts how each move was rejected, not just how many', () => {
    const stats = summarize([
      done(MODEL_A, 1, {
        outcomes: ['moved', 'blocked', 'no-agent', 'no-agent'],
      }),
      done(MODEL_A, 2, { outcomes: ['illegal', 'moved'] }),
    ]);
    expect(stats[0].outcomes).toEqual({
      moved: 2,
      blocked: 1,
      'no-agent': 2,
      illegal: 1,
      'bad-direction': 0,
    });
  });

  it('names the dominant failure mode', () => {
    expect(dominantFailure({ moved: 9, blocked: 1, 'no-agent': 4, illegal: 0, 'bad-direction': 0 }))
      .toBe('no-agent');
  });

  it('ignores successes when naming the dominant failure', () => {
    // `moved` is the largest count but is not a failure.
    expect(dominantFailure({ moved: 99, blocked: 2, 'no-agent': 0, illegal: 0, 'bad-direction': 0 }))
      .toBe('blocked');
  });

  it('reports no dominant failure for a clean run', () => {
    expect(dominantFailure({ moved: 5, blocked: 0, 'no-agent': 0, illegal: 0, 'bad-direction': 0 }))
      .toBeNull();
  });

  it('takes the median first failure over attempts that had one', () => {
    const stats = summarize([
      done(MODEL_A, 1, { firstFailureIndex: 2 }),
      done(MODEL_A, 2, { firstFailureIndex: 20 }),
      done(MODEL_A, 3, { firstFailureIndex: 8 }),
      done(MODEL_A, 4, { firstFailureIndex: null, solved: true, movesToWin: 5 }),
    ]);
    expect(stats[0].medianFirstFailure).toBe(8);
  });
});

describe('excess over optimal', () => {
  it('measures typical play against the baseline', () => {
    const stats = summarize(
      [
        done(MODEL_A, 1, { solved: true, movesToWin: 22 }),
        done(MODEL_A, 2, { solved: true, movesToWin: 18 }),
      ],
      20,
    );
    // Mean of 22 and 18 is 20, exactly optimal.
    expect(stats[0].excessRatio).toBeCloseTo(1);
  });

  it('uses the mean rather than the best run', () => {
    const stats = summarize(
      [
        done(MODEL_A, 1, { solved: true, movesToWin: 10 }),
        done(MODEL_A, 2, { solved: true, movesToWin: 30 }),
      ],
      10,
    );
    // Best would flatter this model at 1.0; typical play is twice optimal.
    expect(stats[0].excessRatio).toBeCloseTo(2);
    expect(stats[0].bestMovesToWin).toBe(10);
  });

  it('is null without a baseline', () => {
    const stats = summarize([done(MODEL_A, 1, { solved: true, movesToWin: 12 })]);
    expect(stats[0].excessRatio).toBeNull();
  });

  it('is null when nothing solved', () => {
    expect(summarize([done(MODEL_A, 1, { solved: false })], 20)[0].excessRatio).toBeNull();
  });

  it('ranks closer-to-optimal first when solve rates tie', () => {
    const stats = summarize(
      [
        done(MODEL_A, 1, { solved: true, movesToWin: 40 }),
        done(MODEL_B, 1, { solved: true, movesToWin: 21 }),
      ],
      20,
    );
    expect(stats[0].modelKey).toBe(MODEL_B.key);
  });
});

describe('spread', () => {
  it('reports the range and deviation of winning lengths', () => {
    const stats = summarize([
      done(MODEL_A, 1, { solved: true, movesToWin: 10 }),
      done(MODEL_A, 2, { solved: true, movesToWin: 20 }),
    ]);
    expect(stats[0].movesToWinSpread).toEqual({ min: 10, max: 20, stdDev: 5 });
  });

  it('reports zero deviation for a single sample', () => {
    const stats = summarize([done(MODEL_A, 1, { durationMs: 274600 })]);
    expect(stats[0].durationSpread).toEqual({ min: 274600, max: 274600, stdDev: 0 });
  });

  it('is null when nothing solved', () => {
    expect(summarize([done(MODEL_A, 1, { solved: false })])[0].movesToWinSpread).toBeNull();
  });
});

describe('formatters for the new columns', () => {
  it('renders an interval as a percentage band', () => {
    expect(formatInterval({ low: 0.342, high: 1 })).toBe('34–100%');
    expect(formatInterval(null)).toBe('—');
  });

  it('renders excess as a multiplier', () => {
    expect(formatRatio(1.0588)).toBe('1.06×');
    expect(formatRatio(null)).toBe('—');
  });
});

describe('root causes', () => {
  /**
   * Haiku's real session showed 75% of moves rejected, dominated by
   * "no agent there" — but that was the cascade from one early mistake. The
   * root cause is what the model actually got wrong.
   */
  it('counts one root cause per failed attempt, not per rejected move', () => {
    const stats = summarize([
      done(MODEL_A, 1, {
        firstFailureOutcome: 'illegal',
        outcomes: ['illegal', 'no-agent', 'no-agent', 'no-agent'],
      }),
      done(MODEL_A, 2, {
        firstFailureOutcome: 'blocked',
        outcomes: ['moved', 'blocked', 'no-agent'],
      }),
    ]);
    expect(stats[0].rootCauses).toEqual({
      moved: 0,
      illegal: 1,
      blocked: 1,
      'no-agent': 0,
      'bad-direction': 0,
    });
    // The full tally still shows the cascade, for contrast.
    expect(stats[0].outcomes['no-agent']).toBe(4);
  });

  it('names a different dominant failure than the raw tally would', () => {
    const stats = summarize([
      done(MODEL_A, 1, {
        firstFailureOutcome: 'illegal',
        outcomes: ['illegal', 'no-agent', 'no-agent', 'no-agent'],
      }),
    ]);
    expect(dominantFailure(stats[0].rootCauses)).toBe('illegal');
    expect(dominantFailure(stats[0].outcomes)).toBe('no-agent');
  });

  it('records nothing for an attempt that never failed', () => {
    const stats = summarize([
      done(MODEL_A, 1, { solved: true, movesToWin: 5, firstFailureOutcome: null }),
    ]);
    expect(Object.values(stats[0].rootCauses).every(n => n === 0)).toBe(true);
  });
});
