import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user arrives via the reset link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError('');
    setSubmitting(true);
    const result = await updatePassword(password);
    if (result.error) {
      setError(result.error);
    } else {
      setDone(true);
      setTimeout(() => navigate('/my-levels', { replace: true }), 2000);
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm w-full">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl mx-auto mb-6 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Lock size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-3">Password updated</h1>
          <p className="text-zinc-500">Redirecting you now...</p>
        </motion.div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm w-full">
          <div className="w-12 h-12 bg-zinc-800 rounded-xl mx-auto mb-6 animate-pulse" />
          <p className="text-zinc-500">Verifying reset link...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-sm w-full"
      >
        <div className="w-12 h-12 bg-purple-500 rounded-xl mx-auto mb-6 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-purple-500/20">
          M
        </div>
        <h1 className="text-3xl font-semibold text-white mb-3">New password</h1>
        <p className="text-zinc-500 mb-8">Choose a new password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
          >
            {submitting ? 'Updating...' : 'Update password'}
            {!submitting && <ArrowRight size={16} />}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
