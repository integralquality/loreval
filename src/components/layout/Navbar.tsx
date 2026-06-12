import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Key, Github } from 'lucide-react';
import { hasGuestKey } from '../../lib/guestKey';
import { GuestKeyModal } from './GuestKeyModal';
import { RequestAccessModal } from './RequestAccessModal';

const navLinks = [
  { to: '/designer', label: 'Design' },
  // { to: '/play', label: 'Solve' },  // coming soon
  { to: '/docs',     label: 'Docs'   },
];

export default function Navbar() {
  const location = useLocation();
  const [showKeyModal, setShowKeyModal]     = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [keyActive, setKeyActive]           = useState(false);

  useEffect(() => {
    setKeyActive(hasGuestKey());
  }, []);

  const handleKeySaved = () => setKeyActive(hasGuestKey());

  return (
    <>
      <nav className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/40">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">

            {/* Logo */}
            <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3 group">
              <div className="relative w-7 h-7 flex items-center justify-center">
                <div className="absolute inset-0 bg-purple-500/20 rounded rotate-45 group-hover:rotate-[55deg] transition-transform duration-300" />
                <span className="relative text-purple-300 font-mono font-bold text-sm">L</span>
              </div>
              <span className="font-mono text-sm font-semibold text-zinc-200 tracking-tight hidden sm:block">
                loreval<span className="text-purple-400">.</span>ai
              </span>
            </Link>

            {/* Nav links */}
            <div className="flex items-center gap-0.5">
              {navLinks.map(({ to, label }) => {
                const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`relative px-4 py-1.5 font-mono text-[13px] transition-all rounded ${
                      isActive ? 'text-purple-300' : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {isActive && <span className="absolute inset-0 rounded bg-purple-500/10 border border-purple-500/20" />}
                    <span className="relative">{label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1">
              <a
                href="https://github.com/integral-quality/loreval"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-zinc-500 hover:text-zinc-200 transition-colors"
                title="Open source CLI on GitHub"
              >
                <Github size={17} />
              </a>

              <button
                onClick={() => setShowAccessModal(true)}
                className="font-mono text-[13px] text-zinc-600 hover:text-zinc-300 transition-colors hidden sm:block"
              >
                Request access
              </button>

              <button
                onClick={() => setShowKeyModal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[13px] border transition-all ${
                  keyActive
                    ? 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                <Key size={13} />
                <span className="hidden sm:block">{keyActive ? 'Key active' : 'Add API key'}</span>
              </button>
            </div>

          </div>
        </div>
      </nav>

      {showKeyModal    && <GuestKeyModal    onClose={() => setShowKeyModal(false)}    onSave={handleKeySaved} />}
      {showAccessModal && <RequestAccessModal onClose={() => setShowAccessModal(false)} />}
    </>
  );
}
