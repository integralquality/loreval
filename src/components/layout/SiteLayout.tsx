import { Outlet, Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import Navbar, { LogoMark } from './Navbar';
import { CookieBanner } from '@/components/shared/cookie-banner';

export default function SiteLayout() {
  return (
    <div className="min-h-screen graph-paper text-ink flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <CookieBanner />
      <footer className="border-t-2 border-zinc-900 py-10 mt-auto">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <LogoMark className="w-5 h-5" />
              <span className="font-mono text-sm font-bold text-zinc-900">loreval</span>
            </div>
            <div className="flex gap-8 font-mono text-xs text-zinc-500">
              <Link to="/designer" className="hover:text-zinc-900 transition-colors">design</Link>
              <Link to="/docs" className="hover:text-zinc-900 transition-colors">docs</Link>
              <Link to="/privacy" className="hover:text-zinc-900 transition-colors">privacy</Link>
              <a href="https://github.com/integral-quality/loreval" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 transition-colors flex items-center gap-1.5">
                <Github size={12} /> github
              </a>
            </div>
            <p className="font-mono text-[11px] text-zinc-400">© 2026 loreval</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
