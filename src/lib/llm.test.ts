import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANTHROPIC_MAX_TOKENS,
  DEFAULT_EFFORT,
  DEFAULT_MODEL,
  OPENAI_MAX_TOKENS,
  supportsEffort,
  VALID_DIFFICULTIES,
  VALID_FEATURES,
  buildGenerateMessages,
  buildSolveMessages,
  callLLM,
  describeEmptyResult,
  extractDsl,
  extractSummary,
  parseMoves,
  MAX_DIMENSION,
  MAX_DSL_LENGTH,
  MAX_FEEDBACK_LENGTH,
  MAX_PROMPT_LENGTH,
  MIN_DIMENSION,
  normalizeGenerateRequest,
  normalizeGenerateRetry,
  normalizeSolveRetry,
} from './llm';

const fence = (body: string) => '```\n' + body + '\n```';

describe('DEFAULT_MODEL', () => {
  it('is a concrete model id the proxy can fall back to', () => {
    expect(DEFAULT_MODEL).toMatch(/^claude-/);
    // No date suffix — the current model ids are bare.
    expect(DEFAULT_MODEL).not.toMatch(/-\d{8}$/);
  });
});

describe('parseMoves', () => {
  it('parses a fenced list of moves', () => {
    expect(parseMoves(fence('(1,1) right\n(2,1) down'))).toEqual([
      { x: 1, y: 1, direction: 'right' },
      { x: 2, y: 1, direction: 'down' },
    ]);
  });

  it('accepts all four directions', () => {
    const moves = parseMoves(fence('(0,0) up\n(0,0) down\n(0,0) left\n(0,0) right'))!;
    expect(moves.map(m => m.direction)).toEqual(['up', 'down', 'left', 'right']);
  });

  it('reads coordinates as numbers', () => {
    const [move] = parseMoves(fence('(12,34) up'))!;
    expect(move).toEqual({ x: 12, y: 34, direction: 'up' });
  });

  it('ignores a language tag on the fence', () => {
    expect(parseMoves('```text\n(1,1) right\n```')).toEqual([
      { x: 1, y: 1, direction: 'right' },
    ]);
  });

  it('skips lines that are not moves', () => {
    expect(parseMoves(fence('Here goes:\n(1,1) right\n(2,1) sideways\n'))).toEqual([
      { x: 1, y: 1, direction: 'right' },
    ]);
  });

  it('keeps the last block that contains moves', () => {
    const text = `${fence('(1,1) right')}\n\nOn reflection:\n\n${fence('(5,5) left')}`;
    expect(parseMoves(text)).toEqual([{ x: 5, y: 5, direction: 'left' }]);
  });

  it('ignores a trailing block with no valid moves', () => {
    const text = `${fence('(1,1) right')}\n\n${fence('no moves here')}`;
    expect(parseMoves(text)).toEqual([{ x: 1, y: 1, direction: 'right' }]);
  });

  it('handles CRLF inside the block', () => {
    expect(parseMoves('```\r\n(1,1) right\r\n(2,1) up\r\n```')).toEqual([
      { x: 1, y: 1, direction: 'right' },
      { x: 2, y: 1, direction: 'up' },
    ]);
  });

  it('returns null when there is no fenced block', () => {
    expect(parseMoves('Move right, then down.')).toBeNull();
  });

  it('returns null when no line in any block is a move', () => {
    expect(parseMoves(fence('I could not solve this level.'))).toBeNull();
  });
});

describe('extractDsl', () => {
  it('returns the contents of a fenced block', () => {
    expect(extractDsl(fence('level "A" 1x1'))).toBe('level "A" 1x1');
  });

  it('returns the last block when several are present', () => {
    expect(extractDsl(`${fence('first')}\ntext\n${fence('second')}`)).toBe('second');
  });

  it('ignores the language tag and trims the body', () => {
    expect(extractDsl('```dsl\n  level "A" 1x1  \n```')).toBe('level "A" 1x1');
  });

  it('keeps interior newlines', () => {
    expect(extractDsl(fence('line one\nline two'))).toBe('line one\nline two');
  });

  it('returns null when there is no fenced block', () => {
    expect(extractDsl('No code here.')).toBeNull();
  });

  // A response cut off by the output-token ceiling leaves the fence open. The
  // partial level is worth salvaging: the parser's complaint about it is far
  // more useful than "the model did not output a DSL code block".
  it('salvages a block whose closing fence never arrived', () => {
    expect(extractDsl('Here you go:\n```\nlevel "A" 9x9\ngrid = [\n  W W W,')).toBe(
      'level "A" 9x9\ngrid = [\n  W W W,',
    );
  });

  it('accepts a closing fence with no newline before it', () => {
    expect(extractDsl('```\nlevel "A" 1x1```')).toBe('level "A" 1x1');
  });

  it('is not fooled by a stray fence after the real block', () => {
    expect(extractDsl(`${fence('level "A" 1x1')}\nNotes follow.\n\`\`\`\n`)).toBe('level "A" 1x1');
  });

  it('still prefers the last complete block', () => {
    expect(extractDsl(`${fence('first')}\ntext\n${fence('second')}`)).toBe('second');
  });
});

describe('extractSummary', () => {
  // Without this, a cut-off response hands the level body back as its own
  // design notes, because the last ``` is the opening fence.
  it('returns null when the final block was never closed', () => {
    expect(extractSummary('Here:\n```\nlevel "A" 9x9\ngrid = [\n  W W W,')).toBeNull();
  });

  it('returns the prose that follows the last block', () => {
    expect(extractSummary(`${fence('level "A" 1x1')}\n\nThe key idea is the switch.`)).toBe(
      'The key idea is the switch.',
    );
  });

  it('ignores prose that precedes the block', () => {
    expect(extractSummary(`Here is the level:\n${fence('x')}\nAfterwards.`)).toBe('Afterwards.');
  });

  it('returns null when nothing follows the block', () => {
    expect(extractSummary(fence('level "A" 1x1'))).toBeNull();
  });

  it('returns null when only whitespace follows the block', () => {
    expect(extractSummary(`${fence('x')}\n\n   \n`)).toBeNull();
  });

  it('returns null when there is no fence at all', () => {
    expect(extractSummary('Just prose.')).toBeNull();
  });
});

describe('buildSolveMessages', () => {
  it('sends a single user turn containing the level', () => {
    const messages = buildSolveMessages('level "A" 1x1');
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toContain('level "A" 1x1');
  });

  it('replays the previous attempt and the feedback on retry', () => {
    const messages = buildSolveMessages('level "A" 1x1', {
      previousMovesText: '(1,1) right',
      userFeedback: 'That move hits a wall.',
    });
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(messages[1].content).toContain('(1,1) right');
    expect(messages[2].content).toContain('That move hits a wall.');
  });
});

describe('buildGenerateMessages', () => {
  const req = {
    difficulty: 'medium' as const,
    width: 8,
    height: 6,
    features: ['switches', 'doors'] as Array<(typeof VALID_FEATURES)[number]>,
    prompt: 'A maze with a hidden shortcut.',
  };

  it('states the difficulty, size, features and designer notes', () => {
    const [message] = buildGenerateMessages(req);
    expect(message.role).toBe('user');
    expect(message.content).toContain('medium difficulty');
    expect(message.content).toContain('8×6');
    expect(message.content).toContain('switches, doors');
    expect(message.content).toContain('A maze with a hidden shortcut.');
  });

  it('says no features are required when the list is empty', () => {
    const [message] = buildGenerateMessages({ ...req, features: [] });
    expect(message.content).toContain('No specific features required');
  });

  it('sends a user-driven update as one turn carrying the current DSL', () => {
    const messages = buildGenerateMessages(req, {
      previousDsl: 'level "A" 1x1',
      userFeedback: 'Make it harder.',
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toContain('Make it harder.');
    expect(messages[0].content).toContain('level "A" 1x1');
  });

  it('replays the broken level and its error on a silent retry', () => {
    const messages = buildGenerateMessages(req, {
      previousDsl: 'level "A" 1x1',
      error: 'Expected 6 grid rows, got 5',
    });
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(messages[1].content).toContain('level "A" 1x1');
    expect(messages[2].content).toContain('Expected 6 grid rows, got 5');
  });
});

describe('request vocabularies', () => {
  it('exposes the three difficulty levels', () => {
    expect([...VALID_DIFFICULTIES]).toEqual(['easy', 'medium', 'hard']);
  });

  it('lists features without duplicates', () => {
    expect(new Set(VALID_FEATURES).size).toBe(VALID_FEATURES.length);
    expect(VALID_FEATURES.length).toBeGreaterThan(0);
  });
});

describe('thinking and effort', () => {
  const base = {
    apiKey: 'test-key',
    system: 'sys',
    messages: [{ role: 'user' as const, content: 'hi' }],
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const bodyOf = (spy: ReturnType<typeof vi.fn>) =>
    JSON.parse(spy.mock.calls[0][1].body as string) as Record<string, unknown>;

  const okFetch = () =>
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }),
    });

  it('knows which models take an effort setting', () => {
    expect(supportsEffort('claude-opus-5')).toBe(true);
    expect(supportsEffort('claude-sonnet-5')).toBe(true);
    expect(supportsEffort('claude-fable-5-1')).toBe(true);
    // Pre-4.6 — sending the parameters would be rejected.
    expect(supportsEffort('claude-haiku-4-5')).toBe(false);
  });

  // On Opus 5 and Sonnet 5 thinking runs whether or not it is requested, so
  // bounding it is the only way to keep room for the answer.
  it('bounds thinking on an effort-capable model', async () => {
    const spy = okFetch();
    vi.stubGlobal('fetch', spy);

    await callLLM({ ...base, provider: 'anthropic', model: 'claude-opus-5', baseUrl: '' });

    const body = bodyOf(spy);
    expect(body.thinking).toEqual({ type: 'adaptive' });
    expect(body.output_config).toEqual({ effort: DEFAULT_EFFORT });
  });

  it('sends neither parameter to a model that would reject them', async () => {
    const spy = okFetch();
    vi.stubGlobal('fetch', spy);

    await callLLM({ ...base, provider: 'anthropic', model: 'claude-haiku-4-5', baseUrl: '' });

    const body = bodyOf(spy);
    expect(body).not.toHaveProperty('thinking');
    expect(body).not.toHaveProperty('output_config');
  });

  it('never sends budget_tokens, which the 5-series rejects outright', async () => {
    const spy = okFetch();
    vi.stubGlobal('fetch', spy);

    await callLLM({
      ...base,
      provider: 'anthropic',
      model: 'claude-opus-5',
      baseUrl: '',
      maxTokens: ANTHROPIC_MAX_TOKENS,
    });

    expect(JSON.stringify(bodyOf(spy))).not.toContain('budget_tokens');
  });

  it('leaves the Anthropic ceiling alone', async () => {
    const spy = okFetch();
    vi.stubGlobal('fetch', spy);

    await callLLM({
      ...base,
      provider: 'anthropic',
      model: 'claude-opus-5',
      baseUrl: '',
      maxTokens: ANTHROPIC_MAX_TOKENS,
    });

    expect(bodyOf(spy).max_tokens).toBe(ANTHROPIC_MAX_TOKENS);
  });

  // Raising the ceiling must not turn a working OpenAI-compatible model into
  // a 400: several of them cap output at 8192.
  it('trims the ceiling on the OpenAI-compatible path', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }),
    });
    vi.stubGlobal('fetch', spy);

    await callLLM({
      ...base,
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      baseUrl: 'https://api.groq.com/openai/v1',
      maxTokens: ANTHROPIC_MAX_TOKENS,
    });

    expect(bodyOf(spy).max_tokens).toBe(OPENAI_MAX_TOKENS);
  });
});

describe('describeEmptyResult', () => {
  const malformed = 'The model did not output a DSL code block';
  const say = (r: { text: string; truncated?: boolean; reasonedOnly?: boolean }) =>
    describeEmptyResult(r, 'the level', malformed);

  it('names reasoning as the cause when the budget went to thinking', () => {
    // The case that prompted this: 8000 output tokens, empty text.
    expect(say({ text: '', truncated: true, reasonedOnly: true })).toMatch(/internal reasoning/);
  });

  it('prefers the reasoning explanation over the plain truncation one', () => {
    // Both flags are set for a reasoning model that ran out — raising the
    // ceiling is not the remedy there, so the wording must not suggest it.
    expect(say({ text: '', truncated: true, reasonedOnly: true })).not.toMatch(/simpler request/);
  });

  it('reports a plain cut-off answer as running out of tokens', () => {
    expect(say({ text: 'Let me start by', truncated: true })).toMatch(/ran out of output tokens/);
  });

  it('reports an empty reply as empty', () => {
    expect(say({ text: '   ' })).toBe('The model returned an empty response.');
  });

  it('falls back to the caller message for a well-formed but unusable reply', () => {
    expect(say({ text: 'I think this puzzle is impossible to build.' })).toBe(malformed);
  });

  it('takes the subject from the caller, so the solver reads correctly', () => {
    expect(describeEmptyResult({ text: '', truncated: true }, 'any moves', 'no moves')).toMatch(
      /before writing any moves/,
    );
  });
});

describe('callLLM routing', () => {
  const base = {
    apiKey: 'test-key',
    model: 'some-model',
    system: 'sys',
    messages: [{ role: 'user' as const, content: 'hi' }],
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses to call an OpenAI-compatible provider with no base URL', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await callLLM({ ...base, provider: 'groq', baseUrl: '' });

    // Guarding this matters: falling back to a default endpoint would hand one
    // provider's key to a different provider.
    expect(result).toMatchObject({ ok: false, httpStatus: 400 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only base URL as missing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await callLLM({ ...base, provider: 'custom', baseUrl: '   ' });
    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts to the Anthropic endpoint for the anthropic provider', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 11, output_tokens: 3 },
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await callLLM({ ...base, provider: 'anthropic', baseUrl: '' });

    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
    expect(result).toMatchObject({ ok: true, text: 'ok', usage: { inputTokens: 11, outputTokens: 3 } });
    expect(result).toMatchObject({ truncated: false });
  });

  // Callers report a cut-off answer differently from one the model simply
  // formatted wrong, so the stop reason has to survive the call.
  it('flags an Anthropic answer stopped at the token ceiling', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'partial' }],
          stop_reason: 'max_tokens',
        }),
      }),
    );

    const result = await callLLM({ ...base, provider: 'anthropic', baseUrl: '' });
    expect(result).toMatchObject({ ok: true, truncated: true });
  });

  // The reported failure: 8000 output tokens, empty text. All of it went to
  // thinking blocks, which the old code silently skipped past.
  it('flags an Anthropic answer that was all thinking and no text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'thinking', thinking: 'long deliberation' }],
          stop_reason: 'max_tokens',
          usage: { input_tokens: 1579, output_tokens: 8000 },
        }),
      }),
    );

    const result = await callLLM({ ...base, provider: 'anthropic', baseUrl: '' });
    expect(result).toMatchObject({ ok: true, text: '', truncated: true, reasonedOnly: true });
  });

  it('joins every Anthropic text block instead of only the first', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            { type: 'thinking', thinking: 'hmm' },
            { type: 'text', text: 'part one ' },
            { type: 'text', text: 'part two' },
          ],
          stop_reason: 'end_turn',
        }),
      }),
    );

    const result = await callLLM({ ...base, provider: 'anthropic', baseUrl: '' });
    expect(result).toMatchObject({ ok: true, text: 'part one part two', reasonedOnly: false });
  });

  // OpenRouter, Groq and DeepSeek return reasoning in a sibling field and may
  // leave `content` null, which read as "the model said nothing".
  it('flags an OpenAI-compatible answer that was all reasoning', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: null, reasoning_content: 'long deliberation' },
              finish_reason: 'length',
            },
          ],
          usage: { completion_tokens: 8000 },
        }),
      }),
    );

    const result = await callLLM({
      ...base,
      provider: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
    });
    expect(result).toMatchObject({ ok: true, text: '', reasonedOnly: true });
  });

  it('flags reasoning-only from the token accounting when the field is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '' }, finish_reason: 'length' }],
          usage: { completion_tokens: 8000, completion_tokens_details: { reasoning_tokens: 7990 } },
        }),
      }),
    );

    const result = await callLLM({
      ...base,
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
    });
    expect(result).toMatchObject({ ok: true, reasonedOnly: true });
  });

  it('flags an OpenAI-compatible answer stopped at the token ceiling', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'partial' }, finish_reason: 'length' }],
        }),
      }),
    );

    const result = await callLLM({
      ...base,
      provider: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
    });
    expect(result).toMatchObject({ ok: true, truncated: true });
  });

  it('posts to the supplied base URL for an OpenAI-compatible provider', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 9, completion_tokens: 4 },
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await callLLM({
      ...base,
      provider: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1/',
    });

    // Trailing slash trimmed, not doubled.
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(result).toMatchObject({ ok: true, usage: { inputTokens: 9, outputTokens: 4 } });
  });

  it('reports a provider error without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'bad key',
    }));
    const result = await callLLM({ ...base, provider: 'anthropic', baseUrl: '' });
    expect(result).toMatchObject({ ok: false, httpStatus: 401 });
  });

  it('reports a network failure without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const result = await callLLM({ ...base, provider: 'anthropic', baseUrl: '' });
    expect(result).toMatchObject({ ok: false, httpStatus: 503, message: 'offline' });
  });
});

describe('direct browser access', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const okFetch = () =>
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }),
    });

  const headersOf = (spy: ReturnType<typeof vi.fn>) =>
    (spy.mock.calls[0][1] as { headers: Record<string, string> }).headers;

  // Without this header the API serves no Access-Control-Allow-Origin and the
  // browser discards the response before we ever see it. Verified against the
  // live endpoint: the header is what flips CORS on.
  it('opts in to browser access on the Anthropic call', async () => {
    const spy = okFetch();
    vi.stubGlobal('fetch', spy);

    await callLLM({
      apiKey: 'k',
      provider: 'anthropic',
      model: 'claude-opus-5',
      baseUrl: '',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(headersOf(spy)['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(headersOf(spy)['x-api-key']).toBe('k');
  });

  // The OpenAI-compatible providers all serve CORS for a plain bearer token,
  // so adding a vendor-specific header there would only break the preflight.
  it('sends no Anthropic-specific header to an OpenAI-compatible provider', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', spy);

    await callLLM({
      apiKey: 'k',
      provider: 'openai',
      model: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(headersOf(spy)).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer k',
    });
  });
});

describe('request hygiene', () => {
  it('clamps dimensions into the range the engine renders', () => {
    expect(normalizeGenerateRequest({ prompt: 'p', width: 999, height: 1 })).toMatchObject({
      width: MAX_DIMENSION,
      height: MIN_DIMENSION,
    });
    // Non-numeric input falls back rather than producing NaN.
    expect(normalizeGenerateRequest({ prompt: 'p', width: 'wide' })).toMatchObject({ width: 8 });
  });

  it('truncates an oversized prompt instead of spending the budget on it', () => {
    const req = normalizeGenerateRequest({ prompt: 'x'.repeat(5000) });
    expect(req.prompt).toHaveLength(MAX_PROMPT_LENGTH);
  });

  it('drops an unknown difficulty and unknown features', () => {
    const req = normalizeGenerateRequest({
      prompt: 'p',
      difficulty: 'impossible',
      features: ['doors', 'lasers', 42],
    });
    expect(req.difficulty).toBe('medium');
    expect(req.features).toEqual(['doors']);
  });

  it('caps a retry context and rejects one with no prior attempt', () => {
    const rc = normalizeGenerateRetry({
      previousDsl: 'd'.repeat(9000),
      userFeedback: 'f'.repeat(9000),
      error: 42,
    });
    expect(rc?.previousDsl).toHaveLength(MAX_DSL_LENGTH);
    expect(rc?.userFeedback).toHaveLength(MAX_FEEDBACK_LENGTH);
    expect(rc?.error).toBeUndefined();

    expect(normalizeGenerateRetry(undefined)).toBeUndefined();
    expect(normalizeGenerateRetry({ userFeedback: 'no prior dsl' })).toBeUndefined();
  });

  // The solve path used to cast this straight off the wire with no check at
  // all, so a non-string would reach the prompt as "[object Object]".
  it('caps a solve retry and ignores a non-string moves list', () => {
    const rc = normalizeSolveRetry({ previousMovesText: 'm'.repeat(9000), userFeedback: 'try again' });
    expect(rc?.previousMovesText).toHaveLength(MAX_DSL_LENGTH);
    expect(rc?.userFeedback).toBe('try again');

    expect(normalizeSolveRetry({ previousMovesText: { not: 'a string' } })).toBeUndefined();
    expect(normalizeSolveRetry(null)).toBeUndefined();
  });
});
