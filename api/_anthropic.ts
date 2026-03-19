/**
 * Shared Anthropic API utilities.
 * Imported by all /api/* serverless functions and the Vite dev middleware.
 *
 * ⚠️  Node.js only — no browser APIs.
 */

// ─── Models ───────────────────────────────────────────────────────────────────

export const VALID_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
] as const;

export type AiModelId = (typeof VALID_MODELS)[number];

export const DEFAULT_MODEL: AiModelId = 'claude-sonnet-4-6';

export function resolveModel(raw: unknown): AiModelId {
  return (VALID_MODELS as readonly string[]).includes(raw as string)
    ? (raw as AiModelId)
    : DEFAULT_MODEL;
}

// ─── Anthropic API call ───────────────────────────────────────────────────────

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CallParams {
  apiKey: string;
  model: AiModelId;
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
}

export type CallResult =
  | { ok: true; text: string }
  | { ok: false; httpStatus: number; message: string };

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
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
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
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  return { ok: true, text };
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

## Tile types
- \`W\` wall — solid, impassable
- \`R\` floor — walkable
- \`.\` void — impassable
- goal — agent wins by stepping on its matching-color goal
- door — blocked unless agent color matches, or toggled open by a switch
- switch — toggles all doors of matching color when stepped on
- paint — changes the agent's color to the paint tile's color
- one-way (\`^\`=up \`v\`=down \`<\`=left \`>\`=right) — passable only from that direction
- lock — blocked until a matching-color agent steps on it (stays open)

## Agent rules
- Agents move one cell per step: up, down, left, right
- Two agents cannot occupy the same cell
- An agent disappears when it reaches its matching-color goal
- Win when all agents have reached their goals

## Output format

Each line: \`(x,y) direction\`
- \`(x,y)\` = the agent's **current position** before this move
- \`direction\` = one of: \`up\` \`down\` \`left\` \`right\`

Output ONLY a fenced code block. No explanation outside it.

## Worked example

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

The orange agent starts at (1,1) and must reach (4,1).

\`\`\`
(1,1) right
(2,1) right
(3,1) right
\`\`\`

## Instructions

1. Read each \`agent(...) start(x,y)\` to know where agents begin.
2. Trace moves step by step, updating each agent's position after every move.
3. Output one \`(x,y) direction\` line per move using the agent's position BEFORE that move.`;

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
  error: string;
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
- \`tiles.door(COLOR)\` — blocked unless agent's current color matches
- \`tiles.switch(COLOR)\` — toggles all doors of that color when stepped on
- \`tiles.paint(COLOR)\` — changes the stepping agent's color
- \`tiles.one-way(COLOR, DIRECTION)\` — passable only from direction (up/down/left/right)
- \`tiles.lock(COLOR)\` — blocked until a matching-color agent steps on it (stays open)

## Available colors
orange, blue, green, red, purple, yellow

## Agent rules
- \`agent(COLOR) start(x,y) and reach(gx,gy)\`
- x = column (0 = left), y = row (0 = top)
- Agents move one step at a time: up, down, left, right
- Two agents cannot occupy the same cell
- An agent disappears when it reaches its matching-color goal
- Win when ALL agents have reached their goals

## What makes a good puzzle

**Solvability (critical):** Every agent must have a valid path from start to goal. Mentally trace the path before outputting. If you use doors and switches, confirm the agent can reach the switch before needing the door.

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

Output ONLY a single fenced code block containing the complete DSL. No explanation.`;

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

  return [
    { role: 'user', content: userMsg },
    { role: 'assistant', content: `\`\`\`\n${retryContext.previousDsl}\n\`\`\`` },
    {
      role: 'user',
      content: `That level has errors: ${retryContext.error}\n\nPlease fix it and output the corrected DSL.`,
    },
  ];
}

/** Extract the last fenced code block from Claude's response. */
export function extractDsl(text: string): string | null {
  const regex = /```(?:[\w]*)\r?\n([\s\S]+?)\r?\n```/g;
  let last: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    last = match[1].trim();
  }
  return last;
}
