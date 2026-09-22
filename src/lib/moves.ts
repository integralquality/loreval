/** Move primitives shared by the AI client, interactive playback, and the eval scorer. */
import type { Direction } from '../types';

export interface AiMove {
  x: number;
  y: number;
  direction: string;
}

export const DIRECTION_DELTAS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export function directionToDelta(dir: string): { dx: number; dy: number } | null {
  return DIRECTION_DELTAS[dir as Direction] ?? null;
}

export function formatMove(move: AiMove): string {
  return `(${move.x},${move.y}) ${move.direction}`;
}

export function formatMoves(moves: AiMove[]): string {
  return moves.map(formatMove).join('\n');
}
