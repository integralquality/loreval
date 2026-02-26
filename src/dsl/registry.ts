import type { TileType, EntityType, RuleType, Direction } from '../types';

/** Built-in single-char tile mappings — always available, cannot be overridden by legend */
export const BUILTIN_CHARS: Record<string, { type: TileType }> = {
  '.': { type: 'empty' },
  'W': { type: 'wall' },
  'R': { type: 'floor-white' },
};

/** All valid tile type strings */
export const TILE_TYPE_SET = new Set<TileType>([
  'empty', 'wall', 'floor', 'floor-white', 'goal', 'start',
  'door', 'paint', 'switch', 'one-way', 'lock',
]);

/** All valid entity type strings */
export const ENTITY_TYPE_SET = new Set<EntityType>([
  'player', 'dog', 'cat', 'rabbit', 'robot',
]);

/** All valid rule type strings */
export const RULE_TYPE_SET = new Set<RuleType>([
  'reach-goal', 'max-steps',
]);

/** All valid direction strings */
export const DIRECTION_SET = new Set<Direction>([
  'up', 'down', 'left', 'right',
]);

/** Arrow chars → Direction (used by parser for one-way shorthand) */
export const ARROW_DIRECTIONS: Record<string, Direction> = {
  '^': 'up',
  'v': 'down',
  '<': 'left',
  '>': 'right',
};

/** Direction → arrow char (used by serializer) */
export const DIRECTION_ARROWS: Record<Direction, string> = {
  up: '^',
  down: 'v',
  left: '<',
  right: '>',
};
