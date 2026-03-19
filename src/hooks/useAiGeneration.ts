import { useState, useCallback } from 'react';
import { generateLevel } from '../lib/ai-generator';
import type { GenerateOptions } from '../lib/ai-generator';
import type { Level } from '../types';

export type GenerateStatus = 'idle' | 'generating' | 'done' | 'error';

const MAX_ATTEMPTS = 3;

/**
 * Manages AI level generation with automatic retry on DSL parse errors.
 *
 * Retry logic:
 *   attempt 1 — plain request
 *   attempt 2 — resend with the bad DSL + parse errors as feedback
 *   attempt 3 — same, with the second bad DSL as feedback
 * On network/API failure (no DSL returned at all), retrying is skipped.
 */
export function useAiGeneration(onLevel: (level: Level, dsl: string) => void) {
  const [status, setStatus] = useState<GenerateStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const generate = useCallback(
    async (opts: Omit<GenerateOptions, 'retryContext'>) => {
      setStatus('generating');
      setError(null);

      let retryContext: GenerateOptions['retryContext'] | undefined;

      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        setAttempt(i + 1);

        const result = await generateLevel({ ...opts, retryContext });

        if (result.ok) {
          onLevel(result.level, result.dsl);
          setStatus('done');
          return;
        }

        // Hard failure (network, API key, etc.) — retrying won't help
        if (!result.rawDsl) {
          setStatus('error');
          setError(result.error);
          return;
        }

        // Soft failure (bad DSL) — send Claude the errors so it can fix them
        retryContext = { previousDsl: result.rawDsl, error: result.error };
      }

      setStatus('error');
      setError(retryContext?.error ?? 'Failed to generate a valid level');
    },
    [onLevel],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setAttempt(0);
  }, []);

  return { status, error, attempt, generate, reset };
}
