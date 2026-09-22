import { useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Play, Download, Trash2, ChevronRight, AlertTriangle, Check, X, Minus } from 'lucide-react';
import { CAMPAIGN_LEVELS } from '../levels';
import { parseDSL } from '../dsl/parser';
import { serializeDSL } from '../dsl/serializer';
import { LevelPreview } from '../components/game/LevelPreview';
import { useAvailableModels } from '../hooks/useAvailableModels';
import { modelKey } from '../lib/providers';
import { runEvalSession } from '../lib/eval/runner';
import { deleteSession, listSessions, saveSession, sessionToCsv } from '../lib/eval/store';
import {
  formatDuration,
  formatNumber,
  formatPercent,
  sessionTotals,
  summarize,
} from '../lib/eval/stats';
import type { EvalAttempt, EvalModelSpec, EvalSession } from '../lib/eval/types';

const card = 'bg-paper border-2 border-zinc-700 rounded-lg p-5';
const label = 'text-[10px] text-zinc-500 uppercase tracking-wide mb-2';

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

  const levelName =
    source === 'campaign'
      ? CAMPAIGN_LEVELS[campaignIndex].name
      : navState.name || 'Custom level';

  const parsed = useMemo(() => parseDSL(dsl), [dsl]);
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

  const stats = session ? summarize(session.attempts) : [];
  const totals = session ? sessionTotals(session.attempts) : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
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
              <textarea
                value={customDsl}
                onChange={e => setCustomDsl(e.target.value)}
                rows={8}
                placeholder={'level "My Level" 5x5\n\ngrid = [\n  ...\n]'}
                className="w-full bg-surface border border-white/15 rounded px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-400"
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
                    <p className="text-xs text-zinc-500">
                      {totals.completed}/{totals.attempts} attempts ·{' '}
                      {formatPercent(totals.solveRate)} solved
                      {totals.errors > 0 && ` · ${totals.errors} failed to run`}
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
                        <th className="text-right font-medium py-2 px-2" title="Average moves proposed">
                          Moves
                        </th>
                        <th
                          className="text-right font-medium py-2 px-2"
                          title="Share of proposed moves the engine rejected or that did nothing"
                        >
                          Illegal
                        </th>
                        <th className="text-right font-medium py-2 px-2" title="Fewest moves to a win">
                          Best
                        </th>
                        <th className="text-right font-medium py-2 px-2">Time</th>
                        <th className="text-right font-medium py-2 pl-2" title="Input / output tokens">
                          Tokens
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
                          <td className="py-2 px-2 text-right text-zinc-400">
                            {formatNumber(row.avgProposed)}
                          </td>
                          <td className="py-2 px-2 text-right text-zinc-400">
                            {formatPercent(row.illegalRate)}
                          </td>
                          <td className="py-2 px-2 text-right text-zinc-400">
                            {formatNumber(row.bestMovesToWin)}
                          </td>
                          <td className="py-2 px-2 text-right text-zinc-400">
                            {formatDuration(row.avgDurationMs)}
                          </td>
                          <td className="py-2 pl-2 text-right text-zinc-500 whitespace-nowrap">
                            {row.inputTokens + row.outputTokens > 0
                              ? `${row.inputTokens}/${row.outputTokens}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

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
