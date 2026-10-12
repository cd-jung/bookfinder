// @ts-check
/** Help assistant conversation (flow 05). Local stack: LLM stub = keyword retrieval over docs/user-guide. */
const { test, expect } = require('@playwright/test');
const { openHelp, ask, llmDown } = require('./helpers');

test.describe('Open & send', () => {
  test('[CHAT-001] Help opens with welcome, disclaimer, suggested questions and focus in the input', async ({ page }) => {
    await page.goto('/');
    const chat = await openHelp(page);
    await expect(chat).toContainText('I can explain how to use BookFinder');
    await expect(chat).toContainText('may be inaccurate');
    await expect(chat.getByTestId('suggested-question')).toHaveCount(3);
    await expect(chat.getByRole('textbox', { name: 'Ask a question' })).toBeFocused();
  });

  test('[CHAT-002] a usage question shows a short answer with links to the User Guide', async ({ page }) => {
    await page.goto('/');
    const chat = await openHelp(page);
    await ask(chat, 'How do I search in plain language?');
    await expect(chat.getByTestId('chat-question')).toHaveText('How do I search in plain language?');
    await expect(chat.getByTestId('chat-answer').last()).not.toBeEmpty();
    await expect(chat.getByTestId('chat-source').first()).toHaveAttribute('href', /^\/guide\/04-ai-search(#|$)/);
  });

  test('[CHAT-003] Enter sends, Shift+Enter adds a new line, blank keeps Send disabled', async ({ page }) => {
    await page.goto('/');
    const chat = await openHelp(page);
    const input = chat.getByRole('textbox', { name: 'Ask a question' });
    await expect(chat.getByRole('button', { name: 'Send' })).toBeDisabled();
    await input.pressSequentially('How do I filter');
    await input.press('Shift+Enter');
    await input.pressSequentially('by price?');
    await expect(input).toHaveValue('How do I filter\nby price?');
    await input.press('Enter');
    await expect(chat.getByTestId('chat-question')).toHaveText('How do I filter\nby price?');
  });

  test('[CHAT-004] input stops at 1000 characters with a counter near the limit', async ({ page }) => {
    await page.goto('/');
    const chat = await openHelp(page);
    const input = chat.getByRole('textbox', { name: 'Ask a question' });
    await input.fill('y'.repeat(1200));
    expect((await input.inputValue()).length).toBe(1000);
    await expect(chat.getByText('1000/1000')).toBeVisible();
  });

  test('[CHAT-005] a suggested question chip sends that question', async ({ page }) => {
    await page.goto('/');
    const chat = await openHelp(page);
    await chat.getByTestId('suggested-question').filter({ hasText: 'How do I filter by price?' }).click();
    await expect(chat.getByTestId('chat-question')).toHaveText('How do I filter by price?');
    await expect(chat.getByTestId('chat-source').first()).toHaveAttribute('href', /^\/guide\/02-searching-books#/);
  });

  test('[CHAT-006] Stop generating cancels the request and marks it Stopped', async ({ page }) => {
    await page.route('**/api/rag/answers', async (route) => {
      await new Promise((r) => setTimeout(r, 5000));
      await route.continue().catch(() => undefined);
    });
    await page.goto('/');
    const chat = await openHelp(page);
    await ask(chat, 'How do I sort results?');
    await chat.getByRole('button', { name: 'Stop generating' }).click();
    await expect(chat.getByTestId('chat-answer').last()).toHaveAttribute('data-stopped', 'true');
    await expect(chat.getByTestId('chat-answer').last()).toHaveText(/Stopped\./);
    await expect(chat.getByRole('textbox', { name: 'Ask a question' })).toBeEnabled();
  });
});

test.describe('Context', () => {
  test('[CHAT-007] a follow-up is searched together with the previous question', async ({ page }) => {
    const bodies = [];
    page.on('request', (r) => r.url().includes('/api/rag/answers') && bodies.push(r.postDataJSON()));
    await page.goto('/');
    const chat = await openHelp(page);
    await ask(chat, 'How do I search logs in plain language?');
    await expect(chat.getByTestId('chat-answer')).toHaveCount(1);
    await ask(chat, 'What about mobile?');
    await expect(chat.getByTestId('chat-answer')).toHaveCount(2);
    expect(bodies[1].history).toEqual(['How do I search logs in plain language?']);
    await expect(chat.getByTestId('chat-answer').last().getByTestId('chat-source').first()).toHaveAttribute('href', /^\/guide\/06-logs-and-monitoring/);
  });
});

test.describe('Sources, copy & feedback', () => {
  test('[CHAT-009] clicking a source opens that User Guide section', async ({ page }) => {
    await page.goto('/');
    const chat = await openHelp(page);
    await ask(chat, 'How do I see if a book is in stock?');
    const source = chat.getByTestId('chat-source').first();
    const href = await source.getAttribute('href');
    await source.click();
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    if (href.includes('#')) await expect(page.locator(href.slice(href.indexOf('#')))).toBeInViewport();
  });

  test.describe('clipboard', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] });
    test('[CHAT-011] Copy answer copies the text without markdown', async ({ page }) => {
      await page.goto('/');
      const chat = await openHelp(page);
      await ask(chat, 'How do I use Copy link?');
      await chat.getByRole('button', { name: 'Copy answer' }).last().click();
      const text = await page.evaluate(() => navigator.clipboard.readText());
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toContain('**');
    });
  });

  test('[CHAT-012] thumbs up thanks you; thumbs down asks for a comment', async ({ page }) => {
    const feedback = [];
    page.on('request', (r) => r.url().includes('/api/rag/feedback') && feedback.push(r.postDataJSON()));
    await page.goto('/');
    const chat = await openHelp(page);
    await ask(chat, 'How do I sort results?');
    await chat.getByRole('button', { name: 'Helpful', exact: true }).click();
    await expect(chat.getByText('Thanks for the feedback')).toBeVisible();
    await ask(chat, 'How do I filter by price?');
    await expect(chat.getByTestId('chat-answer')).toHaveCount(2);
    await chat.getByRole('button', { name: 'Not helpful' }).click();
    await chat.getByRole('textbox', { name: 'Feedback comment' }).fill('Too short');
    await chat.getByRole('button', { name: 'Submit' }).click();
    await expect(chat.getByText('Thanks for the feedback')).toHaveCount(2);
    await expect.poll(() => feedback.length).toBe(2);
    expect(feedback[1]).toMatchObject({ helpful: false, comment: 'Too short', question: 'How do I filter by price?' });
  });
});

test.describe('Session', () => {
  test('[CHAT-013] close then reopen keeps the conversation; reload restores it', async ({ page }) => {
    await page.goto('/');
    let chat = await openHelp(page);
    await ask(chat, 'How do I sort results?');
    await expect(chat.getByTestId('chat-answer')).toHaveCount(1);
    await chat.getByRole('button', { name: 'Close help' }).click();
    chat = await openHelp(page);
    await expect(chat.getByTestId('chat-question')).toHaveCount(1);
    await page.reload();
    chat = await openHelp(page);
    await expect(chat.getByTestId('chat-answer')).toHaveCount(1);
  });

  test('[CHAT-014] New conversation asks to confirm and clears the history', async ({ page }) => {
    await page.goto('/');
    const chat = await openHelp(page);
    await ask(chat, 'How do I sort results?');
    await expect(chat.getByTestId('chat-answer')).toHaveCount(1);
    await chat.getByRole('button', { name: 'New conversation' }).click();
    await page.getByRole('dialog', { name: 'Start a new conversation?' }).getByRole('button', { name: 'Cancel' }).click();
    await expect(chat.getByTestId('chat-question')).toHaveCount(1);
    await chat.getByRole('button', { name: 'New conversation' }).click();
    await page.getByRole('dialog', { name: 'Start a new conversation?' }).getByRole('button', { name: 'Clear' }).click();
    await expect(chat.getByTestId('chat-question')).toHaveCount(0);
  });
});

test.describe('Errors', () => {
  test('[CHE-001] a generation error shows Retry; Retry resends the same question', async ({ page }) => {
    await llmDown(page);
    const asked = [];
    page.on('request', (r) => r.url().includes('/api/rag/answers') && asked.push(r.postDataJSON().question));
    await page.goto('/');
    const chat = await openHelp(page);
    await ask(chat, 'How do I sort results?');
    await expect(chat.getByTestId('chat-error')).toContainText('The assistant is unavailable. Please try again later.');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await chat.getByRole('button', { name: 'Retry' }).click();
    await expect(chat.getByTestId('chat-answer')).toHaveCount(1);
    await expect(chat.getByTestId('chat-error')).toHaveCount(0);
    expect(asked).toEqual(['How do I sort results?', 'How do I sort results?']);
  });

  test('[CHE-002] no answer within 30s shows the timeout message with Retry', async ({ page }) => {
    await page.clock.install();
    await page.route('**/api/rag/answers', () => {
      /* never answers */
    });
    await page.goto('/');
    const chat = await openHelp(page);
    await ask(chat, 'How do I sort results?');
    await expect(chat.getByTestId('chat-typing')).toBeVisible();
    await page.clock.fastForward(31_000);
    await expect(chat.getByTestId('chat-error')).toHaveText(/took too long to respond/);
    await expect(chat.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('[CHE-003] rate limit (429) shows Too many questions', async ({ page }) => {
    await page.route('**/api/rag/answers', (route) =>
      route.fulfill({ status: 429, json: { detail: 'Too many questions, please wait 30 seconds', retryAfter: 30 } })
    );
    await page.goto('/');
    const chat = await openHelp(page);
    await ask(chat, 'How do I sort results?');
    await expect(chat.getByTestId('chat-error')).toContainText('Too many questions, please wait 30 seconds');
  });
});
