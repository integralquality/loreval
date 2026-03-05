import { useParams } from 'react-router-dom';
import GameDesigner from '../components/game/GameDesigner';

export default function GameDesignerPage() {
  const { id } = useParams<{ id: string }>();
  return <GameDesigner levelId={id} />;
}
