import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, Github, Code2, Grid3X3 } from 'lucide-react';
import { TileIcon } from '../components/game/TileIcon';
import { EntityIcon } from '../components/game/EntityIcon';
import { SolveRateChart, FailureChart } from '../components/eval/charts';
import { parseDSL } from '../dsl/parser';
import { executeMove } from '../gameLogic';
import type { ModelStats, OutcomeCounts } from '../lib/eval/stats';
import type { GameState, Level, TileType } from '../types';

// ─── Hero level ───────────────────────────────────────────────────────
// The playable hero grid and the DSL sample further down are the same level:
// this string is parsed by the real parser and run by the real engine.

const HERO_DSL = `level "Paint Run" 9x7
grid = [
  W W W W W W W W W,
  W R R R W W W W W,
  W R W S W W W W W,
  W R W W W N W W W,
  W R D R R R E P W,
  W W W W W W W G W,
  W W W W W W W W W,
]
tile S = tiles.switch(blue)
tile D = tiles.door(blue)
tile N = tiles.paint(green)
tile E = tiles.door(green)
tile P = tiles.paint(orange)
tile G = tiles.goal(orange)
agent(orange) start(1,1) and reach(7,5)`;

const HERO_OPTIMAL = 18; // verified by exhaustive search over the engine

// Lifted from SOLVE_SYSTEM_PROMPT in src/lib/llm.ts — the contract every
// solve attempt is actually sent — and abridged to the part that bites.
const PROMPT_RULES = [
  'door   impassable UNLESS the agent color matches,',
  '       or a matching switch has been stepped on',
  'paint  walkable; stepping on it changes the agent color',
  'goal   walkable; only a matching-color agent may claim it',
  '\u2026',
  'Each move line: (x,y) direction, the position BEFORE the step',
];

// The engine-verified 18-move optimum, so the page and the number agree.
const RESPONSE_MOVES = [
  '(1,1) right',
  '(3,1) down      \u2190 blue switch at (3,2)',
  '\u2026',
  '(5,4) up        \u2190 green paint at (5,3)',
  '(5,4) right     \u2190 through the green door',
  '(6,4) right     \u2190 orange paint at (7,4)',
  '(7,4) down      \u2190 goal',
];

// Outcome vocabulary from src/lib/eval/replay.ts. The failure shown is the one
// this level is built to provoke: skip the switch and the door stays shut.
const REPLAY_ROWS: { n: string; move: string; outcome: string; note?: string }[] = [
  { n: '01', move: '(1,1) down', outcome: 'moved' },
  { n: '02', move: '(1,2) down', outcome: 'moved' },
  { n: '03', move: '(1,3) down', outcome: 'moved' },
  { n: '04', move: '(1,4) right', outcome: 'blocked', note: 'blue door is shut' },
  { n: '05', move: '(2,4) right', outcome: 'no-agent', note: 'cascade' },
  { n: '06', move: '(3,4) right', outcome: 'no-agent', note: 'cascade' },
];

// ─── Illustrative eval readout ──────────────────────────────────────
// Rendered by the same chart components the eval page uses, so the shape of
// the readout on this page cannot drift from the real one.
//
// The models are anonymised on purpose. Loreval ships no leaderboard: published
// numbers would be stale within a release and would invite exactly the ranking
// this instrument is too small a sample to support. These show what a session
// looks like, not who wins.

const NO_OUTCOMES: OutcomeCounts = {
  moved: 0, 'no-agent': 0, 'bad-direction': 0, illegal: 0, blocked: 0,
};

function demoStat(o: {
  label: string;
  completed: number;
  solved: number;
  interval: [number, number];
  illegalRate: number;
  rootCauses: Partial<OutcomeCounts>;
}): ModelStats {
  const rate = o.solved / o.completed;
  return {
    modelKey: o.label,
    providerId: 'demo',
    modelId: o.label,
    label: o.label,
    total: o.completed,
    completed: o.completed,
    errors: 0,
    parseFailures: 0,
    solved: o.solved,
    solveRate: rate,
    avgProposed: null,
    avgApplied: null,
    avgFailedMoves: null,
    illegalRate: o.illegalRate,
    solveRateInterval: { low: o.interval[0], high: o.interval[1] },
    passAtK: [],
    bestMovesToWin: null,
    avgMovesToWin: null,
    movesToWinSpread: null,
    excessRatio: null,
    outcomes: NO_OUTCOMES,
    rootCauses: { ...NO_OUTCOMES, ...o.rootCauses },
    medianFirstFailure: null,
    avgDurationMs: null,
    durationSpread: null,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    costUsd: null,
    costPerSolve: null,
  };
}

const DEMO_STATS: ModelStats[] = [
  demoStat({ label: 'model-a', completed: 8, solved: 7, interval: [0.529, 0.978], illegalRate: 0.01, rootCauses: { blocked: 1 } }),
  demoStat({ label: 'model-b', completed: 8, solved: 5, interval: [0.306, 0.863], illegalRate: 0.04, rootCauses: { blocked: 2, illegal: 1 } }),
  demoStat({ label: 'model-c', completed: 8, solved: 2, interval: [0.071, 0.591], illegalRate: 0.17, rootCauses: { illegal: 4, 'no-agent': 1, blocked: 1 } }),
];

// The tile set, as shown beside the source. Same renderer as the board.
const TILE_LEGEND: { type: TileType; color?: string; note: string }[] = [
  { type: 'wall', note: 'never passable' },
  { type: 'floor', note: 'always passable' },
  { type: 'door', color: 'blue', note: 'matching color, or a switch' },
  { type: 'switch', color: 'blue', note: 'toggles every door of its color' },
  { type: 'paint', color: 'green', note: 'repaints the agent' },
  { type: 'goal', color: 'orange', note: 'matching agent may claim it' },
  { type: 'one-way', note: 'one direction of entry' },
  { type: 'lock', color: 'red', note: 'opens once, for everyone' },
];

const HERO_LEVEL: Level | null = parseDSL(HERO_DSL).level;

function freshState(level: Level): GameState {
  return {
    entities: JSON.parse(JSON.stringify(level.entities)),
    moves: Object.fromEntries(level.entities.map(e => [e.id, 0])),
    history: Object.fromEntries(level.entities.map(e => [e.id, [e.position]])),
    status: 'playing',
    message: '',
    selectedEntityId: level.entities[0]?.id ?? null,
    toggledColors: [],
    finishedEntityIds: [],
    openedLocks: [],
  };
}

const KEY_DELTAS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
};

/**
 * The shared chrome for every instrument on this page.
 *
 * Instruments sit at `zinc-950` — below the page ground — so they read as
 * recessed panels rather than raised cards. `panel-lit` supplies the edge:
 * a hairline highlight along the top and a deep shadow beneath, so every
 * panel on the site is lit from the same angle.
 */
const PANEL = 'rounded-lg bg-zinc-950 ring-1 ring-zinc-800 panel-lit overflow-hidden';

function PanelHeader({ label, accent, right }: { label: string; accent: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-zinc-800/80">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-1.5 h-1.5 rounded-[1px] shrink-0" style={{ backgroundColor: accent }} />
        <span className="eyebrow text-zinc-500 truncate">{label}</span>
      </div>
      {right}
    </div>
  );
}

function PlayableHero({ level }: { level: Level }) {
  const CELL = 40;
  const STEP = CELL + 1; // 1px hairline gap between tiles, matching the designer grid
  const [state, setState] = useState<GameState>(() => freshState(level));
  const [focused, setFocused] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [showSource, setShowSource] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const agent = state.entities[0];
  const moves = agent ? state.moves[agent.id] ?? 0 : 0;
  const won = state.status === 'won';

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const move = (dx: number, dy: number) => {
    const dir = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
    const next = executeMove(level, state, dx, dy);
    if (!next) return;
    const a0 = state.entities[0];
    const a1 = next.entities[0];
    if (a0 && a1 && (a0.position.x !== a1.position.x || a0.position.y !== a1.position.y)) {
      setLog(l => [...l, `${a0.color ?? 'agent'}  (${a0.position.x},${a0.position.y}) → (${a1.position.x},${a1.position.y})  ${dir}`]);
    } else if (next.message) {
      // Rejected moves are annotated, not silently dropped — same rule as playback
      setLog(l => [...l, `✗ ${dir} — blocked`]);
    }
    setState(next);
  };

  const reset = () => {
    setState(freshState(level));
    setLog([]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = KEY_DELTAS[e.key];
    if (!d) return;
    e.preventDefault();
    move(d[0], d[1]);
  };

  const gridW = level.width * CELL + (level.width - 1);
  const gridH = level.height * CELL + (level.height - 1);

  // Agent color tracks paint tiles, so look it up instead of hardcoding orange
  const AGENT_HEX: Record<string, string> = {
    orange: '#fb923c', blue: '#60a5fa', green: '#6ee7b7', red: '#f87171', purple: '#c084fc', pink: '#f472b6',
  };
  const agentHex = AGENT_HEX[agent?.color ?? 'orange'] ?? '#fb923c';

  return (
    <div className={PANEL}>
      <PanelHeader
        label="paint-run.puzzle · you, solving"
        accent={agentHex}
        right={
          <span className="font-mono text-[11px] text-zinc-500 shrink-0 tabular">
            <span className="text-zinc-300">{moves}</span> moves · optimal {HERO_OPTIMAL}
          </span>
        }
      />

      <div className="p-4 flex flex-col items-center">
        {showSource ? (
          /* Source view — same level, same string the model receives */
          <div
            className="overflow-auto w-full rounded-sm border border-zinc-800/60 px-4 py-3 font-mono text-xs leading-6"
            style={{ height: gridH + 18 }}
          >
            {HERO_DSL.split('\n').map((line, i) => {
              const kw = /^(level|grid|tile|agent)\b/.exec(line)?.[1];
              if (!kw) return <p key={i} className="text-zinc-500 whitespace-pre">{line || ' '}</p>;
              return (
                <p key={i} className="whitespace-pre">
                  <span className="text-blue-300">{kw}</span>
                  <span className="text-zinc-300">{line.slice(kw.length)}</span>
                </p>
              );
            })}
          </div>
        ) : (
        /* Axis labels + grid */
        <div className="flex items-start gap-1.5">
          {/* y axis */}
          <div className="flex flex-col" style={{ height: gridH }}>
            {Array.from({ length: level.height }).map((_, y) => (
              <div key={y} className="flex items-center justify-end font-mono text-[10px] text-zinc-600 w-3" style={{ height: STEP }}>{y}</div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <div
              tabIndex={0}
              role="application"
              aria-label="Playable puzzle. Use arrow keys to move the robot."
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="relative outline-none rounded-sm cursor-pointer focus-visible:ring-2 focus-visible:ring-orange-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              style={{ width: gridW, height: gridH }}
            >
              <div
                className="grid gap-px"
                style={{
                  gridTemplateColumns: `repeat(${level.width}, ${CELL}px)`,
                  gridTemplateRows: `repeat(${level.height}, ${CELL}px)`,
                }}
              >
                {level.tiles.flat().map(tile => {
                  const isToggledSwitch = tile.type === 'switch' && !!tile.color && state.toggledColors.includes(tile.color);
                  return (
                    <div key={`${tile.x}-${tile.y}`} className="relative" style={{ width: CELL, height: CELL }}>
                      <TileIcon
                        type={tile.type}
                        color={tile.color}
                        meta={tile.meta}
                        isOpen={tile.type === 'door' && !!tile.color && state.toggledColors.includes(tile.color)}
                      />
                      {isToggledSwitch && <div className="absolute inset-0.5 rounded-sm ring-1 ring-blue-400/60 pointer-events-none" />}
                    </div>
                  );
                })}
              </div>

              {/* Agent */}
              {agent && (
                <motion.div
                  className="absolute top-0 left-0 flex items-center justify-center pointer-events-none"
                  style={{ width: CELL, height: CELL }}
                  animate={{ x: agent.position.x * STEP, y: agent.position.y * STEP }}
                  transition={{ type: 'spring', stiffness: 350, damping: 26 }}
                >
                  <EntityIcon
                    type="robot"
                    color={agentHex}
                    className="w-6 h-6"
                  />
                </motion.div>
              )}

              {/* Win overlay */}
              {won && (
                <div className="absolute inset-0 rounded-sm bg-zinc-950/85 flex flex-col items-center justify-center gap-3">
                  <p className="font-mono text-sm text-emerald-400 flex items-center gap-2">
                    <Check size={15} /> solved in {moves} moves
                  </p>
                  <p className="font-mono text-xs text-zinc-500">
                    {moves <= HERO_OPTIMAL ? "that's optimal" : `optimal is ${HERO_OPTIMAL}`}
                  </p>
                  <button onClick={reset} className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors">
                    <RotateCcw size={12} /> play again
                  </button>
                </div>
              )}
            </div>

            {/* x axis */}
            <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${level.width}, ${CELL}px)` }}>
              {Array.from({ length: level.width }).map((_, x) => (
                <div key={x} className="text-center font-mono text-[10px] text-zinc-600">{x}</div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* Move log */}
        <div
          ref={logRef}
          className="mt-3 w-full h-16 overflow-y-auto border-t border-zinc-800/60 pt-2 font-mono text-[11px] leading-5"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}
        >
          {log.length === 0 ? (
            <p className="text-zinc-700">— move log: your moves appear here, exactly as a model's would —</p>
          ) : (
            log.map((line, i) => (
              <p key={i} className={line.startsWith('✗') ? 'text-red-400/80' : 'text-zinc-500'}>
                <span className="text-zinc-700 mr-2">{String(i + 1).padStart(2, '0')}</span>{line}
              </p>
            ))
          )}
        </div>

        {/* Controls row */}
        <div className="mt-2 w-full flex items-center justify-between gap-3 border-t border-zinc-800/60 pt-3">
          <p className="font-mono text-[11px] text-zinc-500 min-h-4 truncate">
            {won ? '✓ done' : state.message || (focused ? 'arrow keys / wasd' : 'click the grid to play')}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {([
              [ChevronLeft, -1, 0], [ChevronUp, 0, -1], [ChevronDown, 0, 1], [ChevronRight, 1, 0],
            ] as const).map(([Icon, dx, dy], i) => (
              <button key={i} onClick={() => move(dx, dy)} className="p-1.5 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-600 transition-colors" aria-label="move">
                <Icon size={13} />
              </button>
            ))}
            <button onClick={reset} className="p-1.5 ml-1 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-600 transition-colors" aria-label="reset">
              <RotateCcw size={13} />
            </button>
            <button
              onClick={() => setShowSource(s => !s)}
              className={`flex items-center gap-1.5 px-2 py-1.5 ml-1 rounded border font-mono text-[11px] transition-colors ${
                showSource
                  ? 'border-blue-400/40 text-blue-300 bg-blue-500/10'
                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-600'
              }`}
              title={showSource ? 'Back to the grid' : 'View this level as DSL source'}
            >
              {showSource ? <Grid3X3 size={12} /> : <Code2 size={12} />}
              {showSource ? 'grid' : 'source'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────

function DslBlock({ source }: { source: string }) {
  return (
    <div className="bg-zinc-950 px-5 py-4 font-mono text-[12.5px] leading-6">
      {source.split('\n').map((line, i) => {
        const kw = /^(level|grid|tile|agent)\b/.exec(line)?.[1];
        if (!kw) return <p key={i} className="text-zinc-500 whitespace-pre">{line || ' '}</p>;
        return (
          <p key={i} className="whitespace-pre">
            <span className="text-blue-300">{kw}</span>
            <span className="text-zinc-300">{line.slice(kw.length)}</span>
          </p>
        );
      })}
    </div>
  );
}

function DarkPanel({ label, accent, children }: { label: string; accent: string; children: React.ReactNode }) {
  return (
    <div className={PANEL}>
      <PanelHeader label={label} accent={accent} />
      {children}
    </div>
  );
}

/** A labelled run of lines inside a dark panel — one side of a transcript. */
function TranscriptBlock({ role, lines }: { role: string; lines: string[] }) {
  return (
    <div className="px-5 py-4 border-b border-zinc-800/60 last:border-b-0">
      <p className="eyebrow text-zinc-600 mb-2">{role}</p>
      <pre className="font-mono text-[12px] leading-6 text-zinc-400 whitespace-pre-wrap">{lines.join('\n')}</pre>
    </div>
  );
}

/**
 * A section opening: full-bleed rule, number, title, and one line of intro.
 *
 * There used to be two headings per section — a small band label and an h3
 * below it, saying much the same thing — so neither carried the section. This
 * is the only heading now, and it is sized to act like one.
 *
 * The rule runs the whole width of the viewport while the text sits on the
 * page grid, which keeps the page reading as one continuous sheet rather than
 * a stack of centred cards.
 */
function SectionHead({ n, title, intro }: { n: string; title: string; intro?: string }) {
  return (
    <div className="border-t border-zinc-800">
      <div className="max-w-page mx-auto px-6 pt-8 pb-10">
        <div className="flex items-baseline gap-4">
          <span className="eyebrow text-orange-400 shrink-0 pt-1">{n}</span>
          <h2 className="text-[clamp(1.5rem,2.4vw,2.125rem)] font-semibold text-zinc-100 leading-tight">
            {title}
          </h2>
        </div>
        {intro && <p className="text-[17px] text-zinc-400 max-w-2xl mt-4 ml-0 sm:ml-9">{intro}</p>}
      </div>
    </div>
  );
}

/**
 * A raised card, for content that is explanation rather than readout.
 *
 * Instruments sink below the page ground; these sit above it, so the two never
 * get confused for one another at a glance.
 */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col bg-paper ring-1 ring-zinc-800 rounded-lg p-6">
      <h3 className="text-[1.0625rem] font-semibold text-zinc-100 mb-3">{title}</h3>
      {children}
    </div>
  );
}

/** One cell of the figures band: a large mono number over a small caption. */
function Figure({ value, unit, caption }: { value: string; unit?: string; caption: string }) {
  return (
    <div className="px-6 py-7 border-zinc-800 border-t md:border-t-0 md:border-l first:border-l-0 first:border-t-0">
      <p className="font-mono text-[2.25rem] leading-none text-zinc-100 tabular">
        {value}
        {unit && <span className="text-[1rem] text-zinc-500 ml-1.5">{unit}</span>}
      </p>
      <p className="eyebrow text-zinc-500 mt-3">{caption}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="text-ink selection:bg-orange-500/20">

      {/* HERO — type carries this, not copy */}
      <section className="max-w-page mx-auto px-6 pt-20 pb-16">
        <div className="grid lg:grid-cols-12 gap-x-12 gap-y-14 items-start">
          <div className="lg:col-span-7">
            <p className="eyebrow text-zinc-500 mb-6">
              <span className="text-orange-400">lo</span>gic and{' '}
              <span className="text-orange-400">re</span>asoning{' '}
              <span className="text-orange-400">eval</span>uation
            </p>
            <h1 className="text-[clamp(2.5rem,6vw,4.75rem)] font-bold text-zinc-100 leading-[0.97] mb-8">
              LLM evals on custom spatial logic puzzles
            </h1>
            <p className="text-[17px] text-zinc-400 max-w-lg mb-9">
              Design a puzzle, hand it to any model, replay every move through the game
              engine. Solved or it isn't — no rubric, no judge model.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/eval" className="px-5 py-2.5 bg-zinc-100 hover:bg-white text-paper text-sm font-display font-semibold rounded-sm transition-colors flex items-center gap-2">
                Run an eval <ArrowRight size={15} />
              </Link>
              <Link to="/designer" className="px-5 py-2.5 border border-zinc-700 text-zinc-300 text-sm font-display font-medium rounded-sm hover:border-zinc-500 hover:text-zinc-100 transition-colors">
                Open designer
              </Link>
              <a
                href="https://github.com/integral-quality/loreval"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 border border-zinc-700 text-zinc-300 text-sm font-display font-medium rounded-sm hover:border-zinc-500 hover:text-zinc-100 transition-colors flex items-center gap-2"
              >
                <Github size={15} /> GitHub
              </a>
            </div>
          </div>

          <div className="lg:col-span-5">
            {HERO_LEVEL && <PlayableHero level={HERO_LEVEL} />}
            <p className="text-[12px] text-zinc-600 mt-3">
              real level, real engine — play it
            </p>
          </div>
        </div>
      </section>

      {/* FIGURES — full-bleed band, the page's first hard division */}
      <div className="border-y border-zinc-800 bg-zinc-950/40">
        <div className="max-w-page mx-auto px-0 md:px-6 grid grid-cols-1 md:grid-cols-4">
          <Figure value="0" caption="judge models" />
          <Figure value="5" caption="move outcomes" />
          <Figure value="2" caption="tasks · solve, design" />
          <Figure value="18" unit="moves" caption="optimum, proven by search" />
        </div>
      </div>

      {/* 01 — the DSL */}
      <section className="pt-20 pb-20">
        <SectionHead
          n="01"
          title="Puzzles are written as plain text"
          intro="A grid, a legend, and agent declarations. Compact enough to fit in a prompt, which is exactly how a model receives it."
        />
        <div className="max-w-page mx-auto px-6 grid lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-5">
            <DarkPanel label="paint-run.puzzle · source" accent="#60a5fa">
              <DslBlock source={HERO_DSL} />
            </DarkPanel>
          </div>
          <div className="lg:col-span-7">
            <Card title="The tile set">
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mt-4">
                {TILE_LEGEND.map(({ type, color, note }) => (
                  <li key={`${type}-${color ?? ''}`} className="flex items-center gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-sm bg-zinc-950 p-0.5">
                      <TileIcon type={type} color={color} />
                    </span>
                    <span className="text-[13px] text-zinc-200 w-20 shrink-0">{type}</span>
                    <span className="text-[13px] text-zinc-500 truncate">{note}</span>
                  </li>
                ))}
              </ul>
              <Link to="/docs" className="inline-flex items-center gap-2 text-[13px] font-medium text-orange-400 hover:text-orange-300 transition-colors mt-auto pt-6">
                Full DSL reference <ArrowRight size={14} />
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* 02 — prompt and reply */}
      <section className="pb-20">
        <SectionHead
          n="02"
          title="What the model receives, and what it returns"
          intro="No image, no board renderer, no tool to try a move and see what happened. The model holds the grid in its head and returns a list of moves."
        />
        <div className="max-w-page mx-auto px-6 grid lg:grid-cols-2 gap-6 items-start">
          <DarkPanel label="prompt · solve" accent="#60a5fa">
            <TranscriptBlock role="system · abridged" lines={PROMPT_RULES} />
          </DarkPanel>
          <DarkPanel label="response · raw" accent="#6ee7b7">
            <div className="px-5 py-4">
              <p className="eyebrow text-zinc-600 mb-2">moves · 18 of 18</p>
              <pre className="font-mono text-[12px] leading-6 text-zinc-300 whitespace-pre overflow-x-auto">{RESPONSE_MOVES.join('\n')}</pre>
            </div>
          </DarkPanel>
        </div>
      </section>

      {/* 03 — scoring */}
      <section className="pb-20">
        <SectionHead
          n="03"
          title="Every move is replayed through the engine"
          intro="Each one comes back as one of five outcomes, and those outcomes are the whole score."
        />
        <div className="max-w-page mx-auto px-6 grid lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7">
            <DarkPanel label="replay · one attempt" accent="#f87171">
              <div className="px-5 py-4 font-mono text-[12px] leading-7">
                {REPLAY_ROWS.map(row => {
                  const failed = row.outcome !== 'moved';
                  return (
                    <p key={row.n} className="flex gap-3">
                      <span className="text-zinc-700 w-5 shrink-0">{row.n}</span>
                      <span className={`w-28 shrink-0 ${failed ? 'text-zinc-300' : 'text-zinc-500'}`}>{row.move}</span>
                      <span className={`w-36 shrink-0 ${failed ? 'text-red-400' : 'text-emerald-500/80'}`}>{row.outcome}</span>
                      {row.note && <span className="text-zinc-600 truncate">{row.note}</span>}
                    </p>
                  );
                })}
                <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between text-zinc-500">
                  <span>applied 3 / 6 · first failure at 04</span>
                  <span className="text-red-400">✗ unsolved</span>
                </div>
              </div>
            </DarkPanel>
          </div>
          <div className="lg:col-span-5">
            <Card title="One mistake cascades">
              <p className="text-[15px] text-zinc-400 mb-4">
                A rejected move leaves the agent where it was while the plan assumes it moved,
                so every later coordinate is stale.
              </p>
              <p className="text-[15px] text-zinc-400">
                The statistics track the <strong className="text-zinc-200 font-semibold">first</strong> failure
                separately. That's the root cause; the rest is echo.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* 04 — statistics */}
      <section className="pb-24">
        <SectionHead
          n="04"
          title="What a session measures"
          intro="Solve rate with a confidence interval, and the root cause behind every failed attempt."
        />
        <div className="max-w-page mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-3">
              <div className={PANEL}>
                <PanelHeader label="session · 8 runs" accent="#fb923c" />
                <div className="px-5 py-4 font-mono text-[12px] overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-zinc-600">
                        <th className="font-normal pb-2 pr-4">model</th>
                        <th className="font-normal pb-2 pr-4">solved</th>
                        <th className="font-normal pb-2">illegal</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-400">
                      {DEMO_STATS.map(row => (
                        <tr key={row.modelKey} className="border-t border-zinc-800/60">
                          <td className="py-2 pr-4 text-zinc-300">{row.label}</td>
                          <td className="py-2 pr-4">{row.solved}/{row.completed}</td>
                          <td className="py-2">{Math.round((row.illegalRate ?? 0) * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 text-zinc-300">
              <SolveRateChart stats={DEMO_STATS} />
            </div>
            <div className="lg:col-span-5 text-zinc-300">
              <FailureChart stats={DEMO_STATS} />
            </div>
          </div>

          <p className="text-[16px] text-zinc-400 mt-10 max-w-2xl">
            Seven out of eight is not a 93% model — the interval says 53–98%, and the chart
            says so too. Transport errors, format failures and reasoning failures stay
            apart, because collapsing them lets one hide another.
          </p>
          <p className="text-[12px] text-zinc-600 mt-4 max-w-2xl leading-5">
            Illustrative session, models anonymised. Loreval publishes no rankings — run it
            with your own keys and get your own numbers.
          </p>
        </div>
      </section>

      {/* CLOSING */}
      <div className="border-t border-zinc-800">
        <section className="max-w-page mx-auto px-6 py-16 flex flex-wrap items-baseline justify-between gap-6">
          <p className="font-display text-zinc-300 text-[1.25rem] leading-snug max-w-xl">
            Hand one puzzle to several models. Or ask a model to solve the puzzle it just designed.
          </p>
          <Link to="/eval" className="inline-flex items-center gap-2 text-[13px] font-medium text-orange-400 hover:text-orange-300 transition-colors group">
            Run an eval <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </section>
      </div>

    </div>
  );
}
