import { useState, useRef, useCallback } from 'react';
import type { Level, GameState } from '../types';
import { executeMove } from '../gameLogic';
import { serializeDSL } from '../dsl/serializer';
import { solveLevel, directionToDelta } from '../lib/ai-solver';
import type { AiMove, RetryContext, AiModelId } from '../lib/ai-solver';

export type AiStatus = 'idle' | 'solving' | 'playing' | 'paused' | 'done' | 'error';

/** Build a readable move log by tracking which agent is at each position. */
function annotateMoves(moves: AiMove[], initialState: GameState): string {
  const pos: Record<string, { x: number; y: number }> = {};
  const color: Record<string, string> = {};
  const finished = new Set<string>();

  for (const e of initialState.entities) {
    pos[e.id] = { ...e.position };
    color[e.id] = e.color ?? 'agent';
  }

  const deltas: Record<string, { dx: number; dy: number }> = {
    up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
  };

  return moves.map(move => {
    const entityId = Object.keys(pos).find(
      id => !finished.has(id) && pos[id].x === move.x && pos[id].y === move.y
    );
    if (!entityId) return `⚠ no agent at (${move.x},${move.y}) — ${move.direction}`;

    const d = deltas[move.direction];
    const tx = move.x + (d?.dx ?? 0);
    const ty = move.y + (d?.dy ?? 0);
    const label = color[entityId];
    pos[entityId] = { x: tx, y: ty };
    return `${label}  (${move.x},${move.y}) → (${tx},${ty})  ${move.direction}`;
  }).join('\n');
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Mutable playback state accessible from interval without stale closures
  const movesRef = useRef<AiMove[]>([]);
  const liveStateRef = useRef<GameState | null>(null);
  const moveIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialGameStateRef = useRef<GameState | null>(null);
  const modelRef = useRef<AiModelId | undefined>(undefined);

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
    setChatHistory([]);
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

    // Find the active entity currently at (move.x, move.y)
    const entity = currentState.entities.find(e =>
      e.position.x === move.x && e.position.y === move.y &&
      !currentState.finishedEntityIds.includes(e.id)
    );

    if (!entity) {
      // No agent at expected position — skip (position may be stale from a previous skip)
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

    // Skip invalid moves (wall collision, out of bounds)
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

  // Advance exactly one move (use when paused)
  const step = useCallback(() => {
    tick();
  }, [tick]);

  // Step back one move by replaying from initial state
  const stepBack = useCallback(() => {
    const targetIndex = moveIndexRef.current - 1;
    if (targetIndex < 0) return;

    const initialState = initialGameStateRef.current;
    if (!initialState) return;

    const moves = movesRef.current;
    const currentLevel = levelRef.current;

    let state = initialState;
    for (let i = 0; i < targetIndex; i++) {
      if (i >= moves.length) break;
      const move = moves[i];
      const entity = state.entities.find(e =>
        e.position.x === move.x && e.position.y === move.y &&
        !state.finishedEntityIds.includes(e.id)
      );
      if (!entity) continue;
      const delta = directionToDelta(move.direction);
      if (!delta) continue;
      const stateForMove: GameState = { ...state, selectedEntityId: entity.id };
      const newState = executeMove(currentLevel, stateForMove, delta.dx, delta.dy);
      if (!newState) continue;
      const entityBefore = state.entities.find(e => e.id === entity.id)!;
      const entityAfter = newState.entities.find(e => e.id === entity.id);
      const didMove = entityAfter
        ? entityAfter.position.x !== entityBefore.position.x || entityAfter.position.y !== entityBefore.position.y
        : true;
      if (!didMove) continue;
      state = newState;
    }

    liveStateRef.current = state;
    onStateChangeRef.current(state);
    moveIndexRef.current = targetIndex;
    setCurrentMoveIndex(targetIndex);
    setStatus('paused');
  }, []);

  // Rewind to start and enter paused mode for manual scrubbing
  const rewind = useCallback(() => {
    clearTimer();
    const initialState = initialGameStateRef.current;
    if (!initialState) return;
    liveStateRef.current = initialState;
    onStateChangeRef.current(initialState);
    moveIndexRef.current = 0;
    setCurrentMoveIndex(0);
    setStatus('paused');
  }, [clearTimer]);

  const changeSpeed = useCallback((newDelay: number) => {
    stepDelayRef.current = newDelay;
    if (timerRef.current !== null) {
      clearTimer();
      timerRef.current = setInterval(tick, newDelay);
    }
  }, [clearTimer, tick]);

  const startSolving = useCallback(async (gameState: GameState, retryContext?: RetryContext, model?: AiModelId) => {
    if (model !== undefined) modelRef.current = model;
    clearTimer();
    setStatus('solving');
    setError(null);
    setSolved(false);
    setCurrentMoveIndex(0);
    setTotalMoves(0);
    movesRef.current = [];
    moveIndexRef.current = 0;
    liveStateRef.current = gameState;
    initialGameStateRef.current = gameState;
    onStateChangeRef.current(gameState);

    if (!retryContext) setChatHistory([]);
    if (retryContext?.userFeedback) {
      setChatHistory(h => [...h, { role: 'user', content: retryContext.userFeedback }]);
    }

    const dsl = serializeDSL(levelRef.current);
    const result = await solveLevel(dsl, retryContext, modelRef.current);

    if (result.error || result.moves.length === 0) {
      setStatus('error');
      setError(result.error ?? 'Claude returned no moves');
      if (result.error) {
        setChatHistory(h => [...h, { role: 'assistant', content: `Error: ${result.error}` }]);
      }
      return;
    }

    const moveSummary = annotateMoves(result.moves, gameState);
    setChatHistory(h => [...h, { role: 'assistant', content: moveSummary }]);

    movesRef.current = result.moves;
    setTotalMoves(result.moves.length);
    setStatus('playing');
    startInterval();
  }, [clearTimer, startInterval]);

  // Retry from scratch using the stored initial game state
  const retry = useCallback((model?: AiModelId) => {
    const gameState = initialGameStateRef.current;
    if (!gameState) return;
    void startSolving(gameState, undefined, model);
  }, [startSolving]);

  // Retry with user feedback — resets board and sends conversation context to Claude
  const retryWithFeedback = useCallback((feedback: string) => {
    const previousMoves = movesRef.current;
    const gameState = initialGameStateRef.current;
    if (!gameState) return;

    const retryContext: RetryContext = {
      previousMovesText: previousMoves.map(m => `(${m.x},${m.y}) ${m.direction}`).join('\n'),
      userFeedback: feedback,
    };

    void startSolving(gameState, retryContext);
  }, [startSolving]);

  return {
    status, currentMoveIndex, totalMoves, error, solved, chatHistory,
    startSolving, retry, pause, resume, step, stepBack, rewind, stop, changeSpeed, retryWithFeedback,
  };
}
