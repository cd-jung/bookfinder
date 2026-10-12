// @ts-check
const { test, expect } = require('@playwright/test');
const { llmDown } = require('./helpers');

/** Create some log traffic: successful and failing API requests. */
async function traffic(request) {
  for (let i = 0; i < 3; i += 1) await request.get('http://127.0.0.1:8000/api/health');
  await request.get('http://127.0.0.1:8000/api/e2e-missing-path');
}

test.describe('Logs & Monitoring', () => {
  test.beforeEach(async ({ request }) => traffic(request));

  test('[LOGS-001] dashboard shows the cards and the hourly chart', async ({ page }) => {
    await page.goto('/logs');
    const dashboard = page.getByRole('region', { name: 'Dashboard' });
    await expect(dashboard.getByTestId('stat-requests')).toHaveText(/^[1-9]\d*$/);
    await expect(dashboard.getByTestId('stat-error-rate')).toHaveText(/%$/);
    await expect(dashboard.getByTestId('stat-p95')).toHaveText(/ms$/);
    await expect(dashboard.getByTestId('stat-client-errors')).toHaveText(/^[1-9]\d*$/);
    await expect(dashboard.getByText('Requests per hour')).toBeVisible();
  });

  test('[LOGS-002] plain language question shows Interpreted as and matching rows only', async ({ page }) => {
    await page.goto('/logs');
    await page.getByRole('textbox', { name: 'Search logs in plain language' }).fill('4xx or 5xx responses');
    const filtered = page.waitForResponse((r) => r.url().includes('/api/logs/?nl_filter='));
    await page.keyboard.press('Enter');
    await filtered;
    await expect(page.getByRole('status')).toContainText('Interpreted as: (status class(class=4xx) OR status class(class=5xx))');
    const statuses = page.getByTestId('log-status');
    await expect(statuses.first()).toBeVisible();
    await expect.poll(async () => (await statuses.allInnerTexts()).every((text) => Number(text) >= 400)).toBe(true);
  });

  test('[LOGS-003] a question that is not about logs asks to rephrase', async ({ page }) => {
    await page.goto('/logs');
    await page.getByRole('textbox', { name: 'Search logs in plain language' }).fill('what is the weather in Seoul');
    await page.keyboard.press('Enter');
    await expect(page.getByText('The question could not be translated. Please rephrase it.')).toBeVisible();
  });

  test('[LOGS-004] LLM unavailable shows the AI unavailable message', async ({ page }) => {
    await llmDown(page);
    await page.goto('/logs');
    await page.getByRole('textbox', { name: 'Search logs in plain language' }).fill('errors in the last hour');
    await page.keyboard.press('Enter');
    await expect(page.getByText('The AI search is unavailable. Use keyword search instead.')).toBeVisible();
  });

  test('[LOGS-005] keyword and level narrow the table', async ({ page }) => {
    await page.goto('/logs');
    await page.getByRole('tab', { name: 'Keyword' }).click();
    await page.getByRole('searchbox', { name: 'Search logs by keyword' }).fill('e2e-missing-path');
    await page.keyboard.press('Enter');
    await page.getByRole('combobox', { name: 'Level' }).click();
    await page.getByRole('option', { name: 'WARN' }).click();
    const rows = page.getByTestId('log-row');
    await expect(rows.first()).toBeVisible();
    for (const text of await rows.allInnerTexts()) {
      expect(text).toContain('/api/e2e-missing-path');
      expect(text).toContain('WARN');
    }
  });

  test('[LOGS-006] changing the time range reloads the dashboard', async ({ page }) => {
    await page.goto('/logs');
    const reload = page.waitForRequest((r) => r.url().includes('/api/logs/stats?hours=1'));
    await page.getByRole('combobox', { name: 'Time range' }).click();
    await page.getByRole('option', { name: 'Last 1 h' }).click();
    await reload;
    await expect(page.getByTestId('stat-requests')).toBeVisible();
  });

  test('[LOGS-007] dashboard API error shows the message with Retry', async ({ page }) => {
    await page.route('**/api/logs/stats**', (route) => route.fulfill({ status: 500, json: { detail: 'Server error' } }));
    await page.goto('/logs');
    await expect(page.getByText('Server error')).toBeVisible();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByTestId('stat-requests')).toBeVisible();
  });

  test('[LOGS-008] no matching logs shows the empty message', async ({ page }) => {
    await page.goto('/logs');
    await page.getByRole('tab', { name: 'Keyword' }).click();
    await page.getByRole('searchbox', { name: 'Search logs by keyword' }).fill('no-such-path-xyz');
    await page.keyboard.press('Enter');
    await expect(page.getByText('No log entries match.')).toBeVisible();
  });

  test('[LOGS-009] resource headroom shows a % gauge with a status label', async ({ page }) => {
    await page.goto('/logs');
    const gauge = page.getByTestId('gauge-latencyP95');
    await expect(gauge).toBeVisible();
    await expect(page.getByTestId('gauge-latencyP95-percent')).toHaveText(/^\d+(\.\d+)? ?%$/);
    await expect(gauge.getByText(/^(OK|Watch|Critical)$/)).toBeVisible();
    await expect(page.getByTestId('gauge-aiBudget')).toBeVisible();
  });
});

// Runs on the deployed site only: no local log traffic is needed (and no local API exists there).
test.describe('Logs & Monitoring access', () => {
  test('[LOGS-010] @real admin API answers 403 without a Cloudflare Access sign-in', async ({ request }) => {
    const admin = process.env.ADMIN_URL;
    test.skip(!admin, 'ADMIN_URL is not set');
    const response = await request.get(`${admin}/api/logs/stats`, { maxRedirects: 0 });
    // 403 from the admin Worker before Access is on; a 302 to the Access sign-in page once it is.
    expect([302, 403]).toContain(response.status());
  });
});
