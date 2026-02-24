import { useParams, Link } from 'react-router-dom';
import { CAMPAIGN_LEVELS } from '../levels';
import GameDesigner from '../components/game/GameDesigner';

export default function PlayLevelPage() {
  const { levelId } = useParams<{ levelId: string }>();
  const num = Number(levelId);
  const campaign = CAMPAIGN_LEVELS.find(l => l.number === num);

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
        <h1 className="text-2xl font-semibold text-white mb-3">Level not found</h1>
        <p className="text-zinc-500 mb-6">This level doesn't exist yet.</p>
        <Link to="/play" className="text-purple-400 hover:text-purple-300 text-sm">
          Back to levels
        </Link>
      </div>
    );
  }

  return <GameDesigner initialLevel={campaign.level} playOnly />;
}
