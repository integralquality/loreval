import { Flag, DoorOpen, PaintBucket, Snowflake, ToggleLeft, ArrowUp, Waves } from 'lucide-react';
import type { TileType, TileMeta } from '../../types';

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

export const TileIcon = ({ type, color, meta, isOpen, className = "" }: {
  type: TileType;
  color?: string;
  meta?: TileMeta;
  isOpen?: boolean;
  className?: string;
}) => {
  const c = colorVal(color);

  switch (type) {
    case 'wall': {
      const brickSvg = `url("data:image/svg+xml,%3Csvg width='28' height='28' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='28' height='28' fill='%23492009'/%3E%3Crect x='0' y='0' width='26' height='12' fill='%23c2692d' rx='1'/%3E%3Crect x='0' y='0' width='26' height='2' fill='%23d4883a' rx='1' opacity='0.5'/%3E%3Crect x='0' y='14' width='12' height='12' fill='%23c2692d' rx='1'/%3E%3Crect x='0' y='14' width='12' height='2' fill='%23d4883a' rx='1' opacity='0.5'/%3E%3Crect x='14' y='14' width='14' height='12' fill='%23c2692d' rx='1'/%3E%3Crect x='14' y='14' width='14' height='2' fill='%23d4883a' rx='1' opacity='0.5'/%3E%3C/svg%3E")`;
      return (
        <div
          className={`w-full h-full rounded-sm ${className}`}
          style={{ backgroundImage: brickSvg, backgroundSize: '28px 28px' }}
        />
      );
    }
    case 'floor':
    case 'floor-white':
      return (
        <div
          className={`w-full h-full rounded-sm ${className}`}
          style={{
            backgroundColor: 'rgba(120,113,108,0.3)',
            backgroundImage:
              'linear-gradient(to bottom, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '100% 12px',
          }}
        />
      );
    case 'floor-black':
      return (
        <div
          className={`w-full h-full rounded-sm ${className}`}
          style={{
            backgroundColor: 'rgba(34,80,50,0.35)',
            backgroundImage:
              'radial-gradient(circle at 25% 25%, rgba(74,222,128,0.08) 0px, transparent 2px),' +
              'radial-gradient(circle at 75% 60%, rgba(74,222,128,0.06) 0px, transparent 2px)',
            backgroundSize: '16px 16px',
          }}
        />
      );
    case 'water':
      return (
        <div
          className={`w-full h-full rounded-sm flex items-center justify-center ${className}`}
          style={{ backgroundColor: 'rgba(30,64,110,0.45)' }}
        >
          <Waves
            size={18}
            style={{
              color: '#60a5fa',
              filter: 'drop-shadow(0 0 4px rgba(96,165,250,0.5))',
              opacity: 0.6,
            }}
          />
        </div>
      );

    case 'goal':
      return (
        <div className={`w-full h-full bg-zinc-800/20 rounded-sm flex items-center justify-center ${className}`}>
          <Flag
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
            <DoorOpen
              size={18}
              style={{ color: c || '#a1a1aa', opacity: 0.3 }}
            />
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

    case 'ice':
      return (
        <div className={`w-full h-full bg-cyan-400/8 rounded-sm flex items-center justify-center ${className}`}>
          <Snowflake
            size={16}
            style={{
              color: '#67e8f9',
              filter: 'drop-shadow(0 0 4px rgba(103,232,249,0.4))',
              opacity: 0.6,
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
      const rotation = {
        up: 0, right: 90, down: 180, left: 270,
      }[meta?.direction || 'up'];
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

    default:
      return <div className={`w-full h-full bg-zinc-600/25 rounded-sm ${className}`} />;
  }
};
