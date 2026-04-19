import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { IncomingMessage, ServerResponse } from 'http';
import {
  callAnthropic,
  resolveModel,
  buildSolveMessages,
  parseMoves,
  SOLVE_SYSTEM_PROMPT,
  buildGenerateMessages,
  extractDsl,
  extractSummary,
  GENERATE_SYSTEM_PROMPT,
  VALID_DIFFICULTIES,
  VALID_FEATURES,
} from './api/_anthropic';
import type { RetryContext, GenerateRequest, GenerateRetryContext, Difficulty, LevelFeature } from './api/_anthropic';

// ─── Shared dev-server helpers ────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function jsonError(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status;
  res.end(JSON.stringify({ error: message }));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, isFinite(n) ? n : min));
}

// ─── Vite config ──────────────────────────────────────────────────────────────

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

      // Dev-only middleware: mirrors /api/* serverless functions without needing vercel dev
      {
        name: 'api-dev-middleware',
        configureServer(server) {
          // ── POST /api/solve-level ────────────────────────────────────────────
          server.middlewares.use('/api/solve-level', async (req, res, next) => {
            if (req.method !== 'POST') return next();
            res.setHeader('Content-Type', 'application/json');

            let body: Record<string, unknown>;
            try {
              body = JSON.parse(await readBody(req)) as Record<string, unknown>;
            } catch {
              return jsonError(res, 400, 'Invalid JSON body');
            }

            const resolvedKey = typeof body.guestKey === 'string' ? body.guestKey.trim() : '';
            if (!resolvedKey) return jsonError(res, 401, 'No API key provided. Add your Anthropic key via the "Add API key" button.');

            const { dsl, retryContext, model } = body as {
              dsl?: string;
              retryContext?: RetryContext;
              model?: string;
            };
            if (!dsl || typeof dsl !== 'string') return jsonError(res, 400, 'Missing dsl field');

            const result = await callAnthropic({
              apiKey: resolvedKey,
              model: resolveModel(model),
              system: SOLVE_SYSTEM_PROMPT,
              messages: buildSolveMessages(dsl, retryContext),
              maxTokens: 8000,
            });

            if (!result.ok) return jsonError(res, 502, result.message);

            console.log('[AI solver] Claude response:\n', result.text);
            const moves = parseMoves(result.text);
            if (!moves) {
              res.end(JSON.stringify({ moves: [], error: 'No valid moves found in response', raw: result.text }));
              return;
            }
            res.end(JSON.stringify({ moves }));
          });

          // ── POST /api/generate-level ─────────────────────────────────────────
          server.middlewares.use('/api/generate-level', async (req, res, next) => {
            if (req.method !== 'POST') return next();
            res.setHeader('Content-Type', 'application/json');

            let body: Record<string, unknown>;
            try {
              body = JSON.parse(await readBody(req)) as Record<string, unknown>;
            } catch {
              return jsonError(res, 400, 'Invalid JSON body');
            }

            const resolvedKey = typeof body.guestKey === 'string' ? body.guestKey.trim() : '';
            if (!resolvedKey) return jsonError(res, 401, 'No API key provided. Add your Anthropic key via the "Add API key" button.');

            const prompt =
              typeof body.prompt === 'string' ? body.prompt.slice(0, 500).trim() : '';
            if (!prompt) return jsonError(res, 400, 'prompt is required');

            const genReq: GenerateRequest = {
              prompt,
              width: clamp(Number(body.width) || 8, 4, 16),
              height: clamp(Number(body.height) || 8, 4, 16),
              difficulty: (VALID_DIFFICULTIES as readonly string[]).includes(body.difficulty as string)
                ? (body.difficulty as Difficulty)
                : 'medium',
              features: Array.isArray(body.features)
                ? body.features.filter((f): f is LevelFeature =>
                    (VALID_FEATURES as readonly string[]).includes(f as string),
                  )
                : [],
            };

            const rc = body.retryContext as Record<string, unknown> | undefined;
            const retryContext: GenerateRetryContext | undefined =
              rc && typeof rc.previousDsl === 'string'
                ? {
                    previousDsl: String(rc.previousDsl).slice(0, 5000),
                    error: typeof rc.error === 'string' ? String(rc.error).slice(0, 500) : undefined,
                    userFeedback: typeof rc.userFeedback === 'string' ? String(rc.userFeedback).slice(0, 500) : undefined,
                  }
                : undefined;

            const result = await callAnthropic({
              apiKey: resolvedKey,
              model: resolveModel(body.model),
              system: GENERATE_SYSTEM_PROMPT,
              messages: buildGenerateMessages(genReq, retryContext),
              maxTokens: 3000,
            });

            if (!result.ok) return jsonError(res, 502, result.message);

            console.log('[AI generator] Claude response:\n', result.text);
            const dsl = extractDsl(result.text);
            if (!dsl) {
              res.end(JSON.stringify({ error: 'Claude did not output a DSL code block', raw: result.text }));
              return;
            }
            const summary = extractSummary(result.text);
            res.end(JSON.stringify({ dsl, ...(summary && { summary }) }));
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
