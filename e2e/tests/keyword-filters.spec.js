// @ts-check
const { test, expect } = require('@playwright/test');
const { results, act, search, apiBooks } = require('./helpers');

const titles = (page) => page.getByTestId('book-card-title').allInnerTexts();

test.describe('Keyword search', () => {
  test('[KW-001] keyword search by title returns matching books and updates q', async ({ page }) => {
    await page.goto('/');
    await search(page, 'dune');
    await expect(page).toHaveURL(/[?&]q=dune/);
    await results(page);
    const found = await titles(page);
    expect(found.length).toBeGreaterThan(0);
    for (const title of found) expect(title.toLowerCase()).toContain('dune');
  });

  for (const [field, keyword, check] of [
    ['author', 'Haruki Murakami', /Murakami/],
    ['publisher', 'Northwind Press', null],
    ['description', 'old magic is waking', null],
  ]) {
    test(`[KW-002] keyword matches ${field}`, async ({ page, request }) => {
      await page.goto('/');
      await search(page, keyword);
      const api = await apiBooks(request, { q: keyword });
      expect(api.total).toBeGreaterThan(0);
      await expect(page.getByTestId('result-count')).toHaveText(`${api.total.toLocaleString('en-US')} ${api.total === 1 ? 'book' : 'books'} found`);
      if (check) for (const a of await page.getByTestId('book-card-author').allInnerTexts()) expect(a).toMatch(check);
    });
  }

  test('[KW-003] ISBN with or without hyphens returns that book first', async ({ page, request }) => {
    const dune = (await apiBooks(request, { q: 'Dune' })).results.find((b) => b.title === 'Dune');
    for (const query of [dune.isbn, `${dune.isbn.slice(0, 3)}-${dune.isbn.slice(3, 6)}-${dune.isbn.slice(6)}`]) {
      await page.goto('/');
      await search(page, query);
      await expect(page.getByTestId('book-card-title').first()).toHaveText('Dune');
    }
  });

  test('[KW-004] Enter and the search icon both search; clear (x) resets', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search books' }).fill('kafka');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/q=kafka/);
    await expect(page.getByTestId('book-card-title').first()).toHaveText('Kafka on the Shore');
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(page.getByTestId('result-count')).toHaveText('10,000 books found');
  });

  test('[KW-005] special characters and very long keywords do not break the search', async ({ page }) => {
    await page.goto('/');
    await search(page, `%_'";--<script>`);
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await search(page, 'x'.repeat(300));
    await expect(page.getByTestId('result-count')).toHaveText('0 books found');
  });
});

test.describe('Filters', () => {
  test('[FLT-001] two genres return books in either genre', async ({ page }) => {
    await page.goto('/');
    await results(page);
    await act(page, () => page.getByRole('checkbox', { name: /^Poetry/ }).click());
    await act(page, () => page.getByRole('checkbox', { name: /^Children/ }).click());
    await expect(page).toHaveURL(/genre=poetry%2Cchildren|genre=poetry,children/);
    await expect(page.getByRole('checkbox', { name: /^Poetry/ })).toBeChecked();
    const ids = await page.locator('[data-book-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-book-id')));
    expect(ids.length).toBe(20);
    await expect(page.getByTestId('filter-chip')).toHaveText(['Genre: Poetry', 'Genre: Children']);
  });

  test('[FLT-002] author autocomplete suggests after 2 characters and filters', async ({ page }) => {
    await page.goto('/');
    const author = page.getByRole('combobox', { name: 'Author' });
    await author.fill('h');
    await expect(page.getByText('Type at least 2 characters')).toBeVisible();
    await author.fill('han k');
    await act(page, () => page.getByRole('option', { name: 'Han Kang' }).click());
    await expect(page).toHaveURL(/author=Han\+Kang|author=Han%20Kang/);
    for (const a of await page.getByTestId('book-card-author').allInnerTexts()) expect(a).toContain('Han Kang');
  });

  test('[FLT-003] publication year range limits results (inclusive)', async ({ page }) => {
    await page.goto('/?year_from=2015&year_to=2018');
    await results(page);
    const years = (await page.getByTestId('book-card-year').allInnerTexts()).map(Number);
    expect(years.length).toBeGreaterThan(0);
    years.forEach((year) => expect(year >= 2015 && year <= 2018).toBeTruthy());
  });

  test('[FLT-004] year from after to shows an inline error and is not applied', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Year from' }).fill('2020');
    await page.getByRole('textbox', { name: 'Year to' }).fill('2010');
    await page.getByRole('textbox', { name: 'Year to' }).press('Enter');
    await expect(page.getByTestId('year-error')).toBeVisible();
    await expect(page).not.toHaveURL(/year_to=/);
  });

  test('[FLT-005] language, format and minimum rating each narrow the results', async ({ page, request }) => {
    await page.goto('/');
    await results(page);
    await page.getByRole('combobox', { name: 'Language' }).click();
    await act(page, () => page.getByRole('option', { name: /^Japanese/ }).click());
    for (const l of await page.getByTestId('book-card-language').allInnerTexts()) expect(l).toBe('Japanese');
    await act(page, () => page.getByRole('checkbox', { name: /^Audiobook/ }).click());
    await page.getByRole('combobox', { name: 'Minimum rating' }).click();
    await act(page, () => page.getByRole('option', { name: '4+ stars' }).click());
    await expect(page).toHaveURL(/min_rating=4/);
    const api = await apiBooks(request, { language: 'Japanese', format: 'Audiobook', min_rating: '4' });
    await expect(page.getByTestId('result-count')).toHaveText(`${api.total.toLocaleString('en-US')} books found`);
    for (const r of (await page.getByTestId('book-card-rating').allInnerTexts()).map(Number)) expect(r).toBeGreaterThanOrEqual(4);
  });

  test('[FLT-006] In stock only hides out-of-stock books', async ({ page }) => {
    await page.goto('/');
    await results(page);
    await act(page, () => page.getByRole('switch', { name: 'In stock only' }).click());
    await expect(page).toHaveURL(/in_stock=1/);
    for (const badge of await page.getByTestId('book-card-availability').allInnerTexts()) expect(badge).toBe('In stock');
  });

  test('[FLT-007] price slider limits results to the selected band', async ({ page }) => {
    await page.goto('/');
    await results(page);
    const min = page.getByRole('slider', { name: 'Minimum price' });
    await min.focus();
    for (let i = 0; i < 9; i += 1) await min.press('ArrowRight');
    await act(page, () => min.press('ArrowRight'));
    const max = page.getByRole('slider', { name: 'Maximum price' });
    await max.focus();
    await max.press('PageDown');
    await act(page, () => max.press('PageDown'));
    await expect(page).toHaveURL(/price_min=\d+.*price_max=\d+/);
    const url = new URL(page.url());
    const lo = Number(url.searchParams.get('price_min'));
    const hi = Number(url.searchParams.get('price_max'));
    for (const p of await page.getByTestId('book-card-price').allInnerTexts()) {
      const value = Number(p.replace('$', ''));
      expect(value >= lo && value <= hi).toBeTruthy();
    }
  });

  test('[FLT-008] keyword combined with several filters applies all of them', async ({ page }) => {
    await page.goto('/?q=the&genre=fantasy&language=English&in_stock=1');
    await results(page);
    const languages = await page.getByTestId('book-card-language').allInnerTexts();
    expect(languages.length).toBeGreaterThan(0);
    languages.forEach((l) => expect(l).toBe('English'));
    for (const badge of await page.getByTestId('book-card-availability').allInnerTexts()) expect(badge).toBe('In stock');
    await expect(page.getByTestId('filter-chip')).toHaveText(['Genre: Fantasy', 'Language: English', 'In stock only']);
  });

  test('[FLT-009] facet counts follow the current results', async ({ page, request }) => {
    await page.goto('/?language=Korean');
    await results(page);
    const api = await apiBooks(request, { language: 'Korean' });
    await expect(page.getByRole('checkbox', { name: `Poetry (${api.facets.genre.poetry ?? 0})` })).toBeVisible();
  });
});

test.describe('Chips & empty results', () => {
  test('[CHIP-001] each filter is a chip; removing a chip removes the filter', async ({ page }) => {
    await page.goto('/?genre=fantasy&language=French');
    await expect(page.getByTestId('filter-chip')).toHaveText(['Genre: Fantasy', 'Language: French']);
    await page.getByTestId('filter-chip').filter({ hasText: 'Language: French' }).locator('svg').click();
    await expect(page).not.toHaveURL(/language=/);
    await expect(page.getByTestId('filter-chip')).toHaveText(['Genre: Fantasy']);
  });

  test('[CHIP-002] Clear all removes all filters and the keyword', async ({ page }) => {
    await page.goto('/?q=the&genre=fantasy&in_stock=1');
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page.getByTestId('filter-chip')).toHaveCount(0);
    await expect(page.getByRole('searchbox', { name: 'Search books' })).toHaveValue('');
    await expect(page.getByTestId('result-count')).toHaveText('10,000 books found');
  });

  test('[EMP-001] no match shows No books match with the shortcuts', async ({ page }) => {
    await page.goto('/?q=zzzzqqqq&genre=poetry');
    await expect(page.getByTestId('empty-state')).toContainText('No books match');
    await expect(page.getByRole('button', { name: 'Remove last filter' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get help' })).toBeVisible();
  });

  test('[EMP-002] Remove last filter brings back results', async ({ page }) => {
    await page.goto('/?language=German&genre=poetry&year_from=1950&year_to=1950&min_rating=5');
    await expect(page.getByTestId('empty-state')).toBeVisible();
    for (let i = 0; i < 5 && (await page.getByTestId('empty-state').isVisible()); i += 1) {
      await act(page, () => page.getByRole('button', { name: 'Remove last filter' }).click());
    }
    await expect(page.getByTestId('book-card').first()).toBeVisible();
  });

  test('[EMP-003] Get help opens Help prefilled with a search-tips question', async ({ page }) => {
    await page.goto('/?q=zzzzqqqq');
    await page.getByRole('button', { name: 'Get help' }).click();
    const chat = page.getByRole('complementary', { name: 'Help chat' });
    await expect(chat.getByRole('textbox', { name: 'Ask a question' })).toHaveValue('How can I find books when my search shows no results?');
  });
});
