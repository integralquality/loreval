import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Plus, Trash2, Share2, Globe, GlobeLock, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getMyLevels, deleteLevel, publishLevel, unpublishLevel, parseLevelDSL } from '../lib/levels-api';
import type { LevelRow } from '../lib/levels-api';
import { LevelPreview } from '../components/game/LevelPreview';

export default function MyLevelsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      getMyLevels().then(data => {
        setLevels(data);
        setLoading(false);
      });
    }
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this level? This cannot be undone.')) return;
    await deleteLevel(id);
    setLevels(prev => prev.filter(l => l.id !== id));
  };

  const handleTogglePublish = async (level: LevelRow) => {
    if (level.is_published) {
      await unpublishLevel(level.id);
      setLevels(prev => prev.map(l => l.id === level.id ? { ...l, is_published: false } : l));
    } else {
      const { shortId } = await publishLevel(level.id);
      if (shortId) {
        setLevels(prev => prev.map(l => l.id === level.id ? { ...l, is_published: true, short_id: shortId } : l));
      }
    }
  };

  const handleCopyLink = (shortId: string) => {
    const url = `${window.location.origin}/play/s/${shortId}`;
    navigator.clipboard.writeText(url);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">My Levels</h1>
            <p className="text-zinc-500 mt-1">{levels.length} level{levels.length !== 1 ? 's' : ''}</p>
          </div>
          <Link
            to="/designer"
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-100 hover:bg-zinc-300 text-paper text-sm font-semibold rounded transition-colors"
          >
            <Plus size={16} /> New Level
          </Link>
        </div>

        {levels.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-white/15 rounded-lg">
            <p className="text-zinc-500 mb-4">No levels yet</p>
            <Link
              to="/designer"
              className="font-mono text-orange-400 hover:text-orange-300 text-sm"
            >
              create your first level
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {levels.map(level => {
              const parsed = parseLevelDSL(level.dsl_code);
              return (
                <div
                  key={level.id}
                  className="bg-surface/60 border border-white/15 rounded-lg overflow-hidden hover:border-white/25 transition-colors"
                >
                  {/* Preview — dark instrument well */}
                  <div className="p-4 bg-zinc-950 flex items-center justify-center min-h-[160px]">
                    {parsed && <LevelPreview level={parsed} maxWidth={260} />}
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-zinc-100 font-bold truncate">{level.name}</h3>
                      <span className={`flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded ${
                        level.is_published
                          ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-600/30'
                          : 'bg-white/5 text-zinc-500 border border-white/10'
                      }`}>
                        {level.is_published ? <Globe size={10} /> : <GlobeLock size={10} />}
                        {level.is_published ? 'published' : 'draft'}
                      </span>
                    </div>

                    <p className="font-mono text-xs text-zinc-400">
                      {level.width}×{level.height} · updated {new Date(level.updated_at).toLocaleDateString()}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Link
                        to={`/designer/${level.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-white/15 hover:border-zinc-500 text-zinc-300 text-xs rounded transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleTogglePublish(level)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-white/15 hover:border-zinc-500 text-zinc-300 text-xs rounded transition-colors"
                      >
                        {level.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      {level.is_published && (
                        <button
                          onClick={() => handleCopyLink(level.short_id)}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 border border-white/15 hover:border-zinc-500 text-zinc-300 text-xs rounded transition-colors"
                          title="Copy share link"
                        >
                          <Share2 size={12} />
                        </button>
                      )}
                      {level.is_published && (
                        <Link
                          to={`/play/s/${level.short_id}`}
                          className="flex items-center justify-center px-2 py-1.5 border border-white/15 hover:border-zinc-500 text-zinc-300 text-xs rounded transition-colors"
                          title="Play"
                        >
                          <ExternalLink size={12} />
                        </Link>
                      )}
                      <button
                        onClick={() => handleDelete(level.id)}
                        className="flex items-center justify-center px-2 py-1.5 border border-white/15 hover:border-red-500/50 text-zinc-400 hover:text-red-400 text-xs rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
