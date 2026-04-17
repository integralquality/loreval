import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { TileIcon } from '../components/game/TileIcon';
import { EntityIcon } from '../components/game/EntityIcon';

const GRID_SIZE = 6;
const CELL_SIZE = 48;

function HeroGrid() {
  const [step, setStep] = useState(0);
  const path = [
    { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 },
    { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 3, y: 3 }, { x: 2, y: 3 },
    { x: 1, y: 3 }, { x: 1, y: 2 }
  ];

  useEffect(() => {
    const id = setInterval(() => setStep(prev => (prev + 1) % path.length), 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative p-6 border border-white/10 bg-zinc-900/30 backdrop-blur-xl rounded-2xl">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-900/10 to-transparent pointer-events-none" />
      <div className="absolute top-4 left-6 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">claude-sonnet · solving</span>
      </div>
      <div
        className="grid gap-1 bg-zinc-800/10 p-1 rounded-xl mt-8"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`
        }}
      >
        {Array(GRID_SIZE * GRID_SIZE).fill(0).map((_, i) => {
          const x = i % GRID_SIZE;
          const y = Math.floor(i / GRID_SIZE);
          const isWall = x === 0 || x === GRID_SIZE - 1 || y === 0 || y === GRID_SIZE - 1;
          return (
            <div key={i} className="relative w-full h-full">
              <TileIcon type={isWall ? 'wall' : 'floor-white'} className="opacity-40" />
            </div>
          );
        })}
        <div className="absolute" style={{ left: 4 * (CELL_SIZE + 4) + 24, top: 4 * (CELL_SIZE + 4) + 24, width: CELL_SIZE, height: CELL_SIZE, transform: 'translate(-50%, -50%)' }}>
          <TileIcon type="goal" color="#a78bfa" className="scale-75" />
        </div>
        <motion.div
          className="absolute flex items-center justify-center bg-purple-500/20 rounded-lg border border-purple-400/40"
          style={{ width: CELL_SIZE - 4, height: CELL_SIZE - 4 }}
          animate={{ x: path[step].x * (CELL_SIZE + 4) + 4, y: path[step].y * (CELL_SIZE + 4) + 4 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <EntityIcon type="robot" color="#d8b4fe" className="w-6 h-6 drop-shadow-[0_0_10px_rgba(167,139,250,0.7)]" />
        </motion.div>
      </div>
      <div className="mt-3 font-mono text-xs text-zinc-600">move {step + 1}/{path.length}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-10">{children}</p>
  );
}

export default function HomePage() {
  return (
    <div className="bg-zinc-950 text-zinc-300 font-sans selection:bg-purple-500/30">

      {/* HERO */}
      <section className="relative max-w-5xl mx-auto px-6 pt-32 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-center gap-16 relative">
          <div className="flex-[1.4]">
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              {/* Wordmark + acronym breakdown */}
              <div className="flex items-baseline gap-4 mb-8">
                <span className="font-mono text-2xl font-bold text-white tracking-tight">loreval</span>
                <span className="font-mono text-sm text-zinc-500 leading-5">
                  <span className="text-purple-400">Lo</span>gic and{' '}
                  <span className="text-purple-400">Re</span>asoning{' '}
                  <span className="text-purple-400">Eval</span>uation
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white leading-[1.15] tracking-tight mb-6">
                LLM evaluation on<br />
                <span className="bg-gradient-to-r from-purple-300 to-violet-400 bg-clip-text text-transparent">logic and spatial reasoning</span>
              </h1>
              <p className="text-base text-zinc-400 max-w-xl leading-relaxed mb-10">
                Loreval measures language model performance on grid-based spatial puzzles across two tasks: solving puzzles from a description, and generating new ones given a set of constraints. Outcomes are discrete and verifiable — a puzzle is either solved or it isn't.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/designer" className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                  Open designer <ArrowRight size={15} />
                </Link>
                <Link to="/play" className="px-6 py-3 border border-zinc-700 text-zinc-300 text-sm font-medium rounded-lg hover:border-zinc-500 hover:text-white transition-colors">
                  Benchmark levels
                </Link>
              </div>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.3 }} className="flex-1 hidden lg:flex justify-center">
            <HeroGrid />
          </motion.div>
        </div>
      </section>

      {/* WHAT IT EVALUATES */}
      <section className="border-y border-zinc-800/60 py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/30 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 relative">
          <SectionLabel>What it evaluates</SectionLabel>
          <div className="grid lg:grid-cols-2 gap-px bg-zinc-800/40 rounded-2xl overflow-hidden border border-zinc-800/60">

            <div className="bg-zinc-950 p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-px h-8 bg-purple-500" />
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
                <div className="w-px h-8 bg-blue-400" />
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
        <SectionLabel>Puzzle format</SectionLabel>
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <h3 className="text-2xl font-semibold text-white mb-5">A text-based DSL</h3>
            <p className="text-zinc-400 text-base leading-relaxed mb-5">
              Puzzles are defined in a small domain-specific language. A level specifies a grid of tile characters, a legend mapping each character to a tile type and color, and agent declarations with start positions and goals.
            </p>
            <p className="text-zinc-400 text-base leading-relaxed mb-5">
              The format is compact enough to fit in a prompt, which is how it gets sent to the model. It can be written by hand, produced by the visual editor, or generated by AI — all three stay in sync.
            </p>
            <p className="text-zinc-400 text-base leading-relaxed">
              Tile types include walls, floors, doors, switches, paint tiles, one-way tiles, locks, and goals — both color-matched and universal. Mechanics compose: a switch can open a door that a paint tile is needed to reach.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              </div>
              <span className="font-mono text-xs text-zinc-500 ml-1">level.puzzle</span>
            </div>
            <div className="bg-zinc-900/60 p-6 font-mono text-sm leading-7 text-zinc-400">
              <p className="text-zinc-600 mb-3"># switch puzzle — 8×6</p>
              <p><span className="text-purple-300">level</span> <span className="text-zinc-200">"Switch Puzzle"</span> <span className="text-zinc-600">8x6</span></p>
              <p className="mt-3 text-zinc-600">grid = [</p>
              <p className="pl-4 text-zinc-600">W W W W W W W W,</p>
              <p className="pl-4 text-zinc-600">W R R <span className="text-yellow-500/80">S</span> R R R W,</p>
              <p className="pl-4 text-zinc-600">W R W <span className="text-blue-400/80">D</span> W R R W,</p>
              <p className="pl-4 text-zinc-600">W R W R W R <span className="text-orange-400/80">G</span> W,</p>
              <p className="pl-4 text-zinc-600">W R R R R R R W,</p>
              <p className="pl-4 text-zinc-600">W W W W W W W W,</p>
              <p className="text-zinc-600">]</p>
              <p className="mt-3"><span className="text-blue-300">tile</span> S = tiles.switch(<span className="text-yellow-400">blue</span>)</p>
              <p><span className="text-blue-300">tile</span> D = tiles.door(<span className="text-blue-400">blue</span>)</p>
              <p><span className="text-blue-300">tile</span> G = tiles.goal(<span className="text-orange-400">orange</span>)</p>
              <p className="mt-3"><span className="text-emerald-400">agent</span>(<span className="text-orange-400">orange</span>) start(1,4) and reach(6,3)</p>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE DEBUGGING */}
      <section className="border-t border-zinc-800/60 py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/20 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 relative">
          <SectionLabel>Inspecting a solve attempt</SectionLabel>
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

            <div className="rounded-xl border border-zinc-800 overflow-hidden sticky top-8">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                </div>
                <span className="font-mono text-xs text-zinc-500 ml-1">move log · paused</span>
              </div>
              <div className="bg-zinc-900/60 p-6 font-mono text-sm leading-8 space-y-0.5">
                {[
                  'orange  (1,4) → (1,3)  up',
                  'orange  (1,3) → (2,3)  right',
                  'orange  (2,3) → (2,2)  up',
                  'orange  (2,2) → (2,1)  up',
                ].map((line, i) => (
                  <p key={i} className="text-zinc-600">{line}</p>
                ))}
                <p className="bg-purple-500/10 border border-purple-500/25 rounded px-2 text-purple-300 my-1">
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
        <SectionLabel>Why this setup</SectionLabel>
        <div className="grid lg:grid-cols-3 gap-8">
          {[
            {
              title: 'Verifiable outcomes',
              body: 'A puzzle is either solved or not. A generated puzzle is either solvable or not, and either requires its mechanics or doesn\'t. No scoring rubrics or LLM-as-judge needed.',
            },
            {
              title: 'Novel problems',
              body: 'Puzzles are designed by hand or generated on demand. Any combination of grid layout, mechanics, and agent configuration can produce something the model hasn\'t encountered in training.',
            },
            {
              title: 'Inspectable reasoning',
              body: 'The step-by-step playback makes it possible to see where the model\'s plan diverges from a correct solution — useful for identifying specific failure modes rather than just recording a pass/fail.',
            },
          ].map(({ title, body }) => (
            <div key={title} className="border border-zinc-800/60 rounded-xl p-7 bg-zinc-900/20">
              <h4 className="text-base font-semibold text-white mb-3">{title}</h4>
              <p className="text-zinc-500 text-base leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW TO USE */}
      <section className="border-t border-zinc-800/60 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>Using it</SectionLabel>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { n: '01', title: 'Design a level', body: 'Use the visual editor or write a puzzle in the DSL directly. Configure tile types, agent start positions, goals, and constraints.' },
              { n: '02', title: 'Run a model on it', body: 'Select a model and watch the playback. Each move is shown in sequence with coordinates. Compare results across Haiku, Sonnet, and Opus.' },
              { n: '03', title: 'Or ask AI to design', body: 'Prompt AI to generate a level with specific difficulty and mechanics. The model explains its choices. Test whether the result is actually solvable and coherent.' },
            ].map(({ n, title, body }) => (
              <div key={n} className="relative pl-7 border-l border-zinc-800">
                <p className="font-mono text-xs text-zinc-600 mb-3">{n}</p>
                <h4 className="text-base font-semibold text-white mb-2">{title}</h4>
                <p className="text-zinc-500 text-base leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="relative max-w-5xl mx-auto px-6 py-32">
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-900/15 rounded-full blur-3xl pointer-events-none" />
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="relative">
          <p className="text-zinc-400 text-xl leading-relaxed max-w-2xl mb-8">
            The same puzzle can be handed to multiple models. The same model can be asked to solve a puzzle it just designed. Both directions are informative.
          </p>
          <Link to="/designer" className="inline-flex items-center gap-2 text-purple-400 text-base font-medium hover:text-purple-300 transition-colors group">
            Get started <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>
      </section>

    </div>
  );
}
