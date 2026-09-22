import { describe, expect, it } from 'vitest';
import { parseDSL } from '../../dsl/parser';
import { applyAiMove, initialStateFor, replayMoves } from './replay';
import type { AiMove } from '../moves';
import type { Level } from '../../types';

function levelFrom(dsl: string): Level {
  const { level, errors } = parseDSL(dsl);
  if (!level) throw new Error(`fixture failed to parse: ${errors.map(e => e.message).join('; ')}`);
  return level;
}

/** Straight corridor: agent at (1,1), red goal at (4,1). */
const CORRIDOR = levelFrom(`level "Corridor" 6x3

grid = [
  W W W W W W,
  W R R R G W,
  W W W W W W,
]

tile G = tiles.goal(red)

agent(red) start(1,1) and reach(4,1)`);

/** Same corridor with a blue door at (2,1) the red agent can't pass. */
const DOORED = levelFrom(`level "Doored" 6x3

grid = [
  W W W W W W,
  W R D R G W,
  W W W W W W,
]

tile D = tiles.door(blue)
tile G = tiles.goal(red)

agent(red) start(1,1) and reach(4,1)`);

const move = (x: number, y: number, direction: string): AiMove => ({ x, y, direction });

describe('initialStateFor', () => {
  it('starts every agent at its declared position with a clean slate', () => {
    const state = initialStateFor(CORRIDOR);
    expect(state.status).toBe('playing');
    expect(state.entities[0].position).toEqual({ x: 1, y: 1 });
    expect(state.moves['robot-1']).toBe(0);
    expect(state.finishedEntityIds).toEqual([]);
    expect(state.selectedEntityId).toBe('robot-1');
  });

  it('does not alias the level entities', () => {
    const state = initialStateFor(CORRIDOR);
    state.entities[0].position.x = 99;
    expect(CORRIDOR.entities[0].position.x).toBe(1);
  });
});

describe('applyAiMove', () => {
  it('moves an agent standing on the named square', () => {
    const result = applyAiMove(CORRIDOR, initialStateFor(CORRIDOR), move(1, 1, 'right'));
    expect(result.outcome).toBe('moved');
    expect(result.state.entities[0].position).toEqual({ x: 2, y: 1 });
  });

  it('reports no-agent when the square is empty', () => {
    const result = applyAiMove(CORRIDOR, initialStateFor(CORRIDOR), move(3, 1, 'right'));
    expect(result.outcome).toBe('no-agent');
  });

  it('reports bad-direction for an unknown direction', () => {
    const result = applyAiMove(CORRIDOR, initialStateFor(CORRIDOR), move(1, 1, 'sideways'));
    expect(result.outcome).toBe('bad-direction');
  });

  it('reports illegal when the engine refuses the move', () => {
    const result = applyAiMove(CORRIDOR, initialStateFor(CORRIDOR), move(1, 1, 'up'));
    expect(result.outcome).toBe('illegal');
  });

  it('reports blocked when the agent is held in place', () => {
    const result = applyAiMove(DOORED, initialStateFor(DOORED), move(1, 1, 'right'));
    expect(result.outcome).toBe('blocked');
    expect(result.message).toContain('blue');
  });

  it('leaves the input state untouched on every outcome', () => {
    const state = initialStateFor(CORRIDOR);
    applyAiMove(CORRIDOR, state, move(1, 1, 'right'));
    expect(state.entities[0].position).toEqual({ x: 1, y: 1 });
  });
});

describe('replayMoves', () => {
  it('scores a winning plan', () => {
    const result = replayMoves(CORRIDOR, initialStateFor(CORRIDOR), [
      move(1, 1, 'right'),
      move(2, 1, 'right'),
      move(3, 1, 'right'),
    ]);
    expect(result.solved).toBe(true);
    expect(result.proposed).toBe(3);
    expect(result.applied).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.firstFailureIndex).toBeNull();
    expect(result.movesToWin).toBe(3);
  });

  it('scores a plan that never reaches the goal', () => {
    const result = replayMoves(CORRIDOR, initialStateFor(CORRIDOR), [move(1, 1, 'right')]);
    expect(result.solved).toBe(false);
    expect(result.applied).toBe(1);
    expect(result.movesToWin).toBeNull();
  });

  it('counts rejected moves and records the first failure', () => {
    const result = replayMoves(CORRIDOR, initialStateFor(CORRIDOR), [
      move(1, 1, 'right'),
      move(2, 1, 'up'), // into a wall
      move(2, 1, 'right'),
      move(3, 1, 'right'),
    ]);
    expect(result.solved).toBe(true);
    expect(result.applied).toBe(3);
    expect(result.failed).toBe(1);
    expect(result.firstFailureIndex).toBe(1);
    expect(result.steps[1].outcome).toBe('illegal');
  });

  it('keeps going after a failed move', () => {
    const result = replayMoves(CORRIDOR, initialStateFor(CORRIDOR), [
      move(0, 0, 'right'), // no agent there
      move(1, 1, 'right'),
    ]);
    expect(result.steps.map(s => s.outcome)).toEqual(['no-agent', 'moved']);
    expect(result.applied).toBe(1);
  });

  it('stops at the win and reports the remainder as trailing', () => {
    const result = replayMoves(CORRIDOR, initialStateFor(CORRIDOR), [
      move(1, 1, 'right'),
      move(2, 1, 'right'),
      move(3, 1, 'right'),
      move(4, 1, 'right'),
      move(4, 1, 'down'),
    ]);
    expect(result.solved).toBe(true);
    expect(result.movesToWin).toBe(3);
    expect(result.steps).toHaveLength(3);
    expect(result.trailing).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('scores an empty plan as unsolved without failures', () => {
    const result = replayMoves(CORRIDOR, initialStateFor(CORRIDOR), []);
    expect(result.solved).toBe(false);
    expect(result.proposed).toBe(0);
    expect(result.applied).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.firstFailureIndex).toBeNull();
  });

  it('counts a door the agent cannot pass as a failed move', () => {
    const result = replayMoves(DOORED, initialStateFor(DOORED), [
      move(1, 1, 'right'),
      move(1, 1, 'right'),
    ]);
    expect(result.solved).toBe(false);
    expect(result.applied).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.steps.every(s => s.outcome === 'blocked')).toBe(true);
  });

  it('never mutates the state it was handed', () => {
    const state = initialStateFor(CORRIDOR);
    replayMoves(CORRIDOR, state, [move(1, 1, 'right'), move(2, 1, 'right')]);
    expect(state.entities[0].position).toEqual({ x: 1, y: 1 });
    expect(state.status).toBe('playing');
  });
});
