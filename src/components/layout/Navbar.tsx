import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';

const navLinks = [
  { to: '/mission', label: 'Mission' },
  { to: '/designer', label: 'Designer' },
  { to: '/play', label: 'Play' },
  { to: '/account', label: 'Account' },
];

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-purple-500 rounded-lg group-hover:rotate-6 transition-transform flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/20">
              M
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Make Your Game
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label }) => {
              const isActive = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white bg-zinc-800/50 border border-white/5'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/designer"
              className="px-5 py-2.5 bg-purple-500 hover:bg-purple-400 text-white text-sm font-bold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-purple-500/20"
            >
              Build Now
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
