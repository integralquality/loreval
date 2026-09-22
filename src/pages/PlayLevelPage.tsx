import { useParams, Link, useNavigate } from 'react-router-dom';
import { CAMPAIGN_LEVELS } from '../levels';
import GameDesigner from '../components/game/GameDesigner';
import type { Level } from '../types';

export default function PlayLevelPage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const num = Number(levelId);
  const campaign = CAMPAIGN_LEVELS.find(l => l.number === num);

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen page-ground text-center px-6">
        <h1 className="text-2xl font-bold text-zinc-100 mb-3">Level not found</h1>
        <p className="text-zinc-500 mb-6">This level doesn't exist yet.</p>
        <Link to="/play" className="font-mono text-orange-400 hover:text-orange-300 text-sm">
          back to levels
        </Link>
      </div>
    );
  }

  const handleFork = () => {
    const forked: Level = { ...campaign.level, name: `Copy of ${campaign.level.name}` };
    navigate('/designer', { state: { forkLevel: forked } });
  };

  return <GameDesigner initialLevel={campaign.level} playOnly onFork={handleFork} />;
}
