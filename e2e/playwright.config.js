// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * E2E runs against the local stack: Django (SQLite, LLM_MODE=stub) on :8000 and Vite on :5173.
 * Both are started automatically unless APP_BASE_URL points at an already running app.
 * LLM failure contexts (llm_down, api_down) use route interception inside the tests.
 * Tests tagged @real need the real model: they run only in the `deployed` project, which CD runs after
 * deploying (DEPLOYED_URL = the live site).
 */
const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';
const DEPLOYED_URL = process.env.DEPLOYED_URL;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: '../coverage/e2e/results.json' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: DEPLOYED_URL
    ? [{ name: 'deployed', use: { ...devices['Desktop Chrome'], baseURL: DEPLOYED_URL }, grep: /@real/ }]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }, grepInvert: /@mobile|@real/ },
        { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
      ],
  webServer: process.env.APP_BASE_URL || DEPLOYED_URL
    ? undefined
    : [
        { command: 'bash ../scripts/e2e-backend.sh', url: 'http://127.0.0.1:8000/api/health', reuseExistingServer: !process.env.CI, timeout: 120_000 },
        { command: 'npm --prefix ../frontend run dev -- --strictPort', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI, timeout: 120_000 },
      ],
});
