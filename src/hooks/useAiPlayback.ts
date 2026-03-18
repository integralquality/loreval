import { useState, useRef, useCallback } from 'react';
import type { Level, GameState } from '../types';
import { executeMove } from '../gameLogic';
import { serializeDSL } from '../dsl/serializer';
import { solveLevel, directionToDelta } from '../lib/ai-solver';
import type { AiMove } from '../lib/ai-solver';

export type AiStatus = 'idle' | 'solving' | 'playing' | 'paused' | 'done' | 'error';

export function useAiPlayback(
  level: Level,
  onStateChange: (state: GameState) => void,
  stepDelay = 400,
) {
  const [status, setStatus] = useState<AiStatus>('idle');
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [totalMoves, setTotalMoves] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);

  // Mutable playback state accessible from interval without stale closures
  const movesRef = useRef<AiMove[]>([]);
  const liveStateRef = useRef<GameState | null>(null);
  const moveIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable refs so interval callback doesn't need re-registration when props change
  const levelRef = useRef(level);
  const onStateChangeRef = useRef(onStateChange);
  const stepDelayRef = useRef(stepDelay);
  levelRef.current = level;
  onStateChangeRef.current = onStateChange;
  stepDelayRef.current = stepDelay;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    setStatus('idle');
    setError(null);
    setSolved(false);
    setCurrentMoveIndex(0);
    setTotalMoves(0);
    movesRef.current = [];
    moveIndexRef.current = 0;
    liveStateRef.current = null;
  }, [clearTimer]);

  const pause = useCallback(() => {
    clearTimer();
    setStatus('paused');
  }, [clearTimer]);

  const tick = useCallback(() => {
    const index = moveIndexRef.current;
    const moves = movesRef.current;
    const currentState = liveStateRef.current;
    const currentLevel = levelRef.current;

    if (!currentState || index >= moves.length) {
      clearTimer();
      setSolved(currentState?.status === 'won');
      setStatus('done');
      return;
    }

    const move = moves[index];
    const entity = currentLevel.entities.find(e => e.color === move.color);

    if (!entity) {
      clearTimer();
      setError(`Unknown agent color "${move.color}" at move ${index + 1}`);
      setStatus('error');
      return;
    }

    // Skip moves for entities that already finished (don't treat as error)
    if (currentState.finishedEntityIds.includes(entity.id)) {
      moveIndexRef.current = index + 1;
      setCurrentMoveIndex(index + 1);
      return;
    }

    const delta = directionToDelta(move.direction);
    if (!delta) {
      clearTimer();
      setError(`Unknown direction "${move.direction}" at move ${index + 1}`);
      setStatus('error');
      return;
    }

    const stateForMove: GameState = { ...currentState, selectedEntityId: entity.id };
    const newState = executeMove(currentLevel, stateForMove, delta.dx, delta.dy);

    // Skip invalid moves (wall collision, out of bounds) — don't stop playback
    if (!newState) {
      moveIndexRef.current = index + 1;
      setCurrentMoveIndex(index + 1);
      return;
    }

    // Detect blocked move — entity position unchanged (door/one-way/lock)
    const entityBefore = currentState.entities.find(e => e.id === entity.id)!;
    const entityAfter = newState.entities.find(e => e.id === entity.id);
    const didMove = entityAfter
      ? entityAfter.position.x !== entityBefore.position.x || entityAfter.position.y !== entityBefore.position.y
      : true; // entity disappeared (reached goal) — valid

    // Skip blocked moves too — let Claude's path continue
    if (!didMove) {
      moveIndexRef.current = index + 1;
      setCurrentMoveIndex(index + 1);
      return;
    }

    liveStateRef.current = newState;
    onStateChangeRef.current(newState);
    moveIndexRef.current = index + 1;
    setCurrentMoveIndex(index + 1);

    if (newState.status === 'won') {
      clearTimer();
      setSolved(true);
      setStatus('done');
    }
  }, [clearTimer]);

  const startInterval = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(tick, stepDelayRef.current);
  }, [clearTimer, tick]);

  const resume = useCallback(() => {
    setStatus('playing');
    startInterval();
  }, [startInterval]);

  const startSolving = useCallback(async (gameState: GameState) => {
    clearTimer();
    setStatus('solving');
    setError(null);
    setCurrentMoveIndex(0);
    setTotalMoves(0);
    movesRef.current = [];
    moveIndexRef.current = 0;
    liveStateRef.current = gameState;

    const dsl = serializeDSL(levelRef.current);
    const result = await solveLevel(dsl);

    if (result.error || result.moves.length === 0) {
      setStatus('error');
      setError(result.error ?? 'Claude returned no moves');
      return;
    }

    movesRef.current = result.moves;
    setTotalMoves(result.moves.length);
    setStatus('playing');
    startInterval();
  }, [clearTimer, startInterval]);

  return { status, currentMoveIndex, totalMoves, error, solved, startSolving, pause, resume, stop };
}
