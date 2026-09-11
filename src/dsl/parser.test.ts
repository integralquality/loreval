import { describe, expect, it } from 'vitest';
import { parseDSL } from './parser';

/** Minimal 3x3 room: walls around a single walkable centre tile. */
function room(center: string, extra = ''): string {
  return `level "Tiny" 3x3

grid = [
  W W W,
  W ${center} W,
  W W W,
]
${extra}`;
}

describe('header', () => {
  it('parses name and dimensions', () => {
    const { level, errors } = parseDSL(room('R'));
    expect(errors).toEqual([]);
    expect(level).not.toBeNull();
    expect(level!.name).toBe('Tiny');
    expect(level!.width).toBe(3);
    expect(level!.height).toBe(3);
  });

  it('slugifies the name into the level id', () => {
    const { level } = parseDSL(`level "My Great Level" 3x3

grid = [
  W W W,
  W R W,
  W W W,
]`);
    expect(level!.id).toBe('my-great-level');
  });

  it('reports a missing header', () => {
    const { level, errors } = parseDSL(`grid = [
  W W W,
]`);
    expect(level).toBeNull();
    expect(errors.some(e => /Missing (level )?header/.test(e.message))).toBe(true);
  });

  it('reports a malformed header with its line number', () => {
    const { level, errors } = parseDSL(`level Tiny 3x3

grid = [
  W W W,
]`);
    expect(level).toBeNull();
    expect(errors[0]).toMatchObject({ line: 1 });
    expect(errors[0].message).toContain('level "name" WxH');
  });

  it('reports a missing grid', () => {
    const { level, errors } = parseDSL('level "Tiny" 3x3');
    expect(level).toBeNull();
    expect(errors.some(e => e.message === 'No grid rows found')).toBe(true);
  });
});

describe('grid', () => {
  it('maps the built-in characters', () => {
    const { level } = parseDSL(`level "Tiny" 3x3

grid = [
  W R .,
  W R .,
  W R .,
]`);
    expect(level!.tiles[0].map(t => t.type)).toEqual(['wall', 'floor-white', 'empty']);
  });

  it('records the tile coordinates on every tile', () => {
    const { level } = parseDSL(room('R'));
    expect(level!.tiles[1][2]).toMatchObject({ x: 2, y: 1 });
  });

  it('maps arrow shorthand to one-way tiles', () => {
    const { level } = parseDSL(`level "Arrows" 4x1

grid = [
  ^ v < >,
]`);
    expect(level!.tiles[0].map(t => t.meta?.direction)).toEqual(['up', 'down', 'left', 'right']);
    expect(level!.tiles[0].every(t => t.type === 'one-way')).toBe(true);
  });

  it('accepts the legacy bracket-less grid block', () => {
    const { level, errors } = parseDSL(`level "Legacy" 3x2

grid:
  W W W
  W R W

agent(red) start(1,1)`);
    expect(errors).toEqual([]);
    expect(level!.tiles).toHaveLength(2);
    expect(level!.tiles[1][1].type).toBe('floor-white');
  });

  it('flags a bracket grid row that is missing its comma', () => {
    const { errors } = parseDSL(`level "Tiny" 3x2

grid = [
  W W W,
  W R W
]`);
    expect(errors.some(e => e.message === 'Missing comma at end of grid row')).toBe(true);
  });

  it('flags a row count that disagrees with the header', () => {
    const { level, errors } = parseDSL(`level "Tiny" 3x3

grid = [
  W W W,
  W R W,
]`);
    expect(level).toBeNull();
    expect(errors.some(e => e.message === 'Expected 3 grid rows, got 2')).toBe(true);
  });

  it('flags a row whose token count disagrees with the header', () => {
    const { level, errors } = parseDSL(`level "Tiny" 3x1

grid = [
  W W W W,
]`);
    expect(level).toBeNull();
    expect(errors.some(e => e.message === 'Grid row 1 has 4 tokens, expected 3')).toBe(true);
  });

  it('flags an unknown grid character', () => {
    const { level, errors } = parseDSL(room('Z'));
    expect(level).toBeNull();
    expect(errors.some(e => e.message === "Unknown character 'Z' in grid at (1, 1)")).toBe(true);
  });

  it('ignores comments and blank lines', () => {
    const { level, errors } = parseDSL(`# a comment
level "Tiny" 3x1

# another comment
grid = [
  W R W,
]

# trailing comment`);
    expect(errors).toEqual([]);
    expect(level!.tiles[0]).toHaveLength(3);
  });

  it('normalises CRLF line endings', () => {
    const { level, errors } = parseDSL('level "Tiny" 3x1\r\n\r\ngrid = [\r\n  W R W,\r\n]\r\n');
    expect(errors).toEqual([]);
    expect(level!.tiles[0].map(t => t.type)).toEqual(['wall', 'floor-white', 'wall']);
  });
});

describe('tile declarations', () => {
  it('parses function syntax with a color', () => {
    const { level, errors } = parseDSL(room('D', '\ntile D = tiles.door(blue)'));
    expect(errors).toEqual([]);
    expect(level!.tiles[1][1]).toMatchObject({ type: 'door', color: 'blue' });
  });

  it('treats commonGoal() as an uncolored goal', () => {
    const { level } = parseDSL(room('G', '\ntile G = tiles.commonGoal()'));
    expect(level!.tiles[1][1].type).toBe('goal');
    expect(level!.tiles[1][1].color).toBeUndefined();
  });

  it('parses a one-way direction argument', () => {
    const { level } = parseDSL(room('O', '\ntile O = tiles.one-way(left)'));
    expect(level!.tiles[1][1]).toMatchObject({ type: 'one-way', meta: { direction: 'left' } });
  });

  it('rejects a one-way without a valid direction', () => {
    const { level, errors } = parseDSL(room('O', '\ntile O = tiles.one-way(sideways)'));
    expect(level).toBeNull();
    expect(errors[0].message).toContain('one-way requires a direction');
  });

  it('parses the legacy colon spec, including meta', () => {
    const { level, errors } = parseDSL(room('G', '\ntile G = tiles.goal:orange:id=goal-1'));
    expect(errors).toEqual([]);
    expect(level!.tiles[1][1]).toMatchObject({
      type: 'goal',
      color: 'orange',
      meta: { id: 'goal-1' },
    });
  });

  it('parses the legacy let declaration', () => {
    const { level, errors } = parseDSL(room('P', '\nlet P = paint(green)'));
    expect(errors).toEqual([]);
    expect(level!.tiles[1][1]).toMatchObject({ type: 'paint', color: 'green' });
  });

  it('rejects an unknown tile type', () => {
    const { level, errors } = parseDSL(room('T', '\ntile T = tiles.trampoline(red)'));
    expect(level).toBeNull();
    expect(errors[0].message).toBe('Unknown tile type "trampoline"');
  });

  it('refuses to redefine a built-in character', () => {
    const { level, errors } = parseDSL(room('R', '\ntile W = tiles.goal(red)'));
    expect(level).toBeNull();
    expect(errors[0].message).toBe("Character 'W' is a built-in and cannot be redefined");
  });

  it('refuses to define the same character twice', () => {
    const { level, errors } = parseDSL(
      room('G', '\ntile G = tiles.goal(red)\ntile G = tiles.goal(blue)'),
    );
    expect(level).toBeNull();
    expect(errors[0].message).toBe("Character 'G' is already defined");
  });

  it('reports an unrecognised body line', () => {
    const { level, errors } = parseDSL(room('R', '\nwobble the grid'));
    expect(level).toBeNull();
    expect(errors[0].message).toBe('Unexpected: "wobble the grid"');
  });
});

describe('goal ids', () => {
  it('derives an auto id from the goal color', () => {
    const { level } = parseDSL(room('G', '\ntile G = tiles.goal(orange)'));
    expect(level!.tiles[1][1].meta?.id).toBe('exit-orange');
  });

  it('numbers uncolored goals', () => {
    const { level } = parseDSL(`level "Goals" 3x1

grid = [
  G . G,
]

tile G = tiles.commonGoal()`);
    expect(level!.tiles[0][0].meta?.id).toBe('exit-1');
    expect(level!.tiles[0][2].meta?.id).toBe('exit-2');
  });

  it('keeps an explicit id from the declaration', () => {
    const { level } = parseDSL(room('G', '\nlet G = goal:orange:id=my-exit'));
    expect(level!.tiles[1][1].meta?.id).toBe('my-exit');
  });
});

describe('agents', () => {
  it('resolves a reach target to the goal tile id', () => {
    const { level, errors, warnings } = parseDSL(
      room('G', '\ntile G = tiles.goal(orange)\n\nagent(orange) start(1,1) and reach(1,1)'),
    );
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(level!.entities).toHaveLength(1);
    expect(level!.entities[0]).toMatchObject({
      id: 'robot-1',
      type: 'robot',
      color: 'orange',
      position: { x: 1, y: 1 },
      rules: [{ id: 'robot-1-r1', type: 'reach-goal', targetId: 'exit-orange' }],
    });
  });

  it('numbers agents in declaration order', () => {
    const { level } = parseDSL(`level "Two" 3x1

grid = [
  R R R,
]

agent(red) start(0,0)
agent(blue) start(2,0)`);
    expect(level!.entities.map(e => e.id)).toEqual(['robot-1', 'robot-2']);
    expect(level!.entities.map(e => e.color)).toEqual(['red', 'blue']);
  });

  it('accepts the bare "agent color" form', () => {
    const { level, errors } = parseDSL(room('R', '\nagent red start(1,1)'));
    expect(errors).toEqual([]);
    expect(level!.entities[0].color).toBe('red');
  });

  it('treats the color "none" as no color', () => {
    const { level } = parseDSL(room('R', '\nagent(none) start(1,1)'));
    expect(level!.entities[0].color).toBeUndefined();
  });

  it('warns when an agent has no goal but still produces a level', () => {
    const { level, errors, warnings } = parseDSL(room('R', '\nagent(red) start(1,1)'));
    expect(errors).toEqual([]);
    expect(level).not.toBeNull();
    expect(level!.entities[0].rules).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('has no goal');
  });

  it('warns when the reach target is not a goal tile', () => {
    const { level, errors, warnings } = parseDSL(
      room('R', '\nagent(red) start(1,1) and reach(1,1)'),
    );
    expect(errors).toEqual([]);
    expect(warnings[0].message).toContain('is "floor-white", not a goal');
    expect(level!.entities[0].rules[0]).toMatchObject({
      type: 'reach-goal',
      targetId: 'goal-1-1',
    });
  });

  it('rejects a start position outside the grid', () => {
    const { level, errors } = parseDSL(room('R', '\nagent(red) start(9,9)'));
    expect(level).toBeNull();
    expect(errors[0].message).toContain('start(9,9) is outside grid bounds (3x3)');
  });

  it('rejects a reach position outside the grid', () => {
    const { level, errors } = parseDSL(room('R', '\nagent(red) start(1,1) and reach(9,9)'));
    expect(level).toBeNull();
    expect(errors[0].message).toContain('reach(9,9) is outside grid bounds (3x3)');
  });

  it('rejects a malformed agent line', () => {
    const { level, errors } = parseDSL(room('R', '\nagent(red) begin(1,1)'));
    expect(level).toBeNull();
    expect(errors[0].message).toBe('Unexpected: "agent(red) begin(1,1)"');
  });
});

describe('agent rules', () => {
  it('parses a valued rule alongside the implicit reach-goal', () => {
    const { level, errors } = parseDSL(
      room('G', '\ntile G = tiles.goal(red)\n\nagent(red) start(1,1) and reach(1,1) [max-steps:12]'),
    );
    expect(errors).toEqual([]);
    expect(level!.entities[0].rules).toEqual([
      { id: 'robot-1-r1', type: 'reach-goal', targetId: 'exit-red' },
      { id: 'robot-1-r2', type: 'max-steps', value: 12 },
    ]);
  });

  it('parses several rules separated by commas', () => {
    const { level } = parseDSL(room('R', '\nagent(red) start(1,1) [max-steps:3, reach-goal]'));
    expect(level!.entities[0].rules.map(r => r.type)).toEqual(['max-steps', 'reach-goal']);
  });

  it('rejects an unknown rule type', () => {
    const { level, errors } = parseDSL(room('R', '\nagent(red) start(1,1) [fly]'));
    expect(level).toBeNull();
    expect(errors[0].message).toBe('Unknown rule type "fly"');
  });

  it('rejects a non-numeric rule value', () => {
    const { level, errors } = parseDSL(room('R', '\nagent(red) start(1,1) [max-steps:lots]'));
    expect(level).toBeNull();
    expect(errors[0].message).toBe('Invalid rule value in "max-steps:lots"');
  });
});
