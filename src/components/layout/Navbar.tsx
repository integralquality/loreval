import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Key, Github } from 'lucide-react';
import { hasAnyCredential, configuredProviderIds } from '../../lib/credentials';
import { ApiKeysModal } from './ApiKeysModal';

const navLinks = [
  { to: '/designer', label: 'design' },
  { to: '/eval',     label: 'eval'   },
  // { to: '/play', label: 'solve' },  // coming soon
  { to: '/docs',     label: 'docs'   },
];

/**
 * Four tiles, in the game's own agent colours.
 *
 * These are the literal hexes from TileIcon's colour map rather than the
 * `orange-500`/`blue-500` utilities they used to be, because the UI palette
 * is deliberately a step quieter than the game palette — drawn from chrome
 * tokens the mark would have drifted muddy while the board stayed vivid.
 */
const MARK_COLORS = ['#fb923c', '#60a5fa', '#e8eaec', '#6ee7b7'];

export function LogoMark({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-[3px] ${className}`}>
      {MARK_COLORS.map(hex => (
        <div key={hex} className="rounded-[1px]" style={{ backgroundColor: hex }} />
      ))}
    </div>
  );
}

export default function Navbar() {
  const location = useLocation();
  const [showKeyModal, setShowKeyModal]     = useState(false);
  const [keyActive, setKeyActive]           = useState(() => hasAnyCredential());
  const [keyCount, setKeyCount]             = useState(() => configuredProviderIds().length);

  const handleKeySaved = () => {
    setKeyActive(hasAnyCredential());
    setKeyCount(configuredProviderIds().length);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-paper/80 backdrop-blur-xl border-b border-zinc-800">
        <div className="max-w-page mx-auto px-6">
          <div className="flex items-center justify-between h-14">

            {/* Logo */}
            <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3 group">
              <div className="group-hover:rotate-90 transition-transform duration-300">
                <LogoMark />
              </div>
              <span className="font-mono text-sm font-bold text-zinc-100 tracking-tight hidden sm:block">
                loreval<span className="text-orange-400">.</span>ai
              </span>
            </Link>

            {/* Everything else sits together on the right, so the logo owns
                the left edge and the width of the bar is dead space rather
                than a gap between two clusters of controls. */}
            <div className="flex items-center gap-1">
              {navLinks.map(({ to, label }) => {
                const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`relative px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                      isActive ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {label}
                    {/* A hairline tick under the label, inset to the word's
                        width rather than the hit area, so the marker points at
                        the link instead of underlining the padding. */}
                    {isActive && (
                      <span
                        className="absolute left-3.5 right-3.5 -bottom-px h-px bg-orange-500"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                );
              })}

              {/* Separates navigation from the account-ish controls */}
              <span className="w-px h-4 bg-zinc-700 mx-2.5" aria-hidden="true" />

              <a
                href="https://github.com/integral-quality/loreval"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-zinc-500 hover:text-zinc-100 transition-colors"
                title="Loreval on GitHub"
              >
                <Github size={17} />
              </a>

              <button
                onClick={() => setShowKeyModal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[13px] font-medium border transition-colors ${
                  keyActive
                    ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100'
                }`}
              >
                <Key size={13} />
                <span className="hidden sm:block">
                  {keyActive ? `${keyCount} key${keyCount === 1 ? '' : 's'}` : 'add API key'}
                </span>
              </button>
            </div>

          </div>
        </div>
      </nav>

      {showKeyModal && <ApiKeysModal onClose={() => setShowKeyModal(false)} onSave={handleKeySaved} />}
    </>
  );
}
