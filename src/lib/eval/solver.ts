/**
 * Deterministic optimal solver — breadth-first search over the real engine.
 *
 * This is the baseline a model's answer is measured against. "Solved in 54
 * moves" says nothing on its own; "54 against an optimum of 51" says the plan
 * was six percent long. It also settles solvability before any money is spent:
 * a level nothing can solve is a broken test item, not a hard one.
 *
 * `executeMove` is the only judge here too, exactly as in `replay.ts`, so the
 * optimum is reachable by the same rules a model's moves are scored under.
 */
import { executeMove } from '../../gameLogic';
import type { GameState, Level } from '../../types';
import { DIRECTION_DELTAS } from '../moves';
import { initialStateFor } from './replay';

/**
 * Ceiling on explored states. The search is exponential in agents and
 * mechanics — a four-agent 10x10 board blows past this — so it stops and says
 * so rather than running forever.
 */
export const DEFAULT_NODE_LIMIT = 250_000;

/**
 * Wall-clock ceiling. Measured: the worst level the designer currently
 * produces takes ~6s to exhaust the node limit, which is far too long to sit
 * in front of a run. Two seconds bounds the wait; `solveOptimalAsync` keeps
 * the page responsive for however long it does take.
 */
export const DEFAULT_TIME_LIMIT_MS = 2_000;

/** How many states to examine between yields back to the event loop. */
const CHUNK = 5_000;

export interface SolveLimits {
  nodeLimit?: number;
  timeLimitMs?: number;
}

export interface OptimalResult {
  /** Fewest moves that win, or null when unknown. */
  optimal: number | null;
  /**
   * Whether a solution exists. False means the search finished having proved
   * there is none; null means it gave up before finding out.
   */
  solvable: boolean | null;
  /** States dequeued before stopping. */
  explored: number;
  /** True when a limit stopped the search short of an answer. */
  hitLimit: boolean;
}

const DIRECTIONS = Object.values(DIRECTION_DELTAS);

/**
 * Everything that distinguishes one position in the search from another.
 *
 * Agent identity matters (two agents swapping places is a different state),
 * and so does colour, since paint changes which doors and goals an agent can
 * use. Sorting the set-like fields keeps the key stable across orderings.
 */
function stateKey(state: GameState): string {
  const agents = state.entities
    .map(e => `${e.id}:${e.position.x},${e.position.y}:${e.color ?? ''}`)
    .join('|');
  return [
    agents,
    [...state.toggledColors].sort().join(','),
    [...state.finishedEntityIds].sort().join(','),
    [...(state.openedLocks ?? [])].sort().join(','),
  ].join('#');
}

/**
 * The search itself, as a generator that pauses every `CHUNK` states.
 *
 * Written this way so the synchronous and asynchronous entry points share one
 * implementation — the only difference is whether the caller yields to the
 * event loop between chunks.
 */
function* search(level: Level, limits: SolveLimits): Generator<void, OptimalResult, void> {
  const nodeLimit = limits.nodeLimit ?? DEFAULT_NODE_LIMIT;
  const timeLimitMs = limits.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
  const deadline = Date.now() + timeLimitMs;

  const start = initialStateFor(level);
  if (start.status === 'won') {
    return { optimal: 0, solvable: true, explored: 0, hitLimit: false };
  }

  let frontier: GameState[] = [start];
  const seen = new Set<string>([stateKey(start)]);
  let depth = 0;
  let explored = 0;
  let sinceYield = 0;

  while (frontier.length > 0) {
    const next: GameState[] = [];
    depth++;

    for (const state of frontier) {
      explored++;
      sinceYield++;

      if (sinceYield >= CHUNK) {
        sinceYield = 0;
        if (Date.now() > deadline) {
          return { optimal: null, solvable: null, explored, hitLimit: true };
        }
        yield;
      }

      if (explored > nodeLimit) {
        return { optimal: null, solvable: null, explored, hitLimit: true };
      }

      for (const agent of state.entities) {
        if (state.finishedEntityIds.includes(agent.id)) continue;

        for (const { dx, dy } of DIRECTIONS) {
          const moved = executeMove(level, { ...state, selectedEntityId: agent.id }, dx, dy);
          if (!moved) continue;

          // `executeMove` returns a state for refusals too (a locked door sets
          // a message and leaves the agent put). Those are not moves, and
          // counting them would let the search "spend" steps standing still.
          const before = agent.position;
          const after = moved.entities.find(e => e.id === agent.id)?.position;
          const stayed = after ? after.x === before.x && after.y === before.y : false;
          if (stayed && !moved.finishedEntityIds.includes(agent.id)) continue;

          if (moved.status === 'won') {
            return { optimal: depth, solvable: true, explored, hitLimit: false };
          }

          const key = stateKey(moved);
          if (seen.has(key)) continue;
          seen.add(key);
          next.push(moved);
        }
      }
    }

    frontier = next;
  }

  // The frontier emptied without a win: every reachable state has been seen.
  return { optimal: null, solvable: false, explored, hitLimit: false };
}

/**
 * Find the shortest winning move sequence, blocking until done.
 *
 * One step moves one agent, matching the move format a model answers in, so
 * the returned count is directly comparable to `movesToWin` from a replay.
 */
export function solveOptimal(level: Level, limits: SolveLimits = {}): OptimalResult {
  const run = search(level, limits);
  let step = run.next();
  while (!step.done) step = run.next();
  return step.value;
}

/**
 * Same search, yielding to the event loop between chunks so the page keeps
 * painting. Preferred anywhere a user is waiting on it.
 */
export async function solveOptimalAsync(
  level: Level,
  limits: SolveLimits = {},
): Promise<OptimalResult> {
  const run = search(level, limits);
  for (;;) {
    const step = run.next();
    if (step.done) return step.value;
    // A macrotask, not a microtask: a resolved promise would starve rendering.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
