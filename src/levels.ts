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
  'R': () => ({ type: 'floor-white' }),
  'W': () => ({ type: 'wall' }),
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
const level1 = buildLevel({
  id: 'level-1',
  name: 'First Steps',
  description: 'Guide the agent through the maze to the exit.',
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
      id: 'robot-1',
      type: 'robot',
      position: { x: 1, y: 0 },
      color: 'orange',
      rules: [{ id: 'r1', type: 'reach-goal', targetId: 'exit-orange' }],
    },
  ],
  charMap: {
    'F': () => ({ type: 'goal', color: 'orange', meta: { id: 'exit-orange' } }),
  },
});

// ─── Level 2: Switch & Door ─────────────────────────────────
const level2 = buildLevel({
  id: 'level-2',
  name: 'Switch & Door',
  description: 'Find the switch to open the door blocking your path.',
  number: 2,
  width: 8,
  height: 7,
  layout: [
    '.  R  R  R  R  W  R  .',
    '.  R  W  W  R  W  R  .',
    '.  R  W  S  R  W  R  .',
    '.  R  W  W  W  D  R  .',
    '.  R  R  R  R  W  R  .',
    '.  W  W  W  R  R  R  .',
    '.  R  R  R  R  R  F  .',
  ],
  entities: [
    {
      id: 'robot-1',
      type: 'robot',
      position: { x: 1, y: 0 },
      color: 'orange',
      rules: [{ id: 'r1', type: 'reach-goal', targetId: 'exit-orange' }],
    },
  ],
  charMap: {
    'F': () => ({ type: 'goal', color: 'orange', meta: { id: 'exit-orange' } }),
    'S': () => ({ type: 'switch', color: 'blue' }),
    'D': () => ({ type: 'door', color: 'blue' }),
  },
});

// ─── Level 3: Full Challenge ─────────────────────────────
const level3 = buildLevel({
  id: 'level-3',
  name: 'Full Challenge',
  description: 'Four agents, four exits, four different paths.',
  number: 3,
  width: 10,
  height: 10,
  layout: [
    '.  R  R  R  R  R  R  R  R  .',
    '.  R  R  R  R  W  R  R  1  .',
    '.  R  R  W  W  R  W  W  R  .',
    '.  R  R  S  R  R  R  D  4  .',
    '.  W  W  W  R  R  R  W  R  .',
    '.  R  R  R  R  R  >  R  2  .',
    '.  R  R  W  P  W  R  W  R  .',
    '.  R  R  R  R  R  R  R  R  .',
    '.  R  R  R  R  R  R  R  3  .',
    '.  R  R  R  R  R  R  R  R  .',
  ],
  entities: [
    {
      id: 'robot-1',
      type: 'robot',
      position: { x: 2, y: 1 },
      color: 'orange',
      rules: [{ id: 'r1', type: 'reach-goal', targetId: 'exit-orange' }],
    },
    {
      id: 'robot-2',
      type: 'robot',
      position: { x: 2, y: 3 },
      color: 'red',
      rules: [{ id: 'r3', type: 'reach-goal', targetId: 'exit-red' }],
    },
    {
      id: 'robot-3',
      type: 'robot',
      position: { x: 1, y: 5 },
      color: 'purple',
      rules: [{ id: 'r4', type: 'reach-goal', targetId: 'exit-purple' }],
    },
    {
      id: 'robot-4',
      type: 'robot',
      position: { x: 1, y: 9 },
      color: 'pink',
      rules: [{ id: 'r6', type: 'reach-goal', targetId: 'exit-pink' }],
    },
  ],
  charMap: {
    'S': () => ({ type: 'switch', color: 'blue' }),
    'D': () => ({ type: 'door', color: 'blue' }),
    'P': () => ({ type: 'paint', color: 'blue' }),
    '>': () => ({ type: 'one-way', meta: { direction: 'right' as Direction } }),
    '1': () => ({ type: 'goal', color: 'orange', meta: { id: 'exit-orange' } }),
    '2': () => ({ type: 'goal', color: 'purple', meta: { id: 'exit-purple' } }),
    '3': () => ({ type: 'goal', color: 'pink', meta: { id: 'exit-pink' } }),
    '4': () => ({ type: 'goal', color: 'red', meta: { id: 'exit-red' } }),
  },
});

// ─── Level 4: The Swap ───────────────────────────────────
const level4 = buildLevel({
  id: 'level-4',
  name: 'The Swap',
  description: 'Two agents need to swap places. Use the alcove to let one pass.',
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
      id: 'robot-1',
      type: 'robot',
      position: { x: 2, y: 1 },
      color: 'purple',
      rules: [{ id: 'r1', type: 'reach-goal' }],
    },
    {
      id: 'robot-2',
      type: 'robot',
      position: { x: 5, y: 1 },
      color: 'orange',
      rules: [{ id: 'r2', type: 'reach-goal' }],
    },
  ],
  charMap: {
    '1': () => ({ type: 'goal', color: 'orange', meta: { id: 'exit-orange' } }),
    '2': () => ({ type: 'goal', color: 'purple', meta: { id: 'exit-purple' } }),
  },
});

// ─── Level 5: Sort It Out ────────────────────────────────
const level5 = buildLevel({
  id: 'level-5',
  name: 'Sort It Out',
  description: 'Three agents in the wrong order. Shuffle them to their exits.',
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
      id: 'robot-1',
      type: 'robot',
      position: { x: 2, y: 1 },
      color: 'pink',
      rules: [{ id: 'r1', type: 'reach-goal' }],
    },
    {
      id: 'robot-2',
      type: 'robot',
      position: { x: 5, y: 1 },
      color: 'orange',
      rules: [{ id: 'r2', type: 'reach-goal' }],
    },
    {
      id: 'robot-3',
      type: 'robot',
      position: { x: 7, y: 1 },
      color: 'purple',
      rules: [{ id: 'r3', type: 'reach-goal' }],
    },
  ],
  charMap: {
    '1': () => ({ type: 'goal', color: 'orange', meta: { id: 'exit-orange' } }),
    '2': () => ({ type: 'goal', color: 'purple', meta: { id: 'exit-purple' } }),
    '3': () => ({ type: 'goal', color: 'pink', meta: { id: 'exit-pink' } }),
  },
});

export const CAMPAIGN_LEVELS: CampaignLevel[] = [level1, level2, level3, level4, level5];
