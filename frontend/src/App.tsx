import { Route, Routes } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import HomePage from './pages/HomePage';
import GuidePage from './guide/GuidePage';
import LogsPage from './logs/LogsPage';
import NotFoundPage from './pages/NotFoundPage';

/** Routes. Add a feature page here and a menu entry in layout/navItems.ts. */
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="guide" element={<GuidePage />} />
        <Route path="guide/:page" element={<GuidePage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
