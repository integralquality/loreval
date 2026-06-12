import type { ReactNode } from 'react';

export function ToolButton({ active, onClick, icon, label, tooltip }: { active: boolean, onClick: () => void, icon: ReactNode, label: string, tooltip?: string }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`flex flex-col items-center justify-center p-1.5 rounded-md transition-all border ${
        active
          ? 'border-zinc-900 bg-white'
          : 'border-zinc-900/15 bg-white/50 hover:border-zinc-900/50'
      }`}
    >
      {/* Dark mini-well keeps tile art legible on the light chrome */}
      <div className="mb-1 w-9 h-9 rounded bg-zinc-950 flex items-center justify-center">{icon}</div>
      <span className={`text-[10px] uppercase font-medium ${active ? 'text-zinc-900' : 'text-zinc-500'}`}>{label}</span>
    </button>
  );
}
