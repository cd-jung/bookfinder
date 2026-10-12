// @ts-check
/** Shared E2E helpers for BookFinder. */
const { expect } = require('@playwright/test');

const API = process.env.APP_API_URL || 'http://127.0.0.1:8000';

/** Make every AI endpoint fail like an unavailable LLM (account context `llm_down`). */
async function llmDown(page) {
  await page.route('**/api/rag/answers', (route) =>
    route.fulfill({ status: 503, json: { code: 'llm_unavailable', detail: 'The AI service is unavailable.' } })
  );
  await page.route('**/nl-search/translate', (route) =>
    route.fulfill({ status: 502, json: { code: 'llm_unavailable', detail: 'The AI service is unavailable.' } })
  );
}

async function openHelp(page) {
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  return page.getByRole('complementary', { name: 'Help chat' });
}

async function ask(chat, question) {
  const input = chat.getByRole('textbox', { name: 'Ask a question' });
  await input.fill(question);
  await input.press('Enter');
}

const LIST = /\/api\/books(\?|$)/;

/** Wait until the shown results belong to the current search (Results region aria-busy="false"). */
async function results(page) {
  await expect(page.getByRole('region', { name: 'Results' })).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('result-count')).toHaveText(/books? found/);
  return page.getByTestId('book-card');
}

/** Run an action that triggers a new results request, then wait for those results. */
async function act(page, action, match = LIST) {
  const response = page.waitForResponse((r) => match.test(r.url()));
  await action();
  await response;
  return results(page);
}

async function search(page, keyword) {
  const box = page.getByRole('searchbox', { name: 'Search books' });
  await box.fill(keyword);
  return act(page, () => box.press('Enter'));
}

/** Ask in plain language. Resolves after the translate call; use act(..., NL_LIST) to wait for results. */
async function askAi(page, question) {
  await page.getByRole('tab', { name: 'Ask in plain language (AI)' }).click();
  const box = page.getByRole('textbox', { name: 'Ask in plain language' });
  await box.fill(question);
  await box.press('Enter');
}

const NL_LIST = /\/api\/books\?.*nl_filter=/;

/** Read a few books from the API (for data-dependent assertions). */
async function apiBooks(request, params = {}) {
  const query = new URLSearchParams(params).toString();
  const response = await request.get(`${API}/api/books?${query}`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function apiBook(request, id) {
  return (await request.get(`${API}/api/books/${id}`)).json();
}

module.exports = { API, LIST, NL_LIST, llmDown, openHelp, ask, results, act, search, askAi, apiBooks, apiBook };
