import { Outlet, Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import Navbar from './Navbar';
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
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-purple-500/20 rounded flex items-center justify-center text-[10px] font-bold text-purple-300 font-mono">L</div>
              <span className="font-mono text-sm font-semibold text-zinc-400">loreval</span>
            </div>
            <div className="flex gap-8 text-sm text-zinc-500">
              <Link to="/designer" className="hover:text-purple-300 transition-colors">Design</Link>
              <Link to="/docs" className="hover:text-purple-300 transition-colors">Docs</Link>
              <a href="https://github.com/integral-quality/loreval" target="_blank" rel="noopener noreferrer" className="hover:text-purple-300 transition-colors flex items-center gap-1.5">
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
