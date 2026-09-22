import { defaultModelSelection, resolveModelSelection } from './credentials';
import { directionToDelta, type AiMove } from './moves';
import type { TokenUsage } from './eval/types';

export type { AiMove };
export { directionToDelta };

export interface RetryContext {
  previousMovesText: string;
  userFeedback: string;
}

/** A `provider:model` key from `credentials.availableModels()`. */
export type ModelSelection = string;

export interface SolveResult {
  moves: AiMove[];
  error?: string;
  /** Set when the model answered but no move list could be parsed out. */
  parseFailed?: boolean;
  usage?: TokenUsage;
  raw?: string;
}

interface ApiResponse {
  moves?: AiMove[];
  error?: string;
  raw?: string;
  usage?: TokenUsage;
}

/**
 * Ask a model to solve a level.
 *
 * `selection` names which configured model to use; when omitted the first
 * available one is used. Credentials are resolved per call, so an eval can run
 * several providers side by side.
 */
export async function solveLevel(
  dsl: string,
  retryContext?: RetryContext,
  selection?: ModelSelection,
): Promise<SolveResult> {
  const chosen = selection ?? defaultModelSelection();
  if (!chosen) {
    return { moves: [], error: 'No API key configured. Add one with the "API keys" button.' };
  }

  const resolved = resolveModelSelection(chosen);
  if (!resolved) {
    return { moves: [], error: `No API key for the selected model (${chosen}).` };
  }

  let res: Response;
  try {
    res = await fetch('/api/solve-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dsl,
        retryContext,
        provider: resolved.providerId,
        model: resolved.modelId,
        apiKey: resolved.key,
        baseUrl: resolved.baseUrl,
      }),
    });
  } catch (err) {
    return { moves: [], error: err instanceof Error ? err.message : 'Network error' };
  }

  let data: ApiResponse;
  try {
    data = (await res.json()) as ApiResponse;
  } catch {
    return { moves: [], error: `Request failed (${res.status})` };
  }

  if (!res.ok) {
    return { moves: [], error: data.error ?? `Request failed (${res.status})`, usage: data.usage };
  }

  const moves = data.moves ?? [];
  if (data.error) {
    // The call succeeded but the response held no usable move list.
    return { moves, error: data.error, parseFailed: true, usage: data.usage, raw: data.raw };
  }

  return { moves, usage: data.usage };
}
