import { beforeEach, describe, expect, it } from 'vitest';
import { installLocalStorageStub } from '../../test/local-storage';
import {
  BUILT_IN_PRICES,
  clearPrice,
  costOf,
  formatCost,
  getPrice,
  isOverridden,
  setPrice,
} from './pricing';

beforeEach(() => {
  installLocalStorageStub();
});

describe('getPrice', () => {
  /**
   * No rates ship with the app on purpose. A published price baked into the
   * bundle goes stale silently and skews every cost in the results table; a
   * blank does not pretend to know.
   */
  it('ships no built-in rates', () => {
    expect(BUILT_IN_PRICES).toEqual({});
  });

  it('returns null for a model nobody has priced', () => {
    expect(getPrice('anthropic', 'claude-opus-5')).toBeNull();
    expect(getPrice('groq', 'llama-3.3-70b-versatile')).toBeNull();
  });

  it('returns a rate the user supplied', () => {
    setPrice('anthropic', 'claude-opus-5', { input: 5, output: 25 });
    expect(getPrice('anthropic', 'claude-opus-5')).toEqual({ input: 5, output: 25 });
    expect(isOverridden('anthropic', 'claude-opus-5')).toBe(true);
  });

  it('goes back to unknown when a rate is cleared', () => {
    setPrice('anthropic', 'claude-opus-5', { input: 5, output: 25 });
    clearPrice('anthropic', 'claude-opus-5');
    expect(getPrice('anthropic', 'claude-opus-5')).toBeNull();
    expect(isOverridden('anthropic', 'claude-opus-5')).toBe(false);
  });

  it('keeps rates apart per model', () => {
    setPrice('anthropic', 'claude-opus-5', { input: 5, output: 25 });
    setPrice('groq', 'llama-3.3-70b-versatile', { input: 0.59, output: 0.79 });
    expect(getPrice('anthropic', 'claude-opus-5')).toEqual({ input: 5, output: 25 });
    expect(getPrice('groq', 'llama-3.3-70b-versatile')).toEqual({ input: 0.59, output: 0.79 });
  });

  it('ignores malformed stored rates', () => {
    const store = installLocalStorageStub();
    store.loreval_model_pricing = JSON.stringify({
      'anthropic:claude-opus-5': { input: 'free', output: 25 },
      'groq:x': { input: -1, output: 1 },
    });
    expect(getPrice('anthropic', 'claude-opus-5')).toBeNull();
    expect(getPrice('groq', 'x')).toBeNull();
  });
});

describe('costOf', () => {
  /**
   * The case that motivated pricing: in a real session one model spent nearly
   * twice another's output tokens at half the rate, and the two cost about the
   * same. Token counts alone would have ranked them wrongly.
   */
  it('shows that token counts mislead across models', () => {
    setPrice('anthropic', 'model-cheap-per-token', { input: 5, output: 25 });
    setPrice('anthropic', 'model-dear-per-token', { input: 10, output: 50 });

    const chatty = costOf('anthropic', 'model-cheap-per-token', {
      inputTokens: 3346,
      outputTokens: 14936,
    })!;
    const terse = costOf('anthropic', 'model-dear-per-token', {
      inputTokens: 3350,
      outputTokens: 7723,
    })!;
    expect(Math.abs(chatty - terse)).toBeLessThan(0.05);
  });

  it('bills input and output at their own rates', () => {
    setPrice('anthropic', 'm', { input: 5, output: 25 });
    expect(costOf('anthropic', 'm', { inputTokens: 1e6, outputTokens: 1e6 })).toBeCloseTo(30);
  });

  it('returns null, not zero, for an unpriced model', () => {
    // Summing an unknown as zero would quietly understate a session total.
    expect(costOf('groq', 'llama-3.1-8b-instant', { inputTokens: 1000, outputTokens: 1000 })).toBeNull();
  });

  it('costs a zero-token attempt as zero when the rate is known', () => {
    setPrice('anthropic', 'm', { input: 5, output: 25 });
    expect(costOf('anthropic', 'm', { inputTokens: 0, outputTokens: 0 })).toBe(0);
  });
});

describe('formatCost', () => {
  it('keeps sub-cent runs legible', () => {
    expect(formatCost(0.0032)).toBe('$0.0032');
  });

  it('rounds to cents above a cent', () => {
    expect(formatCost(0.3934)).toBe('$0.39');
  });

  it('renders zero and unknown differently', () => {
    expect(formatCost(0)).toBe('$0');
    expect(formatCost(null)).toBe('—');
  });
});
