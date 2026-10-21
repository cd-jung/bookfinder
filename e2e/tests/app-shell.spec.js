// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('App shell & navigation', () => {
  test('[SHELL-001] opening / shows the header, the menu and the Help button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toContainText('BookFinder');
    const menu = page.getByRole('navigation', { name: 'Main menu' });
    const labels = ['Book Search', 'User Guide', 'Coverage', 'Logs & Monitoring'];
    for (const label of labels) {
      await expect(menu.getByRole('link', { name: label })).toBeVisible();
    }
    await expect(menu.getByRole('link')).toHaveText(labels);
    await expect(page.getByRole('button', { name: 'Help' })).toBeVisible();
  });

  test('[SHELL-002] menu entries open their pages; Coverage shows the report inside the layout', async ({ page }) => {
    await page.goto('/');
    const menu = page.getByRole('navigation', { name: 'Main menu' });
    await menu.getByRole('link', { name: 'User Guide' }).click();
    await expect(page).toHaveURL(/\/guide$/);
    await menu.getByRole('link', { name: 'Logs & Monitoring' }).click();
    await expect(page.getByRole('heading', { name: 'Logs & Monitoring' })).toBeVisible();
    await menu.getByRole('link', { name: 'Book Search' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.route('**/reports/coverage.html', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="generator" content="coverage-report"></head><body><h1>Report body</h1></body></html>' })
    );
    await menu.getByRole('link', { name: 'Coverage' }).click();
    await expect(page).toHaveURL(/\/coverage$/);
    await expect(page.getByRole('heading', { name: 'Coverage', level: 1 })).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Coverage' })).toHaveAttribute('aria-current', 'page');
    await expect(page.frameLocator('[data-testid="coverage-frame"]').getByRole('heading', { name: 'Report body' })).toBeVisible();
  });

  test('[SHELL-003] @mobile the menu button opens the drawer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeHidden();
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
  });

  test('[SHELL-004] unknown path shows Page not found', async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await page.getByRole('link', { name: 'Go to Home' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('[SHELL-005] @real on the public site Logs & Monitoring links to the admin site; Coverage opens on the public site', async ({ page }) => {
    const admin = process.env.ADMIN_URL;
    test.skip(!admin, 'ADMIN_URL is not set');
    await page.goto('/');
    const menu = page.getByRole('navigation', { name: 'Main menu' });
    await expect(menu.getByRole('link', { name: 'Logs & Monitoring' })).toHaveAttribute('href', `${admin}/logs`);
    await expect(menu.getByRole('link', { name: 'Coverage' })).toHaveAttribute('href', '/coverage');
    await menu.getByRole('link', { name: 'Coverage' }).click();
    await expect(page.frameLocator('[data-testid="coverage-frame"]').getByRole('heading', { level: 1 })).toContainText('Coverage');
  });
});
