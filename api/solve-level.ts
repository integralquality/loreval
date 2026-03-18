// Vercel serverless function
// POST /api/solve-level { dsl: string } → { moves: Array<{color, direction}> } | { error: string }
// For local dev: run `vercel dev` instead of `vite dev`
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_PROMPT = `You are solving a grid-based logic puzzle. The puzzle is described in a DSL.

**Coordinate system:** x = column (left→right, 0-indexed), y = row (top→bottom, 0-indexed)

**Tile types:**
- empty (.) — void, impassable
- wall (W) — solid wall, impassable
- floor/floor-white (R) — walkable
- goal — destination tile; an agent wins by stepping onto a goal matching its color
- door — blocks movement unless the agent's color matches the door's color, OR the door's color has been toggled open by a switch
- switch — when stepped on, toggles all doors of the same color (open↔closed)
- paint — changes the stepping agent's color to match the paint tile's color
- one-way (^ up, v down, < left, > right) — can only be entered from the indicated direction
- lock — blocks unless agent color matches; stays open once unlocked

**Agent rules:**
- Agents move one cell per turn in a cardinal direction: up, down, left, right
- Agents cannot occupy the same cell as another active agent
- When an agent reaches its matching color goal, it finishes and is removed from the board
- All agents with a reach-goal rule must reach their goals to win

**Response format:** output ONLY a fenced code block with one move per line: \`color direction\`

\`\`\`
orange right
orange down
purple left
\`\`\`

No explanation. No commentary. Just the code block.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { dsl } = (req.body ?? {}) as { dsl?: string };
  if (!dsl || typeof dsl !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid dsl field' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Solve this level:\n\`\`\`\n${dsl}\n\`\`\``,
          },
        ],
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

    // Extract the first fenced code block
    const match = text.match(/```[\w]*\n([\s\S]+?)\n```/);
    if (!match) {
      return res.status(200).json({ moves: [], error: 'No code block found in response', raw: text });
    }

    const moves = match[1]
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) return { color: parts[0], direction: parts[1] };
        return null;
      })
      .filter((m): m is { color: string; direction: string } => m !== null);

    return res.status(200).json({ moves });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
}
