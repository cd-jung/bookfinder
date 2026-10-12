// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('App shell & navigation', () => {
  test('[SHELL-001] opening / shows the header, the menu and the Help button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toBeVisible();
    const menu = page.getByRole('navigation', { name: 'Main menu' });
    for (const label of ['Home', 'User Guide', 'Logs & Monitoring', 'Coverage']) {
      await expect(menu.getByRole('link', { name: label })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Help' })).toBeVisible();
  });

  test('[SHELL-002] menu entries open their pages; Coverage links to the static report', async ({ page }) => {
    await page.goto('/');
    const menu = page.getByRole('navigation', { name: 'Main menu' });
    await menu.getByRole('link', { name: 'User Guide' }).click();
    await expect(page).toHaveURL(/\/guide$/);
    await menu.getByRole('link', { name: 'Logs & Monitoring' }).click();
    await expect(page.getByRole('heading', { name: 'Logs & Monitoring' })).toBeVisible();
    await menu.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(menu.getByRole('link', { name: 'Coverage' })).toHaveAttribute('href', '/coverage/');
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
});
