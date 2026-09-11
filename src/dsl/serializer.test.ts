import { describe, expect, it } from 'vitest';
import { serializeDSL } from './serializer';
import { parseDSL } from './parser';
import type { Entity, Level, Tile } from '../types';

function grid(rows: Array<Array<Partial<Tile>>>): Tile[][] {
  return rows.map((row, y) =>
    row.map((t, x) => ({ x, y, type: 'empty', ...t }) as Tile),
  );
}

function makeLevel(tiles: Tile[][], entities: Entity[] = [], name = 'Test'): Level {
  return {
    id: 'test',
    name,
    width: tiles[0].length,
    height: tiles.length,
    tiles,
    entities,
  };
}

/** Extract the grid rows of a serialized level, without indentation or commas. */
function gridRows(dsl: string): string[] {
  const lines = dsl.split('\n');
  const start = lines.indexOf('grid = [');
  const end = lines.indexOf(']');
  return lines.slice(start + 1, end).map(l => l.trim().replace(/,$/, ''));
}

describe('header', () => {
  it('writes the name and dimensions', () => {
    const dsl = serializeDSL(makeLevel(grid([[{ type: 'wall' }, { type: 'wall' }]]), [], 'Cave'));
    expect(dsl.split('\n')[0]).toBe('level "Cave" 2x1');
  });

  it('escapes quotes in the name', () => {
    const dsl = serializeDSL(makeLevel(grid([[{ type: 'wall' }]]), [], 'The "Big" Room'));
    expect(dsl.split('\n')[0]).toBe('level "The \\"Big\\" Room" 1x1');
  });
});

describe('grid characters', () => {
  it('uses the built-in characters for plain tiles', () => {
    const dsl = serializeDSL(
      makeLevel(grid([[{ type: 'wall' }, { type: 'floor-white' }, { type: 'empty' }]])),
    );
    expect(gridRows(dsl)).toEqual(['W R .']);
  });

  it('uses arrow shorthand for a bare one-way tile', () => {
    const dsl = serializeDSL(
      makeLevel(
        grid([
          [
            { type: 'one-way', meta: { direction: 'up' } },
            { type: 'one-way', meta: { direction: 'down' } },
            { type: 'one-way', meta: { direction: 'left' } },
            { type: 'one-way', meta: { direction: 'right' } },
          ],
        ]),
      ),
    );
    expect(gridRows(dsl)).toEqual(['^ v < >']);
    expect(dsl).not.toContain('tile ');
  });

  it('declares a legend entry for a colored tile', () => {
    const dsl = serializeDSL(
      makeLevel(grid([[{ type: 'wall' }, { type: 'door', color: 'blue' }]])),
    );
    expect(dsl).toContain('tile D = tiles.door(blue)');
    expect(gridRows(dsl)).toEqual(['W D']);
  });

  it('reuses one character for identical tiles', () => {
    const dsl = serializeDSL(
      makeLevel(
        grid([[{ type: 'door', color: 'blue' }, { type: 'door', color: 'blue' }]]),
      ),
    );
    expect(gridRows(dsl)).toEqual(['D D']);
    expect(dsl.match(/^tile /gm)).toHaveLength(1);
  });

  it('falls back to the color initial when the type initial is taken', () => {
    const dsl = serializeDSL(
      makeLevel(
        grid([[{ type: 'goal', color: 'red' }, { type: 'goal', color: 'blue' }]]),
      ),
    );
    expect(gridRows(dsl)).toEqual(['G B']);
    expect(dsl).toContain('tile G = tiles.goal(red)');
    expect(dsl).toContain('tile B = tiles.goal(blue)');
  });

  it('writes commonGoal() for an uncolored goal', () => {
    const dsl = serializeDSL(makeLevel(grid([[{ type: 'goal' }]])));
    expect(dsl).toContain('tile G = tiles.commonGoal()');
  });

  it('treats goals sharing a color as one legend entry despite differing auto ids', () => {
    const dsl = serializeDSL(
      makeLevel(
        grid([
          [
            { type: 'goal', color: 'red', meta: { id: 'exit-red' } },
            { type: 'goal', color: 'red', meta: { id: 'exit-red-2' } },
          ],
        ]),
      ),
    );
    expect(gridRows(dsl)).toEqual(['G G']);
    expect(dsl.match(/^tile /gm)).toHaveLength(1);
  });

  it('sorts legend declarations by character', () => {
    const dsl = serializeDSL(
      makeLevel(
        grid([
          [
            { type: 'switch', color: 'blue' },
            { type: 'door', color: 'blue' },
            { type: 'paint', color: 'green' },
          ],
        ]),
      ),
    );
    const decls = dsl.split('\n').filter(l => l.startsWith('tile '));
    expect(decls.map(l => l.split(' ')[1])).toEqual(['D', 'P', 'S']);
  });
});

describe('agents', () => {
  it('writes color, start and the resolved reach position', () => {
    const level = makeLevel(
      grid([[{ type: 'floor-white' }, { type: 'goal', color: 'red', meta: { id: 'exit-red' } }]]),
      [
        {
          id: 'robot-1',
          type: 'robot',
          position: { x: 0, y: 0 },
          color: 'red',
          rules: [{ id: 'r1', type: 'reach-goal', targetId: 'exit-red' }],
        },
      ],
    );
    expect(serializeDSL(level)).toContain('agent(red) start(0,0) and reach(1,0)');
  });

  it('writes "none" for an entity with no color', () => {
    const level = makeLevel(grid([[{ type: 'floor-white' }]]), [
      { id: 'robot-1', type: 'robot', position: { x: 0, y: 0 }, rules: [] },
    ]);
    expect(serializeDSL(level)).toContain('agent(none) start(0,0)');
  });

  it('omits the reach clause when the goal id has no matching tile', () => {
    const level = makeLevel(grid([[{ type: 'floor-white' }]]), [
      {
        id: 'robot-1',
        type: 'robot',
        position: { x: 0, y: 0 },
        color: 'red',
        rules: [{ id: 'r1', type: 'reach-goal', targetId: 'nowhere' }],
      },
    ]);
    expect(serializeDSL(level)).toContain('agent(red) start(0,0)');
    expect(serializeDSL(level)).not.toContain('reach(');
  });

  it('appends non-goal rules in brackets', () => {
    const level = makeLevel(grid([[{ type: 'floor-white' }]]), [
      {
        id: 'robot-1',
        type: 'robot',
        position: { x: 0, y: 0 },
        color: 'red',
        rules: [{ id: 'r1', type: 'max-steps', value: 7 }],
      },
    ]);
    expect(serializeDSL(level)).toContain('agent(red) start(0,0) [max-steps:7]');
  });
});

describe('round trip', () => {
  const source = `level "Round Trip" 5x4

grid = [
  W W W W W,
  W R D G W,
  W S > P W,
  W W W W W,
]

tile D = tiles.door(blue)
tile G = tiles.goal(orange)
tile P = tiles.paint(green)
tile S = tiles.switch(blue)

agent(orange) start(1,1) and reach(3,1) [max-steps:20]
`;

  it('parses, serializes and reparses to an identical level', () => {
    const first = parseDSL(source);
    expect(first.errors).toEqual([]);

    const dsl = serializeDSL(first.level!);
    const second = parseDSL(dsl);
    expect(second.errors).toEqual([]);
    expect(second.level).toEqual(first.level);
  });

  it('is stable across a second serialization', () => {
    const once = serializeDSL(parseDSL(source).level!);
    const twice = serializeDSL(parseDSL(once).level!);
    expect(twice).toBe(once);
  });

  it('preserves tile types, colors and directions', () => {
    const level = parseDSL(serializeDSL(parseDSL(source).level!)).level!;
    expect(level.tiles[1][2]).toMatchObject({ type: 'door', color: 'blue' });
    expect(level.tiles[2][1]).toMatchObject({ type: 'switch', color: 'blue' });
    expect(level.tiles[2][2]).toMatchObject({ type: 'one-way', meta: { direction: 'right' } });
    expect(level.tiles[2][3]).toMatchObject({ type: 'paint', color: 'green' });
    expect(level.entities[0].rules.map(r => r.type)).toEqual(['reach-goal', 'max-steps']);
  });
});
