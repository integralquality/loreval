import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, Github } from 'lucide-react';
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

  const agent = state.entities[0];
  const moves = agent ? state.moves[agent.id] ?? 0 : 0;
  const won = state.status === 'won';

  const move = (dx: number, dy: number) =>
    setState(prev => executeMove(level, prev, dx, dy) ?? prev);

  const reset = () => setState(freshState(level));

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
        {/* Axis labels + grid */}
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

        {/* Controls row */}
        <div className="mt-3 w-full flex items-center justify-between gap-3 border-t border-zinc-800/60 pt-3">
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
    <div className="border-t-2 border-zinc-900 pt-4 mb-12 flex items-baseline justify-between gap-4">
      <h2 className="font-mono text-sm font-bold text-zinc-900 lowercase tracking-wide">{title}</h2>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="text-ink selection:bg-orange-500/20">

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-24">
        {/* Meta strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-zinc-500 border-b border-zinc-900/15 pb-3 mb-14">
          <span>
            <span className="text-orange-600 font-bold">lo</span>gic and{' '}
            <span className="text-orange-600 font-bold">re</span>asoning{' '}
            <span className="text-orange-600 font-bold">eval</span>uation
          </span>
          <span className="border border-zinc-900/20 rounded px-2 py-0.5">v0 · early scaffolding — no published results yet</span>
        </div>

        <div className="flex flex-col lg:flex-row items-start gap-14">
          <div className="flex-[1.2] pt-2">
            <h1 className="text-[2.6rem] md:text-5xl font-bold text-zinc-900 leading-[1.1] tracking-tight mb-7">
              Can a language model<br />solve this puzzle?
            </h1>
            <p className="text-base text-zinc-600 max-w-xl leading-relaxed mb-4">
              Loreval measures LLM performance on grid-based spatial puzzles across two tasks: <strong className="text-zinc-900 font-semibold">solving</strong> a puzzle from its text description, and <strong className="text-zinc-900 font-semibold">designing</strong> a new one to a set of constraints.
            </p>
            <p className="text-base text-zinc-600 max-w-xl leading-relaxed mb-10">
              Outcomes are discrete and verifiable. A puzzle is either solved or it isn't — no rubric, no judge model. Try the one on the right; a model gets the exact same level, as text.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/designer" className="px-6 py-3 bg-zinc-900 hover:bg-zinc-700 text-paper text-sm font-semibold rounded transition-colors flex items-center gap-2">
                Open designer <ArrowRight size={15} />
              </Link>
              <a
                href="https://github.com/integral-quality/loreval"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 border border-zinc-900/25 text-zinc-800 text-sm font-medium rounded hover:border-zinc-900 transition-colors flex items-center gap-2"
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

      {/* THE TWO TASKS */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <RuleHeader coord="0,1" title="the two tasks" />
        <div className="grid md:grid-cols-2 gap-x-16 gap-y-12">
          <div className="flex gap-6">
            <span className="font-mono text-3xl font-bold text-orange-500 leading-none select-none">1</span>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 mb-3">Solving</h3>
              <p className="text-zinc-600 text-[15px] leading-relaxed mb-4">
                Given a puzzle it hasn't seen before, can the model produce a valid move sequence? The puzzles demand multi-step planning: doors that need a switch hit first, agents that block each other, one-way tiles, color-changing paint. Preconditions and ordering, not just pathfinding.
              </p>
              <p className="text-zinc-500 text-[15px] leading-relaxed">
                Every attempt is replayed move-by-move through the engine, so you see <em>where</em> a plan breaks — not just that it failed.
              </p>
            </div>
          </div>
          <div className="flex gap-6">
            <span className="font-mono text-3xl font-bold text-blue-500 leading-none select-none">2</span>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 mb-3">Designing</h3>
              <p className="text-zinc-600 text-[15px] leading-relaxed mb-4">
                Given a difficulty, a grid size, and a set of mechanics, can the model produce a well-formed puzzle? This probes whether it understands how mechanics interact — a switch placed where it matters, not as decoration.
              </p>
              <p className="text-zinc-500 text-[15px] leading-relaxed">
                The model also explains its design decisions in writing, which is extra signal on whether it understood what it built.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PUZZLE FORMAT */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <RuleHeader coord="0,2" title="the puzzle format" />
        <div className="grid lg:grid-cols-2 gap-14 items-start">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900 mb-5">Plain text, all the way down</h3>
            <p className="text-zinc-600 text-[15px] leading-relaxed mb-4">
              Levels are written in a small DSL: a grid of tile characters, a legend mapping characters to tile types and colors, and agent declarations with start positions and goals.
            </p>
            <p className="text-zinc-600 text-[15px] leading-relaxed mb-4">
              The source on the right is the level at the top of this page — the one you can play. The same parser and the same engine that just ran your moves also score a model's attempt. There is no separate "eval version" of the game.
            </p>
            <p className="text-zinc-600 text-[15px] leading-relaxed mb-6">
              The format is compact enough to fit in a prompt, which is exactly how a model receives it. Levels can be written by hand, drawn in the visual editor, or generated by a model — all three read and write the same text.
            </p>
            <Link to="/docs" className="inline-flex items-center gap-2 font-mono text-sm text-orange-600 hover:text-orange-500 transition-colors">
              full DSL reference <ArrowRight size={14} />
            </Link>
          </div>

          <DarkPanel label="paint-run.puzzle · source" accent="#60a5fa">
            <DslBlock source={HERO_DSL} />
          </DarkPanel>
        </div>
      </section>

      {/* INSPECTING AN ATTEMPT */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
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
                  <h4 className="text-base font-bold text-zinc-900 mb-1.5">{title}</h4>
                  <p className="text-zinc-600 text-[15px] leading-relaxed">{body}</p>
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

      {/* WHY GRIDS */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <RuleHeader coord="0,4" title="why grid puzzles" />
        <div className="grid md:grid-cols-3 gap-x-12 gap-y-10">
          {[
            {
              accent: 'bg-emerald-500',
              title: 'Verifiable outcomes',
              body: 'Solved or not. Solvable or not. Mechanics required or decorative. Every score is computed by executing moves, never by asking another model to grade.',
            },
            {
              accent: 'bg-blue-500',
              title: 'Inexhaustible novelty',
              body: 'Any combination of layout, mechanics, and agents yields a level no model saw in training. Fresh test items can be minted forever, which keeps the benchmark honest.',
            },
            {
              accent: 'bg-orange-500',
              title: 'Inspectable failures',
              body: 'Playback shows the exact move where a plan diverges. That turns a pass/fail number into a failure mode you can name — and study.',
            },
          ].map(({ accent, title, body }) => (
            <div key={title}>
              <div className={`w-2.5 h-2.5 rounded-[2px] mb-4 ${accent}`} />
              <h4 className="text-base font-bold text-zinc-900 mb-2">{title}</h4>
              <p className="text-zinc-600 text-[15px] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STATUS */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <RuleHeader coord="0,5" title="status: built / building" />
        <div className="grid md:grid-cols-2 gap-14">
          <div>
            <p className="font-mono text-xs text-emerald-700 mb-5">— working today</p>
            <ul className="space-y-3">
              {[
                'DSL parser, serializer, and game engine — one source of truth',
                'Visual designer with code editor, kept in sync both ways',
                'Model solve attempts with step-by-step playback and retry loop',
                'Model-generated levels from difficulty + mechanics constraints',
                'Level saving, sharing, and community browsing',
              ].map(item => (
                <li key={item} className="flex gap-3 text-[15px] text-zinc-700 leading-relaxed">
                  <Check size={15} className="text-emerald-600 mt-1 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-mono text-xs text-zinc-500 mb-5">— next, in order</p>
            <ul className="space-y-3">
              {[
                'Deterministic solver: verified solvability and optimal length for every level',
                'Fixed benchmark suites with batch runs, pass@k, and moves-vs-optimal',
                'Interactive solve mode: the model sees the board state after every move',
                'Logic gates (AND / OR / XOR) wiring switches to doors',
                'Open-source CLI for running the eval against any provider',
              ].map((item, i) => (
                <li key={item} className="flex gap-3 text-[15px] text-zinc-500 leading-relaxed">
                  <span className="font-mono text-xs text-zinc-400 mt-0.5 shrink-0 w-4">{i + 1}.</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-zinc-500 text-sm leading-relaxed mt-6 border-l-2 border-zinc-900/15 pl-4">
              No model comparison numbers are published yet — they'll come from the benchmark harness, not from anecdotes. What exists today is the instrument.
            </p>
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="max-w-5xl mx-auto px-6 pb-28">
        <div className="border-t-2 border-zinc-900 pt-12">
          <p className="text-zinc-700 text-xl leading-relaxed max-w-2xl mb-8">
            The same puzzle can be handed to multiple models. The same model can be asked to solve a puzzle it just designed. Both directions are informative.
          </p>
          <Link to="/designer" className="inline-flex items-center gap-2 font-mono text-sm text-orange-600 hover:text-orange-500 transition-colors group">
            open the designer <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

    </div>
  );
}
