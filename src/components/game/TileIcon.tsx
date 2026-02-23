import { Flag, DoorOpen, PaintBucket, Snowflake, ToggleLeft, ArrowUp } from 'lucide-react';
import type { TileType, TileMeta } from '../../types';

export const TileIcon = ({ type, color, meta, isOpen, className = "" }: {
  type: TileType;
  color?: string;
  meta?: TileMeta;
  isOpen?: boolean;
  className?: string;
}) => {
  const style = color ? { color, borderColor: color, backgroundColor: `${color}20` } : {};

  switch (type) {
    case 'wall': return <div className={`w-full h-full bg-slate-800 rounded-sm ${className}`} />;
    case 'floor-white': return <div className={`w-full h-full bg-slate-100 border border-slate-200 rounded-sm ${className}`} />;
    case 'floor-black': return <div className={`w-full h-full bg-slate-900 border border-slate-800 rounded-sm ${className}`} />;
    case 'goal': return <div className={`w-full h-full bg-emerald-500/20 border-2 border-emerald-500 rounded-sm flex items-center justify-center ${className}`} style={style}><Flag size={16} className={color ? "" : "text-emerald-600"} style={color ? { color } : {}} /></div>;
    case 'water': return <div className={`w-full h-full bg-blue-400/30 border border-blue-400 rounded-sm ${className}`} />;
    case 'door':
      if (isOpen) {
        return (
          <div className={`w-full h-full bg-slate-800/50 border-2 border-dashed rounded-sm flex items-center justify-center opacity-50 ${className}`}
               style={{ borderColor: color || '#475569' }}>
            <DoorOpen size={20} color={color || '#94a3b8'} />
          </div>
        );
      }
      return <div className={`w-full h-full bg-slate-800 border-2 rounded-sm flex items-center justify-center ${className}`} style={{ borderColor: color || '#475569' }}><DoorOpen size={20} color={color || '#94a3b8'} /></div>;
    case 'paint': return <div className={`w-full h-full border rounded-sm flex items-center justify-center ${className}`} style={{ backgroundColor: color ? `${color}40` : '#e2e8f0', borderColor: color || '#cbd5e1' }}><PaintBucket size={16} color={color || '#64748b'} /></div>;
    case 'ice':
      return (
        <div className={`w-full h-full bg-cyan-200/30 border border-cyan-300/50 rounded-sm flex items-center justify-center ${className}`}>
          <Snowflake size={16} className="text-cyan-400" />
        </div>
      );
    case 'switch':
      return (
        <div
          className={`w-full h-full border-2 rounded-sm flex items-center justify-center ${className}`}
          style={{
            backgroundColor: color ? `${color}20` : '#e2e8f0',
            borderColor: color || '#cbd5e1'
          }}
        >
          <ToggleLeft size={18} color={color || '#64748b'} />
        </div>
      );
    case 'one-way': {
      const rotation = {
        up: 0,
        right: 90,
        down: 180,
        left: 270,
      }[meta?.direction || 'up'];
      return (
        <div className={`w-full h-full bg-amber-500/10 border border-amber-500/40 rounded-sm flex items-center justify-center ${className}`}>
          <ArrowUp
            size={20}
            className="text-amber-400"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </div>
      );
    }
    default: return <div className={`w-full h-full border border-slate-200/50 rounded-sm ${className}`} />;
  }
};
