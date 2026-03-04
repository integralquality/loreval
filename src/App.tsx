import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SiteLayout from './components/layout/SiteLayout';
import HomePage from './pages/HomePage';
import GameDesignerPage from './pages/GameDesignerPage';
import PlayPage from './pages/PlayPage';
import PlayLevelPage from './pages/PlayLevelPage';
import AccountPage from './pages/AccountPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="play" element={<PlayPage />} />
        </Route>
        <Route path="play/:levelId" element={<PlayLevelPage />} />
        <Route path="designer" element={<GameDesignerPage />} />
      </Routes>
    </BrowserRouter>
  );
}
