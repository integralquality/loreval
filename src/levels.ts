import type { Level, Tile, TileType, Entity, Direction } from './types';

export interface CampaignLevel {
  number: number;
  name: string;
  description: string;
  level: Level;
}

interface LevelDef {
  id: string;
  name: string;
  description: string;
  number: number;
  width: number;
  height: number;
  layout: string[];
  entities: Entity[];
  charMap?: Record<string, () => Partial<Tile>>;
}

const BASE_CHARS: Record<string, () => Partial<Tile>> = {
  '.': () => ({ type: 'empty' }),
  'G': () => ({ type: 'floor-black' }),
  'R': () => ({ type: 'floor-white' }),
  'W': () => ({ type: 'wall' }),
  '~': () => ({ type: 'water' }),
  'I': () => ({ type: 'ice' }),
};

function buildLevel(def: LevelDef): CampaignLevel {
  const charMap = { ...BASE_CHARS, ...def.charMap };
  const tiles: Tile[][] = Array(def.height).fill(null).map((_, y) =>
    Array(def.width).fill(null).map((_, x) => {
      const chars = def.layout[y].trim().split(/\s+/);
      const ch = chars[x] || '.';
      const maker = charMap[ch] || charMap['.'];
      const tile = maker();
      return {
        x, y,
        type: (tile.type || 'empty') as TileType,
        ...(tile.color && { color: tile.color }),
        ...(tile.meta && { meta: tile.meta }),
      };
    })
  );

  return {
    number: def.number,
    name: def.name,
    description: def.description,
    level: {
      id: def.id,
      name: def.name,
      width: def.width,
      height: def.height,
      tiles,
      entities: def.entities,
    },
  };
}

// ─── Level 1: First Steps ──────────────────────────────────
// Simple maze. Dog must navigate to the exit.
// Dog at (1,1) → goal at (6,5). No parity rule.
const level1 = buildLevel({
  id: 'level-1',
  name: 'First Steps',
  description: 'Guide the dog through the maze to the exit.',
  number: 1,
  width: 8,
  height: 7,
  layout: [
    '.  R  R  R  R  R  R  .',
    '.  R  W  W  R  W  R  .',
    '.  R  R  R  R  W  R  .',
    '.  W  W  R  W  R  R  .',
    '.  R  R  R  R  R  W  .',
    '.  W  R  W  R  R  R  .',
    '.  R  R  R  R  R  F  .',
  ],
  entities: [
    {
      id: 'dog-1',
      type: 'dog',
      position: { x: 1, y: 0 },
      color: 'orange',
      rules: [{ id: 'r1', type: 'reach-goal', targetId: 'goal-1' }],
    },
  ],
  charMap: {
    'F': () => ({ type: 'goal', color: 'orange', meta: { id: 'goal-1' } }),
  },
});

// ─── Level 2: Alternate Path ───────────────────────────────
// Rabbit must alternate road/grass every step.
// Rabbit at (1,0) on grass. Goal at (6,6).
// The obvious path right along row 0 then down column 6 fails
// because column 6 has two roads in a row.
// Solution: go down column 1 (alternating G/R), then right along row 6.
const level2 = buildLevel({
  id: 'level-2',
  name: 'Alternate Path',
  description: 'The rabbit must alternate between road and grass every step.',
  number: 2,
  width: 8,
  height: 7,
  layout: [
    '.  G  R  G  R  G  R  .',
    '.  R  R  W  G  W  R  .',
    '.  G  W  R  R  G  R  .',
    '.  R  G  W  G  R  R  .',
    '.  G  R  G  R  G  R  .',
    '.  R  W  R  G  R  G  .',
    '.  G  R  G  R  G  F  .',
  ],
  entities: [
    {
      id: 'rabbit-1',
      type: 'rabbit',
      position: { x: 1, y: 0 },
      color: 'pink',
      rules: [
        { id: 'r1', type: 'reach-goal', targetId: 'goal-2' },
        { id: 'r2', type: 'alternate-colors' },
      ],
    },
  ],
  charMap: {
    'F': () => ({ type: 'goal', color: 'pink', meta: { id: 'goal-2' } }),
  },
});

// ─── Level 3: Full Challenge ─────────────────────────────
// 4 entities, each with unique rules and mechanics.
// Dog (2,1) → orange exit (8,1): parity-even, detour around wall at (5,1)
// Robot (2,3) → red exit (8,3): switch toggles blue door, slide across ice
// Cat (1,5) → purple exit (8,5): parity-odd, pass through one-way
// Rabbit (1,9) → pink exit (8,8): alternate road/grass terrain
const level3 = buildLevel({
  id: 'level-3',
  name: 'Full Challenge',
  description: 'Four characters, four exits, four different rules. Use every mechanic.',
  number: 3,
  width: 10,
  height: 10,
  layout: [
    '.  G  G  G  G  R  R  R  R  .',
    '.  G  R  R  R  W  R  R  1  .',
    '.  G  G  W  W  R  W  W  R  .',
    '.  R  R  S  I  I  I  D  4  .',
    '.  W  W  W  R  R  R  W  R  .',
    '.  R  R  R  R  R  >  R  2  .',
    '.  R  R  W  P  W  R  W  ~  .',
    '.  R  R  R  R  R  R  R  ~  .',
    '.  G  R  G  R  G  R  G  3  .',
    '.  R  R  R  R  R  R  R  R  .',
  ],
  entities: [
    {
      id: 'dog-1',
      type: 'dog',
      position: { x: 2, y: 1 },
      color: 'orange',
      rules: [
        { id: 'r1', type: 'reach-goal', targetId: 'goal-dog' },
        { id: 'r2', type: 'parity-even' },
      ],
    },
    {
      id: 'bot-1',
      type: 'robot',
      position: { x: 2, y: 3 },
      color: 'red',
      rules: [
        { id: 'r3', type: 'reach-goal', targetId: 'goal-bot' },
      ],
    },
    {
      id: 'cat-1',
      type: 'cat',
      position: { x: 1, y: 5 },
      color: 'purple',
      rules: [
        { id: 'r4', type: 'reach-goal', targetId: 'goal-cat' },
        { id: 'r5', type: 'parity-odd' },
      ],
    },
    {
      id: 'rabbit-1',
      type: 'rabbit',
      position: { x: 1, y: 9 },
      color: 'pink',
      rules: [
        { id: 'r6', type: 'reach-goal', targetId: 'goal-rabbit' },
        { id: 'r7', type: 'alternate-colors' },
      ],
    },
  ],
  charMap: {
    'S': () => ({ type: 'switch', color: 'blue' }),
    'D': () => ({ type: 'door', color: 'blue' }),
    'P': () => ({ type: 'paint', color: 'blue' }),
    '>': () => ({ type: 'one-way', meta: { direction: 'right' as Direction } }),
    '1': () => ({ type: 'goal', color: 'orange', meta: { id: 'goal-dog' } }),
    '2': () => ({ type: 'goal', color: 'purple', meta: { id: 'goal-cat' } }),
    '3': () => ({ type: 'goal', color: 'pink', meta: { id: 'goal-rabbit' } }),
    '4': () => ({ type: 'goal', color: 'red', meta: { id: 'goal-bot' } }),
  },
});

// ─── Level 4: The Swap ───────────────────────────────────
// 2 characters in a corridor with exits swapped.
// Dog at (5,1) needs orange exit at (1,1). Cat at (2,1) needs purple exit at (6,1).
// They block each other — one must step into the alcove (column 3) to let the other pass.
// Teaches: using temporary space to swap two items (like a temp variable).
const level4 = buildLevel({
  id: 'level-4',
  name: 'The Swap',
  description: 'Two characters need to swap places. Use the alcove to let one pass.',
  number: 4,
  width: 8,
  height: 3,
  layout: [
    '.  W  W  R  W  W  W  .',
    '.  1  R  R  R  R  2  .',
    '.  W  W  R  W  W  W  .',
  ],
  entities: [
    {
      id: 'cat-1',
      type: 'cat',
      position: { x: 2, y: 1 },
      color: 'purple',
      rules: [{ id: 'r1', type: 'reach-goal' }],
    },
    {
      id: 'dog-1',
      type: 'dog',
      position: { x: 5, y: 1 },
      color: 'orange',
      rules: [{ id: 'r2', type: 'reach-goal' }],
    },
  ],
  charMap: {
    '1': () => ({ type: 'goal', color: 'orange', meta: { id: 'goal-dog' } }),
    '2': () => ({ type: 'goal', color: 'purple', meta: { id: 'goal-cat' } }),
  },
});

// ─── Level 5: Sort It Out ────────────────────────────────
// 3 characters in reverse order. Exits require correct arrangement.
// Rabbit(2,1) needs to reach pink exit at (8,2).
// Dog(5,1) needs to reach orange exit at (1,1).
// Cat(7,1) needs to reach purple exit at (4,2).
// Alcoves above and below the corridor let characters pass each other.
// Teaches: multi-step sorting — bubble sort with temporary storage.
const level5 = buildLevel({
  id: 'level-5',
  name: 'Sort It Out',
  description: 'Three characters in the wrong order. Shuffle them to their exits.',
  number: 5,
  width: 10,
  height: 4,
  layout: [
    '.  W  R  R  R  R  R  R  W  .',
    '.  1  R  R  R  R  R  R  R  .',
    '.  W  R  R  2  R  R  R  3  .',
    '.  .  .  .  .  .  .  .  W  .',
  ],
  entities: [
    {
      id: 'rabbit-1',
      type: 'rabbit',
      position: { x: 2, y: 1 },
      color: 'pink',
      rules: [{ id: 'r1', type: 'reach-goal' }],
    },
    {
      id: 'dog-1',
      type: 'dog',
      position: { x: 5, y: 1 },
      color: 'orange',
      rules: [{ id: 'r2', type: 'reach-goal' }],
    },
    {
      id: 'cat-1',
      type: 'cat',
      position: { x: 7, y: 1 },
      color: 'purple',
      rules: [{ id: 'r3', type: 'reach-goal' }],
    },
  ],
  charMap: {
    '1': () => ({ type: 'goal', color: 'orange', meta: { id: 'goal-dog' } }),
    '2': () => ({ type: 'goal', color: 'purple', meta: { id: 'goal-cat' } }),
    '3': () => ({ type: 'goal', color: 'pink', meta: { id: 'goal-rabbit' } }),
  },
});

export const CAMPAIGN_LEVELS: CampaignLevel[] = [level1, level2, level3, level4, level5];
