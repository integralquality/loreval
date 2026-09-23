import { useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Play, Download, Trash2, ChevronRight, AlertTriangle, Check, X, Minus } from 'lucide-react';
import { CAMPAIGN_LEVELS } from '../levels';
import { parseDSL } from '../dsl/parser';
import { serializeDSL } from '../dsl/serializer';
import { LevelPreview } from '../components/game/LevelPreview';
import { DslTextarea } from '../components/game/DslTextarea';
import {
  CostChart,
  DurationChart,
  ExcessChart,
  FailureChart,
  SolveRateChart,
  SurvivalChart,
  TokenChart,
} from '../components/eval/charts';
import { useAvailableModels } from '../hooks/useAvailableModels';
import { modelKey } from '../lib/providers';
import { runEvalSession } from '../lib/eval/runner';
import {
  clearPrice,
  formatCost,
  getPrice,
  isOverridden,
  setPrice,
  type ModelPrice,
} from '../lib/eval/pricing';
import { costLabel } from '../lib/eval/labels';
import { deleteSession, listSessions, saveSession, sessionToCsv } from '../lib/eval/store';
import {
  formatDuration,
  formatNumber,
  formatPercent,
  dominantFailure,
  formatInterval,
  formatRatio,
  OUTCOME_LABELS,
  sessionTotals,
  summarize,
} from '../lib/eval/stats';
import type { OutcomeCounts, Spread } from '../lib/eval/stats';
import type { MoveOutcome } from '../lib/eval/replay';
import type { EvalAttempt, EvalModelSpec, EvalSession } from '../lib/eval/types';

const card = 'bg-paper border-2 border-zinc-700 rounded-lg p-5';
const label = 'text-[10px] text-zinc-500 uppercase tracking-wide mb-2';

// ─── Tooltip text for the statistics table ───────────────────────────────

/** The whole pass@k curve, since only the interval fits in the column. */
function passAtKLabel(curve: number[]): string | undefined {
  if (curve.length === 0) return undefined;
  return curve.map((v, i) => `pass@${i + 1} ${Math.round(v * 100)}%`).join(' · ');
}

function spreadLabel(spread: Spread | null): string | undefined {
  if (!spread) return undefined;
  return `range ${spread.min}–${spread.max}, sd ${formatNumber(spread.stdDev)}`;
}

function durationSpreadLabel(spread: Spread | null): string | undefined {
  if (!spread) return undefined;
  return `range ${formatDuration(spread.min)}–${formatDuration(spread.max)}`;
}

/**
 * Tooltip for the failure column: how attempts first went wrong, and — for
 * contrast — how many moves were rejected in total. The gap between the two
 * is the cascade, since a rejected move leaves every later coordinate stale.
 */
function outcomeBreakdown(rootCauses: OutcomeCounts, outcomes: OutcomeCounts): string | undefined {
  const named = (counts: OutcomeCounts) =>
    (Object.keys(counts) as MoveOutcome[])
      .filter(o => o !== 'moved' && counts[o] > 0)
      .sort((a, b) => counts[b] - counts[a])
      .map(o => `${counts[o]} ${OUTCOME_LABELS[o]}`);

  const causes = named(rootCauses);
  if (causes.length === 0) return undefined;

  const rejected = (Object.keys(outcomes) as MoveOutcome[])
    .filter(o => o !== 'moved')
    .reduce((total, o) => total + outcomes[o], 0);

  return `first went wrong: ${causes.join(' · ')}\n${rejected} moves rejected in total, including the cascade`;
}

function dominantFailureLabel(outcomes: OutcomeCounts): string {
  const worst = dominantFailure(outcomes);
  return worst ? OUTCOME_LABELS[worst] : '—';
}

interface NavState {
  dsl?: string;
  name?: string;
}

export default function EvalPage() {
  const navState = (useLocation().state ?? {}) as NavState;
  const models = useAvailableModels();

  const [source, setSource] = useState<'campaign' | 'custom'>(navState.dsl ? 'custom' : 'campaign');
  const [campaignIndex, setCampaignIndex] = useState(0);
  const [customDsl, setCustomDsl] = useState(navState.dsl ?? '');
  const [nameOverride, setNameOverride] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [runs, setRuns] = useState(1);

  const [session, setSession] = useState<EvalSession | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<EvalSession[]>(() => listSessions());
  const [openAttempt, setOpenAttempt] = useState<EvalAttempt | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const dsl = useMemo(
    () =>
      source === 'campaign'
        ? serializeDSL(CAMPAIGN_LEVELS[campaignIndex].level)
        : customDsl,
    [source, campaignIndex, customDsl],
  );

  const parsed = useMemo(() => parseDSL(dsl), [dsl]);

  /**
   * What to call this session in the results header and the history list.
   *
   * The DSL already names the level (`level "Paint Run" 9x7`), so a pasted
   * puzzle is named after itself rather than defaulting to "Custom level".
   * A typed name overrides that, for running the same board under different
   * conditions and telling the saved sessions apart afterwards.
   */
  const derivedName =
    source === 'campaign'
      ? CAMPAIGN_LEVELS[campaignIndex].name
      : parsed.level?.name || navState.name || 'Custom level';
  const levelName = nameOverride.trim() || derivedName;
  const parseError = parsed.level
    ? null
    : parsed.errors.map(e => e.message).join('; ') || 'Level could not be parsed';

  const toggleModel = (key: string) =>
    setSelected(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const canRun = !running && selected.length > 0 && !parseError;
  const totalCalls = selected.length * runs;

  const handleRun = async () => {
    if (!canRun) return;
    setError('');
    setOpenAttempt(null);
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const specs: EvalModelSpec[] = selected.flatMap(key => {
      const model = models.find(m => modelKey(m.providerId, m.id) === key);
      // A key may have been removed since it was ticked — skip it rather than crash.
      if (!model) return [];
      return [{ key, providerId: model.providerId, modelId: model.id, label: model.label }];
    });

    if (specs.length === 0) {
      setError('The selected models are no longer available — check your API keys.');
      setRunning(false);
      return;
    }

    try {
      const finished = await runEvalSession({
        dsl,
        levelName,
        models: specs,
        runsPerModel: runs,
        signal: controller.signal,
        onProgress: setSession,
      });
      saveSession(finished);
      setHistory(listSessions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eval failed to start');
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const handleExport = () => {
    if (!session) return;
    const blob = new Blob([sessionToCsv(session)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Editing a rate has to redraw the cost column, but prices live in
  // localStorage rather than React state, so bump a counter to re-run the memo.
  const [pricingVersion, setPricingVersion] = useState(0);

  const handlePriceChange = (
    model: EvalModelSpec,
    field: keyof ModelPrice,
    raw: string,
  ) => {
    const parsed = Number(raw);
    if (raw !== '' && (!isFinite(parsed) || parsed < 0)) return;
    const current = getPrice(model.providerId, model.modelId) ?? { input: 0, output: 0 };
    setPrice(model.providerId, model.modelId, { ...current, [field]: raw === '' ? 0 : parsed });
    setPricingVersion(v => v + 1);
  };

  const stats = useMemo(
    () => (session ? summarize(session.attempts, session.optimalMoves) : []),
    // pricingVersion is the dependency that matters: summarize() reads rates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, pricingVersion],
  );
  const totals = session ? sessionTotals(session.attempts) : null;

  return (
    <div className="max-w-page mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100 mb-1">Eval</h1>
        <p className="text-sm text-zinc-500">
          Give several models the same puzzle. Every answer is replayed through the game engine,
          so the verdict is the engine's, not a model's.
        </p>
      </header>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* ── Setup ─────────────────────────────────────────── */}
        <div className={`${card} space-y-5`}>
          <div>
            <p className={label}>Puzzle</p>
            <div className="flex gap-1.5 mb-3">
              {(['campaign', 'custom'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={`flex-1 py-1.5 rounded text-xs transition-colors border ${
                    source === s
                      ? 'bg-zinc-100 border-zinc-100 text-paper'
                      : 'bg-surface/60 border-white/15 text-zinc-500 hover:text-zinc-100'
                  }`}
                >
                  {s === 'campaign' ? 'Campaign' : 'Paste DSL'}
                </button>
              ))}
            </div>

            {source === 'campaign' ? (
              <select
                value={campaignIndex}
                onChange={e => setCampaignIndex(Number(e.target.value))}
                className="w-full bg-surface border border-white/15 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-400"
              >
                {CAMPAIGN_LEVELS.map((c, i) => (
                  <option key={c.level.id} value={i}>
                    {c.number}. {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <DslTextarea
                value={customDsl}
                onChange={setCustomDsl}
                rows={10}
                invalid={customDsl.trim() !== '' && parseError !== null}
                placeholder={'level "My Level" 5x5\n\ngrid = [\n  ...\n]'}
              />
            )}

            {parseError ? (
              <p className="mt-2 text-xs text-red-400 flex items-start gap-1.5">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                {parseError}
              </p>
            ) : (
              parsed.level && (
                <div className="mt-3 flex justify-center bg-surface/60 border border-white/10 rounded p-3">
                  <LevelPreview level={parsed.level} maxWidth={280} />
                </div>
              )
            )}

            <label className="mt-3 block">
              {/* `label` carries a bottom margin, which an inline span would drop */}
              <span className={`${label} block`}>Session name</span>
              <input
                type="text"
                value={nameOverride}
                onChange={e => setNameOverride(e.target.value)}
                placeholder={derivedName}
                className="w-full bg-surface border border-white/15 rounded px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
              />
            </label>
          </div>

          <div>
            <p className={label}>Models</p>
            {models.length === 0 ? (
              <p className="text-xs text-zinc-500">
                No API keys yet — add one with the <strong>add API key</strong> button in the header.
              </p>
            ) : (
              <div className="space-y-1">
                {models.map(m => {
                  const key = modelKey(m.providerId, m.id);
                  const on = selected.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleModel(key)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors border ${
                        on
                          ? 'bg-zinc-100 border-zinc-100 text-paper'
                          : 'bg-surface/60 border-white/15 text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                          on ? 'bg-orange-500 border-orange-500' : 'border-white/15'
                        }`}
                      >
                        {on && <Check size={10} className="text-white" />}
                      </span>
                      <span className="truncate">{m.label}</span>
                      <span className="ml-auto text-[10px] opacity-60 shrink-0">
                        {m.providerLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className={label}>Runs per model</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRuns(n)}
                  className={`flex-1 py-1.5 rounded text-xs transition-colors border ${
                    runs === n
                      ? 'bg-zinc-100 border-zinc-100 text-paper'
                      : 'bg-surface/60 border-white/15 text-zinc-500 hover:text-zinc-100'
                  }`}
                >
                  {n}×
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500">
              Repeats show variance — models are not deterministic.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRun}
              disabled={!canRun}
              className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-300 disabled:opacity-40 disabled:hover:bg-zinc-100 text-paper text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
            >
              <Play size={14} />
              {running ? 'Running…' : `Run eval${totalCalls > 0 ? ` (${totalCalls} calls)` : ''}`}
            </button>
            {running && (
              <button
                onClick={() => abortRef.current?.abort()}
                title="Stop after the calls already in flight"
                className="px-4 py-2.5 border border-white/15 text-zinc-500 hover:border-red-500/50 hover:text-red-400 text-sm rounded transition-colors"
              >
                Stop
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* ── Results ───────────────────────────────────────── */}
        <div className="space-y-6">
          {!session && (
            <div className={`${card} text-sm text-zinc-500`}>
              Pick a puzzle and one or more models, then run the eval. Results appear here and are
              saved in this browser.
            </div>
          )}

          {session && totals && (
            <>
              <div className={card}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-zinc-100">{session.levelName}</h2>
                    {/* Everything here is summed over every model in the
                        session, which is not obvious from a bare figure —
                        say so rather than leave "$1.67" to be guessed at. */}
                    <p className="text-xs text-zinc-500">
                      {totals.completed}/{totals.attempts} attempts across{' '}
                      {session.models.length} model{session.models.length === 1 ? '' : 's'}
                      {` · ${formatPercent(totals.solveRate)} solved overall`}
                      {totals.errors > 0 && ` · ${totals.errors} failed to run`}
                      {totals.costUsd !== null && (
                        <>
                          {` · ${formatCost(totals.costUsd)} total`}
                          {totals.unpricedModels > 0 &&
                            ` (${totals.unpricedModels} model${
                              totals.unpricedModels === 1 ? '' : 's'
                            } unpriced)`}
                        </>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {session.optimalStatus === 'solved' && (
                        <span className="text-emerald-400">
                          optimal {session.optimalMoves} moves
                        </span>
                      )}
                      {session.optimalStatus === 'unsolvable' && (
                        <span className="text-red-400">
                          no solution exists — this level cannot be scored fairly
                        </span>
                      )}
                      {session.optimalStatus === 'undetermined' && (
                        <span className="text-amber-400">
                          optimum not determined (search limit reached)
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 rounded text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
                  >
                    <Download size={12} /> CSV
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zinc-500 border-b border-white/15">
                        <th className="text-left font-medium py-2 pr-3">Model</th>
                        <th className="text-right font-medium py-2 px-2">Solved</th>
                        <th className="text-right font-medium py-2 px-2">Rate</th>
                        <th
                          className="text-right font-medium py-2 px-2"
                          title="95% Wilson interval on the solve rate — what the sample actually supports"
                        >
                          95% CI
                        </th>
                        <th
                          className="text-right font-medium py-2 px-2"
                          title="Typical winning length divided by the optimum. 1.00× is perfect play."
                        >
                          vs opt
                        </th>
                        <th
                          className="text-right font-medium py-2 px-2"
                          title="Mean moves to a win, with the best run in brackets"
                        >
                          Moves
                        </th>
                        <th
                          className="text-right font-medium py-2 px-2"
                          title="Share of proposed moves the engine rejected or that did nothing"
                        >
                          Illegal
                        </th>
                        <th
                          className="text-right font-medium py-2 px-2"
                          title="How attempts first go wrong — the root cause, before later moves cascade"
                        >
                          Fails as
                        </th>
                        <th
                          className="text-right font-medium py-2 px-2"
                          title="Median index of the first rejected move — how far a plan survives"
                        >
                          Dies at
                        </th>
                        <th className="text-right font-medium py-2 px-2" title="Mean attempt duration">
                          Time
                        </th>
                        <th className="text-right font-medium py-2 px-2" title="Input / output tokens">
                          Tokens
                        </th>
                        <th
                          className="text-right font-medium py-2 pl-2"
                          title="Total spend, with cost per successful solve in brackets"
                        >
                          Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map(row => (
                        <tr key={row.modelKey} className="border-b border-white/10 last:border-0">
                          <td className="py-2 pr-3">
                            <span className="text-zinc-100 font-medium">{row.label}</span>
                            <span className="text-zinc-400 ml-1.5 text-[10px]">{row.providerId}</span>
                            {row.parseFailures > 0 && (
                              <span
                                className="ml-1.5 text-[10px] text-amber-400"
                                title="Responses with no parsable move list"
                              >
                                {row.parseFailures} unparsed
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right text-zinc-300">
                            {row.solved}/{row.completed}
                          </td>
                          <td className="py-2 px-2 text-right font-medium text-zinc-100">
                            {formatPercent(row.solveRate)}
                          </td>
                          <td
                            className="py-2 px-2 text-right text-zinc-500 whitespace-nowrap"
                            title={passAtKLabel(row.passAtK)}
                          >
                            {formatInterval(row.solveRateInterval)}
                          </td>
                          <td
                            className={`py-2 px-2 text-right ${
                              row.excessRatio !== null && row.excessRatio <= 1.05
                                ? 'text-emerald-400'
                                : 'text-zinc-400'
                            }`}
                          >
                            {formatRatio(row.excessRatio)}
                          </td>
                          <td
                            className="py-2 px-2 text-right text-zinc-400 whitespace-nowrap"
                            title={spreadLabel(row.movesToWinSpread)}
                          >
                            {formatNumber(row.avgMovesToWin)}
                            {row.bestMovesToWin !== null &&
                              row.bestMovesToWin !== row.avgMovesToWin && (
                                <span className="text-zinc-600 text-[10px] ml-1">
                                  ({row.bestMovesToWin})
                                </span>
                              )}
                          </td>
                          <td className="py-2 px-2 text-right text-zinc-400">
                            {formatPercent(row.illegalRate)}
                          </td>
                          <td
                            className="py-2 px-2 text-right text-zinc-400 whitespace-nowrap"
                            title={outcomeBreakdown(row.rootCauses, row.outcomes)}
                          >
                            {dominantFailureLabel(row.rootCauses)}
                          </td>
                          <td className="py-2 px-2 text-right text-zinc-400">
                            {formatNumber(row.medianFirstFailure)}
                          </td>
                          <td
                            className="py-2 px-2 text-right text-zinc-400 whitespace-nowrap"
                            title={durationSpreadLabel(row.durationSpread)}
                          >
                            {formatDuration(row.avgDurationMs)}
                          </td>
                          <td
                            className="py-2 px-2 text-right text-zinc-500 whitespace-nowrap"
                            title={
                              row.reasoningTokens > 0
                                ? `${row.reasoningTokens} of the output tokens were reasoning`
                                : undefined
                            }
                          >
                            {row.inputTokens + row.outputTokens > 0
                              ? `${row.inputTokens}/${row.outputTokens}`
                              : '—'}
                          </td>
                          <td
                            className="py-2 pl-2 text-right text-zinc-400 whitespace-nowrap"
                            title={
                              row.costUsd === null
                                ? 'No rate set for this model — add one under Pricing'
                                : `${formatCost(row.costPerSolve)} per solve`
                            }
                          >
                            {costLabel(row)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Rates are local and editable: published prices change, and
                    a stale number in the bundle would quietly skew every cost
                    in the table. Models with no rate simply show a dash. */}
                <details className="mt-4 border-t border-white/10 pt-3">
                  <summary className="text-[10px] text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-300">
                    Pricing — $ per million tokens
                    {totals.costUsd === null && (
                      <span className="ml-2 normal-case tracking-normal text-amber-400">
                        set rates to see cost
                      </span>
                    )}
                  </summary>
                  <p className="mt-2 text-[11px] text-zinc-500 leading-5">
                    No rates ship with the app — published prices change and vary by
                    account, and a stale number here would skew every cost in the table.
                    Enter your own; they are stored in this browser only.
                  </p>
                  <div className="mt-3 space-y-2">
                    {session.models.map(model => {
                      const price = getPrice(model.providerId, model.modelId);
                      return (
                        <div key={model.key} className="flex items-center gap-2">
                          <span
                            className="text-xs text-zinc-400 flex-1 truncate"
                            title={model.modelId}
                          >
                            {model.label}
                          </span>
                          <label className="text-[10px] text-zinc-500">in</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={price?.input ?? ''}
                            placeholder="—"
                            onChange={e =>
                              handlePriceChange(model, 'input', e.target.value)
                            }
                            className="w-20 bg-surface border border-white/15 rounded px-2 py-1 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-400"
                          />
                          <label className="text-[10px] text-zinc-500">out</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={price?.output ?? ''}
                            placeholder="—"
                            onChange={e =>
                              handlePriceChange(model, 'output', e.target.value)
                            }
                            className="w-20 bg-surface border border-white/15 rounded px-2 py-1 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-400"
                          />
                          {isOverridden(model.providerId, model.modelId) && (
                            <button
                              onClick={() => {
                                clearPrice(model.providerId, model.modelId);
                                setPricingVersion(v => v + 1);
                              }}
                              className="text-[10px] text-zinc-500 hover:text-zinc-200 transition-colors"
                              title="Reset to the built-in rate"
                            >
                              reset
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              </div>

              {/* Charts — the same numbers as the table, shaped so the
                  comparisons the table makes you do in your head become
                  visible: overlapping confidence intervals, distance from
                  optimal, and which failure actually started each attempt. */}
              {stats.length > 0 && (
                <div className={card}>
                  <p className={label}>Charts</p>
                  <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                    <SolveRateChart stats={stats} />
                    <ExcessChart stats={stats} />
                    <FailureChart stats={stats} />
                    <SurvivalChart stats={stats} />
                    <DurationChart stats={stats} />
                    <TokenChart stats={stats} />
                    <CostChart stats={stats} />
                  </div>
                </div>
              )}

              {/* Attempt grid — one chip per run, click to inspect */}
              <div className={card}>
                <p className={label}>Attempts</p>
                <div className="space-y-2">
                  {session.models.map(model => (
                    <div key={model.key} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400 w-40 shrink-0 truncate" title={model.modelId}>
                        {model.label}
                      </span>
                      <div className="flex gap-1 flex-wrap">
                        {session.attempts
                          .filter(a => a.modelKey === model.key)
                          .map(a => (
                            <AttemptChip
                              key={a.id}
                              attempt={a}
                              onClick={() => setOpenAttempt(a)}
                              active={openAttempt?.id === a.id}
                            />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>

                {openAttempt && <AttemptDetail attempt={openAttempt} />}
              </div>
            </>
          )}

          {history.length > 0 && (
            <div className={card}>
              <p className={label}>Saved sessions</p>
              <div className="space-y-1">
                {history.slice(0, 8).map(s => {
                  const t = sessionTotals(s.attempts);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 text-xs py-1.5 border-b border-white/10 last:border-0"
                    >
                      <button
                        onClick={() => {
                          setSession(s);
                          setOpenAttempt(null);
                        }}
                        className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors min-w-0"
                      >
                        <ChevronRight size={12} className="shrink-0" />
                        <span className="truncate">{s.levelName}</span>
                      </button>
                      <span className="text-zinc-400 ml-auto shrink-0">
                        {s.models.length} model{s.models.length === 1 ? '' : 's'} ·{' '}
                        {formatPercent(t.solveRate)}
                      </span>
                      <span className="text-zinc-400 shrink-0">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => {
                          deleteSession(s.id);
                          setHistory(listSessions());
                          if (session?.id === s.id) setSession(null);
                        }}
                        className="text-zinc-300 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AttemptChip({
  attempt,
  onClick,
  active,
}: {
  attempt: EvalAttempt;
  onClick: () => void;
  active: boolean;
}) {
  const base =
    'w-7 h-7 rounded flex items-center justify-center border transition-colors cursor-pointer';

  if (attempt.status === 'pending') {
    return <span className={`${base} border-white/10 text-zinc-300`}><Minus size={11} /></span>;
  }
  if (attempt.status === 'running') {
    return (
      <span className={`${base} border-orange-500/40 bg-orange-500/10`}>
        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
      </span>
    );
  }
  if (attempt.status === 'error') {
    return (
      <button onClick={onClick} title={attempt.error} className={`${base} border-red-500/40 bg-red-500/10 text-red-400 ${active ? 'ring-2 ring-zinc-100' : ''}`}>
        <AlertTriangle size={11} />
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      title={attempt.solved ? `Solved in ${attempt.movesToWin} moves` : 'Did not solve'}
      className={`${base} ${
        attempt.solved
          ? 'border-green-600/40 bg-green-500/15 text-green-400'
          : 'border-white/15 bg-surface/60 text-zinc-400'
      } ${active ? 'ring-2 ring-zinc-100' : ''}`}
    >
      {attempt.solved ? <Check size={12} /> : <X size={12} />}
    </button>
  );
}

const OUTCOME_STYLE: Record<string, string> = {
  moved: 'text-zinc-500',
  'no-agent': 'text-amber-400',
  blocked: 'text-amber-400',
  illegal: 'text-red-400',
  'bad-direction': 'text-red-400',
};

function AttemptDetail({ attempt }: { attempt: EvalAttempt }) {
  if (attempt.status === 'error') {
    return (
      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-xs text-red-400">{attempt.error}</p>
      </div>
    );
  }

  const moves = attempt.moves ?? [];
  const outcomes = attempt.outcomes ?? [];

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-400 mb-3">
        <span>
          <strong className="text-zinc-100">{attempt.label}</strong> · run {attempt.attempt}
        </span>
        <span>{attempt.solved ? 'Solved' : 'Not solved'}</span>
        <span>{attempt.proposed} proposed</span>
        <span>{attempt.applied} applied</span>
        <span>{attempt.failedMoves} rejected</span>
        {attempt.firstFailureIndex !== null && attempt.firstFailureIndex !== undefined && (
          <span>first break at #{attempt.firstFailureIndex + 1}</span>
        )}
        {attempt.movesToWin && <span>won on move {attempt.movesToWin}</span>}
      </div>

      {attempt.parseFailed && (
        <p className="text-xs text-amber-400 mb-2">
          No parsable move list in the response — scored as a format failure.
        </p>
      )}

      {moves.length > 0 && (
        <div className="max-h-52 overflow-y-auto bg-surface/60 border border-white/10 rounded p-2 font-mono text-[11px] leading-relaxed">
          {moves.map((m, i) => {
            const outcome = outcomes[i];
            return (
              <div key={i} className={OUTCOME_STYLE[outcome] ?? 'text-zinc-400'}>
                {String(i + 1).padStart(3, ' ')}. ({m.x},{m.y}) {m.direction}
                {outcome && outcome !== 'moved' && ` ← ${outcome}`}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
