import { motion } from 'motion/react';

export default function PlayPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-600 mb-4">
          Coming soon
        </p>
        <h1 className="text-3xl font-semibold text-white mb-3">Play Games</h1>
        <p className="text-zinc-500 max-w-md">
          Browse and play puzzles created by the community.
        </p>
      </motion.div>
    </div>
  );
}
