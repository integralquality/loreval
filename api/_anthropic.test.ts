import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MODEL,
  VALID_DIFFICULTIES,
  VALID_FEATURES,
  buildGenerateMessages,
  buildSolveMessages,
  callLLM,
  extractDsl,
  extractSummary,
  parseMoves,
} from './_anthropic';

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
});

describe('extractSummary', () => {
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
