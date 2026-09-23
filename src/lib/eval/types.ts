import type { AiMove } from '../moves';
import type { MoveOutcome } from './replay';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  /**
   * Thinking/reasoning tokens, when the provider reports them separately.
   * OpenAI-compatible providers expose `reasoning_tokens`; the Anthropic API
   * folds thinking into `output_tokens` and publishes no separate count, so
   * this stays undefined there rather than being guessed at.
   */
  reasoningTokens?: number;
}

/** One model entered into an eval session. */
export interface EvalModelSpec {
  /** `provider:model` selection key. */
  key: string;
  providerId: string;
  modelId: string;
  label: string;
}

export type AttemptStatus = 'pending' | 'running' | 'done' | 'error';

/** A single (model, attempt) cell of an eval session. */
export interface EvalAttempt {
  id: string;
  modelKey: string;
  providerId: string;
  modelId: string;
  label: string;
  /** 1-based index within this model's attempts. */
  attempt: number;
  status: AttemptStatus;

  /** Transport, auth or provider failure — the model never answered. */
  error?: string;
  /** The model answered but produced no parsable move list. */
  parseFailed?: boolean;

  // Scoring — present once status is 'done'.
  solved?: boolean;
  proposed?: number;
  applied?: number;
  failedMoves?: number;
  firstFailureIndex?: number | null;
  /** Outcome of that first failure — the root cause, before any cascade. */
  firstFailureOutcome?: MoveOutcome | null;
  movesToWin?: number | null;
  outcomes?: MoveOutcome[];
  moves?: AiMove[];

  durationMs?: number;
  usage?: TokenUsage;
}

export interface EvalSession {
  id: string;
  createdAt: number;
  /** Human-readable name of the puzzle under test. */
  levelName: string;
  /** The exact DSL sent to every model — the session is reproducible from this. */
  dsl: string;
  /**
   * Fewest moves that win, from the deterministic solver. Null when the level
   * is unsolvable or the search hit its node limit — both mean "no baseline",
   * so excess-over-optimal is simply not reported.
   */
  optimalMoves?: number | null;
  /** Why `optimalMoves` is null, for the UI to explain rather than hide. */
  optimalStatus?: 'solved' | 'unsolvable' | 'undetermined';
  models: EvalModelSpec[];
  runsPerModel: number;
  attempts: EvalAttempt[];
  /** Set once every attempt has settled. */
  finishedAt?: number;
}

export function attemptId(modelKey: string, attempt: number): string {
  return `${modelKey}#${attempt}`;
}

/** Build the full pending grid for a session: every model × every run. */
export function buildAttempts(models: EvalModelSpec[], runsPerModel: number): EvalAttempt[] {
  const attempts: EvalAttempt[] = [];
  for (const model of models) {
    for (let i = 1; i <= runsPerModel; i++) {
      attempts.push({
        id: attemptId(model.key, i),
        modelKey: model.key,
        providerId: model.providerId,
        modelId: model.modelId,
        label: model.label,
        attempt: i,
        status: 'pending',
      });
    }
  }
  return attempts;
}
