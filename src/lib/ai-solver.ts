import { defaultModelSelection, resolveModelSelection } from './credentials';
import { directionToDelta, type AiMove } from './moves';
import {
  ANTHROPIC_MAX_TOKENS,
  MAX_DSL_LENGTH,
  SOLVE_SYSTEM_PROMPT,
  buildSolveMessages,
  callLLM,
  describeEmptyResult,
  normalizeSolveRetry,
  parseMoves,
} from './llm';
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

/**
 * Ask a model to solve a level.
 *
 * `selection` names which configured model to use; when omitted the first
 * available one is used. Credentials are resolved per call, so an eval can run
 * several providers side by side.
 *
 * The request goes from this tab straight to the provider — there is no
 * intermediary, so nothing here can outlive the call or be metered by us.
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

  const result = await callLLM({
    apiKey: resolved.key,
    provider: resolved.providerId,
    model: resolved.modelId,
    baseUrl: resolved.baseUrl,
    system: SOLVE_SYSTEM_PROMPT,
    messages: buildSolveMessages(dsl.slice(0, MAX_DSL_LENGTH), normalizeSolveRetry(retryContext)),
    maxTokens: ANTHROPIC_MAX_TOKENS,
  });

  if (!result.ok) {
    return { moves: [], error: result.message };
  }

  const moves = parseMoves(result.text);
  if (!moves) {
    // The model answered but produced no parsable move list — a format
    // failure, which the caller scores separately from a wrong plan.
    return {
      moves: [],
      error: describeEmptyResult(result, 'any moves', 'No valid moves found in response'),
      parseFailed: true,
      usage: result.usage,
      raw: result.text,
    };
  }

  return { moves, usage: result.usage };
}
