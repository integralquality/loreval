import { Dog, Cat, Rabbit, Bot, User } from 'lucide-react';
import type { EntityType } from '../../types';

export const EntityIcon = ({ type, color, className = "" }: { type: EntityType, color?: string, className?: string }) => {
  const style = color ? { color } : {};
  switch (type) {
    case 'dog': return <Dog className={`text-orange-500 ${className}`} style={style} />;
    case 'cat': return <Cat className={`text-purple-500 ${className}`} style={style} />;
    case 'rabbit': return <Rabbit className={`text-pink-500 ${className}`} style={style} />;
    case 'robot': return <Bot className={`text-blue-500 ${className}`} style={style} />;
    case 'player': return <User className={`text-green-500 ${className}`} style={style} />;
    default: return <User className={`text-gray-500 ${className}`} style={style} />;
  }
};
