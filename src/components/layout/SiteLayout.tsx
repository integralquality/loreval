import { Outlet, Link } from 'react-router-dom';
import Navbar from './Navbar';

export default function SiteLayout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-zinc-800/50 py-12 bg-zinc-950 mt-auto">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center text-[10px] font-bold">M</div>
              <span className="text-sm font-semibold text-zinc-400">Make Your Game</span>
            </div>
            <div className="flex gap-8 text-sm text-zinc-500">
              <Link to="/play" className="hover:text-purple-300">Explore</Link>
              <Link to="/browse" className="hover:text-purple-300">Browse</Link>
              <Link to="/designer" className="hover:text-purple-300">Build</Link>
              <Link to="/my-levels" className="hover:text-purple-300">My Levels</Link>
              <Link to="/account" className="hover:text-purple-300">Account</Link>
            </div>
            <p className="text-xs text-zinc-600">© 2026 Logic Playground. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
