import { LogOut, DoorOpen, PaintBucket, Snowflake, ToggleLeft, ArrowUp, Waves } from 'lucide-react';
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
      const brickSvg = `url("data:image/svg+xml,%3Csvg width='28' height='28' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='28' height='28' fill='%23351008'/%3E%3Crect x='0' y='0' width='26' height='12' fill='%239b3a10' rx='1'/%3E%3Crect x='0' y='0' width='26' height='2' fill='%23c45a30' rx='1' opacity='0.4'/%3E%3Crect x='0' y='14' width='12' height='12' fill='%239b3a10' rx='1'/%3E%3Crect x='0' y='14' width='12' height='2' fill='%23c45a30' rx='1' opacity='0.4'/%3E%3Crect x='14' y='14' width='14' height='12' fill='%239b3a10' rx='1'/%3E%3Crect x='14' y='14' width='14' height='2' fill='%23c45a30' rx='1' opacity='0.4'/%3E%3C/svg%3E")`;
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
            backgroundColor: 'rgba(220,200,130,0.25)',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='24' height='24' fill='%23d0c080' fill-opacity='0.1'/%3E%3Ccircle cx='3' cy='7' r='0.7' fill='%23c0b070' fill-opacity='0.2'/%3E%3Ccircle cx='14' cy='3' r='0.5' fill='%23b8a868' fill-opacity='0.18'/%3E%3Ccircle cx='8' cy='18' r='0.6' fill='%23c8b878' fill-opacity='0.2'/%3E%3Ccircle cx='20' cy='11' r='0.8' fill='%23b8a868' fill-opacity='0.15'/%3E%3Ccircle cx='11' cy='10' r='0.4' fill='%23c0b070' fill-opacity='0.18'/%3E%3Ccircle cx='18' cy='21' r='0.6' fill='%23c8b878' fill-opacity='0.15'/%3E%3Ccircle cx='5' cy='14' r='0.5' fill='%23b8a868' fill-opacity='0.2'/%3E%3Ccircle cx='22' cy='5' r='0.4' fill='%23c0b070' fill-opacity='0.18'/%3E%3C/svg%3E")`,
            backgroundSize: '24px 24px',
          }}
        />
      );
    case 'floor-black': {
      const grassSvg = `url("data:image/svg+xml,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='24' height='24' fill='%23183a28'/%3E%3Cpath d='M3 24 Q3 16 5 12' stroke='%232d6b45' stroke-width='1.5' fill='none'/%3E%3Cpath d='M7 24 Q6 14 9 8' stroke='%23348a52' stroke-width='1.2' fill='none'/%3E%3Cpath d='M11 24 Q12 17 10 11' stroke='%232d6b45' stroke-width='1.5' fill='none'/%3E%3Cpath d='M15 24 Q14 15 17 10' stroke='%23266d40' stroke-width='1.2' fill='none'/%3E%3Cpath d='M19 24 Q20 18 18 13' stroke='%23348a52' stroke-width='1.5' fill='none'/%3E%3Cpath d='M22 24 Q21 16 23 11' stroke='%232d6b45' stroke-width='1.2' fill='none'/%3E%3C/svg%3E")`;
      return (
        <div
          className={`w-full h-full rounded-sm ${className}`}
          style={{ backgroundImage: grassSvg, backgroundSize: '24px 24px' }}
        />
      );
    }
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
