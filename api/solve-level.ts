// Vercel serverless function
// POST /api/solve-level { dsl: string } → { moves: Array<{x, y, direction}> } | { error: string }
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface RetryContext {
  previousMovesText: string;
  userFeedback: string;
}

function buildMessages(dsl: string, retryContext?: RetryContext) {
  const firstUserMsg = `Solve this level:\n\`\`\`\n${dsl}\n\`\`\``;
  if (!retryContext) {
    return [{ role: 'user', content: firstUserMsg }];
  }
  return [
    { role: 'user', content: firstUserMsg },
    { role: 'assistant', content: `\`\`\`\n${retryContext.previousMovesText}\n\`\`\`` },
    { role: 'user', content: `${retryContext.userFeedback}\n\nPlease try again with a corrected solution.` },
  ];
}

function parseMoves(text: string) {
  const codeBlockRegex = /```[\w]*\r?\n([\s\S]+?)\r?\n```/g;
  const VALID_DIRS = new Set(['up', 'down', 'left', 'right']);
  let lastValidMoves: { x: number; y: number; direction: string }[] | null = null;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const moves = match[1].trim().split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const m = line.match(/^\((\d+),(\d+)\)\s+(up|down|left|right)$/);
        if (!m) return null;
        const dir = m[3];
        if (!VALID_DIRS.has(dir)) return null;
        return { x: parseInt(m[1], 10), y: parseInt(m[2], 10), direction: dir };
      })
      .filter((m): m is { x: number; y: number; direction: string } => m !== null);
    if (moves.length > 0) lastValidMoves = moves;
  }
  return lastValidMoves;
}

const SYSTEM_PROMPT = `You are solving a grid-based logic puzzle described in a DSL. Output the move sequence to win.

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { dsl, retryContext, model } = (req.body ?? {}) as { dsl?: string; retryContext?: RetryContext; model?: string };
  if (!dsl || typeof dsl !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid dsl field' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
  }

  const VALID_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'];
  const resolvedModel = model && VALID_MODELS.includes(model) ? model : 'claude-sonnet-4-6';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: buildMessages(dsl, retryContext),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: `Anthropic API error ${response.status}: ${text}` });
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const text = data.content?.find(c => c.type === 'text')?.text ?? '';
    const moves = parseMoves(text);
    if (!moves) {
      return res.status(200).json({ moves: [], error: 'No valid moves found in response', raw: text });
    }

    return res.status(200).json({ moves });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
}
