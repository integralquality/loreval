import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Lock, Play } from 'lucide-react';
import { CAMPAIGN_LEVELS } from '../levels';

const TOTAL_LEVELS = 10;

export default function PlayPage() {
  return (
    <div className="min-h-[70vh] px-6 py-16 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-600 mb-4 text-center">
          Campaign
        </p>
        <h1 className="text-3xl font-semibold text-white mb-2 text-center">Levels</h1>
        <p className="text-zinc-500 text-center mb-10">
          Work through puzzles that teach computational thinking step by step.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: TOTAL_LEVELS }, (_, i) => {
            const num = i + 1;
            const campaign = CAMPAIGN_LEVELS.find(l => l.number === num);
            const available = !!campaign;

            if (available) {
              return (
                <Link
                  key={num}
                  to={`/play/${num}`}
                  className="group relative bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-5 hover:border-purple-500/50 hover:bg-zinc-800 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl font-bold text-zinc-300 group-hover:text-white transition-colors">
                      {num}
                    </span>
                    <Play size={16} className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h3 className="text-sm font-medium text-zinc-200 mb-1">{campaign.name}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{campaign.description}</p>
                </Link>
              );
            }

            return (
              <div
                key={num}
                className="relative bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-5 opacity-40"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-bold text-zinc-600">{num}</span>
                  <Lock size={14} className="text-zinc-700" />
                </div>
                <h3 className="text-sm font-medium text-zinc-600 mb-1">Coming soon</h3>
                <p className="text-xs text-zinc-700">New puzzle on the way</p>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
