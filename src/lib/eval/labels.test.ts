import { beforeEach, describe, expect, it } from 'vitest';
import { installLocalStorageStub } from '../../test/local-storage';
import { costLabel } from './labels';

beforeEach(() => {
  installLocalStorageStub();
});

describe('costLabel', () => {
  /**
   * The regression this covers: the cost chart printed cost-per-solve beside
   * a bar whose length was total spend, so the same model read $0.17 in the
   * chart and $0.50 in the table. The number next to a bar has to label that
   * bar, so spend leads and per solve follows in brackets.
   */
  it('leads with spend, which is what the bar encodes', () => {
    expect(costLabel({ costUsd: 0.504, costPerSolve: 0.168, solved: 3 })).toBe('$0.50 ($0.17)');
  });

  it('omits the bracket when nothing solved', () => {
    // Cost per solve is undefined there, not zero.
    expect(costLabel({ costUsd: 0.0188, costPerSolve: null, solved: 0 })).toBe('$0.02');
  });

  it('shows a dash for an unpriced model', () => {
    expect(costLabel({ costUsd: null, costPerSolve: null, solved: 2 })).toBe('—');
  });

  it('repeats the figure when a single solve makes them equal', () => {
    // Sonnet 5's real row: one solve, so spend and cost-per-solve coincide.
    // The coincidence is what hid the bug, so it is worth pinning.
    expect(costLabel({ costUsd: 0.558, costPerSolve: 0.558, solved: 1 })).toBe('$0.56 ($0.56)');
  });

  it('keeps sub-cent spends legible in both figures', () => {
    expect(costLabel({ costUsd: 0.0032, costPerSolve: 0.0016, solved: 2 })).toBe(
      '$0.0032 ($0.0016)',
    );
  });
});
