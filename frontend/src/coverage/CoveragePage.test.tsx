import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderAt } from '../test/render';
import CoveragePage, { REPORT_URL } from './CoveragePage';

const respond = (body: string, status = 200) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status }));

describe('CoveragePage', () => {
  it('shows the report inside the page when it exists', async () => {
    respond('<meta name="generator" content="coverage-report">');
    renderAt(<CoveragePage />);
    expect(await screen.findByTitle('Coverage report')).toHaveAttribute('src', REPORT_URL);
    expect(screen.getByRole('link', { name: 'Open in a new tab' })).toHaveAttribute('href', REPORT_URL);
  });

  it.each([
    ['the dev server answers with the app', () => respond('<div id="root"></div>')],
    ['the report is missing', () => respond('', 404)],
    ['the request fails', () => vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))],
  ])('explains how to build it when %s', async (_case, mock) => {
    mock();
    renderAt(<CoveragePage />);
    expect(await screen.findByText(/has not been built yet/)).toBeInTheDocument();
    expect(screen.queryByTitle('Coverage report')).not.toBeInTheDocument();
  });
});
