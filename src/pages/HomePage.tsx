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
    <div className="relative p-6 border border-white/10 bg-zinc-900/20 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-purple-500/10">
      <div className="absolute top-4 left-6 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">claude-sonnet · solving</span>
      </div>
      <div
        className="grid gap-1 bg-zinc-800/10 p-1 rounded-xl"
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
        <div
          className="absolute"
          style={{
            left: 4 * (CELL_SIZE + 4) + 24,
            top: 4 * (CELL_SIZE + 4) + 24,
            width: CELL_SIZE,
            height: CELL_SIZE,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <TileIcon type="goal" color="#a78bfa" className="scale-75" />
        </div>
        <motion.div
          className="absolute flex items-center justify-center bg-purple-500/20 rounded-lg border border-purple-400/30"
          style={{ width: CELL_SIZE - 4, height: CELL_SIZE - 4 }}
          animate={{
            x: path[step].x * (CELL_SIZE + 4) + 4,
            y: path[step].y * (CELL_SIZE + 4) + 4,
          }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <EntityIcon type="robot" color="#d8b4fe" className="w-6 h-6 drop-shadow-[0_0_8px_rgba(167,139,250,0.6)]" />
        </motion.div>
      </div>
      <div className="absolute bottom-4 left-6 right-6 font-mono text-[9px] text-zinc-600">
        move {step + 1}/{path.length}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="bg-zinc-950 text-zinc-300 font-sans selection:bg-purple-500/30">

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-6 pt-32 pb-24">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-[1.4]">
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest mb-8">AI Evaluation / Logic Puzzles</p>
              <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-8">
                Evaluating AI<br />
                <span className="text-purple-300 font-medium">as solver<br />and designer</span>
              </h1>
              <p className="text-lg text-zinc-400 max-w-xl leading-relaxed mb-10">
                A tool for testing how language models handle spatial logic puzzles — both solving puzzles they haven't seen before, and generating new ones from a description. Outcomes are discrete and verifiable, making it straightforward to measure and compare model behaviour.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/designer" className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
                  Open the lab <ArrowRight size={16} />
                </Link>
                <Link to="/play" className="px-6 py-3 bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium rounded-lg hover:bg-zinc-800 transition-colors">
                  Browse levels
                </Link>
              </div>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.3 }} className="flex-1 hidden lg:flex justify-center">
            <HeroGrid />
          </motion.div>
        </div>
      </section>

      {/* WHAT IT EVALUATES */}
      <section className="border-y border-zinc-900 py-28">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-16">What it evaluates</h2>
          <div className="grid lg:grid-cols-2 gap-16">

            <div>
              <h3 className="text-xl font-semibold text-white mb-4">Solving</h3>
              <p className="text-zinc-400 leading-relaxed mb-6">
                Given a puzzle it hasn't seen before, can the model produce a valid solution? The puzzles involve multi-step planning: locked doors that require a switch, agents that block each other, one-way tiles, color-changing mechanics. The model must reason about preconditions and ordering, not just find a path.
              </p>
              <p className="text-zinc-400 leading-relaxed">
                Every move is logged and played back step-by-step, so you can inspect where the model's plan breaks down — not just whether it failed.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white mb-4">Designing</h3>
              <p className="text-zinc-400 leading-relaxed mb-6">
                Given a difficulty level, a grid size, and a set of mechanics to include, can the model produce a well-formed puzzle? This tests whether the model understands the interaction between mechanics well enough to use them purposefully — not just place them decoratively.
              </p>
              <p className="text-zinc-400 leading-relaxed">
                The model also provides a written explanation of its design decisions, which gives additional signal on whether it understood what it was building.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* DSL */}
      <section className="max-w-5xl mx-auto px-6 py-28">
        <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-16">Puzzle format</h2>
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <h3 className="text-xl font-semibold text-white mb-4">A text-based DSL</h3>
            <p className="text-zinc-400 leading-relaxed mb-6">
              Puzzles are defined in a small domain-specific language. A level specifies a grid of tile characters, a legend mapping each character to a tile type and color, and agent declarations with start positions and goals.
            </p>
            <p className="text-zinc-400 leading-relaxed mb-6">
              The format is compact enough to fit in a prompt, which is how it gets sent to the model. It can be written by hand, produced by the visual editor, or generated by AI. All three representations stay in sync.
            </p>
            <p className="text-zinc-400 leading-relaxed">
              Tile types include walls, floors, doors, switches, paint tiles, one-way tiles, locks, and goals — both color-matched and universal. Mechanics compose: a switch can open a door that a paint tile is needed to reach.
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 font-mono text-xs leading-6 text-zinc-400 overflow-x-auto">
            <p className="text-zinc-600 mb-3"># example level</p>
            <p><span className="text-purple-300">level</span> <span className="text-zinc-200">"Switch Puzzle"</span> <span className="text-zinc-500">8x6</span></p>
            <p className="mt-3 text-zinc-500">grid = [</p>
            <p className="pl-4"><span className="text-zinc-600">W W W W W W W W,</span></p>
            <p className="pl-4"><span className="text-zinc-600">W R R S R R R W,</span></p>
            <p className="pl-4"><span className="text-zinc-600">W R W D W R R W,</span></p>
            <p className="pl-4"><span className="text-zinc-600">W R W R W R G W,</span></p>
            <p className="pl-4"><span className="text-zinc-600">W R R R R R R W,</span></p>
            <p className="pl-4"><span className="text-zinc-600">W W W W W W W W,</span></p>
            <p className="text-zinc-500">]</p>
            <p className="mt-3"><span className="text-blue-300">tile</span> S = tiles.switch(<span className="text-amber-300">blue</span>)</p>
            <p><span className="text-blue-300">tile</span> D = tiles.door(<span className="text-amber-300">blue</span>)</p>
            <p><span className="text-blue-300">tile</span> G = tiles.goal(<span className="text-amber-300">orange</span>)</p>
            <p className="mt-3"><span className="text-emerald-300">agent</span>(<span className="text-amber-300">orange</span>) start(1,4) and reach(6,3)</p>
          </div>
        </div>
      </section>

      {/* LIVE DEBUGGING */}
      <section className="border-t border-zinc-900 py-28">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-16">Inspecting a solve attempt</h2>
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div className="space-y-8">
              <div>
                <h4 className="text-white font-semibold mb-2">Step-by-step playback</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  The model's planned move sequence plays back one step at a time. The current source tile and target tile are highlighted on the grid with the agent's color. Playback can be paused, stepped forward or backward, or rewound to the start.
                </p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">Move log</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Each move is listed as <span className="font-mono text-zinc-400">agent  (x,y) → (x,y)  direction</span>, with the current step highlighted. Moves that the engine skips — because the model placed an agent at the wrong position, or a path was blocked — are annotated rather than silently dropped.
                </p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">Coordinate overlay</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Axis labels run along the grid edges. During playback, the highlighted tiles show their coordinates directly, so move log entries can be cross-referenced with the grid without counting cells.
                </p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">Feedback loop</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  After a failed attempt, you can describe what went wrong in natural language. The original move sequence and your note are sent back to the model as context, and it retries. Useful for iterating on both the model's approach and the puzzle design.
                </p>
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 font-mono text-xs leading-6 space-y-1">
              <p className="text-zinc-600 mb-3"># move log excerpt</p>
              <p className="text-zinc-600">orange  (1,4) → (1,3)  up</p>
              <p className="text-zinc-600">orange  (1,3) → (2,3)  right</p>
              <p className="text-zinc-600">orange  (2,3) → (2,2)  up</p>
              <p className="text-zinc-600">orange  (2,2) → (2,1)  up</p>
              <p className="bg-purple-600/20 border border-purple-500/30 rounded px-2 text-purple-200">▶ orange  (2,1) → (3,1)  right</p>
              <p className="text-zinc-600">orange  (3,1) → (4,1)  right</p>
              <p className="text-zinc-600">orange  (4,1) → (4,2)  down</p>
              <p className="text-zinc-600">orange  (4,2) → (4,3)  down</p>
              <p className="text-zinc-600">orange  (4,3) → (5,3)  right</p>
              <p className="text-zinc-600">orange  (5,3) → (6,3)  right</p>
              <p className="mt-4 text-zinc-600">—</p>
              <p className="text-zinc-600 mt-1">move 5 / 10 · paused</p>
            </div>
          </div>
        </div>
      </section>

      {/* WHY THIS SETUP */}
      <section className="max-w-5xl mx-auto px-6 py-28">
        <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-16">Why this setup</h2>
        <div className="grid lg:grid-cols-3 gap-12">
          <div>
            <h4 className="text-white font-semibold mb-3">Verifiable outcomes</h4>
            <p className="text-zinc-500 text-sm leading-relaxed">
              A puzzle is either solved or not. A generated puzzle is either solvable or not, and either requires its mechanics or doesn't. No scoring rubrics or LLM-as-judge needed.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Novel problems</h4>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Puzzles are designed by hand or generated on demand. Any combination of grid, mechanics, and agent layout can produce a configuration the model hasn't encountered in training data.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Inspectable reasoning</h4>
            <p className="text-zinc-500 text-sm leading-relaxed">
              The step-by-step playback and move log make it possible to see where the model's plan diverges from a correct solution — useful for identifying specific failure modes.
            </p>
          </div>
        </div>
      </section>

      {/* HOW TO USE */}
      <section className="border-t border-zinc-900 py-28">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-16">Using it</h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <p className="font-mono text-xs text-zinc-600 mb-3">01</p>
              <h4 className="text-white font-semibold mb-2">Design a level</h4>
              <p className="text-zinc-500 text-sm leading-relaxed">Use the visual editor or write a puzzle in the DSL directly. Configure tile types, agent start positions, goals, and constraints.</p>
            </div>
            <div>
              <p className="font-mono text-xs text-zinc-600 mb-3">02</p>
              <h4 className="text-white font-semibold mb-2">Run a model on it</h4>
              <p className="text-zinc-500 text-sm leading-relaxed">Select a model and watch the playback. Each move is shown in sequence with the model's planned coordinates. Compare results across Haiku, Sonnet, and Opus.</p>
            </div>
            <div>
              <p className="font-mono text-xs text-zinc-600 mb-3">03</p>
              <h4 className="text-white font-semibold mb-2">Or ask AI to design</h4>
              <p className="text-zinc-500 text-sm leading-relaxed">Prompt AI to generate a level with specific difficulty and mechanics. The model explains its choices. You can test whether the result is actually solvable and coherent.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="max-w-5xl mx-auto px-6 py-32">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-2xl mb-10">
            The same puzzle can be handed to multiple models. The same model can be asked to solve a puzzle it just designed. Both directions are informative.
          </p>
          <Link to="/designer" className="inline-flex items-center gap-2 text-purple-400 font-medium hover:gap-3 transition-all group text-sm">
            Get started <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>
      </section>

    </div>
  );
}
