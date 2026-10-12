// @ts-check
const { test, expect } = require('@playwright/test');
const { results } = require('./helpers');

test.describe('Page load & layout', () => {
  test('[PAGE-001] opening / shows the header, search tabs, filter panel, popular books and Help', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toContainText('BookFinder');
    await expect(page.getByRole('tab', { name: 'Keyword & filters' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Ask in plain language (AI)' })).toBeVisible();
    await expect(page.getByTestId('filter-panel')).toBeVisible();
    await expect((await results(page)).first()).toBeVisible();
    await expect(page.getByTestId('result-count')).toHaveText('10,000 books found');
    await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeVisible();
  });

  test('[PAGE-002] Keyword & filters tab is selected by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('tab', { name: 'Keyword & filters' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('searchbox', { name: 'Search books' })).toBeVisible();
  });

  test('[PAGE-003] clicking the BookFinder logo resets to a clean /', async ({ page }) => {
    await page.goto('/?q=dune&genre=fantasy&sort=title&page=2');
    await page.getByRole('banner').getByRole('link', { name: 'BookFinder' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('result-count')).toHaveText('10,000 books found');
    await expect(page.getByRole('searchbox', { name: 'Search books' })).toHaveValue('');
  });

  test('[PAGE-004] facet load failure shows the error banner; Retry recovers', async ({ page }) => {
    let fail = true;
    await page.route('**/api/books/facets*', (route) => (fail ? route.fulfill({ status: 500, json: { detail: 'down' } }) : route.continue()));
    await page.goto('/');
    await expect(page.getByText('Could not load the catalogue filters.')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByTestId('filter-panel')).toBeVisible();
    await expect(page.getByText('Could not load the catalogue filters.')).toBeHidden();
  });

  test('[PAGE-005] q / filters / sort / page in the URL restore that search', async ({ page }) => {
    await page.goto('/?q=the&language=Korean&sort=title&page=2');
    await results(page);
    await expect(page.getByRole('searchbox', { name: 'Search books' })).toHaveValue('the');
    await expect(page.getByTestId('filter-chip')).toHaveText(['Language: Korean']);
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveText('Title A-Z');
    await expect(page.getByRole('button', { name: 'page 2', exact: true })).toHaveAttribute('aria-current', 'page');
    for (const language of await page.getByTestId('book-card-language').allInnerTexts()) expect(language).toBe('Korean');
  });

  test('[PAGE-006] mode=nl&q=... runs the natural language search', async ({ page }) => {
    await page.goto('/?mode=nl&q=' + encodeURIComponent('fantasy or sci-fi, but not audiobooks'));
    await expect(page.getByRole('tab', { name: 'Ask in plain language (AI)' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('status')).toContainText('Interpreted as: ((genre is fantasy OR genre is science-fiction) AND NOT format is Audiobook)');
    await results(page);
  });

  test('[PAGE-007] book=id opens that book', async ({ page }) => {
    await page.goto('/?book=1');
    await expect(page.getByRole('dialog', { name: 'Dune' })).toBeVisible();
  });

  test('[PAGE-008] unknown params and invalid values fall back to defaults', async ({ page }) => {
    await page.goto('/?page=-1&sort=foo&min_rating=9&year_from=abc&colour=blue');
    await expect(page.getByTestId('result-count')).toHaveText('10,000 books found');
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveText('Relevance');
    await expect(page.getByTestId('filter-chip')).toHaveCount(0);
  });

  test('[PAGE-009] @mobile Filters opens a drawer; Help opens full screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('filter-panel')).toBeHidden();
    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.getByTestId('filter-panel')).toBeVisible();
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    const chat = page.getByRole('complementary', { name: 'Help chat' });
    const box = await chat.boundingBox();
    const viewport = page.viewportSize();
    expect(box?.width).toBe(viewport?.width);
    expect(box?.height).toBe(viewport?.height);
  });

  test('[PAGE-010] desktop shows the filter panel on the left of the results', async ({ page }) => {
    await page.goto('/');
    await results(page);
    const panel = await page.getByTestId('filter-panel').boundingBox();
    const list = await page.getByTestId('book-card').first().boundingBox();
    expect(panel && list && panel.x + panel.width <= list.x).toBeTruthy();
  });
});
