/**
 * Token pricing, so results can be compared on cost rather than token count.
 *
 * Raw tokens mislead across models. In one real session one model spent
 * roughly twice another's output tokens, and — at half the per-token rate —
 * the two attempts cost within a couple of cents of each other. Cost per
 * solve is the number that answers "which model should I use".
 *
 * No rates ship with the app: see BUILT_IN_PRICES. A model with no rate reads
 * as unknown and shows a dash everywhere, because a wrong price is worse than
 * no price — it produces a confident ranking out of a guess.
 */
import { modelKey } from '../providers';

/** Dollars per million tokens. */
export interface ModelPrice {
  input: number;
  output: number;
}

const STORAGE_KEY = 'loreval_model_pricing';

/** Fired when an override is set or cleared, so open tables can refresh. */
export const PRICING_CHANGED_EVENT = 'loreval:pricing-changed';

/**
 * Built-in rates, keyed by `provider:model`.
 *
 * Deliberately empty. Published rates change, vary by account, and would be
 * a snapshot frozen into the bundle the day it was written — a stale number
 * here silently skews every cost in the results table, which is worse than an
 * honest blank. Rates come from the user instead, via the pricing editor on
 * the eval page.
 *
 * Add an entry only with a rate that is both current and account-independent.
 */
export const BUILT_IN_PRICES: Record<string, ModelPrice> = {};

function readOverrides(): Record<string, ModelPrice> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, ModelPrice> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const price = value as Partial<ModelPrice>;
      if (typeof price?.input === 'number' && typeof price?.output === 'number') {
        if (price.input >= 0 && price.output >= 0) {
          out[key] = { input: price.input, output: price.output };
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeOverrides(overrides: Record<string, ModelPrice>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Storage unavailable — prices just don't persist.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PRICING_CHANGED_EVENT));
  }
}

/** The rate in force for a model, or null when nobody has supplied one. */
export function getPrice(providerId: string, modelId: string): ModelPrice | null {
  const key = modelKey(providerId, modelId);
  return readOverrides()[key] ?? BUILT_IN_PRICES[key] ?? null;
}

export function setPrice(providerId: string, modelId: string, price: ModelPrice): void {
  const overrides = readOverrides();
  overrides[modelKey(providerId, modelId)] = price;
  writeOverrides(overrides);
}

/** Drop an override, falling back to the built-in rate if there is one. */
export function clearPrice(providerId: string, modelId: string): void {
  const overrides = readOverrides();
  delete overrides[modelKey(providerId, modelId)];
  writeOverrides(overrides);
}

/** Whether a rate came from the user rather than the shipped table. */
export function isOverridden(providerId: string, modelId: string): boolean {
  return modelKey(providerId, modelId) in readOverrides();
}

/**
 * Cost in dollars for a token count, or null when the model has no rate.
 *
 * Returning null rather than 0 keeps "free" and "unpriced" apart — summing an
 * unpriced model as zero would quietly understate a session's total.
 */
export function costOf(
  providerId: string,
  modelId: string,
  tokens: { inputTokens: number; outputTokens: number },
): number | null {
  const price = getPrice(providerId, modelId);
  if (!price) return null;
  return (tokens.inputTokens * price.input + tokens.outputTokens * price.output) / 1_000_000;
}

/** Dollars, at enough precision to be useful for cents-scale runs. */
export function formatCost(value: number | null): string {
  if (value === null || !isFinite(value)) return '—';
  if (value === 0) return '$0';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}
