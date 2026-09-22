import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/shared/error-boundary';
import SiteLayout from './components/layout/SiteLayout';
import HomePage from './pages/HomePage';
import GameDesignerPage from './pages/GameDesignerPage';
import PlayPage from './pages/PlayPage';
import PlayLevelPage from './pages/PlayLevelPage';
import SharedLevelPage from './pages/SharedLevelPage';
import BrowsePage from './pages/BrowsePage';
import PrivacyPage from './pages/PrivacyPage';
import DocsPage from './pages/DocsPage';
import EvalPage from './pages/EvalPage';

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="play" element={<PlayPage />} />
            <Route path="browse" element={<BrowsePage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="eval" element={<EvalPage />} />
            {/* Account routes (login, signup, my-levels, account, reset-password)
                are unrouted until authentication ships. The pages still live in
                src/pages — re-add the <Route> entries to bring them back. */}
          </Route>
          <Route path="play/:levelId" element={<PlayLevelPage />} />
          <Route path="play/s/:shortId" element={<SharedLevelPage />} />
          <Route path="designer" element={<GameDesignerPage />} />
          <Route path="designer/:id" element={<GameDesignerPage />} />
          {/* Anything unmatched — including the unrouted account pages and any
              stale /login bookmark — lands on home rather than a blank screen. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
