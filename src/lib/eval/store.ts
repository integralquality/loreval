/**
 * Eval session history, kept in localStorage.
 *
 * Sessions carry the exact DSL they ran against, so any saved session can be
 * re-run later and compared. Oldest sessions are dropped past MAX_SESSIONS to
 * stay well inside the storage quota.
 */
import { costOf } from './pricing';
import type { MoveOutcome } from './replay';
import type { EvalAttempt, EvalSession } from './types';

function countOutcomes(outcomes: EvalAttempt['outcomes']): Record<MoveOutcome, number> {
  const counts: Record<MoveOutcome, number> = {
    moved: 0,
    'no-agent': 0,
    'bad-direction': 0,
    illegal: 0,
    blocked: 0,
  };
  for (const outcome of outcomes ?? []) counts[outcome]++;
  return counts;
}

const STORAGE_KEY = 'loreval_eval_sessions';
export const MAX_SESSIONS = 25;

function read(): EvalSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as EvalSession[]) : [];
  } catch {
    return [];
  }
}

function write(sessions: EvalSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Quota or unavailable storage — history is a convenience, not critical.
  }
}

/** Newest first. */
export function listSessions(): EvalSession[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

export function getSession(id: string): EvalSession | null {
  return read().find(s => s.id === id) ?? null;
}

/** Insert or replace a session, trimming the history to MAX_SESSIONS. */
export function saveSession(session: EvalSession): void {
  const sessions = read().filter(s => s.id !== session.id);
  sessions.push(session);
  sessions.sort((a, b) => b.createdAt - a.createdAt);
  write(sessions.slice(0, MAX_SESSIONS));
}

export function deleteSession(id: string): void {
  write(read().filter(s => s.id !== id));
}

export function clearSessions(): void {
  write([]);
}

/**
 * Session as a CSV of per-attempt rows, for taking numbers elsewhere.
 *
 * Per-attempt rather than per-model on purpose: aggregates can be rebuilt from
 * rows, but rows cannot be recovered from aggregates. The level's optimum and
 * the per-outcome counts ride along so excess-over-optimal and the failure
 * taxonomy survive the export.
 */
export function sessionToCsv(session: EvalSession): string {
  const header = [
    'provider', 'model', 'attempt', 'status', 'solved', 'proposed_moves',
    'applied_moves', 'failed_moves', 'first_failure_index', 'moves_to_win',
    'optimal_moves', 'excess_over_optimal',
    'moved', 'blocked', 'illegal', 'no_agent', 'bad_direction',
    'duration_ms', 'input_tokens', 'output_tokens', 'reasoning_tokens',
    'cost_usd', 'error',
  ].join(',');

  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

  const optimal = session.optimalMoves ?? null;

  const rows = session.attempts.map(a => {
    const counts = countOutcomes(a.outcomes);
    const cost = a.usage
      ? costOf(a.providerId, a.modelId, {
          inputTokens: a.usage.inputTokens,
          outputTokens: a.usage.outputTokens,
        })
      : null;

    return [
      a.providerId,
      a.modelId,
      String(a.attempt),
      a.status,
      a.solved === undefined ? '' : String(a.solved),
      a.proposed ?? '',
      a.applied ?? '',
      a.failedMoves ?? '',
      a.firstFailureIndex ?? '',
      a.movesToWin ?? '',
      optimal ?? '',
      optimal && a.movesToWin ? (a.movesToWin / optimal).toFixed(3) : '',
      counts.moved,
      counts.blocked,
      counts.illegal,
      counts['no-agent'],
      counts['bad-direction'],
      a.durationMs ?? '',
      a.usage?.inputTokens ?? '',
      a.usage?.outputTokens ?? '',
      a.usage?.reasoningTokens ?? '',
      cost === null ? '' : cost.toFixed(6),
      escape(a.error ?? ''),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}
