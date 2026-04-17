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

/** Extract the design summary — text that appears after the last code block. */
export function extractSummary(text: string): string | null {
  const lastClose = text.lastIndexOf('```');
  if (lastClose === -1) return null;
  const after = text.slice(lastClose + 3).trim();
  return after.length > 0 ? after : null;
}
