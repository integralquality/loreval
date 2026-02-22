import { Flag, DoorOpen, PaintBucket } from 'lucide-react';
import type { TileType } from '../../types';

export const TileIcon = ({ type, color, className = "" }: { type: TileType, color?: string, className?: string }) => {
  const style = color ? { color, borderColor: color, backgroundColor: `${color}20` } : {};

  switch (type) {
    case 'wall': return <div className={`w-full h-full bg-slate-800 rounded-sm ${className}`} />;
    case 'floor-white': return <div className={`w-full h-full bg-slate-100 border border-slate-200 rounded-sm ${className}`} />;
    case 'floor-black': return <div className={`w-full h-full bg-slate-900 border border-slate-800 rounded-sm ${className}`} />;
    case 'goal': return <div className={`w-full h-full bg-emerald-500/20 border-2 border-emerald-500 rounded-sm flex items-center justify-center ${className}`} style={style}><Flag size={16} className={color ? "" : "text-emerald-600"} style={color ? { color } : {}} /></div>;
    case 'water': return <div className={`w-full h-full bg-blue-400/30 border border-blue-400 rounded-sm ${className}`} />;
    case 'door': return <div className={`w-full h-full bg-slate-800 border-2 rounded-sm flex items-center justify-center ${className}`} style={{ borderColor: color || '#475569' }}><DoorOpen size={20} color={color || '#94a3b8'} /></div>;
    case 'paint': return <div className={`w-full h-full border rounded-sm flex items-center justify-center ${className}`} style={{ backgroundColor: color ? `${color}40` : '#e2e8f0', borderColor: color || '#cbd5e1' }}><PaintBucket size={16} color={color || '#64748b'} /></div>;
    default: return <div className={`w-full h-full border border-slate-200/50 rounded-sm ${className}`} />;
  }
};
