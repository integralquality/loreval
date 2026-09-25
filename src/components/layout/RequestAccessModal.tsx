import { X, Mail } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function RequestAccessModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-paper ring-1 ring-zinc-700 rounded-lg w-full max-w-md p-6 shadow-2xl">

        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100 transition-colors">
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 bg-blue-500/15 border border-blue-500/30 rounded flex items-center justify-center">
            <Mail size={15} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100">Request beta access</h2>
            <p className="text-xs text-zinc-500">Managed account — no API key needed</p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
          <p>
            Beta accounts get a managed API budget, puzzle storage, and access to the full evaluation pipeline including the leaderboard once it launches.
          </p>
          <p>
            Send a short note — what you're working on or what you want to evaluate — to:
          </p>
          <a
            href="mailto:access@loreval.ai"
            className="flex items-center gap-2 font-mono text-orange-400 hover:text-orange-300 transition-colors"
          >
            <Mail size={14} /> access@loreval.ai
          </a>
          <p className="text-zinc-500 text-xs">
            In the meantime, use the guest option with your own API key — all features are available.
          </p>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-2 bg-zinc-100 hover:bg-zinc-300 text-paper text-sm font-medium rounded transition-colors"
        >
          Got it
        </button>

      </div>
    </div>
  );
}
