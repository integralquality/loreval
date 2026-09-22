import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber, formatPercent, sessionTotals, summarize } from './stats';
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

  it('breaks a solve-rate tie by fewest moves to win', () => {
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
