import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Boxes, Network, Lightbulb, Binary } from 'lucide-react';

const features = [
  {
    icon: Boxes,
    title: 'Abstraction Thinking',
    description: 'Break complex problems into manageable pieces by designing tile-based worlds with layered rules.',
    color: 'text-indigo-400',
  },
  {
    icon: Network,
    title: 'Structural Reasoning',
    description: 'Understand how grids, paths, and spatial relationships create meaningful constraints.',
    color: 'text-purple-400',
  },
  {
    icon: Lightbulb,
    title: 'Creative Problem Design',
    description: 'Shift from solving puzzles to inventing them — a deeper form of computational creativity.',
    color: 'text-amber-400',
  },
  {
    icon: Binary,
    title: 'Algorithmic Intuition',
    description: 'Develop a feel for parity, sequencing, and logical constraints through hands-on experimentation.',
    color: 'text-emerald-400',
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/40 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />

        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-4 py-1.5 mb-6 text-sm font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
              Teach creativity and logic — not just tools.
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-6xl font-bold leading-tight"
          >
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              In the era of AI, logic is the
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              new programming language
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto"
          >
            Kids design puzzle games with grids, rules, and characters — building computational thinking skills
            that outlast any single programming language.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex items-center justify-center gap-4"
          >
            <Link
              to="/designer"
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/25"
            >
              Start Creating
            </Link>
            <a
              href="#features"
              className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-colors"
            >
              Learn More
            </a>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white">What kids really learn</h2>
          <p className="mt-3 text-slate-400">Beyond coding syntax — the thinking patterns that matter.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="p-6 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition-colors"
            >
              <feature.icon className={`w-10 h-10 ${feature.color} mb-4`} />
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center p-12 bg-gradient-to-br from-slate-900 to-indigo-950/50 border border-slate-800 rounded-2xl">
          <h2 className="text-3xl font-bold text-white mb-3">Design first. Solve second.</h2>
          <p className="text-slate-400 mb-8 max-w-lg mx-auto">
            The best way to understand a puzzle is to build one. Jump into the designer and start creating.
          </p>
          <Link
            to="/designer"
            className="inline-block px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/25"
          >
            Open Game Designer
          </Link>
        </div>
      </section>
    </div>
  );
}
