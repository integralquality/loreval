import { parseDSL } from '../dsl/parser';
import type { Level } from '../types';
import { defaultModelSelection, resolveModelSelection } from './credentials';
import type { ModelSelection } from './ai-solver';

// ─── Public types ─────────────────────────────────────────────────────────────

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const FEATURES = [
  { id: 'switches',    label: 'Switches'  },
  { id: 'doors',       label: 'Doors'     },
  { id: 'paint',       label: 'Paint'     },
  { id: 'one-way',     label: 'One-way'   },
  { id: 'locks',       label: 'Locks'     },
  { id: 'multi-agent', label: '2+ Agents' },
] as const;
export type LevelFeature = (typeof FEATURES)[number]['id'];

export const PRESET_SIZES = [
  { label: '6×6',   width: 6,  height: 6  },
  { label: '8×8',   width: 8,  height: 8  },
  { label: '10×10', width: 10, height: 10 },
  { label: '12×12', width: 12, height: 12 },
] as const;

export interface GenerateOptions {
  prompt: string;
  width?: number;
  height?: number;
  difficulty?: Difficulty;
  features?: LevelFeature[];
  model?: ModelSelection;
  /** Passed automatically by useAiGeneration on retry. */
  retryContext?: { previousDsl: string; error?: string; userFeedback?: string };
}

export type GenerateSuccess = { ok: true; level: Level; dsl: string; summary?: string };
export type GenerateFailure = {
  ok: false;
  error: string;
  /** The DSL the model produced, when it produced some but it didn't parse. */
  rawDsl?: string;
  /** The model's full reply, when no DSL block could be found in it at all. */
  rawResponse?: string;
};
export type GenerateResult = GenerateSuccess | GenerateFailure;

// ─── Core function ────────────────────────────────────────────────────────────

export async function generateLevel(opts: GenerateOptions): Promise<GenerateResult> {
  const chosen = opts.model ?? defaultModelSelection();
  if (!chosen) {
    return { ok: false, error: 'No API key configured. Add one with the "API keys" button.' };
  }
  const resolved = resolveModelSelection(chosen);
  if (!resolved) {
    return { ok: false, error: `No API key for the selected model (${chosen}).` };
  }

  let res: Response;
  try {
    res = await fetch('/api/generate-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...opts,
        provider: resolved.providerId,
        model: resolved.modelId,
        apiKey: resolved.key,
        baseUrl: resolved.baseUrl,
      }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }

  const data = (await res.json()) as {
    dsl?: string;
    summary?: string;
    error?: string;
    raw?: string;
  };

  if (!res.ok || !data.dsl) {
    return {
      ok: false,
      error: data.error ?? `Request failed (${res.status})`,
      rawResponse: data.raw,
    };
  }

  const parsed = parseDSL(data.dsl);
  if (!parsed.level) {
    const errorMsg = parsed.errors.map((e) => e.message).join('; ');
    return { ok: false, error: errorMsg, rawDsl: data.dsl };
  }

  return { ok: true, level: parsed.level, dsl: data.dsl, summary: data.summary };
}

export type { ModelSelection };
