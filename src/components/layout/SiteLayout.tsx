import { Outlet, Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import Navbar, { LogoMark } from './Navbar';
import { CookieBanner } from '@/components/shared/cookie-banner';

export default function SiteLayout() {
  return (
    <div className="min-h-screen page-ground text-ink flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <CookieBanner />
      <footer className="border-t border-zinc-800 py-10 mt-auto">
        <div className="max-w-page mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <LogoMark className="w-4 h-4" />
              <span className="font-mono text-[13px] font-bold text-zinc-300 tracking-tight">loreval</span>
            </div>
            <div className="flex gap-8 text-[13px] text-zinc-500">
              <Link to="/designer" className="hover:text-zinc-100 transition-colors">design</Link>
              <Link to="/docs" className="hover:text-zinc-100 transition-colors">docs</Link>
              <Link to="/privacy" className="hover:text-zinc-100 transition-colors">privacy</Link>
              <a href="https://github.com/integral-quality/loreval" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-100 transition-colors flex items-center gap-1.5">
                <Github size={12} /> github
              </a>
            </div>
            <p className="text-[12px] text-zinc-600">© 2026 loreval</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
