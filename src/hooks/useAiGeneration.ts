import { useState, useCallback, useRef } from 'react';
import { generateLevel } from '../lib/ai-generator';
import type { GenerateOptions } from '../lib/ai-generator';
import type { Level } from '../types';

export type GenerateStatus = 'idle' | 'generating' | 'ready' | 'error';

export interface GenerateChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_ATTEMPTS = 3;

/**
 * Manages AI level generation with:
 * - Automatic silent retry on DSL parse errors (up to MAX_ATTEMPTS)
 * - User-driven refinement via refine(feedback) after a successful generation
 * - Chat history for display
 */
export function useAiGeneration(onLevel: (level: Level, dsl: string) => void) {
  const [status, setStatus] = useState<GenerateStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [chatHistory, setChatHistory] = useState<GenerateChatMessage[]>([]);

  // Mutable refs so refine() always has fresh values without stale closures
  const currentDslRef = useRef<string | null>(null);
  const baseOptsRef = useRef<Omit<GenerateOptions, 'retryContext'> | null>(null);

  /**
   * Core generation loop. Silently retries on parse errors by sending the
   * bad DSL back to Claude along with the error message.
   */
  const runLoop = useCallback(
    async (
      opts: Omit<GenerateOptions, 'retryContext'>,
      initialContext?: GenerateOptions['retryContext'],
    ) => {
      setStatus('generating');
      setError(null);

      let retryContext = initialContext;

      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        setAttempt(i + 1);

        const result = await generateLevel({ ...opts, retryContext });

        if (result.ok) {
          currentDslRef.current = result.dsl;
          setChatHistory((h) => [...h, { role: 'assistant', content: 'Level generated.' }]);
          setStatus('ready');
          onLevel(result.level, result.dsl);
          return;
        }

        // Hard failure (network, API key…) — no point retrying
        if (!result.rawDsl) {
          setChatHistory((h) => [
            ...h,
            { role: 'assistant', content: `Error: ${result.error}` },
          ]);
          setStatus('error');
          setError(result.error);
          return;
        }

        // Soft failure (bad DSL) — feed the error back to Claude
        retryContext = { previousDsl: result.rawDsl, error: result.error };
      }

      const lastError = retryContext?.error ?? 'Failed to generate a valid level';
      setChatHistory((h) => [...h, { role: 'assistant', content: `Error: ${lastError}` }]);
      setStatus('error');
      setError(lastError);
    },
    [onLevel],
  );

  /** Start a fresh generation from the form. */
  const generate = useCallback(
    async (opts: Omit<GenerateOptions, 'retryContext'>) => {
      baseOptsRef.current = opts;
      currentDslRef.current = null;
      setChatHistory([{ role: 'user', content: opts.prompt }]);
      await runLoop(opts);
    },
    [runLoop],
  );

  /** Refine the current level with user feedback. */
  const refine = useCallback(
    async (feedback: string) => {
      const opts = baseOptsRef.current;
      const dsl = currentDslRef.current;
      if (!opts || !dsl) return;

      setChatHistory((h) => [...h, { role: 'user', content: feedback }]);
      await runLoop(opts, { previousDsl: dsl, userFeedback: feedback });
    },
    [runLoop],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setAttempt(0);
    setChatHistory([]);
    currentDslRef.current = null;
    baseOptsRef.current = null;
  }, []);

  return { status, error, attempt, chatHistory, generate, refine, reset };
}
