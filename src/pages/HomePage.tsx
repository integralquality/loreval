import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Brain, Lightbulb, Puzzle, Layers, ArrowRight } from 'lucide-react';

// --- Decorative Hero Grid (same as before but slightly tweaked) ---

const GRID_COLS = 6;
const GRID_ROWS = 6;
const CELL = 40;

type CellType = 'wall' | 'floor' | 'empty';

const grid: CellType[][] = [
  ['wall',  'wall',  'wall',  'wall',  'wall',  'wall' ],
  ['wall',  'floor', 'floor', 'floor', 'floor', 'wall' ],
  ['wall',  'floor', 'wall',  'wall',  'floor', 'wall' ],
  ['wall',  'floor', 'floor', 'floor', 'floor', 'wall' ],
  ['wall',  'floor', 'wall',  'floor', 'floor', 'wall' ],
  ['wall',  'wall',  'wall',  'wall',  'wall',  'wall' ],
];

const amberPath = [
  { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }, { r: 1, c: 4 },
];

function HeroGrid() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep(prev => (prev + 1) % amberPath.length);
    }, 1200);
    return () => clearInterval(id);
  }, []);

  const pos = (row: number, col: number, dotSize: number) => ({
    x: col * (CELL + 1) + (CELL - dotSize) / 2,
    y: row * (CELL + 1) + (CELL - dotSize) / 2,
  });

  return (
    <div className="-rotate-2 relative">
      <div className="absolute inset-0 blur-3xl opacity-15 bg-amber-500 rounded-full scale-75 -z-10" />
      <div
        className="relative grid gap-px rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-px"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL}px)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL}px)`,
        }}
      >
        {grid.flat().map((cell, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.025 }}
            className={`rounded-sm ${
              cell === 'wall' ? 'bg-zinc-700/80' :
              cell === 'floor' ? 'bg-zinc-800/40' :
              ''
            }`}
            style={{ width: CELL, height: CELL }}
          />
        ))}
        <motion.div
          className="absolute w-3 h-3 rounded-sm border-2 border-amber-400/60"
          style={{ left: pos(1, 4, 12).x, top: pos(1, 4, 12).y }}
        />
        <motion.div
          className="absolute rounded-full bg-amber-400"
          style={{ width: 14, height: 14, boxShadow: '0 0 12px rgba(251,191,36,0.4)' }}
          animate={pos(amberPath[step].r, amberPath[step].c, 14)}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        />
      </div>
    </div>
  );
}

// --- Features data ---

const skills = [
  { icon: <Layers className="text-amber-400" />, title: 'Abstraction Thinking', desc: 'Identify core patterns and hide unnecessary details.' },
  { icon: <Puzzle className="text-emerald-400" />, title: 'Structural Reasoning', desc: 'Understand how components interact within a system.' },
  { icon: <Lightbulb className="text-rose-400" />, title: 'Creative Problem Design', desc: 'Define the challenges instead of just solving them.' },
  { icon: <Brain className="text-cyan-400" />, title: 'Algorithmic Intuition', desc: 'Develop a mental model for step-by-step logic.' },
];

export default function HomePage() {
  return (
    <div className="overflow-x-hidden">
      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-32">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-[1.2]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight text-white mb-6">
                Logic is the new <br />
                <span className="text-amber-400">programming language</span>
              </h1>
              <p className="text-xl text-zinc-400 max-w-2xl leading-relaxed mb-10">
                In the era of AI, coding is cheap. Logic is fundamental.
                We teach kids to design rules, imagine systems, and build puzzles
                instead of just memorizing commands.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  to="/designer"
                  className="px-8 py-4 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold rounded-xl transition-all hover:scale-105 flex items-center gap-2"
                >
                  Start Creating <ArrowRight size={20} />
                </Link>
                <Link
                  to="/play"
                  className="px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all border border-zinc-700"
                >
                  Explore Puzzles
                </Link>
              </div>
              <p className="mt-6 text-sm text-zinc-500 font-medium">
                Teach creativity and logic — not just tools.
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex-1 hidden lg:flex justify-center"
          >
            <div className="relative scale-150">
               <HeroGrid />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why Section */}
      <section className="bg-zinc-900/40 py-24 border-y border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-16 max-w-3xl">
            <h2 className="text-3xl font-bold text-white mb-6">The Real Advantage</h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              As automation grows, computational thinking remains powerful.
              Our platform helps children develop these skills early through playful creation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {skills.map((skill, i) => (
              <motion.div
                key={skill.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="p-6 rounded-2xl bg-zinc-800/30 border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <div className="mb-4">{skill.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{skill.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{skill.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Focus Section */}
      <section className="max-w-6xl mx-auto px-6 py-32">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8 order-2 lg:order-1">
            <div className="flex gap-4">
              <div className="w-12 h-12 shrink-0 rounded-full bg-amber-400/10 flex items-center justify-center text-amber-400 font-bold">1</div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Design before solving</h3>
                <p className="text-zinc-400">Kids create the obstacles and define the win conditions, learning that solutions are built from structure.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-12 h-12 shrink-0 rounded-full bg-emerald-400/10 flex items-center justify-center text-emerald-400 font-bold">2</div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Explore logic through play</h3>
                <p className="text-zinc-400">Rules like "even steps only" turn abstract math into a tangible game mechanic.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-12 h-12 shrink-0 rounded-full bg-rose-400/10 flex items-center justify-center text-rose-400 font-bold">3</div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Practice structured thinking</h3>
                <p className="text-zinc-400">Building a functional game requires organizing thoughts into a logical flow.</p>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <h2 className="text-4xl font-bold text-white mb-8 leading-tight">
              Teach them to <span className="text-amber-400">create</span> instead of just consume.
            </h2>
            <p className="text-zinc-400 text-lg mb-8">
              We focus on creative reasoning and abstract problem modeling—skills that remain powerful even as AI grows.
            </p>
            <Link to="/designer" className="text-amber-400 font-bold flex items-center gap-2 hover:gap-4 transition-all">
              Try the Builder <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-6 pb-32">
        <div className="p-12 md:p-20 rounded-[3rem] bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-8">Ready to design your first system?</h2>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/designer"
                className="px-10 py-5 bg-zinc-950 text-white font-bold rounded-2xl hover:scale-105 transition-transform"
              >
                Open the Designer
              </Link>
              <Link
                to="/play"
                className="px-10 py-5 bg-white/20 hover:bg-white/30 text-zinc-950 font-bold rounded-2xl transition-colors backdrop-blur-sm"
              >
                See How It Works
              </Link>
            </div>
          </div>
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>
      </section>
    </div>
  );
}
