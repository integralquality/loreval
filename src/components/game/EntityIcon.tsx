import { Bot } from 'lucide-react';
import type { EntityType } from '../../types';

export const EntityIcon = ({ type: _type, color, className = "" }: { type: EntityType, color?: string, className?: string }) => {
  const style = color ? { color } : {};
  return <Bot className={`text-blue-500 ${className}`} style={style} />;
};
