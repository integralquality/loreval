import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Github, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { TileIcon } from '../components/game/TileIcon';
import { EntityIcon } from '../components/game/EntityIcon';
import { parseDSL } from '../dsl/parser';
import { executeMove } from '../gameLogic';
import type { GameState, Level } from '../types';

// ─── Hero level ───────────────────────────────────────────────────────────────
// The playable hero grid and the DSL sample below are the same level: this
// string is parsed by the real parser and run by the real engine.

const HERO_DSL = `level "Switch Gate" 8x6
grid = [
  W W W W W W W W,
  W R R R R R R W,
  W R W W W W S W,
  W R W G D R R W,
  W R R W R R R W,
  W W W W W W W W,
]
tile S = tiles.switch(blue)
tile D = tiles.door(blue)
tile G = tiles.goal(orange)
agent(orange) start(1,1) and reach(3,3)`;

const HERO_OPTIMAL = 10;
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
  const CELL = 44;
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

  const gridW = level.width * CELL;
  const gridH = level.height * CELL;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-[2px] bg-orange-400" />
          <span className="font-mono text-xs text-zinc-400">switch-gate.puzzle</span>
        </div>
        <span className="font-mono text-xs text-zinc-500">
          moves {moves} · optimal {HERO_OPTIMAL}
        </span>
      </div>

      <div className="p-5">
        {/* Grid + axis labels */}
        <div className="inline-block">
          <div className="flex">
            {/* y axis */}
            <div className="flex flex-col mr-1.5" style={{ height: gridH }}>
              {Array.from({ length: level.height }).map((_, y) => (
                <div key={y} className="flex items-center justify-end font-mono text-[10px] text-zinc-600 w-3" style={{ height: CELL }}>{y}</div>
              ))}
            </div>

            <div
              tabIndex={0}
              role="application"
              aria-label="Playable puzzle. Use arrow keys to move the robot."
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="relative outline-none rounded-md cursor-pointer focus:ring-2 focus:ring-orange-400/40"
              style={{ width: gridW, height: gridH }}
            >
              <div
                className="grid rounded-md overflow-hidden"
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
                  animate={{ x: agent.position.x * CELL, y: agent.position.y * CELL }}
                  transition={{ type: 'spring', stiffness: 350, damping: 26 }}
                >
                  <EntityIcon type="robot" color="#fb923c" className="w-6 h-6 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]" />
                </motion.div>
              )}

              {/* Win overlay */}
              {won && (
                <div className="absolute inset-0 rounded-md bg-zinc-950/85 flex flex-col items-center justify-center gap-3">
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
          </div>

          {/* x axis */}
          <div className="flex ml-[18px]" style={{ width: gridW }}>
            {Array.from({ length: level.width }).map((_, x) => (
              <div key={x} className="text-center font-mono text-[10px] text-zinc-600" style={{ width: CELL }}>{x}</div>
            ))}
          </div>
        </div>

        {/* Controls row */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="font-mono text-xs text-zinc-500 min-h-4">
            {won ? '' : state.message || (focused ? 'arrow keys / wasd' : 'click the grid to play')}
          </p>
          <div className="flex items-center gap-1">
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

// ─── DSL rendering ────────────────────────────────────────────────────────────

function DslBlock({ source }: { source: string }) {
  return (
    <div className="bg-zinc-900/60 p-6 font-mono text-sm leading-7">
      {source.split('\n').map((line, i) => {
        const kw = /^(level|grid|tile|agent)\b/.exec(line)?.[1];
        if (!kw) return <p key={i} className="text-zinc-500 whitespace-pre">{line || ' '}</p>;
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

// ─── Page scaffolding ─────────────────────────────────────────────────────────

function SectionLabel({ coord, children }: { coord: string; children: string }) {
  return (
    <p className="font-mono text-xs tracking-wider text-zinc-500 mb-10">
      <span className="text-orange-400/80">({coord})</span>
      <span className="mx-2 text-zinc-700">·</span>
      {children}
    </p>
  );
}

function PanelHeader({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/60">
      <div className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: accent }} />
      <span className="font-mono text-xs text-zinc-400">{label}</span>
    </div>
  );
}

const GRAPH_PAPER = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
  backgroundSize: '56px 56px',
};

export default function HomePage() {
  return (
    <div className="bg-zinc-950 text-zinc-300 font-sans selection:bg-orange-500/30" style={GRAPH_PAPER}>

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-24">
        <div className="flex flex-col lg:flex-row items-start gap-14">
          <div className="flex-[1.2] pt-4">
            {/* Wordmark + acronym breakdown */}
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 mb-3">
              <span className="font-mono text-2xl font-bold text-white tracking-tight">loreval</span>
              <span className="font-mono text-sm text-zinc-500 leading-5">
                <span className="text-orange-400">Lo</span>gic and{' '}
                <span className="text-orange-400">Re</span>asoning{' '}
                <span className="text-orange-400">Eval</span>uation
              </span>
            </div>
            <p className="inline-block font-mono text-[11px] text-zinc-500 border border-zinc-800 rounded px-2 py-0.5 mb-8">
              v0 · early scaffolding — no published results yet
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-[1.15] tracking-tight mb-6">
              LLM evaluation on<br />
              <span className="text-orange-300">logic and spatial reasoning</span>
            </h1>
            <p className="text-base text-zinc-400 max-w-xl leading-relaxed mb-10">
              Loreval measures language model performance on grid-based spatial puzzles across two tasks: solving puzzles from a description, and generating new ones given a set of constraints. Outcomes are discrete and verifiable — a puzzle is either solved or it isn't.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/designer" className="px-6 py-3 bg-orange-500 hover:bg-orange-400 text-zinc-950 text-sm font-semibold rounded-md transition-colors flex items-center gap-2">
                Open designer <ArrowRight size={15} />
              </Link>
              <a
                href="https://github.com/integral-quality/loreval"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 border border-zinc-700 text-zinc-300 text-sm font-medium rounded-md hover:border-zinc-500 hover:text-white transition-colors flex items-center gap-2"
              >
                <Github size={15} /> GitHub
              </a>
            </div>
          </div>

          <div className="flex-1 w-full max-w-md">
            {HERO_LEVEL && <PlayableHero level={HERO_LEVEL} />}
            <p className="font-mono text-xs text-zinc-600 mt-3 leading-5">
              This is a real level running on the real engine. The switch opens the door. Models get the same puzzle as text.
            </p>
          </div>
        </div>
      </section>

      {/* WHAT IT EVALUATES */}
      <section className="border-y border-zinc-800/60 py-24 bg-zinc-950/60">
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel coord="0,1">what it evaluates</SectionLabel>
          <div className="grid lg:grid-cols-2 gap-px bg-zinc-800/40 rounded-lg overflow-hidden border border-zinc-800/60">

            <div className="bg-zinc-950 p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2.5 h-2.5 rounded-[2px] bg-orange-400" />
                <h3 className="text-xl font-semibold text-white">Solving</h3>
              </div>
              <p className="text-zinc-400 text-base leading-relaxed mb-5">
                Given a puzzle it hasn't seen before, can the model produce a valid solution? The puzzles involve multi-step planning: locked doors that require a switch, agents that block each other, one-way tiles, color-changing mechanics. The model must reason about preconditions and ordering, not just find a path.
              </p>
              <p className="text-zinc-500 text-base leading-relaxed">
                Every move is logged and played back step-by-step, so you can inspect where the model's plan breaks down — not just whether it failed.
              </p>
            </div>

            <div className="bg-zinc-950 p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2.5 h-2.5 rounded-[2px] bg-blue-400" />
                <h3 className="text-xl font-semibold text-white">Designing</h3>
              </div>
              <p className="text-zinc-400 text-base leading-relaxed mb-5">
                Given a difficulty level, a grid size, and a set of mechanics to include, can the model produce a well-formed puzzle? This tests whether the model understands the interaction between mechanics well enough to use them purposefully — not just place them decoratively.
              </p>
              <p className="text-zinc-500 text-base leading-relaxed">
                The model also provides a written explanation of its design decisions, which gives additional signal on whether it understood what it was building.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* DSL */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <SectionLabel coord="0,2">puzzle format</SectionLabel>
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <h3 className="text-2xl font-semibold text-white mb-5">A text-based DSL</h3>
            <p className="text-zinc-400 text-base leading-relaxed mb-5">
              Puzzles are defined in a small domain-specific language. A level specifies a grid of tile characters, a legend mapping each character to a tile type and color, and agent declarations with start positions and goals.
            </p>
            <p className="text-zinc-400 text-base leading-relaxed mb-5">
              The source on the right is the level at the top of this page — the one you can play. It's parsed by the same parser and run by the same engine that scores a model's attempt. The format is compact enough to fit in a prompt, which is how it gets sent to the model.
            </p>
            <p className="text-zinc-400 text-base leading-relaxed">
              Tile types include walls, floors, doors, switches, paint tiles, one-way tiles, locks, and goals — both color-matched and universal. Mechanics compose: a switch can open a door that a paint tile is needed to reach. Levels can be written by hand, produced by the visual editor, or generated by AI — all three stay in sync.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <PanelHeader label="switch-gate.puzzle — source" accent="#60a5fa" />
            <DslBlock source={HERO_DSL} />
          </div>
        </div>
      </section>

      {/* LIVE DEBUGGING */}
      <section className="border-t border-zinc-800/60 py-24 bg-zinc-950/60">
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel coord="0,3">inspecting a solve attempt</SectionLabel>
          <div className="grid lg:grid-cols-2 gap-16 items-start">

            <div className="space-y-10">
              {[
                {
                  title: 'Step-by-step playback',
                  body: 'The model\'s planned move sequence plays back one step at a time. The current source and target tile are highlighted on the grid. Playback can be paused, stepped forward or backward, or rewound to the start.',
                },
                {
                  title: 'Move log',
                  body: 'Each move is listed as agent (x,y) → (x,y) direction, with the active step highlighted. Moves the engine skips — because the model placed an agent at the wrong position, or a path was blocked — are annotated rather than silently dropped.',
                },
                {
                  title: 'Coordinate overlay',
                  body: 'Axis labels run along the grid edges. During playback, highlighted tiles show their coordinates directly, so move log entries can be cross-referenced without counting cells.',
                },
                {
                  title: 'Feedback loop',
                  body: 'After a failed attempt, you can describe what went wrong in natural language. The original move sequence and your note are sent back to the model as context, and it retries.',
                },
              ].map(({ title, body }) => (
                <div key={title}>
                  <h4 className="text-base font-semibold text-zinc-200 mb-2">{title}</h4>
                  <p className="text-zinc-500 text-base leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-zinc-800 overflow-hidden lg:sticky lg:top-20">
              <PanelHeader label="move log · paused" accent="#fb923c" />
              <div className="bg-zinc-900/60 p-6 font-mono text-sm leading-8 space-y-0.5">
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
                  <span className="text-emerald-500/70">✓ solved</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* WHY THIS SETUP */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <SectionLabel coord="0,4">why this setup</SectionLabel>
        <div className="grid lg:grid-cols-3 gap-8">
          {[
            {
              accent: '#6ee7b7',
              title: 'Verifiable outcomes',
              body: 'A puzzle is either solved or not. A generated puzzle is either solvable or not, and either requires its mechanics or doesn\'t. No scoring rubrics or LLM-as-judge needed.',
            },
            {
              accent: '#60a5fa',
              title: 'Novel problems',
              body: 'Puzzles are designed by hand or generated on demand. Any combination of grid layout, mechanics, and agent configuration can produce something the model hasn\'t encountered in training.',
            },
            {
              accent: '#fb923c',
              title: 'Inspectable reasoning',
              body: 'The step-by-step playback makes it possible to see where the model\'s plan diverges from a correct solution — useful for identifying specific failure modes rather than just recording a pass/fail.',
            },
          ].map(({ accent, title, body }) => (
            <div key={title} className="border border-zinc-800/60 rounded-lg p-7">
              <div className="w-2.5 h-2.5 rounded-[2px] mb-5" style={{ backgroundColor: accent }} />
              <h4 className="text-base font-semibold text-white mb-3">{title}</h4>
              <p className="text-zinc-500 text-base leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW TO USE */}
      <section className="border-t border-zinc-800/60 py-24 bg-zinc-950/60">
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel coord="0,5">using it</SectionLabel>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { n: '(0,0)', title: 'Design a level', body: 'Use the visual editor or write a puzzle in the DSL directly. Configure tile types, agent start positions, goals, and constraints.' },
              { n: '(1,0)', title: 'Run a model on it', body: 'Select a model and watch the playback. Each move is shown in sequence with coordinates. Compare results across Haiku, Sonnet, and Opus.' },
              { n: '(2,0)', title: 'Or ask AI to design', body: 'Prompt AI to generate a level with specific difficulty and mechanics. The model explains its choices. Test whether the result is actually solvable and coherent.' },
            ].map(({ n, title, body }) => (
              <div key={n} className="relative pl-7 border-l border-zinc-800">
                <p className="font-mono text-xs text-orange-400/70 mb-3">{n}</p>
                <h4 className="text-base font-semibold text-white mb-2">{title}</h4>
                <p className="text-zinc-500 text-base leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="max-w-5xl mx-auto px-6 py-32">
        <p className="text-zinc-400 text-xl leading-relaxed max-w-2xl mb-8">
          The same puzzle can be handed to multiple models. The same model can be asked to solve a puzzle it just designed. Both directions are informative.
        </p>
        <Link to="/designer" className="inline-flex items-center gap-2 text-orange-400 text-base font-medium hover:text-orange-300 transition-colors group">
          Get started <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </section>

    </div>
  );
}
