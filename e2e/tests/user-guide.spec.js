// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('User Guide', () => {
  test('[GUIDE-001] page list and first page; clicking a page opens it', async ({ page }) => {
    await page.goto('/guide');
    const pages = page.getByRole('navigation', { name: 'User Guide pages' });
    await expect(pages.getByRole('link').first()).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('guide-article').getByRole('heading', { level: 1 })).toBeVisible();
    const second = pages.getByRole('link').nth(1);
    const title = await second.innerText();
    await second.click();
    await expect(page.getByTestId('guide-article').getByRole('heading', { level: 1 })).toHaveText(title);
  });

  test('[GUIDE-002] deep link scrolls to the section heading', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto('/guide/03-logs-and-monitoring#keyword-search');
    await expect(page.locator('#keyword-search')).toBeInViewport();
  });

  test('[GUIDE-003] unknown page shows a warning', async ({ page }) => {
    await page.goto('/guide/not-a-page');
    await expect(page.getByText('This User Guide page does not exist.')).toBeVisible();
  });
});
