import { parseDSL } from '../dsl/parser';
import type { Level } from '../types';
import { AI_MODELS } from './ai-solver';
import type { AiModelId } from './ai-solver';
import { getGuestKey } from './guestKey';

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
  model?: AiModelId;
  /** Passed automatically by useAiGeneration on retry. */
  retryContext?: { previousDsl: string; error?: string; userFeedback?: string };
}

export type GenerateSuccess = { ok: true; level: Level; dsl: string; summary?: string };
export type GenerateFailure = { ok: false; error: string; rawDsl?: string };
export type GenerateResult = GenerateSuccess | GenerateFailure;

// ─── Core function ────────────────────────────────────────────────────────────

export async function generateLevel(opts: GenerateOptions): Promise<GenerateResult> {
  let res: Response;
  try {
    res = await fetch('/api/generate-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...opts, guestKey: getGuestKey() }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }

  const data = (await res.json()) as { dsl?: string; summary?: string; error?: string };

  if (!res.ok || !data.dsl) {
    return { ok: false, error: data.error ?? `Request failed (${res.status})` };
  }

  const parsed = parseDSL(data.dsl);
  if (!parsed.level) {
    const errorMsg = parsed.errors.map((e) => e.message).join('; ');
    return { ok: false, error: errorMsg, rawDsl: data.dsl };
  }

  return { ok: true, level: parsed.level, dsl: data.dsl, summary: data.summary };
}

// Re-export for convenience in the UI layer
export { AI_MODELS };
export type { AiModelId };
