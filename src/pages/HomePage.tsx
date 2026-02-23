import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Layers, Activity, Lightbulb, Brain, ArrowRight } from 'lucide-react';

// --- Decorative Hero Grid ---
const GRID_COLS = 6;
const GRID_ROWS = 6;
const CELL = 40;

type CellType = 'wall' | 'floor' | 'empty';

const grid: CellType[][] = [
  ['wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
  ['wall', 'floor', 'floor', 'floor', 'floor', 'wall'],
  ['wall', 'floor', 'wall', 'wall', 'floor', 'wall'],
  ['wall', 'floor', 'floor', 'floor', 'floor', 'wall'],
  ['wall', 'floor', 'wall', 'floor', 'floor', 'wall'],
  ['wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
];

const entityPath = [{ r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }, { r: 1, c: 4 }];

function HeroGrid() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(prev => (prev + 1) % entityPath.length), 1200);
    return () => clearInterval(id);
  }, []);

  const pos = (row: number, col: number, dotSize: number) => ({
    x: col * (CELL + 1) + (CELL - dotSize) / 2,
    y: row * (CELL + 1) + (CELL - dotSize) / 2,
  });

  return (
    <div className="relative">
      <div className="absolute inset-0 blur-3xl opacity-20 bg-purple-500/50 rounded-full scale-75 -z-10" />
      <div
        className="relative grid gap-px rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-px"
        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL}px)`, gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL}px)` }}
      >
        {grid.flat().map((cell, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: i * 0.02 }}
            className={`rounded-sm ${cell === 'wall' ? 'bg-zinc-700/60' : cell === 'floor' ? 'bg-zinc-800/20' : ''}`}
            style={{ width: CELL, height: CELL }}
          />
        ))}

        {/* Goal markers */}
        <motion.div className="absolute w-3 h-3 rounded-sm border-2 border-purple-300/60" style={{ left: pos(1, 4, 12).x, top: pos(1, 4, 12).y }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} />
        <motion.div className="absolute w-3 h-3 rounded-sm border-2 border-emerald-300/60" style={{ left: pos(3, 4, 12).x, top: pos(3, 4, 12).y }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }} />
        <motion.div className="absolute w-3 h-3 rounded-sm border-2 border-amber-300/60" style={{ left: pos(4, 3, 12).x, top: pos(4, 3, 12).y }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} />

        {/* Moving entity */}
        <motion.div
          className="absolute rounded-full bg-purple-300"
          style={{ width: 14, height: 14, boxShadow: '0 0 12px rgba(216,180,254,0.4)' }}
          animate={pos(entityPath[step].r, entityPath[step].c, 14)}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        />

        {/* Static entities */}
        <motion.div
          className="absolute rounded-full bg-emerald-300"
          style={{ width: 14, height: 14, boxShadow: '0 0 8px rgba(110,231,183,0.3)', ...pos(3, 1, 14) }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
        />
        <motion.div
          className="absolute rounded-full bg-amber-300"
          style={{ width: 14, height: 14, boxShadow: '0 0 8px rgba(252,211,77,0.3)', ...pos(4, 3, 14) }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.0, duration: 0.4 }}
        />
      </div>
    </div>
  );
}

// --- Skills data ---
const skills = [
  {
    icon: Layers,
    title: 'Abstract thinking',
    desc: 'Breaking a complex puzzle into smaller, manageable pieces — walls here, a path there, a rule that ties it together.',
    color: 'text-purple-300',
  },
  {
    icon: Activity,
    title: 'Pattern recognition',
    desc: 'Spotting sequences, parity, and relationships. "If this character takes an even number of steps, it works — odd, it doesn\'t."',
    color: 'text-emerald-300',
  },
  {
    icon: Lightbulb,
    title: 'Creative problem design',
    desc: 'Inventing challenges, not just solving them. Designing a good puzzle is harder — and more educational — than solving one.',
    color: 'text-amber-300',
  },
  {
    icon: Brain,
    title: 'Logical reasoning',
    desc: 'Thinking through cause and effect. "If the character is blue, it can pass the blue door — so I need a paint tile first."',
    color: 'text-rose-300',
  },
];

// --- Steps data ---
const steps = [
  {
    num: '01',
    title: 'Design a board',
    desc: 'Place walls, paths, doors, and goals on a grid. Drop characters where they start. The board is your canvas.',
  },
  {
    num: '02',
    title: 'Set the rules',
    desc: 'Add constraints to characters — reach the goal in even steps, alternate between light and dark tiles, change color to pass through a locked door. Each rule teaches a logical pattern.',
  },
  {
    num: '03',
    title: 'Test and share',
    desc: 'Play your own puzzle. Is it solvable? Is it too easy? Tweak it, then challenge your friends to figure it out.',
  },
];

// --- Page ---
export default function HomePage() {
  return (
    <div className="overflow-x-hidden selection:bg-purple-500/30">

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-28 pb-24">
        <div className="flex flex-col lg:flex-row lg:items-center gap-12 lg:gap-16">
          <div className="flex-[3] min-w-0">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-white">
                Make your own games.
                <br />
                <span className="text-purple-300">Learn to think.</span>
              </h1>
              <p className="mt-8 text-lg text-zinc-400 max-w-xl leading-relaxed">
                Kids design their own grid-based puzzle games from scratch — placing tiles,
                setting rules, building constraints. Every design choice is a small lesson
                in logic, creativity, and problem-solving.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  to="/designer"
                  className="inline-flex items-center gap-2 px-7 py-3.5 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-xl transition-colors text-sm shadow-lg shadow-purple-500/20"
                >
                  Start Creating <ArrowRight size={16} />
                </Link>
                <Link
                  to="/mission"
                  className="inline-flex items-center gap-2 px-7 py-3.5 text-zinc-400 hover:text-white font-medium text-sm transition-colors"
                >
                  Our Mission <ArrowRight size={14} />
                </Link>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex-[2] hidden lg:flex justify-center"
          >
            <div className="scale-[1.4]">
              <HeroGrid />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why this exists */}
      <section className="border-y border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <p className="font-mono text-xs uppercase tracking-widest text-zinc-600 mb-6">Why this exists</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 leading-tight">
              Most screen time is consumption.
              <br />
              <span className="text-zinc-500">This is the opposite.</span>
            </h2>
            <div className="space-y-5 text-zinc-400 text-lg leading-relaxed">
              <p>
                Kids spend hours scrolling, watching, and tapping. Even most &ldquo;educational&rdquo;
                apps are gamified memorization — flashcards with sound effects.
              </p>
              <p>
                Meanwhile, the thinking skills that actually matter — breaking down problems,
                recognizing patterns, designing solutions — rarely get practiced. These are
                the skills behind programming, engineering, and scientific reasoning, and they
                don&rsquo;t require a single line of code.
              </p>
              <p>
                This platform turns screen time into building time. Kids don&rsquo;t solve
                pre-made puzzles — they <em className="text-white not-italic font-medium">design their own</em>,
                which is a fundamentally different (and deeper) kind of thinking.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="font-mono text-xs uppercase tracking-widest text-zinc-600 mb-16"
        >
          How it works
        </motion.p>
        <div className="space-y-16">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="flex gap-8 items-baseline"
            >
              <span className="font-mono text-4xl text-zinc-800 font-light select-none shrink-0">
                {s.num}
              </span>
              <div>
                <h3 className="text-2xl font-semibold text-white mb-3">{s.title}</h3>
                <p className="text-zinc-400 max-w-lg leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* What kids develop */}
      <section className="border-y border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <p className="font-mono text-xs uppercase tracking-widest text-zinc-600 mb-6">What kids develop</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              Thinking skills that outlast any tool.
            </h2>
            <p className="text-zinc-500 max-w-2xl mb-16 text-lg">
              These aren&rsquo;t buzzwords — they&rsquo;re the same cognitive patterns behind
              software architecture, scientific reasoning, and systems design. Kids practice
              them here without needing to know that.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-6">
            {skills.map((skill, i) => (
              <motion.div
                key={skill.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="p-8 rounded-2xl bg-zinc-950/60 border border-zinc-800/80"
              >
                <skill.icon className={`w-8 h-8 ${skill.color} mb-5`} />
                <h4 className="text-lg font-semibold text-white mb-2">{skill.title}</h4>
                <p className="text-sm text-zinc-400 leading-relaxed">{skill.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* The bigger picture */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-600 mb-6">The bigger picture</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 leading-tight">
            In an era of AI, logic is the new literacy.
          </h2>
          <div className="space-y-5 text-zinc-400 text-lg leading-relaxed">
            <p>
              AI is getting better at writing code — handling syntax, tooling, and
              implementation. The skills that remain distinctly human are the ones
              upstream: deciding <em className="text-white not-italic font-medium">what</em> to
              build, <em className="text-white not-italic font-medium">how</em> to structure
              it, and <em className="text-white not-italic font-medium">why</em> the
              constraints matter.
            </p>
            <p>
              We don&rsquo;t teach kids to code. We teach them to think computationally —
              the skill that makes coding (and a lot of other things) possible in the
              first place.
            </p>
          </div>
          <Link
            to="/mission"
            className="inline-flex items-center gap-2 mt-8 text-purple-300 hover:text-purple-200 font-medium text-sm transition-colors"
          >
            Read more about our mission <ArrowRight size={14} />
          </Link>
        </motion.div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center py-20 px-8 rounded-2xl border border-zinc-800/50 bg-zinc-900/30"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
            Ready to build your first puzzle?
          </h2>
          <p className="text-zinc-500 mb-10 max-w-md mx-auto">
            No accounts, no setup. Open the designer and start creating.
          </p>
          <Link
            to="/designer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-purple-500/20"
          >
            Start Creating <ArrowRight size={16} />
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
