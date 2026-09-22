/**
 * Eval session history, kept in localStorage.
 *
 * Sessions carry the exact DSL they ran against, so any saved session can be
 * re-run later and compared. Oldest sessions are dropped past MAX_SESSIONS to
 * stay well inside the storage quota.
 */
import type { EvalSession } from './types';

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

/** Session as a CSV of per-attempt rows, for taking numbers elsewhere. */
export function sessionToCsv(session: EvalSession): string {
  const header = [
    'provider', 'model', 'attempt', 'status', 'solved', 'proposed_moves',
    'applied_moves', 'failed_moves', 'first_failure_index', 'moves_to_win',
    'duration_ms', 'input_tokens', 'output_tokens', 'error',
  ].join(',');

  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

  const rows = session.attempts.map(a =>
    [
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
      a.durationMs ?? '',
      a.usage?.inputTokens ?? '',
      a.usage?.outputTokens ?? '',
      escape(a.error ?? ''),
    ].join(','),
  );

  return [header, ...rows].join('\n');
}
