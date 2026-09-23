/**
 * Shared Anthropic API utilities.
 * Imported by all /api/* serverless functions and the Vite dev middleware.
 *
 * ⚠️  Node.js only — no browser APIs.
 */

// ─── Models ───────────────────────────────────────────────────────────────────

/**
 * Fallback when a request names no model. The selectable catalog lives in
 * `src/lib/providers.ts` — the client owns it, so there is one list to keep
 * current instead of two that drift apart.
 */
export const DEFAULT_MODEL = 'claude-sonnet-5';

/**
 * Models that accept `thinking: {type:'adaptive'}` and `output_config.effort`.
 *
 * This matters because on Opus 5 and Sonnet 5 **thinking is on whether or not
 * we ask for it** — omitting the parameter runs adaptive. Left unbounded, a
 * hard prompt can spend the entire `max_tokens` budget thinking and return no
 * text at all. Naming an effort level puts a ceiling on that without turning
 * thinking off, which matters here: an eval instrument that silently disabled
 * reasoning would be measuring the wrong thing.
 *
 * Deliberately excludes Haiku 4.5 and anything older, which predate adaptive
 * thinking and would reject both parameters.
 */
const EFFORT_CAPABLE = /^claude-(opus-5|sonnet-5|fable-5)/;

export function supportsEffort(model: string): boolean {
  return EFFORT_CAPABLE.test(model);
}

/**
 * How hard an effort-capable model should think. `medium` leaves clear room
 * for the answer inside our token budget; `high` and above regularly consume
 * the whole thing on a "make it complex" prompt.
 */
export const DEFAULT_EFFORT = 'medium';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CallParams {
  apiKey: string;
  model: string;
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  /**
   * Thinking/reasoning tokens where the provider reports them. The Anthropic
   * API folds thinking into `output_tokens` and publishes no separate count,
   * so this is left undefined there rather than estimated.
   */
  reasoningTokens?: number;
}

export type CallResult =
  | {
      ok: true;
      text: string;
      usage?: TokenUsage;
      /**
       * The model hit the output-token ceiling mid-answer. The text is a
       * fragment, so a missing code block means "cut off", not "refused" —
       * callers report those differently.
       */
      truncated?: boolean;
      /**
       * The model produced output but none of it was the answer — the budget
       * went entirely on thinking/reasoning content. Distinct from `truncated`
       * alone, because raising the ceiling is the fix for one and a different
       * model is usually the fix for the other.
       */
      reasonedOnly?: boolean;
    }
  | { ok: false; httpStatus: number; message: string };

// ─── Provider routing ─────────────────────────────────────────────────────────

export interface ProviderCallParams {
  apiKey: string;
  /** Provider id from the client catalog; 'anthropic' uses the native API. */
  provider: string;
  model: string;
  /** Required for OpenAI-compatible providers. */
  baseUrl: string;
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
}

export async function callLLM(params: ProviderCallParams): Promise<CallResult> {
  const { apiKey, provider, model, baseUrl, system, messages, maxTokens } = params;
  if (provider === 'anthropic') {
    return callAnthropic({ apiKey, model: model || DEFAULT_MODEL, system, messages, maxTokens });
  }
  // OpenAI-compatible (OpenAI, Google, Groq, OpenRouter, Ollama, custom).
  // Never guess a base URL here: defaulting to one provider's endpoint would
  // send another provider's key to it.
  const url = baseUrl.trim().replace(/\/$/, '');
  if (!url) {
    return {
      ok: false,
      httpStatus: 400,
      message: `No base URL supplied for provider "${provider}".`,
    };
  }
  // Several OpenAI-compatible models top out at 8192 output tokens and reject
  // anything larger outright, so the generous Anthropic ceiling is trimmed
  // here rather than turning a working model into a 400.
  const capped = maxTokens === undefined ? undefined : Math.min(maxTokens, OPENAI_MAX_TOKENS);
  return callOpenAI({ apiKey, baseUrl: url, model, system, messages, maxTokens: capped });
}

/** Ceiling for the OpenAI-compatible path — see the note in `callLLM`. */
export const OPENAI_MAX_TOKENS = 8000;

/**
 * Output ceiling for a solve or generate call.
 *
 * Thinking tokens count against this, so it has to cover the reasoning *and*
 * the answer. 8000 was not enough: a "make it complex and tricky" prompt spent
 * all of it thinking and returned no text. Paired with `DEFAULT_EFFORT`, this
 * leaves the answer plenty of room.
 */
export const ANTHROPIC_MAX_TOKENS = 32000;

// ─── Anthropic API call ───────────────────────────────────────────────────────

export async function callAnthropic(params: CallParams): Promise<CallResult> {
  const { apiKey, model, system, messages, maxTokens = 2048 } = params;

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages,
        // Sent explicitly rather than relying on the default, so the budget is
        // predictable across models that differ on whether thinking is on.
        ...(supportsEffort(model)
          ? { thinking: { type: 'adaptive' }, output_config: { effort: DEFAULT_EFFORT } }
          : {}),
      }),
    });
  } catch (err) {
    return {
      ok: false,
      httpStatus: 503,
      message: err instanceof Error ? err.message : 'Network error reaching Anthropic',
    };
  }

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      httpStatus: response.status,
      message: `Anthropic API error ${response.status}: ${body}`,
    };
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const blocks = data.content ?? [];
  // Join every text block rather than taking the first: a reply that carries
  // thinking blocks puts the answer in a later one, and a long answer can be
  // split across several.
  const text = blocks
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
    .join('');
  return {
    ok: true,
    text,
    truncated: data.stop_reason === 'max_tokens',
    // Whether the model produced anything at all that wasn't the answer —
    // used to explain an empty reply that still burned the whole budget.
    reasonedOnly: text.trim() === '' && blocks.some((c) => c.type !== 'text'),
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  };
}

// ─── OpenAI-compatible API call ───────────────────────────────────────────────

async function callOpenAI(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
}): Promise<CallResult> {
  const { apiKey, baseUrl, model, system, messages, maxTokens = 2048 } = params;
  const openaiMessages = [
    { role: 'system', content: system },
    ...messages,
  ];

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: openaiMessages }),
    });
  } catch (err) {
    return { ok: false, httpStatus: 503, message: err instanceof Error ? err.message : 'Network error' };
  }

  if (!response.ok) {
    const body = await response.text();
    return { ok: false, httpStatus: response.status, message: `API error ${response.status}: ${body}` };
  }

  const data = (await response.json()) as {
    choices: Array<{
      message: {
        content: string | null;
        // Reasoning models on OpenRouter, Groq, DeepSeek and friends put their
        // chain of thought in a sibling field and may leave `content` null.
        reasoning_content?: string | null;
        reasoning?: string | null;
      };
      finish_reason?: string;
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  };
  const message = data.choices?.[0]?.message;
  const text = message?.content ?? '';
  const reasoning = message?.reasoning_content ?? message?.reasoning ?? '';
  const reasoningTokens = data.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
  return {
    ok: true,
    text,
    truncated: data.choices?.[0]?.finish_reason === 'length',
    reasonedOnly: text.trim() === '' && (reasoning.trim() !== '' || reasoningTokens > 0),
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      ...(reasoningTokens > 0 ? { reasoningTokens } : {}),
    },
  };
}

// ─── Solver ───────────────────────────────────────────────────────────────────

export interface RetryContext {
  previousMovesText: string;
  userFeedback: string;
}

export interface AiMove {
  x: number;
  y: number;
  direction: string;
}

export const SOLVE_SYSTEM_PROMPT = `You are solving a grid-based logic puzzle described in a DSL. Output the move sequence to win.

## DSL format

\`\`\`
level "Name" WxH

grid = [
  <row of space-separated single-char tile tokens>,
  ...
]

tile X = tiles.type(color)   ← what char X means in the grid

agent(COLOR) start(x,y) and reach(gx,gy)  ← an agent starting at (x,y) that must reach (gx,gy)
\`\`\`

## Coordinate system
x = column (0 = left), y = row (0 = top). Agents move one cell per step.

## Tile types — passability is critical

**Always impassable (treat as walls):**
- \`W\` — wall, solid barrier
- \`.\` — void, out-of-bounds
- door — impassable UNLESS the agent's current color matches the door's color, OR a switch of matching color has been stepped on. Never try to walk through a closed door.
- lock — impassable UNTIL a matching-color agent steps on it (it then stays open permanently). Never try to walk through a locked tile.

**Always passable (agents may freely enter):**
- \`R\` — floor, walkable
- goal — walkable; an agent that has a matching designation (\`and reach()\` in its declaration) is removed from the board when it steps on its goal. Color matching: if the goal has a color (e.g. \`tiles.goal(orange)\`), only the matching-color agent may claim it; \`tiles.commonGoal()\` is a **universal exit** — any designated agent may claim it.
- switch — walkable; stepping on it toggles all doors of matching color
- paint — walkable; stepping on it changes the agent's color to the paint's color

**Conditionally passable:**
- one-way (\`^\`=up \`v\`=down \`<\`=left \`>\`=right) — passable ONLY when entering from the indicated direction; impassable from all other directions

## Agent rules
- Agents move one cell per step: up, down, left, right
- A cell occupied by another active agent is **impassable** — treat it exactly like a wall. You cannot move into it.
- An agent has a goal only if its declaration includes \`and reach(gx,gy)\`. An agent **without** \`and reach()\` has no designated goal and does not count toward the win condition.
- An agent disappears when it steps on its designated goal tile (it no longer blocks)
- Win when **all agents that have \`and reach()\` designations** have reached their respective goals
- ⚠ If no agents have \`and reach()\`, the level has no win condition and cannot be solved — state this clearly instead of outputting moves.

## Output format

Each move line: \`(x,y) direction\`
- \`(x,y)\` = the agent's **current position** before this move
- \`direction\` = one of: \`up\` \`down\` \`left\` \`right\`

Put the complete move sequence inside a fenced code block.

## How to solve

1. **Plan first.** Describe the intended path for each agent: which corridors, which switches to hit, in what order.
2. **Track positions explicitly.** After each move in your plan, write the updated position of the agent that just moved. For example: "orange moves right → now at (3,1)". Never assume a position — always derive it from the previous step.
3. **One move = one line.** Each \`(x,y) direction\` line must use the agent's position BEFORE that move. If you have 2 agents, alternate lines must reference whichever agent's current tracked position matches.
4. **Output the full sequence.** Write every move until ALL agents have reached their goals. Do not stop early — an incomplete sequence loses the level.

## Example

Level:
\`\`\`
level "Simple" 5x3

grid = [
  W W W W W,
  W R R R G,
  W W W W W,
]

tile G = tiles.goal(orange)

agent(orange) start(1,1) and reach(4,1)
\`\`\`

Plan: orange walks right from (1,1) to (4,1) — three steps.

\`\`\`
(1,1) right
(2,1) right
(3,1) right
\`\`\``;

export function buildSolveMessages(
  dsl: string,
  retryContext?: RetryContext,
): AnthropicMessage[] {
  const firstUserMsg = `Solve this level:\n\`\`\`\n${dsl}\n\`\`\``;
  if (!retryContext) {
    return [{ role: 'user', content: firstUserMsg }];
  }
  return [
    { role: 'user', content: firstUserMsg },
    { role: 'assistant', content: `\`\`\`\n${retryContext.previousMovesText}\n\`\`\`` },
    {
      role: 'user',
      content: `${retryContext.userFeedback}\n\nPlease try again with a corrected solution.`,
    },
  ];
}

export function parseMoves(text: string): AiMove[] | null {
  const codeBlockRegex = /```[\w]*\r?\n([\s\S]+?)\r?\n```/g;
  const VALID_DIRS = new Set(['up', 'down', 'left', 'right']);
  let lastValidMoves: AiMove[] | null = null;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const moves = match[1]
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const m = line.match(/^\((\d+),(\d+)\)\s+(up|down|left|right)$/);
        if (!m) return null;
        const dir = m[3];
        if (!VALID_DIRS.has(dir)) return null;
        return { x: parseInt(m[1], 10), y: parseInt(m[2], 10), direction: dir };
      })
      .filter((m): m is AiMove => m !== null);

    if (moves.length > 0) lastValidMoves = moves;
  }

  return lastValidMoves;
}

// ─── Generator ────────────────────────────────────────────────────────────────

export const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof VALID_DIFFICULTIES)[number];

export const VALID_FEATURES = [
  'switches',
  'doors',
  'paint',
  'one-way',
  'locks',
  'multi-agent',
] as const;
export type LevelFeature = (typeof VALID_FEATURES)[number];

export interface GenerateRequest {
  prompt: string;
  width: number;
  height: number;
  difficulty: Difficulty;
  features: LevelFeature[];
}

export interface GenerateRetryContext {
  previousDsl: string;
  /** Validation/parse errors — used for automatic silent retry. */
  error?: string;
  /** User-written feedback — used for intentional refinement. */
  userFeedback?: string;
}

export const GENERATE_SYSTEM_PROMPT = `You are a puzzle designer creating grid-based logic puzzles in a specific DSL. Your goal is to produce an interesting, solvable puzzle that matches the given specifications.

## DSL format

\`\`\`
level "Name" WxH

grid = [
  <row of space-separated single-char tile tokens>,
  ...
]

tile X = tiles.type(color)   ← what char X means in the grid

agent(COLOR) start(x,y) and reach(gx,gy)
\`\`\`

## Available tile types
- \`.\` void — impassable (use for areas outside the play zone)
- \`W\` wall — solid barrier
- \`R\` floor — walkable (no tile declaration needed for W, R, .)
- \`tiles.goal(COLOR)\` — agent wins by stepping on matching-color goal
- \`tiles.commonGoal()\` — universal exit; any designated agent may step on it to win
- \`tiles.door(COLOR)\` — blocked unless agent's current color matches
- \`tiles.switch(COLOR)\` — toggles all doors of that color when stepped on
- \`tiles.paint(COLOR)\` — changes the stepping agent's color
- \`tiles.one-way(COLOR, DIRECTION)\` — passable only from direction (up/down/left/right)
- \`tiles.lock(COLOR)\` — blocked until a matching-color agent steps on it (stays open)

## Available colors
orange, blue, green, red, purple, yellow

## Agent rules
- \`agent(COLOR) start(x,y) and reach(gx,gy)\`
- **\`and reach(gx,gy)\` is mandatory** — omitting it makes the level invalid and unsolvable
- x = column (0 = left), y = row (0 = top)
- Agents move one step at a time: up, down, left, right
- Two agents cannot occupy the same cell
- An agent disappears when it reaches its matching-color goal
- Win when ALL agents have reached their goals

## What makes a good puzzle

**Solvability (critical):** Every agent must have a valid path from start to goal. Mentally trace the path before outputting. If you use doors and switches, confirm the agent can reach the switch before needing the door.

**Agent placement (critical):**
- Agent start positions MUST be plain floor tiles ('R') — never place a start on a goal, door, paint, switch, one-way, or lock tile
- No agent's start position may coincide with another agent's goal tile — this causes permanent blocking
- Each agent's goal tile must be reachable and not occupied by another agent's start

**Difficulty guidelines:**
- easy: 5–12 total moves, 1 mechanic, clear single path
- medium: 12–25 moves, 2 interacting mechanics, requires planning ahead
- hard: 25+ moves, multiple mechanics, precise sequencing required

**Design rules:**
- Features you include must be necessary to solve — not decorative
- The goal must not be trivially adjacent to the start
- Walls and voids should define clear navigable corridors
- Avoid large empty areas or completely blocked regions

## Output format

First, output a single fenced code block containing the complete DSL.

Then, after the code block, write 2–4 sentences explaining your design thinking: what the core challenge is, why you arranged the mechanics the way you did, and what the intended solution path looks like. Be specific — mention tile positions, color choices, or sequencing decisions that shaped the puzzle.`;

export function buildGenerateMessages(
  req: GenerateRequest,
  retryContext?: GenerateRetryContext,
): AnthropicMessage[] {
  const featureNote =
    req.features.length > 0
      ? `Required features (must appear and be necessary to solve): ${req.features.join(', ')}`
      : 'No specific features required — use your judgment.';

  const userMsg =
    `Create a ${req.difficulty} difficulty puzzle.\n\n` +
    `Grid size: ${req.width}×${req.height}\n` +
    `${featureNote}\n` +
    `Designer notes: ${req.prompt}\n\n` +
    `Output a single fenced code block with the complete DSL.`;

  if (!retryContext) {
    return [{ role: 'user', content: userMsg }];
  }

  // User-driven update: send as a single clear message, not a fake assistant turn
  if (retryContext.userFeedback) {
    const updateMsg =
      `Update the following level based on this request: ${retryContext.userFeedback}\n\n` +
      `Current level DSL:\n\`\`\`\n${retryContext.previousDsl}\n\`\`\`\n\n` +
      `Grid constraints: ${req.width}×${req.height}, ${req.difficulty} difficulty.\n` +
      `Keep as much of the existing structure as makes sense. Output the revised DSL followed by your design notes.`;
    return [{ role: 'user', content: updateMsg }];
  }

  // Silent parse-error retry
  return [
    { role: 'user', content: userMsg },
    { role: 'assistant', content: `\`\`\`\n${retryContext.previousDsl}\n\`\`\`` },
    { role: 'user', content: `That level has errors: ${retryContext.error ?? 'unknown'}\n\nPlease fix it and output the corrected DSL.` },
  ];
}

/**
 * Extract the last fenced code block from the model's response.
 *
 * The closing fence is optional: a response cut short by the output-token
 * ceiling leaves the block open, and handing the partial level to the parser
 * produces a specific complaint ("grid has 4 rows, expected 9") instead of the
 * useless "no DSL code block". The trailing newline before the fence is
 * optional too — not every model emits one.
 */
export function extractDsl(text: string): string | null {
  const regex = /```(?:[\w]*)\r?\n([\s\S]*?)(?:\r?\n?```|$)/g;
  let last: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const body = match[1].trim();
    if (body) last = body;
    // A zero-width match at end-of-string would spin forever.
    if (regex.lastIndex === match.index) regex.lastIndex++;
  }
  return last;
}

/** Extract the design summary — text that appears after the last code block. */
export function extractSummary(text: string): string | null {
  // An odd fence count means the final block was never closed, so the last
  // ``` is an *opening* fence and everything after it is the level itself,
  // not prose about it.
  const fences = text.match(/```/g)?.length ?? 0;
  if (fences === 0 || fences % 2 !== 0) return null;

  const lastClose = text.lastIndexOf('```');
  const after = text.slice(lastClose + 3).trim();
  return after.length > 0 ? after : null;
}

/**
 * Explain a successful call that yielded nothing usable.
 *
 * The cases need different remedies, so they get different wording: a
 * reasoning model that never reached its answer, an answer cut off mid-flight,
 * an empty reply, and a model that simply answered in the wrong shape.
 */
export function describeEmptyResult(
  result: { text: string; truncated?: boolean; reasonedOnly?: boolean },
  /** What the caller was looking for, e.g. 'the level' or 'any moves'. */
  wanted: string,
  /** The message for a well-formed reply that just didn't contain it. */
  malformed: string,
): string {
  if (result.reasonedOnly) {
    return `The model spent its entire output budget on internal reasoning and never wrote ${wanted}. Pick a non-reasoning model, or reduce the difficulty and grid size.`;
  }
  if (result.truncated) {
    return `The model ran out of output tokens before writing ${wanted}. Try a simpler request or a smaller grid.`;
  }
  if (result.text.trim() === '') {
    return 'The model returned an empty response.';
  }
  return malformed;
}
