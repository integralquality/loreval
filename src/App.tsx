import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import SiteLayout from './components/layout/SiteLayout';
import HomePage from './pages/HomePage';
import GameDesignerPage from './pages/GameDesignerPage';
import PlayPage from './pages/PlayPage';
import PlayLevelPage from './pages/PlayLevelPage';
import SharedLevelPage from './pages/SharedLevelPage';
import AccountPage from './pages/AccountPage';
import LoginPage from './pages/LoginPage';
import MyLevelsPage from './pages/MyLevelsPage';
import BrowsePage from './pages/BrowsePage';
import PrivacyPage from './pages/PrivacyPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="play" element={<PlayPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<LoginPage defaultSignUp />} />
            <Route path="my-levels" element={<MyLevelsPage />} />
            <Route path="browse" element={<BrowsePage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
          </Route>
          <Route path="play/:levelId" element={<PlayLevelPage />} />
          <Route path="play/s/:shortId" element={<SharedLevelPage />} />
          <Route path="designer" element={<GameDesignerPage />} />
          <Route path="designer/:id" element={<GameDesignerPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
