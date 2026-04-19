// Vercel serverless function
// POST /api/solve-level { dsl, retryContext?, model? } → { moves } | { error }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  callLLM,
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

  const { dsl, retryContext, guestKey, guestProvider, guestModel, guestBaseUrl } = (req.body ?? {}) as {
    dsl?: string;
    retryContext?: RetryContext;
    guestKey?: string;
    guestProvider?: string;
    guestModel?: string;
    guestBaseUrl?: string;
  };

  if (!guestKey?.trim()) {
    return res.status(401).json({ error: 'No API key provided. Add your key via the "Add API key" button.' });
  }
  if (!dsl || typeof dsl !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid dsl field' });
  }

  const result = await callLLM({
    guestKey: guestKey.trim(),
    guestProvider: guestProvider ?? 'anthropic',
    guestModel: guestModel ?? 'claude-sonnet-4-6',
    guestBaseUrl: guestBaseUrl ?? '',
    system: SOLVE_SYSTEM_PROMPT,
    messages: buildSolveMessages(dsl, retryContext),
    maxTokens: 8000,
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
