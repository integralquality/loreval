import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Brain, Lightbulb, Puzzle, Layers, ArrowRight, ShieldCheck, Target, Zap, Activity } from 'lucide-react';

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

const purplePath = [{ r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }, { r: 1, c: 4 }];

function HeroGrid() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(prev => (prev + 1) % purplePath.length), 1200);
    return () => clearInterval(id);
  }, []);

  const pos = (row: number, col: number, dotSize: number) => ({
    x: col * (CELL + 1) + (CELL - dotSize) / 2,
    y: row * (CELL + 1) + (CELL - dotSize) / 2,
  });

  return (
    <div className="relative">
      <div className="absolute inset-0 blur-3xl opacity-20 bg-purple-500/50 rounded-full scale-75 -z-10" />
      <div className="relative grid gap-px rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-px" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL}px)`, gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL}px)` }}>
        {grid.flat().map((cell, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: i * 0.02 }} className={`rounded-sm ${cell === 'wall' ? 'bg-zinc-700/60' : cell === 'floor' ? 'bg-zinc-800/20' : ''}`} style={{ width: CELL, height: CELL }} />
        ))}
        <motion.div className="absolute w-3 h-3 rounded-sm border-2 border-purple-300/60" style={{ left: pos(1, 4, 12).x, top: pos(1, 4, 12).y }} />
        <motion.div className="absolute rounded-full bg-purple-300" style={{ width: 14, height: 14, boxShadow: '0 0 12px rgba(216,180,254,0.4)' }} animate={pos(purplePath[step].r, purplePath[step].c, 14)} transition={{ type: 'spring', stiffness: 200, damping: 20 }} />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="overflow-x-hidden selection:bg-purple-500/30">
      {/* 1. Hero Section: The Philosophical Hook */}
      <section className="max-w-6xl mx-auto px-6 pt-32 pb-40">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-[1.2]">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-purple-400 font-bold mb-6 block">The Architecture of Intent</span>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight text-white mb-8">
                Logic is the new <br />
                <span className="text-purple-300">programming language</span>
              </h1>
              <p className="text-xl text-zinc-400 max-w-2xl leading-relaxed mb-12">
                In an era where AI automates the "how," the human role shifts to the "what." We teach children to design the systems of rules that direct intelligence, moving beyond the syntax barrier into pure structural reasoning.
              </p>
              <div className="flex flex-wrap gap-6">
                <Link to="/designer" className="px-10 py-5 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20">
                  Open the Designer <ArrowRight size={20} />
                </Link>
                <Link to="/mission" className="px-10 py-5 bg-zinc-900/50 hover:bg-zinc-900 text-white font-bold rounded-2xl transition-all border border-zinc-800">
                  Our Mission
                </Link>
              </div>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.2 }} className="flex-1 hidden lg:flex justify-center">
            <div className="relative scale-150">
              <HeroGrid />
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. The Paradigm Shift: From Craft to Abstract Creativity */}
      <section className="bg-zinc-900/30 py-32 border-y border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-3xl mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">The Great Decoupling</h2>
            <p className="text-lg text-zinc-400 leading-relaxed">
              For decades, "learning to code" meant memorizing the craft of syntax. Today, implementation is becoming a commodity. The real creative advantage now lies in <strong>abstract problem modeling</strong>—the ability to conceptualize a system before it is built.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="p-10 rounded-3xl bg-black/40 border border-zinc-800">
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4 block">The Old Craft</span>
              <h3 className="text-xl font-bold text-zinc-200 mb-6 italic">How do I write the command?</h3>
              <ul className="space-y-4 text-zinc-500 text-sm">
                <li className="flex gap-3 items-center"><div className="w-1 h-1 bg-zinc-700 rounded-full" /> Syntax Memorization</li>
                <li className="flex gap-3 items-center"><div className="w-1 h-1 bg-zinc-700 rounded-full" /> Tool-specific knowledge</li>
                <li className="flex gap-3 items-center"><div className="w-1 h-1 bg-zinc-700 rounded-full" /> Debugging implementation</li>
              </ul>
            </div>
            <div className="p-10 rounded-3xl bg-purple-500/5 border border-purple-500/20">
              <span className="text-xs font-mono text-purple-400 uppercase tracking-widest mb-4 block">The New Logic</span>
              <h3 className="text-xl font-bold text-white mb-6">What are the rules of the system?</h3>
              <ul className="space-y-4 text-purple-200/60 text-sm">
                <li className="flex gap-3 items-center"><div className="w-1.5 h-1.5 bg-purple-400 rounded-full" /> Structural Reasoning</li>
                <li className="flex gap-3 items-center"><div className="w-1.5 h-1.5 bg-purple-400 rounded-full" /> Intent Specification</li>
                <li className="flex gap-3 items-center"><div className="w-1.5 h-1.5 bg-purple-400 rounded-full" /> Constraint Design</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The Cognitive Blueprint: Mapping Play to Engineering */}
      <section className="max-w-6xl mx-auto px-6 py-32">
        <div className="text-center mb-24">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Play is a System Prototype</h2>
          <p className="text-zinc-500 max-w-2xl mx-auto text-lg leading-relaxed">
            We don't teach "games." We teach the logical physics that powers all modern infrastructure.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { icon: <Activity className="text-purple-300" />, title: "State Management", desc: "Understanding how objects change properties based on environment interactions.", tag: "Color Painting" },
            { icon: <ShieldCheck className="text-emerald-300" />, title: "Security Logic", desc: "Defining access protocols where identity must match system constraints.", tag: "Locked Doors" },
            { icon: <Target className="text-rose-300" />, title: "Parity Algorithms", desc: "Managing step-based logic and alternating patterns in data flow.", tag: "Even/Odd Steps" },
            { icon: <Zap className="text-cyan-300" />, title: "Win Conditions", desc: "Specifying the complex set of requirements that define a successful outcome.", tag: "Goal Rules" }
          ].map((skill, i) => (
            <div key={i} className="group p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800 hover:border-purple-500/30 transition-all">
              <div className="mb-6 transform group-hover:scale-110 transition-transform">{skill.icon}</div>
              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-2 block">{skill.tag}</span>
              <h4 className="text-lg font-bold text-white mb-3">{skill.title}</h4>
              <p className="text-sm text-zinc-500 leading-relaxed">{skill.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Philosophical Statement: A New Literacy */}
      <section className="max-w-4xl mx-auto px-6 py-32 text-center">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1 }}>
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-12 tracking-tight italic">
            "We are moving from a world of commands to a world of intent."
          </h2>
          <div className="w-20 h-px bg-zinc-800 mx-auto mb-12" />
          <p className="text-zinc-400 text-xl leading-relaxed font-light">
            To be literate in the AI era is to be an architect of systems. Our platform is a training ground for the cognitive depth required to imagine, design, and direct the technologies of tomorrow.
          </p>
        </motion.div>
      </section>

      {/* 5. CTA Section */}
      <section className="max-w-6xl mx-auto px-6 pb-40">
        <div className="p-16 md:p-24 rounded-[4rem] bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/20 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">Begin the Transition.</h2>
            <p className="text-zinc-400 text-xl mb-12 max-w-xl mx-auto">
              Start building the systems of tomorrow, one rule at a time.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <Link to="/designer" className="px-12 py-5 bg-white text-purple-900 font-bold rounded-2xl hover:scale-105 transition-transform">
                Enter the Designer
              </Link>
              <Link to="/mission" className="px-12 py-5 bg-transparent border border-white/20 text-white font-bold rounded-2xl hover:bg-white/5 transition-colors">
                Read the Manifesto
              </Link>
            </div>
          </div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px]" />
        </div>
      </section>
    </div>
  );
}
