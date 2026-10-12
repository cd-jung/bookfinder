import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import { renderAt } from '../test/render';
import GuidePage from './GuidePage';
import { GUIDE_PAGES, parsePages } from './pages';
import { slugify } from './slug';

describe('slugify', () => {
  it('matches the backend rule', () => {
    expect(slugify('Logs & Monitoring')).toBe('logs--monitoring');
    expect(slugify('Asking a `question`?')).toBe('asking-a-question');
    expect(slugify('검색 방법')).toBe('검색-방법');
  });
});

describe('guide pages', () => {
  it('parses slugs and titles in file order', () => {
    const pages = parsePages({ '/x/02-b.md': '# Beta\ntext', '/x/01-a.md': 'no heading' });
    expect(pages.map((p) => [p.slug, p.title])).toEqual([
      ['01-a', '01-a'],
      ['02-b', 'Beta'],
    ]);
  });

  it('bundles every docs/user-guide page', () => {
    expect(GUIDE_PAGES.length).toBeGreaterThan(0);
    expect(GUIDE_PAGES.every((p) => p.content.startsWith('# '))).toBe(true);
  });
});

const guideRoutes = (
  <Routes>
    <Route path="/guide" element={<GuidePage />} />
    <Route path="/guide/:page" element={<GuidePage />} />
  </Routes>
);

describe('GuidePage', () => {
  it('shows the first page by default with anchored headings', () => {
    renderAt(guideRoutes, '/guide');
    const first = GUIDE_PAGES[0];
    expect(screen.getByRole('heading', { level: 1, name: first.title })).toBeInTheDocument();
    const h2 = screen.getAllByRole('heading', { level: 2 })[0];
    expect(h2.id).toBe(slugify(h2.textContent ?? ''));
    expect(screen.getByRole('link', { name: first.title })).toHaveAttribute('aria-current', 'page');
  });

  it('opens a page by slug and reports unknown pages', () => {
    const last = GUIDE_PAGES[GUIDE_PAGES.length - 1];
    renderAt(guideRoutes, `/guide/${last.slug}`);
    expect(screen.getByRole('heading', { level: 1, name: last.title })).toBeInTheDocument();
  });

  it('shows a warning for a missing page', () => {
    renderAt(guideRoutes, '/guide/nope');
    expect(screen.getByText('This User Guide page does not exist.')).toBeInTheDocument();
  });
});
