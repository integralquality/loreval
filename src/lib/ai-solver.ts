export interface AiMove {
  color: string;
  direction: string;
}

export interface RetryContext {
  previousMovesText: string;
  userFeedback: string;
}

export async function solveLevel(
  dsl: string,
  retryContext?: RetryContext,
): Promise<{ moves: AiMove[]; error?: string }> {
  try {
    const res = await fetch('/api/solve-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dsl, retryContext }),
    });
    const data = await res.json() as { moves?: AiMove[]; error?: string };
    if (!res.ok || data.error) {
      return { moves: [], error: data.error ?? `Request failed (${res.status})` };
    }
    return { moves: data.moves ?? [] };
  } catch (err) {
    return { moves: [], error: err instanceof Error ? err.message : 'Network error' };
  }
}

export function directionToDelta(dir: string): { dx: number; dy: number } | null {
  if (dir === 'up') return { dx: 0, dy: -1 };
  if (dir === 'down') return { dx: 0, dy: 1 };
  if (dir === 'left') return { dx: -1, dy: 0 };
  if (dir === 'right') return { dx: 1, dy: 0 };
  return null;
}
