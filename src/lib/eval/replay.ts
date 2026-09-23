/**
 * Headless replay of a proposed move list through the game engine.
 *
 * This is the scoring ground truth: `executeMove` is the only judge of whether
 * a move is legal, so the eval and the interactive playback can never disagree
 * about what a model's plan actually does.
 */
import { executeMove } from '../../gameLogic';
import type { GameState, Level } from '../../types';
import { directionToDelta, type AiMove } from '../moves';

/** What happened when one proposed move met the engine. */
export type MoveOutcome =
  /** Applied — an agent actually changed tiles. */
  | 'moved'
  /** No un-finished agent stands on the square the move names. */
  | 'no-agent'
  /** Direction string wasn't one of up/down/left/right. */
  | 'bad-direction'
  /** Engine rejected it outright: wall, edge of grid, or another agent. */
  | 'illegal'
  /** Engine accepted the attempt but the agent stayed put: door, lock, one-way. */
  | 'blocked';

/** Outcomes that mean the move did not advance the game. */
export const FAILED_OUTCOMES: MoveOutcome[] = ['no-agent', 'bad-direction', 'illegal', 'blocked'];

export interface AppliedMove {
  outcome: MoveOutcome;
  /** Next state — unchanged from the input unless outcome is 'moved'. */
  state: GameState;
  /** Engine message for a blocked move ("Locked! ..."), when there is one. */
  message?: string;
}

/**
 * Apply one proposed move. Shared by interactive playback and the eval scorer
 * so both interpret a model's plan identically.
 */
export function applyAiMove(level: Level, state: GameState, move: AiMove): AppliedMove {
  const entity = state.entities.find(
    e => e.position.x === move.x && e.position.y === move.y && !state.finishedEntityIds.includes(e.id),
  );
  if (!entity) return { outcome: 'no-agent', state };

  const delta = directionToDelta(move.direction);
  if (!delta) return { outcome: 'bad-direction', state };

  const next = executeMove(level, { ...state, selectedEntityId: entity.id }, delta.dx, delta.dy);
  if (!next) return { outcome: 'illegal', state };

  const before = entity.position;
  const after = next.entities.find(e => e.id === entity.id)?.position;
  const didMove = after ? after.x !== before.x || after.y !== before.y : true;
  if (!didMove) return { outcome: 'blocked', state, message: next.message || undefined };

  return { outcome: 'moved', state: next };
}

export interface ReplayStep {
  index: number;
  move: AiMove;
  outcome: MoveOutcome;
  message?: string;
}

export interface ReplayResult {
  solved: boolean;
  /** How many moves the model proposed. */
  proposed: number;
  /** How many the engine actually executed. */
  applied: number;
  /** Proposed moves the engine refused or that did nothing. */
  failed: number;
  /** Index of the first move that failed, or null if every move landed. */
  firstFailureIndex: number | null;
  /**
   * How that first failure failed — the root cause.
   *
   * Worth separating from the tally of all outcomes: a rejected move leaves
   * the agent where it was while the plan assumes it moved, so every later
   * coordinate is stale and reports 'no-agent'. One real mistake cascades
   * into a run of them, and counting the mode over all failures measures the
   * echo rather than the cause.
   */
  firstFailureOutcome: MoveOutcome | null;
  /** 1-based count of moves consumed to reach the win, or null if unsolved. */
  movesToWin: number | null;
  /** Moves left unplayed because the level was already won. */
  trailing: number;
  steps: ReplayStep[];
  finalState: GameState;
}

/**
 * Run a full move list and score it. Stops as soon as the level is won; any
 * moves after that are reported as `trailing` rather than counted as failures.
 */
export function replayMoves(level: Level, initialState: GameState, moves: AiMove[]): ReplayResult {
  const steps: ReplayStep[] = [];
  let state = initialState;
  let applied = 0;
  let failed = 0;
  let firstFailureIndex: number | null = null;
  let firstFailureOutcome: MoveOutcome | null = null;
  let movesToWin: number | null = null;

  for (let index = 0; index < moves.length; index++) {
    if (state.status === 'won') break;

    const move = moves[index];
    const result = applyAiMove(level, state, move);
    steps.push({ index, move, outcome: result.outcome, message: result.message });

    if (result.outcome === 'moved') {
      applied++;
      state = result.state;
      if (state.status === 'won') movesToWin = index + 1;
    } else {
      failed++;
      if (firstFailureIndex === null) {
        firstFailureIndex = index;
        firstFailureOutcome = result.outcome;
      }
    }
  }

  return {
    solved: state.status === 'won',
    proposed: moves.length,
    applied,
    failed,
    firstFailureIndex,
    firstFailureOutcome,
    movesToWin,
    trailing: moves.length - steps.length,
    steps,
    finalState: state,
  };
}

/** Build the fresh game state a level starts from. */
export function initialStateFor(level: Level): GameState {
  const moves: Record<string, number> = {};
  const history: Record<string, { x: number; y: number }[]> = {};
  for (const entity of level.entities) {
    moves[entity.id] = 0;
    history[entity.id] = [{ ...entity.position }];
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
  };
}
