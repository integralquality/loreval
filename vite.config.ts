import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => {
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

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler']],
        },
      }),
      tailwindcss(),
      // Dev-only middleware: handles /api/solve-level without needing vercel dev
      {
        name: 'api-solve-level-dev',
        configureServer(server) {
          server.middlewares.use('/api/solve-level', async (req, res, next) => {
            if (req.method !== 'POST') {
              return next();
            }

            res.setHeader('Content-Type', 'application/json');

            const apiKey = env.ANTHROPIC_API_KEY;
            if (!apiKey) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in .env.local' }));
              return;
            }

            const rawBody = await new Promise<string>((resolve, reject) => {
              let data = '';
              req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
              req.on('end', () => resolve(data));
              req.on('error', reject);
            });

            let dsl: string;
            let retryContext: RetryContext | undefined;
            let model: string | undefined;
            try {
              ({ dsl, retryContext, model } = JSON.parse(rawBody) as { dsl: string; retryContext?: RetryContext; model?: string });
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON body' }));
              return;
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
                res.statusCode = 502;
                res.end(JSON.stringify({ error: `Anthropic API error ${response.status}: ${text}` }));
                return;
              }

              const data = await response.json() as { content: Array<{ type: string; text: string }> };
              const text = data.content?.find(c => c.type === 'text')?.text ?? '';

              console.log('[AI solver] Claude response:\n', text);
              const moves = parseMoves(text);
              if (!moves) {
                res.end(JSON.stringify({ moves: [], error: 'No valid moves found in response', raw: text }));
                return;
              }

              res.end(JSON.stringify({ moves }));
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Internal error';
              res.statusCode = 500;
              res.end(JSON.stringify({ error: message }));
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
