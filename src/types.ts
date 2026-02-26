export type Position = {
  x: number;
  y: number;
};

export type Direction = 'up' | 'down' | 'left' | 'right';

export type TileType =
  | 'empty'
  | 'wall'
  | 'floor'
  | 'floor-white'
  | 'goal'
  | 'start'
  | 'door'
  | 'paint'
  | 'switch'
  | 'one-way'
  | 'lock';

export type EntityType =
  | 'player'
  | 'dog'
  | 'cat'
  | 'rabbit'
  | 'robot';

export type RuleType =
  | 'reach-goal'
  | 'max-steps';

export interface Rule {
  id: string;
  type: RuleType;
  targetId?: string; // For reach-goal
  value?: number; // For max-steps
}

export interface Entity {
  id: string;
  type: EntityType;
  position: Position;
  color?: string;
  rules: Rule[];
}

export interface TileMeta {
  id?: string;
  direction?: Direction;
}

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  color?: string;
  meta?: TileMeta;
}

export interface Level {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: Tile[][];
  entities: Entity[];
}

export interface GameState {
  entities: Entity[];
  moves: Record<string, number>;
  history: Record<string, Position[]>;
  status: 'playing' | 'won' | 'lost';
  message: string;
  selectedEntityId: string | null;
  toggledColors: string[];
  finishedEntityIds: string[];
  openedLocks: string[];
}

export const TILE_SIZE = 56;
