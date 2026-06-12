import { Outlet, Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import Navbar, { LogoMark } from './Navbar';
import { CookieBanner } from '@/components/shared/cookie-banner';

export default function SiteLayout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <CookieBanner />
      <footer className="border-t border-zinc-800/50 py-12 bg-zinc-950 mt-auto">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <LogoMark className="w-5 h-5" />
              <span className="font-mono text-sm font-semibold text-zinc-400">loreval</span>
            </div>
            <div className="flex gap-8 text-sm text-zinc-500">
              <Link to="/designer" className="hover:text-zinc-200 transition-colors">Design</Link>
              <Link to="/docs" className="hover:text-zinc-200 transition-colors">Docs</Link>
              <Link to="/privacy" className="hover:text-zinc-200 transition-colors">Privacy</Link>
              <a href="https://github.com/integral-quality/loreval" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-200 transition-colors flex items-center gap-1.5">
                <Github size={13} /> GitHub
              </a>
            </div>
            <p className="text-xs text-zinc-600">© 2026 Loreval. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
