/**
 * Runs an eval session: every selected model attempts the same puzzle N times,
 * and each answer is replayed through the engine to produce a verdict.
 */
import { parseDSL } from '../../dsl/parser';
import { solveLevel } from '../ai-solver';
import { initialStateFor, replayMoves } from './replay';
import { solveOptimalAsync } from './solver';
import { buildAttempts, type EvalAttempt, type EvalModelSpec, type EvalSession } from './types';

export interface RunSessionOptions {
  dsl: string;
  levelName: string;
  models: EvalModelSpec[];
  runsPerModel: number;
  /** Attempts in flight at once. Keep small — these are billed API calls. */
  concurrency?: number;
  signal?: AbortSignal;
  /** Called after every state change so the UI can render progress live. */
  onProgress?: (session: EvalSession) => void;
}

function newSessionId(): string {
  return `eval-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Execute a session. Resolves once every attempt has settled; rejects only if
 * the puzzle itself can't be parsed (a per-attempt failure is recorded on the
 * attempt, never thrown).
 */
export async function runEvalSession(opts: RunSessionOptions): Promise<EvalSession> {
  const { dsl, levelName, models, runsPerModel, concurrency = 2, signal, onProgress } = opts;

  const parsed = parseDSL(dsl);
  if (!parsed.level) {
    throw new Error(
      parsed.errors.map(e => e.message).join('; ') || 'Level could not be parsed',
    );
  }
  const level = parsed.level;

  // Establish the baseline before spending anything on models: an unsolvable
  // level is a broken test item, and without an optimum a winning move count
  // has nothing to be measured against.
  const optimal = await solveOptimalAsync(level);

  const session: EvalSession = {
    id: newSessionId(),
    createdAt: Date.now(),
    levelName,
    dsl,
    optimalMoves: optimal.optimal,
    optimalStatus:
      optimal.optimal !== null ? 'solved' : optimal.solvable === false ? 'unsolvable' : 'undetermined',
    models,
    runsPerModel,
    attempts: buildAttempts(models, runsPerModel),
  };

  const emit = () => onProgress?.({ ...session, attempts: [...session.attempts] });
  emit();

  const queue = [...session.attempts];

  async function runOne(attempt: EvalAttempt): Promise<void> {
    // Cancelled attempts stay 'pending': they never ran, so they are not
    // provider errors and must not drag the error count up.
    if (signal?.aborted) return;

    attempt.status = 'running';
    emit();

    const started = Date.now();
    const result = await solveLevel(dsl, undefined, attempt.modelKey);
    attempt.durationMs = Date.now() - started;
    attempt.usage = result.usage;

    // A transport/auth failure is not a wrong answer — keep it out of the score.
    if (result.error && !result.parseFailed) {
      attempt.status = 'error';
      attempt.error = result.error;
      emit();
      return;
    }

    const replay = replayMoves(level, initialStateFor(level), result.moves);
    attempt.status = 'done';
    attempt.parseFailed = result.parseFailed || undefined;
    attempt.solved = replay.solved;
    attempt.proposed = replay.proposed;
    attempt.applied = replay.applied;
    attempt.failedMoves = replay.failed;
    attempt.firstFailureIndex = replay.firstFailureIndex;
    attempt.movesToWin = replay.movesToWin;
    attempt.outcomes = replay.steps.map(s => s.outcome);
    attempt.moves = result.moves;
    emit();
  }

  async function worker(): Promise<void> {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      await runOne(next);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, worker);
  await Promise.all(workers);

  session.finishedAt = Date.now();
  emit();
  return session;
}
