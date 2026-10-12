// @ts-check
/** Shared E2E helpers. */

/** Make every AI endpoint fail like an unavailable LLM (account context `llm_down`). */
async function llmDown(page) {
  await page.route('**/api/rag/answers', (route) =>
    route.fulfill({ status: 503, json: { code: 'llm_unavailable', detail: 'The AI service is unavailable.' } })
  );
  await page.route('**/api/**/nl-search/translate', (route) =>
    route.fulfill({ status: 502, json: { code: 'llm_unavailable', detail: 'The AI service is unavailable.' } })
  );
}

async function openHelp(page) {
  await page.getByRole('button', { name: 'Help' }).click();
  return page.getByRole('complementary', { name: 'Help chat' });
}

async function ask(chat, question) {
  await chat.getByRole('textbox', { name: 'Ask a question' }).fill(question);
  await chat.getByRole('textbox', { name: 'Ask a question' }).press('Enter');
}

module.exports = { llmDown, openHelp, ask };
