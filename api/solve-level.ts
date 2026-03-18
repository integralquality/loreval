// Vercel serverless function
// POST /api/solve-level { dsl: string } → { moves: Array<{color, direction}> } | { error: string }
// For local dev: run `vercel dev` instead of `vite dev`
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
  const match = text.match(/```[\w]*\n([\s\S]+?)\n```/);
  if (!match) return null;
  return match[1].trim().split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const parts = line.split(/\s+/);
      return parts.length >= 2 ? { color: parts[0], direction: parts[1] } : null;
    })
    .filter((m): m is { color: string; direction: string } => m !== null);
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

agent(COLOR) start(x,y) and reach(gx,gy)  ← an agent you must move to its goal
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
- Agents are identified by their COLOR name (e.g. \`orange\`, \`purple\`, \`blue\`)
- Agents move one cell per step: up, down, left, right
- Two agents cannot occupy the same cell
- An agent disappears when it reaches its matching-color goal
- Win when all agents have reached their goals

## CRITICAL — output format

Each output line is: \`<COLOR> <direction>\`

**COLOR** = the exact color string from the \`agent(COLOR)\` declaration — a word like \`orange\` or \`purple\`.
**direction** = one of: \`up\` \`down\` \`left\` \`right\`

⚠️ Grid characters (\`W\`, \`R\`, \`.\`, \`G\`, etc.) are tile labels — they are NEVER valid color names.
⚠️ The only valid color values are the exact words inside \`agent(...)\` in the level.

WRONG (using grid chars as colors):
\`\`\`
. right
R down
G left
\`\`\`

RIGHT (using agent color names):
\`\`\`
orange right
orange down
purple left
\`\`\`

## Worked example

Level:
\`\`\`
level "Simple" 4x3

grid = [
  W W W W,
  W R R G,
  W W W W,
]

tile G = tiles.goal(orange)

agent(orange) start(1,1) and reach(3,1)
\`\`\`

Agents: orange starts at (1,1), goal G at (3,1).

Solution:
\`\`\`
orange right
orange right
\`\`\`

## Instructions

1. Read all \`agent(COLOR)\` lines — those COLOR words are the ONLY valid move prefixes.
2. Trace each agent's path step by step through the grid.
3. Output ONLY a fenced code block with one \`<color> <direction>\` per line.
No explanation, no commentary outside the code block.`;

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
      return res.status(200).json({ moves: [], error: 'No code block found in response', raw: text });
    }

    return res.status(200).json({ moves });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
}
