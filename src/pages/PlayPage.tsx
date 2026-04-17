import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import { CAMPAIGN_LEVELS } from '../levels';

const TOTAL_LEVELS = 10;

export default function PlayPage() {
  return (
    <div className="min-h-[70vh] px-6 py-16 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">
          Benchmark · Test Suite
        </p>
        <h1 className="text-3xl font-bold text-white mb-3">Benchmark levels</h1>
        <p className="text-zinc-500 text-sm max-w-xl mb-12 leading-relaxed">
          A curated set of puzzles for evaluating model performance. Each level tests a specific combination of mechanics — open one to run an AI model against it and inspect the move-by-move result.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: TOTAL_LEVELS }, (_, i) => {
            const num = i + 1;
            const campaign = CAMPAIGN_LEVELS.find(l => l.number === num);
            const available = !!campaign;

            if (available) {
              return (
                <Link
                  key={num}
                  to={`/play/${num}`}
                  className="group relative bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 hover:border-purple-500/40 hover:bg-zinc-900 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs text-zinc-600">#{num}</span>
                    <ArrowRight size={13} className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h3 className="text-sm font-medium text-zinc-200 mb-1.5 group-hover:text-white transition-colors">
                    {campaign.name}
                  </h3>
                  <p className="text-xs text-zinc-600 leading-relaxed">{campaign.description}</p>
                </Link>
              );
            }

            return (
              <div
                key={num}
                className="relative bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 opacity-35"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs text-zinc-700">#{num}</span>
                  <Lock size={12} className="text-zinc-700" />
                </div>
                <h3 className="text-sm font-medium text-zinc-700 mb-1">Pending</h3>
                <p className="text-xs text-zinc-700">Benchmark level in progress</p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800/60">
          <p className="text-zinc-600 text-xs font-mono mb-3">or start from a blank level</p>
          <Link
            to="/designer"
            className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            Open the designer <ArrowRight size={13} />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
