import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Play, Heart, User } from 'lucide-react';
import { getPublishedLevels, parseLevelDSL } from '../lib/levels-api';
import type { LevelWithMeta } from '../lib/levels-api';
import { LevelPreview } from '../components/game/LevelPreview';

type SortOption = 'newest' | 'most_played' | 'most_liked';

export default function BrowsePage() {
  const [levels, setLevels] = useState<LevelWithMeta[]>([]);
  const [sort, setSort] = useState<SortOption>('newest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPublishedLevels(sort).then(data => {
      setLevels(data);
      setLoading(false);
    });
  }, [sort]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="font-mono text-[11px] text-zinc-500 mb-2">explore</p>
            <h1 className="text-3xl font-bold text-zinc-100">All levels</h1>
            <p className="text-zinc-500 text-sm mt-1">Puzzles available for AI evaluation</p>
          </div>

          <div className="flex bg-surface/60 border border-white/15 p-1 rounded-lg">
            {([
              ['newest', 'Newest'],
              ['most_played', 'Most run'],
              ['most_liked', 'Most liked'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setSort(value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  sort === value
                    ? 'bg-zinc-100 text-paper'
                    : 'text-zinc-500 hover:text-zinc-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : levels.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-white/15 rounded-lg">
            <p className="text-zinc-500 mb-4">No levels published yet</p>
            <Link
              to="/designer"
              className="font-mono text-orange-400 hover:text-orange-300 text-sm"
            >
              design one in the editor
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {levels.map(level => {
              const parsed = parseLevelDSL(level.dsl_code);
              return (
                <Link
                  key={level.id}
                  to={`/play/s/${level.short_id}`}
                  className="bg-surface/60 border border-white/15 rounded-lg overflow-hidden hover:border-zinc-500 transition-colors group"
                >
                  {/* Preview — dark instrument well */}
                  <div className="p-4 bg-zinc-950 flex items-center justify-center min-h-[160px]">
                    {parsed && <LevelPreview level={parsed} maxWidth={260} />}
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-2">
                    <h3 className="text-zinc-100 font-bold truncate">
                      {level.name}
                    </h3>

                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <User size={10} /> {level.author_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Play size={10} /> {level.play_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={10} /> {level.like_count}
                      </span>
                    </div>

                    <p className="font-mono text-xs text-zinc-400">
                      {level.width}×{level.height}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
