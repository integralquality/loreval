import { LogOut, DoorOpen, PaintBucket, ToggleLeft, ArrowUp, Lock, LockOpen } from 'lucide-react';
import type { TileType, TileMeta } from '../../types';
import { getTheme } from '../../lib/themes';

const COLOR_MAP: Record<string, string> = {
  orange: '#fb923c',
  purple: '#c084fc',
  pink: '#f472b6',
  blue: '#60a5fa',
  green: '#6ee7b7',
  red: '#f87171',
};

function colorVal(name?: string) {
  return name ? COLOR_MAP[name] || name : undefined;
}

export const TileIcon = ({ type, color, meta, isOpen, theme: themeId, className = '' }: {
  type: TileType;
  color?: string;
  meta?: TileMeta;
  isOpen?: boolean;
  theme?: string;
  className?: string;
}) => {
  const c = colorVal(color);
  const theme = getTheme(themeId);

  switch (type) {
    case 'wall':
      return (
        <div
          className={`w-full h-full rounded-sm ${className}`}
          style={theme.wall}
        />
      );

    case 'floor':
    case 'floor-white':
      return (
        <div
          className={`w-full h-full rounded-sm ${className}`}
          style={theme.floor}
        />
      );

    case 'goal':
      return (
        <div className={`w-full h-full bg-zinc-800/20 rounded-sm flex items-center justify-center ${className}`}>
          <LogOut
            size={18}
            style={{
              color: c || '#6ee7b7',
              filter: c ? `drop-shadow(0 0 4px ${c}60)` : 'drop-shadow(0 0 4px rgba(110,231,183,0.4))',
              opacity: 0.8,
            }}
          />
        </div>
      );

    case 'door':
      if (isOpen) {
        return (
          <div className={`w-full h-full bg-zinc-800/20 rounded-sm flex items-center justify-center ${className}`}>
            <DoorOpen size={18} style={{ color: c || '#a1a1aa', opacity: 0.3 }} />
          </div>
        );
      }
      return (
        <div className={`w-full h-full bg-zinc-700/60 rounded-sm flex items-center justify-center ${className}`}>
          <DoorOpen
            size={18}
            style={{
              color: c || '#a1a1aa',
              filter: c ? `drop-shadow(0 0 4px ${c}50)` : undefined,
              opacity: 0.8,
            }}
          />
        </div>
      );

    case 'paint':
      return (
        <div
          className={`w-full h-full rounded-sm flex items-center justify-center ${className}`}
          style={{ backgroundColor: c ? `${c}15` : 'rgba(161,161,170,0.05)' }}
        >
          <PaintBucket
            size={16}
            style={{
              color: c || '#a1a1aa',
              filter: c ? `drop-shadow(0 0 4px ${c}50)` : undefined,
              opacity: 0.7,
            }}
          />
        </div>
      );

    case 'switch':
      return (
        <div className={`w-full h-full bg-zinc-800/20 rounded-sm flex items-center justify-center ${className}`}>
          <ToggleLeft
            size={18}
            style={{
              color: c || '#a1a1aa',
              filter: c ? `drop-shadow(0 0 4px ${c}50)` : undefined,
              opacity: 0.7,
            }}
          />
        </div>
      );

    case 'one-way': {
      const rotation = { up: 0, right: 90, down: 180, left: 270 }[meta?.direction || 'up'];
      return (
        <div className={`w-full h-full bg-zinc-800/20 rounded-sm flex items-center justify-center ${className}`}>
          <ArrowUp
            size={18}
            style={{
              color: '#fbbf24',
              filter: 'drop-shadow(0 0 3px rgba(251,191,36,0.4))',
              opacity: 0.6,
              transform: `rotate(${rotation}deg)`,
            }}
          />
        </div>
      );
    }

    case 'lock':
      if (isOpen) {
        return (
          <div className={`w-full h-full bg-zinc-800/20 rounded-sm flex items-center justify-center ${className}`}>
            <LockOpen size={18} style={{ color: c || '#a1a1aa', opacity: 0.25 }} />
          </div>
        );
      }
      return (
        <div className={`w-full h-full bg-zinc-700/60 rounded-sm flex items-center justify-center ${className}`}>
          <Lock
            size={18}
            style={{
              color: c || '#a1a1aa',
              filter: c ? `drop-shadow(0 0 4px ${c}50)` : undefined,
              opacity: 0.8,
            }}
          />
        </div>
      );

    default:
      return <div className={`w-full h-full bg-zinc-600/25 rounded-sm ${className}`} />;
  }
};
