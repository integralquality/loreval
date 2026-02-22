import { LucideIcon } from 'lucide-react';

export type Position = {
  x: number;
  y: number;
};

export type TileType = 
  | 'empty' 
  | 'wall' 
  | 'floor' 
  | 'floor-white' 
  | 'floor-black' 
  | 'water' 
  | 'goal'
  | 'start'
  | 'door'
  | 'paint';

export type EntityType = 
  | 'player' 
  | 'dog' 
  | 'cat' 
  | 'rabbit'
  | 'robot';

export type RuleType = 
  | 'reach-goal'
  | 'parity-even'
  | 'parity-odd'
  | 'alternate-colors'
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

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  color?: string;
  meta?: any; // For extra data like pipe capacity
}

export interface Level {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: Tile[][];
  entities: Entity[];
}

export const TILE_SIZE = 48;
