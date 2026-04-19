// Vercel serverless function
// POST /api/generate-level { prompt, width?, height?, difficulty?, features?, model?, retryContext? }
//   → { dsl } | { error }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  callLLM,
  buildGenerateMessages,
  extractDsl,
  extractSummary,
  GENERATE_SYSTEM_PROMPT,
  VALID_DIFFICULTIES,
  VALID_FEATURES,
} from './_anthropic';
import type { Difficulty, LevelFeature, GenerateRequest, GenerateRetryContext } from './_anthropic';

const MAX_PROMPT_LENGTH = 500;
const MIN_DIMENSION = 4;
const MAX_DIMENSION = 16;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, isFinite(n) ? n : min));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const raw = (req.body ?? {}) as Record<string, unknown>;

  const guestKey     = typeof raw.guestKey     === 'string' ? raw.guestKey.trim()     : '';
  const guestProvider = typeof raw.guestProvider === 'string' ? raw.guestProvider       : 'anthropic';
  const guestModel   = typeof raw.guestModel    === 'string' ? raw.guestModel          : 'claude-sonnet-4-6';
  const guestBaseUrl = typeof raw.guestBaseUrl  === 'string' ? raw.guestBaseUrl        : '';

  if (!guestKey) {
    return res.status(401).json({ error: 'No API key provided. Add your key via the "Add API key" button.' });
  }

  // Validate and sanitize
  const prompt =
    typeof raw.prompt === 'string' ? raw.prompt.slice(0, MAX_PROMPT_LENGTH).trim() : '';
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const genReq: GenerateRequest = {
    prompt,
    width: clamp(Number(raw.width) || 8, MIN_DIMENSION, MAX_DIMENSION),
    height: clamp(Number(raw.height) || 8, MIN_DIMENSION, MAX_DIMENSION),
    difficulty: (VALID_DIFFICULTIES as readonly string[]).includes(raw.difficulty as string)
      ? (raw.difficulty as Difficulty)
      : 'medium',
    features: Array.isArray(raw.features)
      ? raw.features.filter((f): f is LevelFeature =>
          (VALID_FEATURES as readonly string[]).includes(f as string),
        )
      : [],
  };

  // Optional retry context (truncated to prevent prompt injection / token abuse)
  const rc = raw.retryContext as Record<string, unknown> | undefined;
  const retryContext: GenerateRetryContext | undefined =
    rc != null && typeof rc.previousDsl === 'string'
      ? {
          previousDsl: String(rc.previousDsl).slice(0, 5000),
          error: typeof rc.error === 'string' ? String(rc.error).slice(0, 500) : undefined,
          userFeedback:
            typeof rc.userFeedback === 'string'
              ? String(rc.userFeedback).slice(0, 500)
              : undefined,
        }
      : undefined;

  const result = await callLLM({
    guestKey,
    guestProvider,
    guestModel,
    guestBaseUrl,
    system: GENERATE_SYSTEM_PROMPT,
    messages: buildGenerateMessages(genReq, retryContext),
    maxTokens: 3000,
  });

  if (!result.ok) {
    return res.status(502).json({ error: result.message });
  }

  const dsl = extractDsl(result.text);
  if (!dsl) {
    return res
      .status(200)
      .json({ error: 'Claude did not output a DSL code block', raw: result.text });
  }

  const summary = extractSummary(result.text);
  return res.status(200).json({ dsl, ...(summary && { summary }) });
}
