import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage({ defaultSignUp = false }: { defaultSignUp?: boolean }) {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [isSignUp, setIsSignUp] = useState(defaultSignUp);

  useEffect(() => {
    setIsSignUp(defaultSignUp);
  }, [defaultSignUp]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/my-levels', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (isSignUp) {
      const result = await signUp(email, password);
      if (result.error) {
        setError(result.error);
      } else {
        setConfirmSent(true);
      }
    } else {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
      }
    }
    setSubmitting(false);
  };

  if (confirmSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm w-full">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl mx-auto mb-6 flex items-center justify-center text-white text-xl font-bold">
            <Mail size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-3">Check your email</h1>
          <p className="text-zinc-500">
            We sent a confirmation link to <span className="text-zinc-300">{email}</span>. Click it to activate your account.
          </p>
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
        <h1 className="text-3xl font-semibold text-white mb-3">
          {isSignUp ? 'Create account' : 'Sign in'}
        </h1>
        <p className="text-zinc-500 mb-8">
          Save your levels, share them with the world, and play puzzles from other creators.
        </p>

        <form key={isSignUp ? 'signup' : 'signin'} onSubmit={handleSubmit} className="space-y-3 text-left">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              name="email"
              className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              name="password"
              className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {isSignUp && (
            <label className="flex items-start gap-2.5 py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-zinc-900 accent-purple-500"
              />
              <span className="text-xs text-zinc-500 leading-relaxed">
                I agree to the{' '}
                <Link to="/privacy" target="_blank" className="text-purple-400 hover:text-purple-300 underline">
                  Privacy Policy
                </Link>
              </span>
            </label>
          )}

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || (isSignUp && !agreed)}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
          >
            {submitting ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
            {!submitting && <ArrowRight size={16} />}
          </button>
        </form>

        <p className="text-sm text-zinc-500 mt-6">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <Link
            to={isSignUp ? '/login' : '/signup'}
            className="text-purple-400 hover:text-purple-300"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
