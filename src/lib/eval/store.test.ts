import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_SESSIONS,
  clearSessions,
  deleteSession,
  getSession,
  listSessions,
  saveSession,
  sessionToCsv,
} from './store';
import type { EvalSession } from './types';
import { installFailingLocalStorage, installLocalStorageStub } from '../../test/local-storage';
import { setPrice } from './pricing';

function session(id: string, createdAt: number, over: Partial<EvalSession> = {}): EvalSession {
  return {
    id,
    createdAt,
    levelName: 'Corridor',
    dsl: 'level "Corridor" 3x3',
    models: [
      { key: 'anthropic:claude-opus-5', providerId: 'anthropic', modelId: 'claude-opus-5', label: 'Opus 5' },
    ],
    runsPerModel: 1,
    attempts: [
      {
        id: 'anthropic:claude-opus-5#1',
        modelKey: 'anthropic:claude-opus-5',
        providerId: 'anthropic',
        modelId: 'claude-opus-5',
        label: 'Opus 5',
        attempt: 1,
        status: 'done',
        solved: true,
        proposed: 5,
        applied: 5,
        failedMoves: 0,
        firstFailureIndex: null,
        movesToWin: 5,
        durationMs: 1200,
        usage: { inputTokens: 900, outputTokens: 60 },
      },
    ],
    ...over,
  };
}

beforeEach(() => {
  installLocalStorageStub();
});

describe('persistence', () => {
  it('starts with no sessions', () => {
    expect(listSessions()).toEqual([]);
  });

  it('saves and reads a session back', () => {
    const s = session('a', 1000);
    saveSession(s);
    expect(getSession('a')).toEqual(s);
  });

  it('lists newest first', () => {
    saveSession(session('old', 1000));
    saveSession(session('new', 3000));
    saveSession(session('mid', 2000));
    expect(listSessions().map(s => s.id)).toEqual(['new', 'mid', 'old']);
  });

  it('replaces a session with the same id rather than duplicating it', () => {
    saveSession(session('a', 1000));
    saveSession(session('a', 1000, { levelName: 'Updated' }));
    const all = listSessions();
    expect(all).toHaveLength(1);
    expect(all[0].levelName).toBe('Updated');
  });

  it('deletes one session', () => {
    saveSession(session('a', 1000));
    saveSession(session('b', 2000));
    deleteSession('a');
    expect(listSessions().map(s => s.id)).toEqual(['b']);
  });

  it('clears everything', () => {
    saveSession(session('a', 1000));
    clearSessions();
    expect(listSessions()).toEqual([]);
  });

  it('returns null for an unknown id', () => {
    expect(getSession('missing')).toBeNull();
  });

  it('drops the oldest sessions past the cap', () => {
    for (let i = 0; i < MAX_SESSIONS + 5; i++) {
      saveSession(session(`s${i}`, 1000 + i));
    }
    const all = listSessions();
    expect(all).toHaveLength(MAX_SESSIONS);
    expect(all[all.length - 1].id).toBe('s5');
  });

  it('survives unusable storage', () => {
    installFailingLocalStorage();
    expect(listSessions()).toEqual([]);
    expect(() => saveSession(session('a', 1))).not.toThrow();
  });
});

describe('sessionToCsv', () => {
  it('writes a header plus one row per attempt', () => {
    const csv = sessionToCsv(session('a', 1000));
    const lines = csv.split('\n');
    expect(lines[0]).toContain('provider,model,attempt,status,solved');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('anthropic,claude-opus-5,1,done,true');
  });

  it('includes token counts and timing', () => {
    const csv = sessionToCsv(session('a', 1000));
    expect(csv).toContain('1200,900,60');
  });

  it('leaves unscored fields blank for a failed attempt', () => {
    const s = session('a', 1000);
    s.attempts = [{ ...s.attempts[0], status: 'error', error: 'rate limited', solved: undefined }];
    const row = sessionToCsv(s).split('\n')[1];
    expect(row).toContain('error');
    expect(row).toContain('rate limited');
  });

  it('quotes a value containing a comma', () => {
    const s = session('a', 1000);
    s.attempts = [{ ...s.attempts[0], status: 'error', error: 'bad request, retry' }];
    expect(sessionToCsv(s)).toContain('"bad request, retry"');
  });

  it('carries the optimum and excess ratio so the baseline survives export', () => {
    const s = session('a', 1000, { optimalMoves: 4, optimalStatus: 'solved' });
    const [header, row] = sessionToCsv(s).split('\n');
    expect(header).toContain('optimal_moves,excess_over_optimal');
    // 5 moves to win against an optimum of 4.
    expect(row).toContain('4,1.250');
  });

  it('leaves the excess blank without a baseline', () => {
    const [, row] = sessionToCsv(session('a', 1000)).split('\n');
    expect(row).toContain(',,,');
  });

  it('breaks the outcomes out into their own columns', () => {
    const s = session('a', 1000);
    s.attempts = [
      { ...s.attempts[0], outcomes: ['moved', 'moved', 'blocked', 'no-agent'] },
    ];
    const [header, row] = sessionToCsv(s).split('\n');
    expect(header).toContain('moved,blocked,illegal,no_agent,bad_direction');
    expect(row).toContain('2,1,0,1,0');
  });

  it('prices an attempt once the user has supplied a rate', () => {
    installLocalStorageStub();
    setPrice('anthropic', 'claude-opus-5', { input: 5, output: 25 });
    // 900 input at $5/MTok + 60 output at $25/MTok.
    const expected = (900 * 5 + 60 * 25) / 1_000_000;
    expect(sessionToCsv(session('a', 1000))).toContain(expected.toFixed(6));
  });

  it('leaves the cost column blank when no rate is set', () => {
    installLocalStorageStub();
    const [, row] = sessionToCsv(session('a', 1000)).split('\n');
    // Trailing empty cost field, then the empty error field.
    expect(row.endsWith(',,')).toBe(true);
  });
});
