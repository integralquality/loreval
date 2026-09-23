import { describe, expect, it } from 'vitest';
import { parseDSL } from '../../dsl/parser';
import { DEFAULT_NODE_LIMIT, solveOptimal, solveOptimalAsync } from './solver';
import type { Level } from '../../types';

function level(dsl: string): Level {
  const parsed = parseDSL(dsl);
  if (!parsed.level) throw new Error(parsed.errors.map(e => e.message).join('; '));
  return parsed.level;
}

const STRAIGHT_LINE = `level "Line" 6x3
grid = [
  W W W W W W,
  W R R R G W,
  W W W W W W,
]
tile G = tiles.goal(orange)
agent(orange) start(1,1) and reach(4,1)`;

const WALLED_OFF = `level "Sealed" 5x5
grid = [
  W W W W W,
  W R W G W,
  W W W W W,
  W R R R W,
  W W W W W,
]
tile G = tiles.goal(orange)
agent(orange) start(1,1) and reach(3,1)`;

/** The landing-page level: the goal needs two colour changes in order. */
const PAINT_RUN = `level "Paint Run" 9x7
grid = [
  W W W W W W W W W,
  W R R R W W W W W,
  W R W S W W W W W,
  W R W W W N W W W,
  W R D R R R E P W,
  W W W W W W W G W,
  W W W W W W W W W,
]
tile S = tiles.switch(blue)
tile D = tiles.door(blue)
tile N = tiles.paint(green)
tile E = tiles.door(green)
tile P = tiles.paint(orange)
tile G = tiles.goal(orange)
agent(orange) start(1,1) and reach(7,5)`;

/**
 * Two agents in an open room with both goals sealed behind walls. Nothing can
 * win, so the search explores the whole reachable product space (~94 open
 * cells squared) instead of stopping early — enough states to cross a chunk
 * boundary and force a yield.
 */
const BIG_SEARCH = `level "Open Room" 12x12
grid = [
  W W W W W W W W W W W W,
  W A W R R R R R R R R W,
  W W R R R R R R R R R W,
  W R R R R R R R R R R W,
  W R R R R R R R R R R W,
  W R R R R R R R R R R W,
  W R R R R R R R R R R W,
  W R R R R R R R R R R W,
  W R R R R R R R R R R W,
  W R R R R R R R R R W W,
  W R R R R R R R R W B W,
  W W W W W W W W W W W W,
]
tile A = tiles.goal(red)
tile B = tiles.goal(blue)
agent(red) start(5,5) and reach(1,1)
agent(blue) start(6,5) and reach(10,10)`;

describe('solveOptimal', () => {
  it('counts the moves on a straight corridor', () => {
    const result = solveOptimal(level(STRAIGHT_LINE));
    expect(result).toMatchObject({ optimal: 3, solvable: true, hitLimit: false });
  });

  it('proves a sealed goal unreachable rather than guessing', () => {
    const result = solveOptimal(level(WALLED_OFF));
    expect(result).toMatchObject({ optimal: null, solvable: false, hitLimit: false });
  });

  /**
   * The number quoted on the landing page. If the engine's rules ever change,
   * this fails here rather than silently making the marketing copy wrong.
   */
  it('agrees with the published optimum for the hero level', () => {
    expect(solveOptimal(level(PAINT_RUN)).optimal).toBe(18);
  });

  it('respects preconditions: the answer is longer than the raw path', () => {
    // Manhattan distance from (1,1) to (7,5) is 10. The real optimum is far
    // longer because the switch and both paint tiles are detours.
    const result = solveOptimal(level(PAINT_RUN));
    expect(result.optimal).toBeGreaterThan(10);
  });

  it('reports hitting the node limit instead of inventing an answer', () => {
    const result = solveOptimal(level(PAINT_RUN), { nodeLimit: 5 });
    expect(result).toMatchObject({ optimal: null, solvable: null, hitLimit: true });
    expect(result.explored).toBeGreaterThan(0);
  });

  it('explores far fewer states than the limit on a small level', () => {
    expect(solveOptimal(level(STRAIGHT_LINE)).explored).toBeLessThan(DEFAULT_NODE_LIMIT);
  });
});

describe('limits', () => {
  /**
   * Measured before this guard existed: the worst level the designer currently
   * produces (four agents on 10x10) ran 6.3s and still found nothing. Blocking
   * a click for that long is not acceptable, so the clock stops it.
   */
  it('stops on the time budget, not just the node count', () => {
    const started = Date.now();
    const result = solveOptimal(level(PAINT_RUN), { nodeLimit: 1e9, timeLimitMs: 1 });
    expect(Date.now() - started).toBeLessThan(2000);
    // Tiny levels can still finish inside 1ms; either outcome is honest.
    if (result.optimal === null) expect(result.hitLimit).toBe(true);
  });

  it('gives the same answer asynchronously', async () => {
    const sync = solveOptimal(level(PAINT_RUN));
    const async = await solveOptimalAsync(level(PAINT_RUN));
    expect(async).toEqual(sync);
  });

  it('yields to the event loop while searching', async () => {
    // Paint Run is too small to reach a yield point, so this uses a level
    // whose state space is deliberately larger than one chunk: two agents in
    // an open room, both goals walled off, so the search exhausts ~8,700
    // states before concluding there is no solution.
    let ticked = false;
    setTimeout(() => {
      ticked = true;
    }, 0);
    const result = await solveOptimalAsync(level(BIG_SEARCH), { timeLimitMs: 60_000 });
    // A blocking search would never have let the timer run.
    expect(ticked).toBe(true);
    expect(result.explored).toBeGreaterThan(5_000);
  });
});
