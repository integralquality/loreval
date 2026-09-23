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

export function LogoMark({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-[3px] ${className}`}>
      <div className="rounded-[2px] bg-orange-500" />
      <div className="rounded-[2px] bg-blue-500" />
      <div className="rounded-[2px] bg-zinc-100" />
      <div className="rounded-[2px] bg-emerald-500" />
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
      <nav className="sticky top-0 z-50 bg-paper/90 backdrop-blur-md border-b-2 border-zinc-700">
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
                    className={`px-4 py-1.5 font-mono text-[13px] transition-colors border-b-2 ${
                      isActive
                        ? 'text-zinc-100 border-orange-500'
                        : 'text-zinc-500 border-transparent hover:text-zinc-100'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}

              {/* Separates navigation from the account-ish controls */}
              <span className="w-px h-5 bg-white/15 mx-2" aria-hidden="true" />

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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[13px] border transition-colors ${
                  keyActive
                    ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20'
                    : 'border-zinc-600 text-zinc-400 hover:border-zinc-500 hover:text-zinc-100'
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
