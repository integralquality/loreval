import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Heart, User, Play } from 'lucide-react';
import type { Level } from '../types';
import { getLevelByShortId, parseLevelDSL, toggleLike } from '../lib/levels-api';
import type { LevelWithMeta } from '../lib/levels-api';
import { useAuth } from '../contexts/AuthContext';
import GameDesigner from '../components/game/GameDesigner';

export default function SharedLevelPage() {
  const { shortId } = useParams<{ shortId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [levelData, setLevelData] = useState<LevelWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    if (!shortId) return;
    getLevelByShortId(shortId).then(data => {
      setLevelData(data);
      if (data) setLikeCount(data.like_count);
      setLoading(false);
    });
  }, [shortId]);

  const handleLike = async () => {
    if (!user || !levelData) return;
    const result = await toggleLike(levelData.id);
    if (!result.error) {
      setLiked(result.liked);
      setLikeCount(prev => prev + (result.liked ? 1 : -1));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!levelData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-center px-6">
        <h1 className="text-2xl font-semibold text-white mb-3">Level not found</h1>
        <p className="text-zinc-500 mb-6">This level may have been removed or the link is invalid.</p>
        <Link to="/browse" className="text-orange-400 hover:text-orange-300 text-sm">
          Browse levels
        </Link>
      </div>
    );
  }

  const parsed = parseLevelDSL(levelData.dsl_code);
  if (!parsed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-center px-6">
        <h1 className="text-2xl font-semibold text-white mb-3">Failed to load level</h1>
        <Link to="/browse" className="text-orange-400 hover:text-orange-300 text-sm">
          Browse levels
        </Link>
      </div>
    );
  }

  const handleFork = () => {
    const forked: Level = { ...parsed, name: `Copy of ${parsed.name}` };
    navigate('/designer', { state: { forkLevel: forked } });
  };

  return (
    <div className="relative">
      <GameDesigner initialLevel={parsed} playOnly onFork={handleFork} />

      {/* Floating info bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-2.5 bg-zinc-900/90 backdrop-blur border border-zinc-700/50 rounded-full shadow-2xl">
        <span className="text-sm font-semibold text-white">{levelData.name}</span>
        <span className="text-xs text-zinc-500 flex items-center gap-1">
          <User size={10} /> {levelData.author_name}
        </span>
        <span className="text-xs text-zinc-500 flex items-center gap-1">
          <Play size={10} /> {levelData.play_count}
        </span>
        {user && (
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
              liked ? 'bg-pink-500/20 text-pink-400' : 'text-zinc-500 hover:text-pink-400'
            }`}
          >
            <Heart size={12} fill={liked ? 'currentColor' : 'none'} /> {likeCount}
          </button>
        )}
      </div>
    </div>
  );
}
