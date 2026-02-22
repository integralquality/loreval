import { Play } from 'lucide-react';

export default function PlayPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
      <Play className="w-16 h-16 text-slate-600 mb-6" />
      <h1 className="text-3xl font-bold text-white mb-3">Play Games</h1>
      <p className="text-slate-400 max-w-md">
        Coming soon — browse and play puzzles created by the community.
      </p>
    </div>
  );
}
