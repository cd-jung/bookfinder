// @ts-check
const { test, expect } = require('@playwright/test');
const { llmDown, openHelp, ask } = require('./helpers');

test.describe('Help assistant (LLM stub)', () => {
  test('[HELP-001] Help opens the panel with the disclaimer and focus in the input', async ({ page }) => {
    await page.goto('/');
    const chat = await openHelp(page);
    await expect(chat.getByText(/Answers come from the User Guide/)).toBeVisible();
    await expect(chat.getByRole('textbox', { name: 'Ask a question' })).toBeFocused();
  });

  test('[HELP-002] usage question gets a summary with links to the guide', async ({ page }) => {
    await page.goto('/');
    const chat = await openHelp(page);
    await ask(chat, 'How do I search logs in plain language?');
    await expect(chat.getByTestId('chat-answer').last()).not.toBeEmpty();
    const source = chat.getByTestId('chat-source').first();
    await expect(source).toHaveAttribute('href', /^\/guide\/03-logs-and-monitoring#/);
  });

  test('[HELP-003] clicking a source opens that guide section', async ({ page }) => {
    await page.goto('/');
    const chat = await openHelp(page);
    await ask(chat, 'How do I search logs in plain language?');
    const source = chat.getByTestId('chat-source').first();
    const href = await source.getAttribute('href');
    await source.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator(href.slice(href.indexOf('#')))).toBeInViewport();
  });

  test('[HELP-004] question outside the guide gets the fixed answer and no links', async ({ page }) => {
    await page.goto('/');
    const chat = await openHelp(page);
    await ask(chat, 'What is the capital of France?');
    await expect(chat.getByTestId('chat-answer').last()).toContainText("I couldn't find that in the User Guide");
    await expect(chat.getByTestId('chat-source')).toHaveCount(0);
  });

  test('[HELP-005] AI unavailable shows the error; Retry resends', async ({ page }) => {
    await llmDown(page);
    await page.goto('/');
    const chat = await openHelp(page);
    await ask(chat, 'How do I ask a question?');
    await expect(chat.getByTestId('chat-error')).toContainText('The AI service is unavailable.');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await chat.getByRole('button', { name: 'Retry' }).click();
    await expect(chat.getByTestId('chat-answer').last()).toBeVisible();
    await expect(chat.getByTestId('chat-error')).toHaveCount(0);
  });

  test('[HELP-006] Enter sends, Shift+Enter adds a line, blank keeps Send disabled', async ({ page }) => {
    await page.goto('/');
    const chat = await openHelp(page);
    const input = chat.getByRole('textbox', { name: 'Ask a question' });
    await expect(chat.getByRole('button', { name: 'Send' })).toBeDisabled();
    await input.pressSequentially('first line');
    await input.press('Shift+Enter');
    await input.pressSequentially('second line');
    await expect(input).toHaveValue('first line\nsecond line');
    await input.press('Enter');
    await expect(chat.getByTestId('chat-question')).toHaveText('first line\nsecond line');
  });

  test('[HELP-007] conversation survives close and reload; New conversation clears it', async ({ page }) => {
    await page.goto('/');
    let chat = await openHelp(page);
    await ask(chat, 'How do I ask a question?');
    await expect(chat.getByTestId('chat-answer')).toHaveCount(1);
    await chat.getByRole('button', { name: 'Close help' }).click();
    chat = await openHelp(page);
    await expect(chat.getByTestId('chat-question')).toHaveCount(1);
    await page.reload();
    chat = await openHelp(page);
    await expect(chat.getByTestId('chat-question')).toHaveCount(1);
    await chat.getByRole('button', { name: 'New conversation' }).click();
    await expect(chat.getByTestId('chat-question')).toHaveCount(0);
  });
});
