import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Brain, 
  Lightbulb, 
  Puzzle, 
  Layers, 
  ArrowRight, 
  Sparkles, 
  Compass, 
  Zap, 
  Focus,
  Fingerprint
} from 'lucide-react';

// --- Logic Canvas (Hero Visual) ---
const GRID_COLS = 6;
const GRID_ROWS = 6;
const CELL = 40;

function HeroGrid() {
  const [step, setStep] = useState(0);
  const path = [{ r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }, { r: 1, c: 4 }];

  useEffect(() => {
    const id = setInterval(() => setStep(prev => (prev + 1) % path.length), 1200);
    return () => clearInterval(id);
  }, []);

  const pos = (row: number, col: number, dotSize: number) => ({
    x: col * (CELL + 1) + (CELL - dotSize) / 2,
    y: row * (CELL + 1) + (CELL - dotSize) / 2,
  });

  return (
    <div className="relative p-4 border border-zinc-800/50 bg-zinc-900/10 backdrop-blur-sm rounded-2xl">
      <div className="absolute top-2 left-4 font-mono text-[8px] text-zinc-600 tracking-widest uppercase">System_State: Thinking</div>
      <div className="relative grid gap-px bg-zinc-800/30 p-px" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL}px)` }}>
        {Array(GRID_COLS * GRID_ROWS).fill(0).map((_, i) => (
          <div key={i} className="bg-zinc-950/40" style={{ width: CELL, height: CELL }} />
        ))}
        <motion.div 
          className="absolute bg-purple-400/80 shadow-[0_0_15px_rgba(167,139,250,0.4)]" 
          style={{ width: 12, height: 12, borderRadius: 2 }} 
          animate={pos(path[step].r, path[step].c, 12)} 
          transition={{ type: 'spring', stiffness: 200, damping: 20 }} 
        />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="bg-zinc-950 text-zinc-300 font-sans selection:bg-purple-500/30">
      
      {/* 1. HERO: The High-Level Vision */}
      <section className="max-w-6xl mx-auto px-6 pt-32 pb-24">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-[1.4]">
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-purple-500/20 bg-purple-500/5 rounded-full mb-8">
                <Sparkles size={12} className="text-purple-400" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-purple-300">A New Literacy for the AI Era</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-8">
                Creativity is the <br />
                <span className="text-purple-300 font-medium">reasoning of the future.</span>
              </h1>
              <p className="text-xl text-zinc-400 max-w-2xl leading-relaxed mb-10">
                In a world of automated answers, the most valuable skill isn't knowing the solution—it's having the creative reasoning to design the question. We teach children to think in systems, rules, and logic.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/designer" className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-xl shadow-purple-500/20">
                  Start Creating <ArrowRight size={20} />
                </Link>
                <Link to="/mission" className="px-8 py-4 bg-zinc-900 border border-zinc-800 text-zinc-200 font-bold rounded-xl hover:bg-zinc-800 transition-all">
                  Our Mission
                </Link>
              </div>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.5, delay: 0.3 }} className="flex-1 hidden lg:flex justify-center">
            <HeroGrid />
          </motion.div>
        </div>
      </section>

      {/* 2. THE WHY: The Intelligence Shift */}
      <section className="border-y border-zinc-900 bg-zinc-900/20 py-32">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="max-w-3xl mx-auto mb-20">
            <h2 className="text-sm font-mono uppercase tracking-[0.4em] text-purple-400 mb-6">The Why</h2>
            <h3 className="text-3xl md:text-5xl font-bold text-white mb-8 tracking-tight">From memorizing to modeling.</h3>
            <p className="text-lg text-zinc-400 leading-relaxed">
              For a century, education was about downloading information. But as AI takes over the "knowledge" layer, humans must move to the "wisdom" layer. We focus on the cognitive muscles that machines can't replicate: 
              <strong> abstract reasoning and structured imagination.</strong>
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 bg-zinc-950 border border-zinc-900 rounded-3xl text-left">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-6"><Compass size={20} /></div>
              <h4 className="text-white font-bold mb-4">Direction over Data</h4>
              <p className="text-sm text-zinc-500 leading-relaxed">It's no longer about finding the path, but about knowing where to point the compass in a sea of infinite information.</p>
            </div>
            <div className="p-8 bg-zinc-950 border border-zinc-900 rounded-3xl text-left">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-6"><Fingerprint size={20} /></div>
              <h4 className="text-white font-bold mb-4">Unique Creative Agency</h4>
              <p className="text-sm text-zinc-500 leading-relaxed">Reasoning allows children to put their own unique signature on how they solve problems, rather than following a script.</p>
            </div>
            <div className="p-8 bg-zinc-950 border border-zinc-900 rounded-3xl text-left">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 mb-6"><Focus size={20} /></div>
              <h4 className="text-white font-bold mb-4">Deep Cognitive Focus</h4>
              <p className="text-sm text-zinc-500 leading-relaxed">In a distracted world, the ability to sit with a system and understand its rules is a superpower.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. THE WHAT: Structured Imagination */}
      <section className="max-w-6xl mx-auto px-6 py-32">
        <div className="flex flex-col lg:flex-row gap-20 items-center">
          <div className="flex-1">
            <h2 className="text-sm font-mono uppercase tracking-[0.4em] text-purple-400 mb-6">The What</h2>
            <h3 className="text-4xl font-bold text-white mb-8 tracking-tight">A playground for the mind.</h3>
            <p className="text-lg text-zinc-400 leading-relaxed mb-8">
              We provide a simple, grid-based canvas where every element is a logical building block. By placing walls, characters, and rules, children are actually creating <strong>functional models of their own thoughts.</strong>
            </p>
            <ul className="space-y-4">
              {['Building without the barrier of syntax', 'Visualizing abstract patterns in real-time', 'Testing hypotheses through immediate play'].map((item, i) => (
                <li key={i} className="flex gap-3 items-center text-zinc-300">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1 w-full bg-zinc-900/50 aspect-video rounded-[3rem] border border-zinc-800/50 flex items-center justify-center overflow-hidden">
            <div className="text-center p-12">
               <div className="text-purple-400 font-mono text-xs mb-4 uppercase tracking-widest">Logic_Blueprint.jpg</div>
               <div className="grid grid-cols-4 gap-2 opacity-30">
                 {Array(16).fill(0).map((_, i) => <div key={i} className="w-12 h-12 border border-purple-500/50 rounded-lg" />)}
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. THE HOW: The Thinking Loop */}
      <section className="bg-white/5 py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-sm font-mono uppercase tracking-[0.4em] text-purple-400 mb-6">The How</h2>
            <h3 className="text-3xl md:text-5xl font-bold text-white mb-8 tracking-tight">The Three Loops of Reasoning.</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-16">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-zinc-800 mx-auto flex items-center justify-center text-zinc-400 text-2xl font-bold">1</div>
              <h4 className="text-xl font-bold text-white uppercase tracking-wider">Observe</h4>
              <p className="text-zinc-500">Understand the constraints of the grid. What is possible? What is impossible?</p>
            </div>
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-zinc-800 mx-auto flex items-center justify-center text-zinc-400 text-2xl font-bold">2</div>
              <h4 className="text-xl font-bold text-white uppercase tracking-wider">Architect</h4>
              <p className="text-zinc-500">Design the rules. If a character is purple, can they pass through a blue door?</p>
            </div>
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-zinc-800 mx-auto flex items-center justify-center text-zinc-400 text-2xl font-bold">3</div>
              <h4 className="text-xl font-bold text-white uppercase tracking-wider">Refine</h4>
              <p className="text-zinc-500">Play the game. Did the logic hold up? If not, why? The most learning happens in the "why."</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. THE SKILLS: Core Cognitive Capacities */}
      <section className="max-w-6xl mx-auto px-6 py-32">
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-white mb-6">Developing the Core.</h2>
          <p className="text-zinc-400 max-w-xl">These aren't tech skills. They are life skills for a systemic world.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { icon: <Layers size={22} className="text-purple-300" />, title: "Abstraction", desc: "Seeing the simple pattern within a complex mess." },
            { icon: <Compass size={22} className="text-blue-300" />, title: "Strategy", desc: "Thinking three steps ahead of the current state." },
            { icon: <Zap size={22} className="text-rose-300" />, title: "Intuition", desc: "Developing a 'gut feeling' for how systems behave." },
            { icon: <Brain size={22} className="text-cyan-300" />, title: "Logic", desc: "Mastering the fundamental physics of cause and effect." }
          ].map((skill, i) => (
            <div key={i} className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-purple-500/30 transition-all">
              <div className="mb-6">{skill.icon}</div>
              <h4 className="text-lg font-bold text-white mb-3">{skill.title}</h4>
              <p className="text-xs text-zinc-500 leading-relaxed">{skill.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. VISION: The Future-Proof Mind */}
      <section className="max-w-4xl mx-auto px-6 py-40 text-center">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-12 tracking-tight">
            Design the question.
          </h2>
          <p className="text-zinc-400 text-xl leading-relaxed font-light">
            We aren't training children to be "workers" in an AI world. We are training them to be the architects, the philosophers, and the creative directors of it. By mastering reasoning, they master the future.
          </p>
          <div className="mt-16">
             <Link to="/designer" className="inline-flex items-center gap-2 text-purple-400 font-bold text-lg hover:gap-4 transition-all">
               Start the Journey <ArrowRight size={22} />
             </Link>
          </div>
        </motion.div>
      </section>

    </div>
  );
}
