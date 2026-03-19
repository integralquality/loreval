// Vercel serverless function
// POST /api/solve-level { dsl, retryContext?, model? } → { moves } | { error }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  callAnthropic,
  resolveModel,
  buildSolveMessages,
  parseMoves,
  SOLVE_SYSTEM_PROMPT,
} from './_anthropic';
import type { RetryContext } from './_anthropic';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
  }

  const { dsl, retryContext, model } = (req.body ?? {}) as {
    dsl?: string;
    retryContext?: RetryContext;
    model?: string;
  };

  if (!dsl || typeof dsl !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid dsl field' });
  }

  const result = await callAnthropic({
    apiKey,
    model: resolveModel(model),
    system: SOLVE_SYSTEM_PROMPT,
    messages: buildSolveMessages(dsl, retryContext),
  });

  if (!result.ok) {
    return res.status(502).json({ error: result.message });
  }

  const moves = parseMoves(result.text);
  if (!moves) {
    return res
      .status(200)
      .json({ moves: [], error: 'No valid moves found in response', raw: result.text });
  }

  return res.status(200).json({ moves });
}
