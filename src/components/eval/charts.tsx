/**
 * Small SVG charts for the eval results panel.
 *
 * Hand-drawn rather than pulled from a charting library: the shapes needed
 * here are bars, whiskers and stacked segments, and a dependency would bring
 * its own typography and colour decisions to argue with the rest of the page.
 *
 * Every chart is driven by `ModelStats[]` and renders nothing when there is
 * nothing to show, so a session with no solves simply omits the panels that
 * would be empty.
 */
import type { MoveOutcome } from '../../lib/eval/replay';
import { costLabel } from '../../lib/eval/labels';
import { formatCost } from '../../lib/eval/pricing';
import {
  OUTCOME_LABELS,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRatio,
  type ModelStats,
} from '../../lib/eval/stats';

const ROW_HEIGHT = 26;
const BAR_HEIGHT = 12;
/** Room for the model name down the left edge. */
const LABEL_WIDTH = 104;
/** Room for the value printed at the right edge. */
const VALUE_WIDTH = 92;

/** Failure colours, warm to cool, so a stacked bar reads left to right. */
const OUTCOME_COLORS: Record<MoveOutcome, string> = {
  moved: '#34d399',
  illegal: '#f87171',
  blocked: '#fb923c',
  'no-agent': '#c084fc',
  'bad-direction': '#60a5fa',
};

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{title}</p>
        {hint && <p className="text-[10px] text-zinc-600">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function RowLabel({ text, y }: { text: string; y: number }) {
  return (
    <text
      x={0}
      y={y + BAR_HEIGHT - 2}
      className="fill-zinc-400"
      style={{ fontSize: 11 }}
    >
      {text.length > 15 ? `${text.slice(0, 14)}…` : text}
    </text>
  );
}

function RowValue({ text, x, y, muted }: { text: string; x: number; y: number; muted?: boolean }) {
  return (
    <text
      x={x}
      y={y + BAR_HEIGHT - 2}
      textAnchor="end"
      className={muted ? 'fill-zinc-600' : 'fill-zinc-300'}
      style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
    >
      {text}
    </text>
  );
}

/**
 * Solve rate with its 95% interval drawn as a whisker.
 *
 * The point of the picture: at three runs per model the intervals are wide
 * enough to overlap almost completely, which a column of "100%" hides.
 */
export function SolveRateChart({ stats, width = 460 }: { stats: ModelStats[]; width?: number }) {
  const plotWidth = Math.max(80, width - LABEL_WIDTH - VALUE_WIDTH);
  const height = stats.length * ROW_HEIGHT;
  const x = (fraction: number) => LABEL_WIDTH + fraction * plotWidth;

  return (
    <Panel title="Solve rate" hint="bar = observed · line = 95% interval">
      <svg width="100%" viewBox={`0 0 ${width} ${height + 14}`} role="img" aria-label="Solve rate by model with confidence intervals">
        {/* Quarter gridlines, so the eye can place a bar without an axis */}
        {[0, 0.25, 0.5, 0.75, 1].map(tick => (
          <line
            key={tick}
            x1={x(tick)}
            x2={x(tick)}
            y1={0}
            y2={height}
            stroke="currentColor"
            className="text-white/10"
          />
        ))}

        {stats.map((row, i) => {
          const y = i * ROW_HEIGHT;
          const rate = row.solveRate ?? 0;
          const interval = row.solveRateInterval;
          return (
            <g key={row.modelKey}>
              <RowLabel text={row.label} y={y} />
              <rect
                x={x(0)}
                y={y}
                width={Math.max(1, rate * plotWidth)}
                height={BAR_HEIGHT}
                rx={2}
                fill={rate >= 1 ? '#34d399' : rate > 0 ? '#fb923c' : '#444a52'}
              />
              {interval && (
                <g className="text-zinc-400">
                  <line
                    x1={x(interval.low)}
                    x2={x(interval.high)}
                    y1={y + BAR_HEIGHT / 2}
                    y2={y + BAR_HEIGHT / 2}
                    stroke="currentColor"
                    strokeWidth={1}
                  />
                  {[interval.low, interval.high].map(edge => (
                    <line
                      key={edge}
                      x1={x(edge)}
                      x2={x(edge)}
                      y1={y + 1}
                      y2={y + BAR_HEIGHT - 1}
                      stroke="currentColor"
                      strokeWidth={1}
                    />
                  ))}
                </g>
              )}
              <RowValue
                text={`${formatPercent(row.solveRate)} (${row.solved}/${row.completed})`}
                x={width}
                y={y}
              />
            </g>
          );
        })}

        {[0, 0.5, 1].map(tick => (
          <text
            key={tick}
            x={x(tick)}
            y={height + 11}
            textAnchor="middle"
            className="fill-zinc-600"
            style={{ fontSize: 9 }}
          >
            {Math.round(tick * 100)}%
          </text>
        ))}
      </svg>
    </Panel>
  );
}

/**
 * Winning length against the optimum, with 1.00x marked.
 *
 * Renders nothing without a baseline — there is no honest way to draw this
 * when the solver could not determine the optimum.
 */
export function ExcessChart({ stats, width = 460 }: { stats: ModelStats[]; width?: number }) {
  const rows = stats.filter(r => r.excessRatio !== null);
  if (rows.length === 0) return null;

  const worst = Math.max(...rows.map(r => r.excessRatio as number), 1.5);
  const plotWidth = Math.max(80, width - LABEL_WIDTH - VALUE_WIDTH);
  const height = rows.length * ROW_HEIGHT;
  // Scale starts at 1.0, because below optimal is impossible.
  const x = (ratio: number) => LABEL_WIDTH + ((ratio - 1) / (worst - 1)) * plotWidth;

  return (
    <Panel title="Moves vs optimal" hint="1.00× is perfect play">
      <svg width="100%" viewBox={`0 0 ${width} ${height + 14}`} role="img" aria-label="Winning move count relative to the optimum">
        <line
          x1={x(1)}
          x2={x(1)}
          y1={0}
          y2={height}
          stroke="#34d399"
          strokeDasharray="2 2"
          opacity={0.7}
        />
        {rows.map((row, i) => {
          const y = i * ROW_HEIGHT;
          const ratio = row.excessRatio as number;
          return (
            <g key={row.modelKey}>
              <RowLabel text={row.label} y={y} />
              <rect
                x={x(1)}
                y={y}
                width={Math.max(1, x(ratio) - x(1))}
                height={BAR_HEIGHT}
                rx={2}
                fill={ratio <= 1.05 ? '#34d399' : ratio <= 1.25 ? '#fb923c' : '#f87171'}
              />
              <RowValue text={formatRatio(ratio)} x={width} y={y} />
            </g>
          );
        })}
        <text x={x(1)} y={height + 11} textAnchor="middle" className="fill-zinc-600" style={{ fontSize: 9 }}>
          1.00×
        </text>
        <text x={LABEL_WIDTH + plotWidth} y={height + 11} textAnchor="end" className="fill-zinc-600" style={{ fontSize: 9 }}>
          {worst.toFixed(2)}×
        </text>
      </svg>
    </Panel>
  );
}

/**
 * How attempts first go wrong, one stacked bar per model.
 *
 * Built from `rootCauses`, not the full outcome tally: a rejected move leaves
 * every later coordinate stale, so the tally is dominated by the cascade and
 * would paint every model the same colour.
 */
export function FailureChart({ stats, width = 460 }: { stats: ModelStats[]; width?: number }) {
  const failureModes: MoveOutcome[] = ['illegal', 'blocked', 'no-agent', 'bad-direction'];
  const totals = stats.map(row => ({
    row,
    counts: failureModes.map(mode => row.rootCauses[mode]),
    failed: failureModes.reduce((sum, mode) => sum + row.rootCauses[mode], 0),
  }));
  if (totals.every(t => t.failed === 0)) return null;

  const maxAttempts = Math.max(...stats.map(r => r.completed), 1);
  const plotWidth = Math.max(80, width - LABEL_WIDTH - VALUE_WIDTH);
  const height = stats.length * ROW_HEIGHT;
  const unit = plotWidth / maxAttempts;

  return (
    <Panel title="How attempts first fail" hint="one segment per failed attempt">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Root cause of the first failure in each attempt">
        {totals.map(({ row, counts, failed }, i) => {
          const y = i * ROW_HEIGHT;
          let offset = 0;
          return (
            <g key={row.modelKey}>
              <RowLabel text={row.label} y={y} />
              {/* Solved attempts first, so the bar reads as the whole sample */}
              <rect
                x={LABEL_WIDTH}
                y={y}
                width={Math.max(0, row.solved * unit)}
                height={BAR_HEIGHT}
                fill={OUTCOME_COLORS.moved}
                opacity={0.55}
              />
              {counts.map((count, mode) => {
                if (count === 0) return null;
                const segmentX = LABEL_WIDTH + (row.solved + offset) * unit;
                offset += count;
                return (
                  <rect
                    key={failureModes[mode]}
                    x={segmentX}
                    y={y}
                    width={count * unit}
                    height={BAR_HEIGHT}
                    fill={OUTCOME_COLORS[failureModes[mode]]}
                  >
                    <title>{`${count} × ${OUTCOME_LABELS[failureModes[mode]]}`}</title>
                  </rect>
                );
              })}
              <RowValue
                text={failed === 0 ? 'no failures' : `${failed} failed`}
                x={width}
                y={y}
                muted={failed === 0}
              />
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
        {(['moved', ...failureModes] as MoveOutcome[]).map(mode => (
          <span key={mode} className="flex items-center gap-1 text-[10px] text-zinc-500">
            <span
              className="w-2 h-2 rounded-[1px]"
              style={{ backgroundColor: OUTCOME_COLORS[mode], opacity: mode === 'moved' ? 0.55 : 1 }}
            />
            {mode === 'moved' ? 'solved' : OUTCOME_LABELS[mode]}
          </span>
        ))}
      </div>
    </Panel>
  );
}

/**
 * Time per attempt, with the observed range behind the mean.
 *
 * The spread is the point: one model taking four times another's mean is
 * interesting, and a single slow draw inside a wide range is not.
 */
export function DurationChart({ stats, width = 460 }: { stats: ModelStats[]; width?: number }) {
  const rows = stats.filter(r => r.avgDurationMs !== null);
  if (rows.length === 0) return null;

  const slowest = Math.max(...rows.map(r => r.durationSpread?.max ?? r.avgDurationMs ?? 0), 1);
  const plotWidth = Math.max(80, width - LABEL_WIDTH - VALUE_WIDTH);
  const height = rows.length * ROW_HEIGHT;
  const x = (ms: number) => LABEL_WIDTH + (ms / slowest) * plotWidth;

  return (
    <Panel title="Time per attempt" hint="bar = mean · line = range">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Mean attempt duration by model with observed range">
        {rows.map((row, i) => {
          const y = i * ROW_HEIGHT;
          const mean = row.avgDurationMs as number;
          const spread = row.durationSpread;
          return (
            <g key={row.modelKey}>
              <RowLabel text={row.label} y={y} />
              {spread && spread.max > spread.min && (
                <line
                  x1={x(spread.min)}
                  x2={x(spread.max)}
                  y1={y + BAR_HEIGHT / 2}
                  y2={y + BAR_HEIGHT / 2}
                  stroke="currentColor"
                  className="text-white/20"
                  strokeWidth={BAR_HEIGHT}
                />
              )}
              <rect
                x={LABEL_WIDTH}
                y={y}
                width={Math.max(1, x(mean) - LABEL_WIDTH)}
                height={BAR_HEIGHT}
                rx={2}
                fill="#60a5fa"
                opacity={0.8}
              />
              <RowValue text={formatDuration(mean)} x={width} y={y} />
            </g>
          );
        })}
      </svg>
    </Panel>
  );
}

/**
 * How far into a plan attempts survive before the first rejected move.
 *
 * Reads as "this model is wrong from the start" versus "this model nearly
 * had it", which a solve rate alone cannot distinguish.
 */
export function SurvivalChart({ stats, width = 460 }: { stats: ModelStats[]; width?: number }) {
  const rows = stats.filter(r => r.medianFirstFailure !== null);
  if (rows.length === 0) return null;

  const furthest = Math.max(
    ...rows.map(r => r.medianFirstFailure as number),
    ...stats.map(r => r.avgMovesToWin ?? 0),
    1,
  );
  const plotWidth = Math.max(80, width - LABEL_WIDTH - VALUE_WIDTH);
  const height = rows.length * ROW_HEIGHT;

  return (
    <Panel title="Moves before the first mistake" hint="median across failed attempts">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Median index of the first rejected move">
        {rows.map((row, i) => {
          const y = i * ROW_HEIGHT;
          const survived = row.medianFirstFailure as number;
          return (
            <g key={row.modelKey}>
              <RowLabel text={row.label} y={y} />
              <rect
                x={LABEL_WIDTH}
                y={y}
                width={Math.max(1, (survived / furthest) * plotWidth)}
                height={BAR_HEIGHT}
                rx={2}
                fill="#c084fc"
                opacity={0.8}
              />
              <RowValue text={formatNumber(survived)} x={width} y={y} />
            </g>
          );
        })}
      </svg>
    </Panel>
  );
}

/** Compact token counts: 55318 reads as 55.3k. */
function formatTokens(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(2)}M`;
}

/**
 * Input and output tokens per model, stacked.
 *
 * Output dominates on a thinking model — one session had a model spend 55k
 * output tokens against 5k of input — and the split is what makes that
 * visible. It is deliberately *not* a cost chart: the same token count costs
 * different amounts on different models, which is what CostChart is for.
 */
export function TokenChart({ stats, width = 460 }: { stats: ModelStats[]; width?: number }) {
  const rows = stats.filter(r => r.inputTokens + r.outputTokens > 0);
  if (rows.length === 0) return null;

  const largest = Math.max(...rows.map(r => r.inputTokens + r.outputTokens), 1);
  const plotWidth = Math.max(80, width - LABEL_WIDTH - VALUE_WIDTH);
  const height = rows.length * ROW_HEIGHT;
  const scale = (tokens: number) => (tokens / largest) * plotWidth;

  return (
    <Panel title="Tokens" hint="input · output">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Input and output tokens by model">
        {rows.map((row, i) => {
          const y = i * ROW_HEIGHT;
          const inputWidth = scale(row.inputTokens);
          return (
            <g key={row.modelKey}>
              <RowLabel text={row.label} y={y} />
              <rect x={LABEL_WIDTH} y={y} width={Math.max(1, inputWidth)} height={BAR_HEIGHT} fill="#60a5fa" opacity={0.55}>
                <title>{`${row.inputTokens} input`}</title>
              </rect>
              <rect
                x={LABEL_WIDTH + inputWidth}
                y={y}
                width={Math.max(1, scale(row.outputTokens))}
                height={BAR_HEIGHT}
                fill="#c084fc"
              >
                <title>
                  {`${row.outputTokens} output` +
                    (row.reasoningTokens > 0 ? ` (${row.reasoningTokens} reasoning)` : '')}
                </title>
              </rect>
              <RowValue text={formatTokens(row.inputTokens + row.outputTokens)} x={width} y={y} />
            </g>
          );
        })}
      </svg>

      <div className="flex gap-3 mt-1">
        {[
          ['input', '#60a5fa', 0.55],
          ['output', '#c084fc', 1],
        ].map(([name, colour, opacity]) => (
          <span key={name as string} className="flex items-center gap-1 text-[10px] text-zinc-500">
            <span
              className="w-2 h-2 rounded-[1px]"
              style={{ backgroundColor: colour as string, opacity: opacity as number }}
            />
            {name as string}
          </span>
        ))}
      </div>
    </Panel>
  );
}

/**
 * Spend per model, with cost per solve marked.
 *
 * Total spend alone flatters a model that failed cheaply — Haiku is the
 * cheapest row in every session and solved nothing. The tick is cost per
 * successful solve, which is the number worth comparing; a model that never
 * solved has no tick, because its cost per solve is undefined rather than
 * zero.
 *
 * Renders nothing until rates are entered — none ship with the app.
 */
export function CostChart({ stats, width = 460 }: { stats: ModelStats[]; width?: number }) {
  const rows = stats.filter(r => r.costUsd !== null);
  if (rows.length === 0) return null;

  // Cost per solve can only be a fraction of spend, so spend sets the scale.
  const dearest = Math.max(...rows.map(r => r.costUsd ?? 0), Number.EPSILON);
  const plotWidth = Math.max(80, width - LABEL_WIDTH - VALUE_WIDTH);
  const height = rows.length * ROW_HEIGHT;
  const scale = (usd: number) => (usd / dearest) * plotWidth;

  const unpriced = stats.length - rows.length;

  return (
    <Panel
      title="Cost"
      hint={unpriced > 0 ? `${unpriced} unpriced` : 'spend, (per solve)'}
    >
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Spend by model with cost per solve">
        {rows.map((row, i) => {
          const y = i * ROW_HEIGHT;
          const spend = row.costUsd as number;
          return (
            <g key={row.modelKey}>
              <RowLabel text={row.label} y={y} />
              <rect
                x={LABEL_WIDTH}
                y={y}
                width={Math.max(1, scale(spend))}
                height={BAR_HEIGHT}
                rx={2}
                fill={row.solved > 0 ? '#f0b849' : '#444a52'}
                opacity={0.8}
              >
                <title>{`${formatCost(spend)} total`}</title>
              </rect>
              {row.costPerSolve !== null && (
                <line
                  x1={LABEL_WIDTH + scale(row.costPerSolve)}
                  x2={LABEL_WIDTH + scale(row.costPerSolve)}
                  y1={y - 1}
                  y2={y + BAR_HEIGHT + 1}
                  stroke="#e8eaec"
                  strokeWidth={1.5}
                >
                  <title>{`${formatCost(row.costPerSolve)} per solve`}</title>
                </line>
              )}
              <RowValue text={costLabel(row)} x={width} y={y} muted={row.solved === 0} />
            </g>
          );
        })}
      </svg>
    </Panel>
  );
}
