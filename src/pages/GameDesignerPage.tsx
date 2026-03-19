import { useParams, useLocation } from 'react-router-dom';
import GameDesigner from '../components/game/GameDesigner';
import type { Level } from '../types';

interface LocationState {
  forkLevel?: Level;
}

export default function GameDesignerPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const forkLevel = (location.state as LocationState)?.forkLevel;
  if (forkLevel) {
    return <GameDesigner initialLevel={forkLevel} />;
  }
  return <GameDesigner levelId={id} />;
}
