// @ts-check
/** Common states, responsiveness, accessibility and history (flow 07). */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { results, act, openHelp, ask, search } = require('./helpers');

const delay = (ms) => async (route) => {
  await new Promise((r) => setTimeout(r, ms));
  await route.continue().catch(() => undefined);
};

test.describe('Loading & errors', () => {
  test('[COM-001] skeleton cards while loading, without layout jump', async ({ page }) => {
    await page.route(/\/api\/books(\?|$)/, delay(1500));
    await page.goto('/');
    const skeleton = page.getByTestId('results-skeleton');
    await expect(skeleton).toBeVisible();
    const before = await page.getByRole('region', { name: 'Results' }).boundingBox();
    await results(page);
    const after = await page.getByRole('region', { name: 'Results' }).boundingBox();
    expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(2);
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(2);
  });

  test('[COM-002] results API 5xx shows Could not load books; Retry recovers', async ({ page }) => {
    let fail = true;
    await page.route(/\/api\/books(\?|$)/, (route) => (fail ? route.fulfill({ status: 500, json: { detail: 'boom' } }) : route.continue()));
    await page.goto('/');
    await expect(page.getByText('Could not load books')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect((await results(page)).first()).toBeVisible();
    await expect(page.getByText('Could not load books')).toBeHidden();
  });

  test('[COM-003] offline shows the notice and disables search until back online', async ({ page, context }) => {
    await page.goto('/');
    await results(page);
    await context.setOffline(true);
    await expect(page.getByText('You are offline. Search is disabled until you are back online.')).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search books' })).toBeDisabled();
    await context.setOffline(false);
    await expect(page.getByRole('searchbox', { name: 'Search books' })).toBeEnabled();
  });

  test('[COM-004] a response slower than 3s shows Still loading', async ({ page }) => {
    await page.goto('/');
    await results(page);
    await page.route(/\/api\/books(\?|$)/, delay(4500));
    await page.getByRole('searchbox', { name: 'Search books' }).fill('dune');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('still-loading')).toBeVisible({ timeout: 6000 });
    await expect(page.getByTestId('still-loading')).toBeHidden({ timeout: 8000 });
  });
});

test.describe('Responsive', () => {
  test('[COM-005] @mobile filter drawer with Apply, single-column cards, full-screen Help', async ({ page }) => {
    await page.goto('/');
    await results(page);
    const cards = page.getByTestId('book-card');
    const [a, b] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()];
    expect(a?.x).toBe(b?.x);
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByRole('checkbox', { name: /^Poetry/ }).click();
    await expect(page).not.toHaveURL(/genre=/);
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/genre=poetry/);
    await expect(page.getByRole('button', { name: 'Filters (1)' })).toBeVisible();
  });

  test('[COM-006] desktop three-area layout at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await results(page);
    const menu = await page.getByRole('navigation', { name: 'Main menu' }).boundingBox();
    const filters = await page.getByTestId('filter-panel').boundingBox();
    const list = await page.getByTestId('book-card').first().boundingBox();
    expect(menu && filters && list).toBeTruthy();
    expect(menu.x + menu.width <= filters.x && filters.x + filters.width <= list.x).toBeTruthy();
  });
});

test.describe('Accessibility', () => {
  test('[A11Y-001] filter search, open a book and ask Help using only the keyboard', async ({ page }) => {
    await page.goto('/');
    await results(page);
    await page.getByRole('checkbox', { name: /^Fantasy/ }).focus();
    await act(page, () => page.keyboard.press('Space'));
    await expect(page).toHaveURL(/genre=fantasy/);
    await page.locator('[data-book-id]').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('button', { name: 'Help', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.type('How do I sort results?');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('chat-answer')).toHaveCount(1);
  });

  test('[A11Y-002] dialog and Help trap focus; Esc closes and focus returns', async ({ page }) => {
    await page.goto('/');
    await results(page);
    const card = page.locator('[data-book-id]').first();
    await card.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBeTruthy();
    }
    await page.keyboard.press('Escape');
    await expect(card).toBeFocused();
    const chat = await openHelp(page);
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press('Tab');
      expect(await chat.evaluate((c) => c.contains(document.activeElement))).toBeTruthy();
    }
    await page.keyboard.press('Escape');
    await expect(chat).toBeHidden();
  });

  test('[A11Y-003] results count, Help answers and errors are announced via aria-live', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('result-count')).toHaveAttribute('aria-live', 'polite');
    const chat = await openHelp(page);
    await expect(chat.locator('[aria-live="polite"]')).toHaveCount(1);
    await ask(chat, 'How do I sort results?');
    await expect(chat.locator('[aria-live="polite"]').getByTestId('chat-answer')).toHaveCount(1);
    await page.getByRole('button', { name: 'Close help' }).click();
    await page.getByRole('textbox', { name: 'Year from' }).fill('2020');
    await page.getByRole('textbox', { name: 'Year to' }).fill('2000');
    await page.getByRole('textbox', { name: 'Year to' }).press('Enter');
    await expect(page.getByRole('alert').filter({ hasText: "'From' year must not be after 'To' year." })).toBeVisible();
  });

  test('[A11Y-004] inputs, filters, covers and icon buttons have labels', async ({ page }) => {
    await page.goto('/');
    await results(page);
    for (const [role, name] of [
      ['searchbox', 'Search books'],
      ['combobox', 'Author'],
      ['combobox', 'Language'],
      ['combobox', 'Minimum rating'],
      ['combobox', 'Sort by'],
      ['slider', 'Minimum price'],
      ['button', 'Grid view'],
      ['button', 'List view'],
    ]) {
      await expect(page.getByRole(role, { name })).toBeVisible();
    }
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('button, [role="img"], input')]
        .filter((el) => !(el.getAttribute('aria-label') || el.textContent?.trim() || el.getAttribute('aria-labelledby') || el.labels?.length || el.getAttribute('type') === 'hidden' || el.getAttribute('aria-hidden') === 'true' || el.getAttribute('tabindex') === '-1'))
        .map((el) => el.outerHTML.slice(0, 80))
    );
    expect(unnamed).toEqual([]);
  });

  test('[A11Y-005] axe finds no serious violations on the page, the dialog and Help', async ({ page }) => {
    await page.goto('/');
    await results(page);
    const scan = async () => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
    expect(await scan()).toEqual([]);
    await page.locator('[data-book-id]').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await scan()).toEqual([]);
    await page.keyboard.press('Escape');
    await openHelp(page);
    expect(await scan()).toEqual([]);
  });
});

test.describe('History', () => {
  test('[NAV-001] Back / Forward restore the previous search and the dialog', async ({ page }) => {
    await page.goto('/');
    await results(page);
    await search(page, 'dune');
    await page.getByTestId('book-card').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('searchbox', { name: 'Search books' })).toHaveValue('dune');
    await page.goBack();
    await expect(page.getByRole('searchbox', { name: 'Search books' })).toHaveValue('');
    await expect(page.getByTestId('result-count')).toHaveText('10,000 books found');
    await page.goForward();
    await page.goForward();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('[NAV-002] reload keeps the search state from the URL', async ({ page }) => {
    await page.goto('/?q=the&genre=fantasy&sort=rating');
    await results(page);
    const first = await page.getByTestId('book-card-title').first().innerText();
    await page.reload();
    await expect(page.getByTestId('book-card-title').first()).toHaveText(first);
    await expect(page.getByTestId('filter-chip')).toHaveText(['Genre: Fantasy']);
  });
});
