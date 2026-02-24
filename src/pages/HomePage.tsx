import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Brain,
  ArrowRight,
  Sparkles,
  Cpu,
  Zap,
  Code2,
  Terminal,
  Share2,
  Trophy,
  Bot
} from 'lucide-react';
import { TileIcon } from '../components/game/TileIcon';
import { EntityIcon } from '../components/game/EntityIcon';

// --- Improved Hero Visual: A "Living" Logic Board ---
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
    const id = setInterval(() => setStep(prev => (prev + 1) % path.length), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative p-6 border border-white/10 bg-zinc-900/20 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-purple-500/10">
      <div className="absolute top-4 left-6 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">System_Status: Logic_Verification</span>
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
              <TileIcon type={isWall ? 'wall' : (x + y) % 2 === 0 ? 'floor-white' : 'floor-black'} className="opacity-40" />
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
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="bg-zinc-950 text-zinc-300 font-sans selection:bg-purple-500/30">

      {/* 1. HERO: The Intelligence Hub */}
      <section className="max-w-6xl mx-auto px-6 pt-32 pb-24">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-[1.4]">
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-purple-500/20 bg-purple-500/5 rounded-full mb-8">
                <Bot size={12} className="text-purple-400" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-purple-300">The Human-AI Logic Laboratory</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-8">
                Where humans and AI<br />
                <span className="text-purple-300 font-medium">reason side by side.</span>
              </h1>
              <p className="text-xl text-zinc-400 max-w-2xl leading-relaxed mb-10">
                A playground where humans and machines design, solve, and compare logic puzzles. Build rule systems, challenge AI models, and see how different minds approach the same problem.
              </p>
              <p className="text-xl text-zinc-400 max-w-2xl leading-relaxed mb-10">
                A benchmark for machine reasoning and one for human creativity.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/designer" className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-xl shadow-purple-500/20">
                  Enter the Lab <ArrowRight size={20} />
                </Link>
                <Link to="/play" className="px-8 py-4 bg-zinc-900 border border-zinc-800 text-zinc-200 font-bold rounded-xl hover:bg-zinc-800 transition-all">
                  Explore Arena
                </Link>
              </div>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.3 }} className="flex-1 hidden lg:flex justify-center">
            <HeroGrid />
          </motion.div>
        </div>
      </section>

      {/* 2. THE VISION: Co-Evolution of Reasoning */}
      <section className="border-y border-zinc-900 bg-zinc-900/20 py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center mb-32">
            <div>
              <h2 className="text-sm font-mono uppercase tracking-[0.4em] text-purple-400 mb-6">The Idea</h2>
              <h3 className="text-3xl md:text-5xl font-bold text-white mb-8 tracking-tight">Beyond pattern matching.</h3>
              <p className="text-lg text-zinc-400 leading-relaxed mb-8">
                AI is getting good at code and retrieval, but <strong>spatial reasoning and planning</strong> remain hard. Our platform is a neutral ground where human intuition meets machine scalability — push models out of their comfort zone with puzzles that require genuine logic, not memorized patterns.
              </p>
              <div className="space-y-6">
                <div className="flex gap-4 p-4 rounded-2xl bg-zinc-950 border border-zinc-900">
                  <Cpu className="text-purple-400 shrink-0" />
                  <div>
                    <h4 className="text-white font-bold text-sm">AI Benchmarking</h4>
                    <p className="text-zinc-500 text-xs mt-1">Export puzzles as JSON and challenge LLMs to solve or generate them. Compare how different models reason through the same constraints.</p>
                  </div>
                </div>
                <div className="flex gap-4 p-4 rounded-2xl bg-zinc-950 border border-zinc-900">
                  <Brain className="text-blue-400 shrink-0" />
                  <div>
                    <h4 className="text-white font-bold text-sm">Human Intuition</h4>
                    <p className="text-zinc-500 text-xs mt-1">Develop the mental models required to design systems that are robust, creative, and strategically deep.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 hover:border-purple-500/30 transition-colors group space-y-3">
                <Terminal className="text-zinc-700 group-hover:text-purple-400 transition-colors" size={22} />
                <h4 className="text-white font-bold">Export Systems</h4>
                <p className="text-zinc-600 text-xs leading-relaxed">Save puzzles as JSON. Feed them to any AI model or share with others.</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 hover:border-purple-500/30 transition-colors group space-y-3">
                <Share2 className="text-zinc-700 group-hover:text-purple-400 transition-colors" size={22} />
                <h4 className="text-white font-bold">Collaborate</h4>
                <p className="text-zinc-600 text-xs leading-relaxed">Share levels via link. Let others play, remix, and build on your designs.</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 hover:border-purple-500/30 transition-colors group space-y-3">
                <Bot className="text-zinc-700 group-hover:text-purple-400 transition-colors" size={22} />
                <h4 className="text-white font-bold">AI Co-Creation</h4>
                <p className="text-zinc-600 text-xs leading-relaxed">Let AI generate levels, or design one and watch it attempt to solve it.</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 hover:border-purple-500/30 transition-colors group space-y-3">
                <Trophy className="text-zinc-700 group-hover:text-purple-400 transition-colors" size={22} />
                <h4 className="text-white font-bold">Leaderboards</h4>
                <p className="text-zinc-600 text-xs leading-relaxed">Track solve times and step counts. Compare humans vs AI on the same puzzles.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. THE MISSION: Universal Reasoning */}
      <section className="max-w-6xl mx-auto px-6 py-32">
        <div className="text-center mb-24">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Built for all kinds of minds.</h2>
          <p className="text-zinc-500 max-w-2xl mx-auto text-lg leading-relaxed">
            Whether you're a kid building your first logic puzzle or a researcher stress-testing an AI model, the core is the same: <strong>think clearly, solve systematically.</strong>
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-12">
          <div className="text-center space-y-4">
            <h4 className="text-white font-bold text-xl">For Humans</h4>
            <p className="text-zinc-500 text-sm">A cognitive playground to sharpen abstraction and systemic thinking—the skills that remain valuable as technology changes.</p>
          </div>
          <div className="text-center space-y-4">
            <h4 className="text-white font-bold text-xl">For Machines</h4>
            <p className="text-zinc-500 text-sm">A specialized benchmark for spatial reasoning, planning, and constraint satisfaction. No training data, just pure logic.</p>
          </div>
          <div className="text-center space-y-4">
            <h4 className="text-white font-bold text-xl">For the Future</h4>
            <p className="text-zinc-500 text-sm">A bridge between the two. Collaborative design where humans set the intent and AI scales the possibilities.</p>
          </div>
        </div>
      </section>

      {/* 4. VISION: The Intelligence Lab */}
      <section className="max-w-4xl mx-auto px-6 py-40 text-center">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-12 tracking-tight">
            Same puzzle. <br /> Different minds.
          </h2>
          <p className="text-zinc-400 text-xl leading-relaxed font-light">
            Design a logic system, solve it yourself, then hand it to an AI. See where human creativity and machine reasoning overlap — and where they don't.
          </p>
          <div className="mt-16">
            <Link to="/designer" className="inline-flex items-center gap-2 text-purple-400 font-bold text-lg hover:gap-4 transition-all group">
              Enter the Laboratory <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>
      </section>

    </div>
  );
}
