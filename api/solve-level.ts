// Vercel serverless function
// POST /api/solve-level { dsl, provider, model, apiKey, baseUrl?, retryContext? }
//   → { moves, usage } | { error }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  callLLM,
  buildSolveMessages,
  parseMoves,
  DEFAULT_MODEL,
  SOLVE_SYSTEM_PROMPT,
  describeEmptyResult,
  ANTHROPIC_MAX_TOKENS,
} from './_anthropic';
import type { RetryContext } from './_anthropic';

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const raw = (req.body ?? {}) as Record<string, unknown>;

  const dsl = typeof raw.dsl === 'string' ? raw.dsl : '';
  const apiKey = typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '';
  const provider = typeof raw.provider === 'string' ? raw.provider : 'anthropic';
  const model = typeof raw.model === 'string' && raw.model ? raw.model : DEFAULT_MODEL;
  const baseUrl = typeof raw.baseUrl === 'string' ? raw.baseUrl : '';
  const retryContext = raw.retryContext as RetryContext | undefined;

  if (!apiKey) {
    return res.status(401).json({ error: 'No API key provided. Add one with the "API keys" button.' });
  }
  if (!dsl) {
    return res.status(400).json({ error: 'Missing or invalid dsl field' });
  }

  const result = await callLLM({
    apiKey,
    provider,
    model,
    baseUrl,
    system: SOLVE_SYSTEM_PROMPT,
    messages: buildSolveMessages(dsl, retryContext),
    maxTokens: ANTHROPIC_MAX_TOKENS,
  });

  if (!result.ok) {
    return res.status(502).json({ error: result.message });
  }

  const moves = parseMoves(result.text);
  if (!moves) {
    // The model answered but produced no parsable move list — a format failure,
    // which the caller scores separately from a wrong plan.
    return res.status(200).json({
      moves: [],
      error: describeEmptyResult(result, 'any moves', 'No valid moves found in response'),
      raw: result.text,
      usage: result.usage,
    });
  }

  return res.status(200).json({ moves, usage: result.usage });
}
