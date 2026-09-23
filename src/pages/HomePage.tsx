import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, Github, Code2, Grid3X3 } from 'lucide-react';
import { TileIcon } from '../components/game/TileIcon';
import { EntityIcon } from '../components/game/EntityIcon';
import { parseDSL } from '../dsl/parser';
import { executeMove } from '../gameLogic';
import type { GameState, Level } from '../types';

// ─── Hero level ───────────────────────────────────────────────────────────────
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

// The prompt excerpt is lifted from SOLVE_SYSTEM_PROMPT in api/_anthropic.ts —
// the contract every solve attempt is actually sent. The moves below are the
// engine-verified 18-move optimum for HERO_DSL, so the example on this page and
// the number beside it cannot drift apart.
const PROMPT_RULES = [
  'Tile types — passability is critical',
  '  door   impassable UNLESS the agent color matches,',
  '         or a matching switch has been stepped on',
  '  paint  walkable; stepping on it changes the agent color',
  '  goal   walkable; only a matching-color agent may claim it',
  '…',
  'Output format',
  '  Each move line: (x,y) direction',
  '  (x,y)     the agent position before this move',
  '  direction one of: up down left right',
];

const PROMPT_LEVEL = [
  'level "Paint Run" 9x7',
  'grid = [',
  '  W W W W W W W W W,',
  '  W R R R W W W W W,',
  '  …',
  ']',
  'agent(orange) start(1,1) and reach(7,5)',
];

const RESPONSE_PLAN = [
  'The goal at (7,5) is orange and the agent starts orange —',
  'but the green door at (6,4) sits in front of it, so the agent',
  'has to be green to pass and orange again to claim the goal.',
  'Order: blue switch → blue door → green paint → green door',
  '→ orange paint → goal.',
];

const RESPONSE_MOVES = [
  '(1,1) right',
  '(2,1) right',
  '(3,1) down      ← blue switch at (3,2)',
  '…',
  '(5,4) up        ← green paint at (5,3)',
  '(5,3) down',
  '(5,4) right     ← through the green door',
  '(6,4) right     ← orange paint at (7,4)',
  '(7,4) down      ← goal',
];

// Outcome vocabulary from src/lib/eval/replay.ts. The failure shown is the one
// this level is built to provoke: skip the switch and the door stays shut.
const REPLAY_ROWS: { n: string; move: string; outcome: string; note?: string }[] = [
  { n: '01', move: '(1,1) down', outcome: 'moved' },
  { n: '02', move: '(1,2) down', outcome: 'moved' },
  { n: '03', move: '(1,3) down', outcome: 'moved' },
  { n: '04', move: '(1,4) right', outcome: 'blocked', note: 'blue door is shut' },
  { n: '05', move: '(2,4) right', outcome: 'no-agent' },
  { n: '06', move: '(3,4) right', outcome: 'no-agent' },
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
    <div className="rounded-lg bg-zinc-950 border border-zinc-800 shadow-[0_12px_40px_-12px_rgba(33,32,28,0.45)] overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-[2px] shrink-0" style={{ backgroundColor: agentHex }} />
          <span className="font-mono text-xs text-zinc-400 truncate">paint-run.puzzle · you, solving</span>
        </div>
        <span className="font-mono text-xs text-zinc-500 shrink-0">
          moves {moves} · optimal {HERO_OPTIMAL}
        </span>
      </div>

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

// ─── Shared bits ──────────────────────────────────────────────────────────────

function DslBlock({ source }: { source: string }) {
  return (
    <div className="bg-zinc-950 p-6 font-mono text-sm leading-7">
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

/** Ledger-style section rule: heavy top line, title left, grid coordinate right. */
function RuleHeader({ coord, title }: { coord: string; title: string }) {
  return (
    <div className="border-t-2 border-zinc-700 pt-4 mb-12 flex items-baseline justify-between gap-4">
      <h2 className="font-mono text-sm font-bold text-zinc-100 lowercase tracking-wide">{title}</h2>
      <span className="font-mono text-xs text-zinc-400">({coord})</span>
    </div>
  );
}

function DarkPanel({ label, accent, children }: { label: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-zinc-950 border border-zinc-800 shadow-[0_12px_40px_-12px_rgba(33,32,28,0.45)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800">
        <div className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: accent }} />
        <span className="font-mono text-xs text-zinc-400">{label}</span>
      </div>
      {children}
    </div>
  );
}

/** A labelled run of lines inside a dark panel — one side of a transcript. */
function TranscriptBlock({ role, lines }: { role: string; lines: string[] }) {
  return (
    <div className="px-5 py-4 border-b border-zinc-800/60 last:border-b-0">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-2">{role}</p>
      <pre className="font-mono text-[12px] leading-6 text-zinc-400 whitespace-pre-wrap">{lines.join('\n')}</pre>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="text-ink selection:bg-orange-500/20">

      {/* HERO */}
      <section className="max-w-page mx-auto px-6 pt-16 pb-24">
        {/* Meta strip */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-zinc-500 border-b border-white/15 pb-3 mb-14">
          <span>
            <span className="text-orange-400 font-bold">lo</span>gic and{' '}
            <span className="text-orange-400 font-bold">re</span>asoning{' '}
            <span className="text-orange-400 font-bold">eval</span>uation
          </span>
        </div>

        <div className="flex flex-col lg:flex-row items-start gap-14">
          <div className="flex-[1.2] pt-2">
            <h1 className="text-[2.6rem] md:text-5xl font-bold text-zinc-100 leading-[1.1] tracking-tight mb-7">
              Can a language model<br />solve this puzzle?
            </h1>
            <p className="text-base text-zinc-400 max-w-xl leading-relaxed mb-4">
              Loreval measures LLM performance on grid-based spatial puzzles across two tasks: <strong className="text-zinc-100 font-semibold">solving</strong> a puzzle from its text description, and <strong className="text-zinc-100 font-semibold">designing</strong> a new one to a set of constraints.
            </p>
            <p className="text-base text-zinc-400 max-w-xl leading-relaxed mb-10">
              Outcomes are discrete and verifiable. A puzzle is either solved or it isn't — no rubric, no judge model. Try the one on the right; a model gets the exact same level, as text.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/designer" className="px-6 py-3 bg-zinc-100 hover:bg-zinc-300 text-paper text-sm font-semibold rounded transition-colors flex items-center gap-2">
                Open designer <ArrowRight size={15} />
              </Link>
              <a
                href="https://github.com/integral-quality/loreval"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 border border-white/15 text-zinc-200 text-sm font-medium rounded hover:border-zinc-500 transition-colors flex items-center gap-2"
              >
                <Github size={15} /> GitHub
              </a>
            </div>
          </div>

          <div className="flex-1 w-full max-w-md">
            {HERO_LEVEL && <PlayableHero level={HERO_LEVEL} />}
            <p className="font-mono text-[11px] text-zinc-500 mt-3 leading-5">
              real level, real engine. the switch opens the blue door — but the goal takes more than that. optimal verified by exhaustive search.
            </p>
          </div>
        </div>
      </section>

      {/* PUZZLE FORMAT */}
      <section className="max-w-page mx-auto px-6 pb-24">
        <RuleHeader coord="0,1" title="the puzzle format" />
        <div className="grid lg:grid-cols-2 gap-14 items-start">
          <div>
            <h3 className="text-2xl font-bold text-zinc-100 mb-5">Plain text, all the way down</h3>
            <p className="text-zinc-400 text-[15px] leading-relaxed mb-4">
              Levels are written in a small DSL: a grid of tile characters, a legend mapping characters to tile types and colors, and agent declarations with start positions and goals.
            </p>
            <p className="text-zinc-400 text-[15px] leading-relaxed mb-4">
              The source on the right is the level at the top of this page — the one you can play. The same parser and the same engine that just ran your moves also score a model's attempt. There is no separate "eval version" of the game.
            </p>
            <p className="text-zinc-400 text-[15px] leading-relaxed mb-6">
              The format is compact enough to fit in a prompt, which is exactly how a model receives it. Levels can be written by hand, drawn in the visual editor, or generated by a model — all three read and write the same text.
            </p>
            <Link to="/docs" className="inline-flex items-center gap-2 font-mono text-sm text-orange-400 hover:text-orange-300 transition-colors">
              full DSL reference <ArrowRight size={14} />
            </Link>
          </div>

          <DarkPanel label="paint-run.puzzle · source" accent="#60a5fa">
            <DslBlock source={HERO_DSL} />
          </DarkPanel>
        </div>
      </section>

      {/* HOW A MODEL ATTEMPTS IT */}
      <section className="max-w-page mx-auto px-6 pb-24">
        <RuleHeader coord="0,2" title="how a model attempts it" />
        <div className="grid lg:grid-cols-2 gap-14 items-start">
          <div>
            <h3 className="text-2xl font-bold text-zinc-100 mb-5">A prompt in, a move list out</h3>
            <p className="text-zinc-400 text-[15px] leading-relaxed mb-4">
              The model gets two things: the rules of the tile set, and the level as DSL text. No image, no board renderer, no tool it can call to try a move and see what happened. It has to hold the grid in its head.
            </p>
            <p className="text-zinc-400 text-[15px] leading-relaxed mb-4">
              What comes back is plain text. Whatever reasoning it wants to show is fine, but the move sequence has to land in a fenced block, one <code className="font-mono text-[13px] text-zinc-200">(x,y) direction</code> per line, the coordinate being where the agent stands <em>before</em> the step. A reply with no parsable block is a format failure, counted apart from a wrong plan.
            </p>
            <p className="text-zinc-400 text-[15px] leading-relaxed">
              This level is small but not flat: the orange goal sits behind a green door, so the agent has to pick up green paint to get through and orange paint to claim the exit. Getting it right is an ordering problem, not a pathfinding one.
            </p>
          </div>

          <div className="space-y-4">
            <DarkPanel label="prompt · solve" accent="#60a5fa">
              <TranscriptBlock role="system · abridged" lines={PROMPT_RULES} />
              <TranscriptBlock role="user" lines={PROMPT_LEVEL} />
            </DarkPanel>

            <DarkPanel label="response · raw" accent="#6ee7b7">
              <TranscriptBlock role="assistant" lines={RESPONSE_PLAN} />
              <div className="px-5 py-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-2">moves · 18 of 18</p>
                <pre className="font-mono text-[12px] leading-6 text-zinc-300 whitespace-pre overflow-x-auto">{RESPONSE_MOVES.join('\n')}</pre>
              </div>
            </DarkPanel>
          </div>
        </div>
      </section>

      {/* INSPECTING AN ATTEMPT */}
      <section className="max-w-page mx-auto px-6 pb-24">
        <RuleHeader coord="0,3" title="inspecting a solve attempt" />
        <div className="grid lg:grid-cols-2 gap-14 items-start">

          <div className="space-y-9">
            {[
              {
                title: 'Step-by-step playback',
                body: 'The model\'s move sequence plays back one step at a time. Source and target tiles are highlighted; playback can be paused, stepped in either direction, or rewound.',
              },
              {
                title: 'Move log',
                body: 'Each move is listed as agent (x,y) → (x,y) direction. Moves the engine rejects — wrong agent position, blocked path — are annotated rather than silently dropped.',
              },
              {
                title: 'Coordinate overlay',
                body: 'Axis labels run along the grid edges, and highlighted tiles show their coordinates during playback, so the log can be cross-referenced without counting cells.',
              },
              {
                title: 'Feedback loop',
                body: 'After a failed attempt you can tell the model what went wrong, in plain language. Its previous moves and your note go back as context, and it retries.',
              },
            ].map(({ title, body }, i) => (
              <div key={title} className="flex gap-5">
                <span className="font-mono text-xs text-zinc-400 pt-1 select-none">{`0${i + 1}`}</span>
                <div>
                  <h4 className="text-base font-bold text-zinc-100 mb-1.5">{title}</h4>
                  <p className="text-zinc-400 text-[15px] leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:sticky lg:top-20">
            <DarkPanel label="move log · paused" accent="#fb923c">
              <div className="p-6 font-mono text-sm leading-8 space-y-0.5">
                {[
                  'orange  (1,4) → (1,3)  up',
                  'orange  (1,3) → (2,3)  right',
                  'orange  (2,3) → (2,2)  up',
                  'orange  (2,2) → (2,1)  up',
                ].map((line, i) => (
                  <p key={i} className="text-zinc-600">{line}</p>
                ))}
                <p className="bg-orange-500/10 border border-orange-500/25 rounded px-2 text-orange-300 my-1">
                  ▶ orange  (2,1) → (3,1)  right
                </p>
                {[
                  'orange  (3,1) → (4,1)  right',
                  'orange  (4,1) → (4,2)  down',
                  'orange  (4,2) → (4,3)  down',
                  'orange  (4,3) → (5,3)  right',
                  'orange  (5,3) → (6,3)  right',
                ].map((line, i) => (
                  <p key={i} className="text-zinc-700">{line}</p>
                ))}
                <div className="pt-4 border-t border-zinc-800 mt-3 flex justify-between text-zinc-500 text-sm">
                  <span>move 5 / 10</span>
                  <span className="text-emerald-500/80">✓ solved</span>
                </div>
              </div>
            </DarkPanel>
          </div>

        </div>
      </section>

      {/* HOW IT GETS EVALUATED */}
      <section className="max-w-page mx-auto px-6 pb-24">
        <RuleHeader coord="0,4" title="how it gets evaluated" />
        <div className="grid lg:grid-cols-2 gap-14 items-start">
          <div>
            <h3 className="text-2xl font-bold text-zinc-100 mb-5">The engine is the grader</h3>
            <p className="text-zinc-400 text-[15px] leading-relaxed mb-4">
              Every proposed move is fed back through the same function that moves your agent when you play. It returns one of five outcomes, and those outcomes are the whole score — there is no rubric and no judge model anywhere in the loop.
            </p>
            <p className="text-zinc-400 text-[15px] leading-relaxed mb-4">
              That makes failures legible. A plan that walks into a shut door reports <code className="font-mono text-[13px] text-zinc-200">blocked</code> at the exact index where it went wrong, and the moves after it usually report <code className="font-mono text-[13px] text-zinc-200">no-agent</code> — the agent is no longer where the plan assumed it would be.
            </p>
            <p className="text-zinc-400 text-[15px] leading-relaxed mb-6">
              Three kinds of failure stay apart on purpose: a request that never returned is a transport error and is excluded from the solve rate, a reply with no parsable move block is a format failure, and a parsable plan the engine rejects is a reasoning failure. Collapsing them lets one hide another.
            </p>
            <Link to="/eval" className="inline-flex items-center gap-2 font-mono text-sm text-orange-400 hover:text-orange-300 transition-colors">
              run an eval <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-4">
            <DarkPanel label="replay · one attempt" accent="#f87171">
              <div className="px-5 py-4 font-mono text-[12px] leading-7">
                {REPLAY_ROWS.map(row => {
                  const failed = row.outcome !== 'moved';
                  return (
                    <p key={row.n} className="flex gap-3">
                      <span className="text-zinc-700 w-5 shrink-0">{row.n}</span>
                      <span className={`w-28 shrink-0 ${failed ? 'text-zinc-400' : 'text-zinc-500'}`}>{row.move}</span>
                      <span className={`shrink-0 ${failed ? 'text-red-400' : 'text-emerald-500/80'}`}>{row.outcome}</span>
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

            <DarkPanel label="session · 3 runs per model" accent="#fb923c">
              <div className="px-5 py-4 font-mono text-[12px] overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-zinc-600">
                      <th className="font-normal pb-2 pr-4">model</th>
                      <th className="font-normal pb-2 pr-4">solved</th>
                      <th className="font-normal pb-2 pr-4">illegal</th>
                      <th className="font-normal pb-2">moves</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-400">
                    {[
                      ['model-a', '3/3', '0%', '18'],
                      ['model-b', '2/3', '4%', '21'],
                      ['model-c', '0/3', '17%', '—'],
                    ].map(([model, solved, illegal, moves]) => (
                      <tr key={model} className="border-t border-zinc-800/60">
                        <td className="py-1.5 pr-4 text-zinc-300">{model}</td>
                        <td className="py-1.5 pr-4">{solved}</td>
                        <td className="py-1.5 pr-4">{illegal}</td>
                        <td className="py-1.5">{moves}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 pt-3 border-t border-zinc-800 text-zinc-600 leading-5">
                  solve rate, illegal-move rate, and moves against the verified optimum — exportable as CSV
                </p>
              </div>
            </DarkPanel>
            <p className="font-mono text-[11px] text-zinc-500 leading-5">
              the shape of the table, with the model names stood in for. loreval publishes no rankings — you run the eval with your own keys and get your own numbers.
            </p>
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="max-w-page mx-auto px-6 pb-28">
        <div className="border-t-2 border-zinc-700 pt-12">
          <p className="text-zinc-300 text-xl leading-relaxed max-w-2xl mb-8">
            The same puzzle can be handed to multiple models. The same model can be asked to solve a puzzle it just designed. Both directions are informative.
          </p>
          <Link to="/designer" className="inline-flex items-center gap-2 font-mono text-sm text-orange-400 hover:text-orange-300 transition-colors group">
            open the designer <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

    </div>
  );
}
