import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const { user, profile, loading } = useAuth();

  const navLinks = [
    { to: '/designer', label: 'Make' },
    { to: '/play', label: 'Play' },
    { to: '/browse', label: 'Browse' },
    ...(user ? [{ to: '/my-levels', label: 'My Levels' }] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-purple-500 rounded-lg group-hover:rotate-6 transition-transform flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/20">
              M
            </div>
            <span className="text-lg font-bold text-white tracking-tight hidden sm:block">
              Make Your Game
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label }) => {
              const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  className={`px-4 py-2 rounded-lg text-[15px] font-medium transition-all ${isActive
                    ? 'text-white bg-zinc-800/60'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                    }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center">
            {!loading && (
              user ? (
                <Link
                  to="/account"
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-sm font-bold">
                      {(profile?.username?.[0] || user.email?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                  <span className="text-[15px] text-zinc-300 hidden sm:block">
                    {profile?.username || 'Account'}
                  </span>
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="px-5 py-2 text-[15px] font-medium text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Sign In
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
