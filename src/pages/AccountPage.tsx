import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function AccountPage() {
  const { user, profile, loading, signOut, deleteAccount, updateUsername } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile) setUsername(profile.username);
  }, [profile]);

  const handleSaveUsername = async () => {
    if (!username.trim() || username === profile?.username) return;
    setSaving(true);
    await updateUsername(username.trim());
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) return null;

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-8"
      >
        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-purple-500 flex items-center justify-center text-white text-2xl font-bold">
              {profile.username[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{profile.username}</h1>
            <p className="text-sm text-zinc-500">{user.email}</p>
          </div>
        </div>

        {/* Edit username */}
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Username</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={handleSaveUsername}
              disabled={saving || username === profile.username}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Update'}
            </button>
          </div>
        </div>

        {/* Links */}
        <div className="space-y-2">
          <Link
            to="/my-levels"
            className="block w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 text-sm hover:border-zinc-700 transition-colors"
          >
            My Levels
          </Link>
        </div>

        {/* Sign out */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2.5 text-zinc-500 hover:text-red-400 text-sm transition-colors"
          >
            <LogOut size={16} /> Sign out
          </button>
          <button
            onClick={async () => {
              if (!confirm('Delete your account and all your levels? This cannot be undone.')) return;
              const result = await deleteAccount();
              if (result.error) {
                alert('Failed to delete account: ' + result.error);
              } else {
                navigate('/');
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 text-zinc-600 hover:text-red-500 text-xs transition-colors"
          >
            <Trash2 size={14} /> Delete account
          </button>
        </div>
      </motion.div>
    </div>
  );
}
