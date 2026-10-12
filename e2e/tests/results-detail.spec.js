// @ts-check
const { test, expect } = require('@playwright/test');
const { results, act, search, apiBooks, apiBook } = require('./helpers');

test.describe('Results', () => {
  test('[RES-001] N books found and cards with cover, title, author, year, rating, price, availability', async ({ page }) => {
    await page.goto('/');
    const card = (await results(page)).first();
    await expect(page.getByTestId('result-count')).toHaveAttribute('aria-live', 'polite');
    for (const id of ['book-card-title', 'book-card-author', 'book-card-year', 'book-card-rating', 'book-card-price', 'book-card-availability']) {
      await expect(card.getByTestId(id)).not.toBeEmpty();
    }
    await expect(card.getByRole('img')).toHaveCount(1);
  });

  for (const [label, key, compare] of [
    ['Title A-Z', 'book-card-title', (a, b) => a.localeCompare(b) <= 0 || a.toLowerCase() <= b.toLowerCase()],
    ['Highest rated', 'book-card-rating', (a, b) => Number(a) >= Number(b)],
    ['Price low-high', 'book-card-price', (a, b) => Number(a.slice(1)) <= Number(b.slice(1))],
    ['Newest', 'book-card-year', (a, b) => Number(a) >= Number(b)],
    ['Oldest', 'book-card-year', (a, b) => Number(a) <= Number(b)],
  ]) {
    test(`[RES-002] sort ${label} orders the results`, async ({ page }) => {
      await page.goto('/');
      await results(page);
      await page.getByRole('combobox', { name: 'Sort by' }).click();
      await act(page, () => page.getByRole('option', { name: label }).click());
      const values = await page.getByTestId(key).allInnerTexts();
      for (let i = 1; i < values.length; i += 1) expect(compare(values[i - 1], values[i])).toBeTruthy();
    });
  }

  test('[RES-003] 20 per page with Next / Previous / page numbers and page in the URL', async ({ page }) => {
    await page.goto('/');
    expect(await (await results(page)).count()).toBe(20);
    const first = await page.getByTestId('book-card-title').first().innerText();
    await act(page, () => page.getByRole('button', { name: 'Go to next page' }).click());
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('book-card-title').first()).not.toHaveText(first);
    await act(page, () => page.getByRole('button', { name: 'Go to page 3' }).click());
    await expect(page).toHaveURL(/page=3/);
    await act(page, () => page.getByRole('button', { name: 'Go to previous page' }).click());
    await expect(page).toHaveURL(/page=2/);
  });

  test('[RES-004] page beyond the last shows the last valid page', async ({ page }) => {
    await page.goto('/?page=9999');
    await expect(page).toHaveURL(/page=500/);
    await expect(page.getByRole('button', { name: 'page 500', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  test('[RES-005] Grid / List toggle is remembered after reload', async ({ page }) => {
    await page.goto('/');
    await results(page);
    await page.getByRole('button', { name: 'List view' }).click();
    await expect(page.getByTestId('results-list')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('results-list')).toBeVisible();
    await page.getByRole('button', { name: 'Grid view' }).click();
    await expect(page.getByTestId('results-grid')).toBeVisible();
  });

  test('[RES-006] a book without a cover shows the placeholder', async ({ page, request }) => {
    let book;
    for (let p = 1; !book && p < 20; p += 1) book = (await apiBooks(request, { page: String(p) })).results.find((b) => !b.coverColor);
    await page.goto('/');
    await search(page, book.isbn);
    await expect(page.getByTestId('book-card').first().getByTestId('cover-placeholder')).toHaveAccessibleName('No cover available');
  });
});

test.describe('Book detail', () => {
  test('[DET-001] clicking a card opens the dialog with full metadata and book=id', async ({ page }) => {
    await page.goto('/');
    await search(page, 'Dune');
    await page.getByTestId('book-card').filter({ hasText: /^Dune/ }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Dune' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/[?&]book=1\b/);
    await expect(dialog.getByTestId('book-isbn')).toHaveText(/^978\d{10}$/);
    for (const text of ['Frank Herbert', 'Pages', '612', 'Publisher', 'Published', 'Language', 'English', 'Formats', 'Hugo 1966', 'Dune #1 of 3']) {
      await expect(dialog).toContainText(text);
    }
  });

  test('[DET-002] availability per format, out of stock with the expected date', async ({ page, request }) => {
    let target;
    for (let id = 1; !target && id < 400; id += 1) {
      const b = await apiBook(request, id);
      if (b.formats?.some((f) => !f.inStock && f.expectedDate) && b.formats.some((f) => f.inStock)) target = b;
    }
    await page.goto(`/?book=${target.id}`);
    const dialog = page.getByRole('dialog');
    const late = target.formats.find((f) => !f.inStock && f.expectedDate);
    await expect(dialog.getByTestId('book-format').filter({ hasText: late.type })).toContainText(`Out of stock · expected ${late.expectedDate}`);
    const ok = target.formats.find((f) => f.inStock);
    await expect(dialog.getByTestId('book-format').filter({ hasText: ok.type }).first()).toContainText('In stock');
  });

  test('[DET-003] a similar book opens its own detail', async ({ page }) => {
    await page.goto('/?book=1');
    const dialog = page.getByRole('dialog', { name: 'Dune' });
    const similar = dialog.getByTestId('similar-book').first();
    const title = await similar.getByTestId('similar-title').innerText();
    await similar.click();
    await expect(page.getByRole('dialog', { name: title })).toBeVisible();
    await expect(page).not.toHaveURL(/book=1\b/);
  });

  test('[DET-004] clicking the author runs a keyword search for that author', async ({ page }) => {
    await page.goto('/?book=4');
    await act(page, () => page.getByRole('dialog').getByTestId('book-author').first().click());
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('searchbox', { name: 'Search books' })).toHaveValue('Han Kang');
    for (const a of await page.getByTestId('book-card-author').allInnerTexts()) expect(a).toContain('Han Kang');
  });

  test.describe('clipboard', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] });
    test('[DET-005] Copy link and Copy ISBN put the right values on the clipboard', async ({ page }) => {
      await page.goto('/?book=1');
      const dialog = page.getByRole('dialog', { name: 'Dune' });
      const isbn = await dialog.getByTestId('book-isbn').innerText();
      await dialog.getByRole('button', { name: 'Copy ISBN' }).click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(isbn);
      await dialog.getByRole('button', { name: 'Copy link' }).click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/\?book=1$/);
    });
  });

  test('[DET-006] close by X, Esc and backdrop; focus returns to the card; book leaves the URL', async ({ page }) => {
    await page.goto('/');
    await results(page);
    const card = page.locator('[data-book-id]').first();
    for (const close of ['x', 'esc', 'backdrop']) {
      await card.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      if (close === 'x') await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
      if (close === 'esc') await page.keyboard.press('Escape');
      if (close === 'backdrop') await page.mouse.click(5, 400);
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(page).not.toHaveURL(/book=/);
      await expect(card).toBeFocused();
    }
  });

  test('[DET-008] deep link opens the dialog; unknown id shows Book not found', async ({ page }) => {
    await page.goto('/?book=2');
    await expect(page.getByRole('dialog', { name: 'Dune Messiah' })).toBeVisible();
    await page.goto('/?book=999999');
    await expect(page.getByText('Book not found')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect((await results(page)).first()).toBeVisible();
  });
});
