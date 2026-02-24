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

export const CAMPAIGN_LEVELS: CampaignLevel[] = [level1, level2];
