import { motion } from 'motion/react';
import { Brain, ShieldCheck, Cpu, Lightbulb, Sparkles, Target, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const missionPoints = [
  {
    icon: <Cpu className="text-amber-400" />,
    title: "AI is the Engine, Logic is the Driver",
    desc: "In a world where AI can generate code instantly, the value shifts from knowing 'how' to write syntax to knowing 'what' to build and 'why' it works. We focus on the architectural logic that directs the AI."
  },
  {
    icon: <Brain className="text-emerald-400" />,
    title: "Computational Thinking for Everyone",
    desc: "We believe logic is a universal language. By stripping away the complexity of modern development environments, we allow children to master the core principles of algorithms and state management through play."
  },
  {
    icon: <Lightbulb className="text-rose-400" />,
    title: "Creative Problem Design",
    desc: "The future belongs to the designers of systems, not just the consumers of them. Our mission is to transform kids from players into architects of their own digital worlds."
  }
];

const pillars = [
  { title: "Abstraction", desc: "Learning to identify and isolate the essential features of a problem while ignoring irrelevant details.", icon: <ShieldCheck size={20} /> },
  { title: "Structural Reasoning", desc: "Understanding how different parts of a system interact and depend on one another.", icon: <Target size={20} /> },
  { title: "Algorithmic Intuition", desc: "Developing a natural sense for step-by-step logic and conditional flow.", icon: <Zap size={20} /> },
  { title: "Systemic Creativity", desc: "Using constraints as a tool for innovation rather than a limitation.", icon: <Sparkles size={20} /> }
];

export default function MissionPage() {
  return (
    <div className="pb-24">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-amber-500 font-bold mb-4 block">
            Our Philosophy
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-8 tracking-tight">
            Preparing for the <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
              Logic-First Era
            </span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed">
            We are building a platform where the next generation learns that 
            <strong> creativity and logic</strong> are the ultimate tools for 
            thriving alongside artificial intelligence.
          </p>
        </motion.div>
      </section>

      {/* Core Philosophy Grid */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-12">
          {missionPoints.map((point, i) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-xl">
                {point.icon}
              </div>
              <h3 className="text-xl font-bold text-white">{point.title}</h3>
              <p className="text-zinc-500 leading-relaxed text-sm">
                {point.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Detailed Pillars */}
      <section className="max-w-5xl mx-auto px-6 py-16 bg-zinc-900/30 rounded-[3rem] border border-zinc-800/50 mt-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">The Four Pillars</h2>
          <p className="text-zinc-500">The specific cognitive skills we aim to cultivate.</p>
        </div>
        
        <div className="grid sm:grid-cols-2 gap-x-12 gap-y-16">
          {pillars.map((pillar, i) => (
            <div key={pillar.title} className="flex gap-6">
              <div className="text-amber-500 shrink-0 mt-1">
                {pillar.icon}
              </div>
              <div>
                <h4 className="text-lg font-bold text-zinc-200 mb-2">{pillar.title}</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">{pillar.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quote / Conclusion */}
      <section className="max-w-4xl mx-auto px-6 pt-32 text-center">
        <div className="relative inline-block">
          <span className="text-6xl text-zinc-800 absolute -top-8 -left-10 font-serif">"</span>
          <h2 className="text-2xl md:text-3xl font-medium text-zinc-300 italic relative z-10">
            The real advantage in the future will not be the ability to write code, but the 
            <span className="text-white not-italic font-bold"> intuition to design systems.</span>
          </h2>
        </div>
        
        <div className="mt-16">
          <Link
            to="/designer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-2xl transition-all hover:scale-105"
          >
            Start Designing Today
          </Link>
        </div>
      </section>
    </div>
  );
}
