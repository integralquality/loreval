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
        <p className="font-mono text-[11px] text-zinc-500 mb-4">benchmark / test suite</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Benchmark levels</h1>
        <p className="text-zinc-600 text-sm max-w-xl mb-12 leading-relaxed">
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
                  className="group relative bg-white/60 border border-zinc-900/15 rounded-lg p-5 hover:border-zinc-900 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs text-zinc-400">#{num}</span>
                    <ArrowRight size={13} className="text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-900 mb-1.5">
                    {campaign.name}
                  </h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{campaign.description}</p>
                </Link>
              );
            }

            return (
              <div
                key={num}
                className="relative border border-dashed border-zinc-900/15 rounded-lg p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs text-zinc-400">#{num}</span>
                  <Lock size={12} className="text-zinc-400" />
                </div>
                <h3 className="text-sm font-medium text-zinc-400 mb-1">Pending</h3>
                <p className="text-xs text-zinc-400">Benchmark level in progress</p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 pt-8 border-t-2 border-zinc-900">
          <p className="text-zinc-500 text-xs font-mono mb-3">or start from a blank level</p>
          <Link
            to="/designer"
            className="inline-flex items-center gap-2 font-mono text-sm text-orange-600 hover:text-orange-500 transition-colors"
          >
            open the designer <ArrowRight size={13} />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
