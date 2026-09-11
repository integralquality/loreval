import { describe, expect, it } from 'vitest';
import { executeMove } from './gameLogic';
import type { Entity, GameState, Level, Tile, TileType } from './types';

// ── Fixtures ────────────────────────────────────────────────

const CHARS: Record<string, () => Partial<Tile>> = {
  '.': () => ({ type: 'empty' }),
  'R': () => ({ type: 'floor-white' }),
  'W': () => ({ type: 'wall' }),
  'G': () => ({ type: 'goal', meta: { id: 'exit-common' } }),
  'g': () => ({ type: 'goal', color: 'red', meta: { id: 'exit-red' } }),
  'b': () => ({ type: 'goal', color: 'blue', meta: { id: 'exit-blue' } }),
  'D': () => ({ type: 'door', color: 'blue' }),
  'S': () => ({ type: 'switch', color: 'blue' }),
  'P': () => ({ type: 'paint', color: 'green' }),
  'L': () => ({ type: 'lock', color: 'red' }),
  '>': () => ({ type: 'one-way', meta: { direction: 'right' } }),
};

/**
 * Build a level from a row-per-string layout. Each character maps through
 * CHARS; unknown characters fall back to an empty tile.
 */
function makeLevel(layout: string[], entities: Entity[]): Level {
  const tiles: Tile[][] = layout.map((row, y) =>
    row.split('').map((ch, x) => {
      const base = CHARS[ch]?.() ?? { type: 'empty' as TileType };
      return { x, y, type: 'empty', ...base } as Tile;
    }),
  );
  return {
    id: 'test',
    name: 'Test',
    width: layout[0].length,
    height: layout.length,
    tiles,
    entities,
  };
}

function robot(id: string, x: number, y: number, color?: string, goalId?: string): Entity {
  return {
    id,
    type: 'robot',
    position: { x, y },
    color,
    rules: goalId ? [{ id: `${id}-r1`, type: 'reach-goal', targetId: goalId }] : [],
  };
}

function makeState(level: Level, overrides: Partial<GameState> = {}): GameState {
  const moves: Record<string, number> = {};
  const history: Record<string, { x: number; y: number }[]> = {};
  for (const e of level.entities) {
    moves[e.id] = 0;
    history[e.id] = [e.position];
  }
  return {
    entities: level.entities.map(e => ({ ...e, position: { ...e.position } })),
    moves,
    history,
    status: 'playing',
    message: '',
    selectedEntityId: level.entities[0]?.id ?? null,
    toggledColors: [],
    finishedEntityIds: [],
    openedLocks: [],
    ...overrides,
  };
}

/** Position of the selected entity in a state. */
function posOf(state: GameState, id: string) {
  return state.entities.find(e => e.id === id)!.position;
}

// ── Tests ───────────────────────────────────────────────────

describe('guards', () => {
  const level = makeLevel(['RRR'], [robot('robot-1', 1, 0, 'red')]);

  it('refuses to move once the game is won', () => {
    const state = makeState(level, { status: 'won' });
    expect(executeMove(level, state, 1, 0)).toBeNull();
  });

  it('refuses to move with no entity selected', () => {
    const state = makeState(level, { selectedEntityId: null });
    expect(executeMove(level, state, 1, 0)).toBeNull();
  });

  it('refuses to move an entity that already finished', () => {
    const state = makeState(level, { finishedEntityIds: ['robot-1'] });
    expect(executeMove(level, state, 1, 0)).toBeNull();
  });

  it('refuses to move an unknown entity id', () => {
    const state = makeState(level, { selectedEntityId: 'ghost' });
    expect(executeMove(level, state, 1, 0)).toBeNull();
  });
});

describe('basic movement', () => {
  const level = makeLevel(['RRR', 'RRR', 'RRR'], [robot('robot-1', 1, 1, 'red')]);

  it('moves the selected entity and records the step', () => {
    const next = executeMove(level, makeState(level), 1, 0)!;
    expect(next).not.toBeNull();
    expect(posOf(next, 'robot-1')).toEqual({ x: 2, y: 1 });
    expect(next.moves['robot-1']).toBe(1);
    expect(next.history['robot-1']).toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
    expect(next.message).toBe('');
  });

  it('moves in all four directions', () => {
    const state = makeState(level);
    expect(posOf(executeMove(level, state, 0, -1)!, 'robot-1')).toEqual({ x: 1, y: 0 });
    expect(posOf(executeMove(level, state, 0, 1)!, 'robot-1')).toEqual({ x: 1, y: 2 });
    expect(posOf(executeMove(level, state, -1, 0)!, 'robot-1')).toEqual({ x: 0, y: 1 });
    expect(posOf(executeMove(level, state, 1, 0)!, 'robot-1')).toEqual({ x: 2, y: 1 });
  });

  it('does not mutate the state it was given', () => {
    const state = makeState(level);
    executeMove(level, state, 1, 0);
    expect(state.entities[0].position).toEqual({ x: 1, y: 1 });
    expect(state.moves['robot-1']).toBe(0);
    expect(state.history['robot-1']).toEqual([{ x: 1, y: 1 }]);
  });

  it('blocks movement past the grid edge', () => {
    const edge = makeLevel(['RR'], [robot('robot-1', 0, 0, 'red')]);
    const state = makeState(edge);
    expect(executeMove(edge, state, -1, 0)).toBeNull();
    expect(executeMove(edge, state, 0, -1)).toBeNull();
    expect(executeMove(edge, state, 0, 1)).toBeNull();
  });

  it('blocks movement into a wall', () => {
    const walled = makeLevel(['RWR'], [robot('robot-1', 0, 0, 'red')]);
    expect(executeMove(walled, makeState(walled), 1, 0)).toBeNull();
  });

  it('blocks movement into an empty (non-floor) tile', () => {
    const gap = makeLevel(['R.R'], [robot('robot-1', 0, 0, 'red')]);
    expect(executeMove(gap, makeState(gap), 1, 0)).toBeNull();
  });
});

describe('entity collisions', () => {
  const level = makeLevel(
    ['RRR'],
    [robot('robot-1', 0, 0, 'red'), robot('robot-2', 1, 0, 'blue')],
  );

  it('blocks movement onto an active entity', () => {
    expect(executeMove(level, makeState(level), 1, 0)).toBeNull();
  });

  it('allows movement onto a finished entity’s tile', () => {
    const state = makeState(level, { finishedEntityIds: ['robot-2'] });
    const next = executeMove(level, state, 1, 0)!;
    expect(posOf(next, 'robot-1')).toEqual({ x: 1, y: 0 });
  });
});

describe('doors', () => {
  const level = makeLevel(['RDR'], [robot('robot-1', 0, 0, 'red')]);

  it('blocks an entity of the wrong color and explains why', () => {
    const next = executeMove(level, makeState(level), 1, 0)!;
    expect(next.message).toBe('Locked! You need to be blue to pass.');
    expect(posOf(next, 'robot-1')).toEqual({ x: 0, y: 0 });
    expect(next.moves['robot-1']).toBe(0);
  });

  it('lets a matching-color entity through', () => {
    const blue = makeLevel(['RDR'], [robot('robot-1', 0, 0, 'blue')]);
    const next = executeMove(blue, makeState(blue), 1, 0)!;
    expect(posOf(next, 'robot-1')).toEqual({ x: 1, y: 0 });
  });

  it('lets any entity through once the matching color is toggled on', () => {
    const state = makeState(level, { toggledColors: ['blue'] });
    const next = executeMove(level, state, 1, 0)!;
    expect(posOf(next, 'robot-1')).toEqual({ x: 1, y: 0 });
  });
});

describe('switches', () => {
  const level = makeLevel(['RSR'], [robot('robot-1', 0, 0, 'red')]);

  it('toggles its color on when stepped on', () => {
    const next = executeMove(level, makeState(level), 1, 0)!;
    expect(next.toggledColors).toEqual(['blue']);
  });

  it('toggles its color back off when stepped on again', () => {
    const state = makeState(level, { toggledColors: ['blue'] });
    const next = executeMove(level, state, 1, 0)!;
    expect(next.toggledColors).toEqual([]);
  });
});

describe('paint', () => {
  it('repaints the entity that steps on it', () => {
    const level = makeLevel(['RPR'], [robot('robot-1', 0, 0, 'red')]);
    const next = executeMove(level, makeState(level), 1, 0)!;
    expect(next.entities[0].color).toBe('green');
  });
});

describe('locks', () => {
  const level = makeLevel(
    ['RLR'],
    [robot('robot-1', 0, 0, 'red'), robot('robot-2', 2, 0, 'blue')],
  );

  it('blocks a non-matching entity and explains why', () => {
    const state = makeState(level, { selectedEntityId: 'robot-2' });
    const next = executeMove(level, state, -1, 0)!;
    expect(next.message).toBe('Locked! Only a red character can open this.');
    expect(posOf(next, 'robot-2')).toEqual({ x: 2, y: 0 });
  });

  it('records the lock as opened when a matching entity steps on it', () => {
    const next = executeMove(level, makeState(level), 1, 0)!;
    expect(next.openedLocks).toEqual(['1,0']);
    expect(posOf(next, 'robot-1')).toEqual({ x: 1, y: 0 });
  });

  it('stays open for every entity afterwards', () => {
    const state = makeState(level, { selectedEntityId: 'robot-2', openedLocks: ['1,0'] });
    const next = executeMove(level, state, -1, 0)!;
    expect(posOf(next, 'robot-2')).toEqual({ x: 1, y: 0 });
    expect(next.message).toBe('');
  });
});

describe('one-way tiles', () => {
  const level = makeLevel(['RRR', 'R>R', 'RRR'], [robot('robot-1', 1, 1, 'red')]);

  it('allows entry from the matching direction', () => {
    const from = makeLevel(['R>R'], [robot('robot-1', 0, 0, 'red')]);
    const next = executeMove(from, makeState(from), 1, 0)!;
    expect(posOf(next, 'robot-1')).toEqual({ x: 1, y: 0 });
  });

  it('rejects entry from any other direction', () => {
    const from = makeLevel(['R>R'], [robot('robot-1', 2, 0, 'red')]);
    const next = executeMove(from, makeState(from), -1, 0)!;
    expect(next.message).toBe("Can't enter from this direction!");
    expect(posOf(next, 'robot-1')).toEqual({ x: 2, y: 0 });
  });

  it('is unreachable from above when it points right', () => {
    const above = makeLevel(['RRR', 'R>R'], [robot('robot-1', 1, 0, 'red')]);
    const next = executeMove(above, makeState(above), 0, 1)!;
    expect(next.message).toBe("Can't enter from this direction!");
    expect(level.tiles[1][1].type).toBe('one-way');
  });
});

describe('goals', () => {
  it('finishes the entity and wins when it is the only one', () => {
    const level = makeLevel(['Rg'], [robot('robot-1', 0, 0, 'red', 'exit-red')]);
    const next = executeMove(level, makeState(level), 1, 0)!;
    expect(next.finishedEntityIds).toEqual(['robot-1']);
    expect(next.status).toBe('won');
    expect(next.message).toBe('You did it! All characters reached their exits!');
    expect(next.selectedEntityId).toBeNull();
  });

  it('rejects a goal of the wrong color without finishing', () => {
    const level = makeLevel(['Rb'], [robot('robot-1', 0, 0, 'red', 'exit-red')]);
    const next = executeMove(level, makeState(level), 1, 0)!;
    expect(next.message).toBe('Wrong house! This is the blue house.');
    expect(next.finishedEntityIds).toEqual([]);
    expect(next.status).toBe('playing');
    expect(posOf(next, 'robot-1')).toEqual({ x: 1, y: 0 });
  });

  it('accepts an uncolored goal from any entity', () => {
    const level = makeLevel(['RG'], [robot('robot-1', 0, 0, 'red', 'exit-common')]);
    const next = executeMove(level, makeState(level), 1, 0)!;
    expect(next.status).toBe('won');
  });

  it('ignores goal tiles for an entity with no reach-goal rule', () => {
    const level = makeLevel(['RG'], [robot('robot-1', 0, 0, 'red')]);
    const next = executeMove(level, makeState(level), 1, 0)!;
    expect(next.finishedEntityIds).toEqual([]);
    expect(next.status).toBe('playing');
    expect(next.message).toBe('');
    expect(posOf(next, 'robot-1')).toEqual({ x: 1, y: 0 });
  });

  it('keeps playing and hands selection to the next entity', () => {
    const level = makeLevel(
      ['Rg', 'Rb'],
      [
        robot('robot-1', 0, 0, 'red', 'exit-red'),
        robot('robot-2', 0, 1, 'blue', 'exit-blue'),
      ],
    );
    const next = executeMove(level, makeState(level), 1, 0)!;
    expect(next.status).toBe('playing');
    expect(next.message).toBe('Great job! robot reached home safely!');
    expect(next.finishedEntityIds).toEqual(['robot-1']);
    expect(next.selectedEntityId).toBe('robot-2');
  });

  it('wins once the last entity reaches its goal', () => {
    const level = makeLevel(
      ['Rg', 'Rb'],
      [
        robot('robot-1', 0, 0, 'red', 'exit-red'),
        robot('robot-2', 0, 1, 'blue', 'exit-blue'),
      ],
    );
    const first = executeMove(level, makeState(level), 1, 0)!;
    const second = executeMove(level, first, 1, 0)!;
    expect(second.status).toBe('won');
    expect(second.finishedEntityIds).toEqual(['robot-1', 'robot-2']);
    expect(second.selectedEntityId).toBeNull();
  });
});
