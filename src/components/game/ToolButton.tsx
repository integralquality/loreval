import type { ReactNode } from 'react';

export function ToolButton({ active, onClick, icon, label, tooltip }: { active: boolean, onClick: () => void, icon: ReactNode, label: string, tooltip?: string }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
        active
          ? 'bg-orange-600/20 border border-orange-500 text-orange-300'
          : 'bg-zinc-800 border border-transparent text-zinc-400 hover:bg-zinc-700'
      }`}
    >
      <div className="mb-1">{icon}</div>
      <span className="text-[10px] uppercase font-medium">{label}</span>
    </button>
  );
}
