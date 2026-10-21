import { Navigate, Route, Routes } from 'react-router-dom';
import { ADMIN_URL, PUBLIC_URL, SITE } from './config';
import OtherSite from './pages/OtherSite';
import AppLayout from './layout/AppLayout';
import SearchPage from './books/SearchPage';
import GuidePage from './guide/GuidePage';
import LogsPage from './logs/LogsPage';
import CoveragePage from './coverage/CoveragePage';
import NotFoundPage from './pages/NotFoundPage';

/** Routes. Add a feature page here and a menu entry in layout/navItems.ts. */
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {SITE === 'admin' ? (
          <Route index element={<Navigate to="/logs" replace />} />
        ) : (
          <Route index element={<SearchPage />} />
        )}
        <Route path="guide" element={SITE === 'admin' ? <OtherSite url={PUBLIC_URL} /> : <GuidePage />} />
        <Route path="guide/:page" element={SITE === 'admin' ? <OtherSite url={PUBLIC_URL} /> : <GuidePage />} />
        <Route path="logs" element={SITE === 'public' ? <OtherSite url={ADMIN_URL} /> : <LogsPage />} />
        <Route path="coverage" element={SITE === 'admin' ? <OtherSite url={PUBLIC_URL} /> : <CoveragePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
