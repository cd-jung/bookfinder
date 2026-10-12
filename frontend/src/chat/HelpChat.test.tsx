import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../api/client';
import { renderAt } from '../test/render';
import { MAX_QUESTION } from './api';
import HelpChat from './HelpChat';

const answer = { answer: 'Click Help.', sources: [{ title: 'Help', section: 'Help > Asking', url: '/guide/02-help#asking', similarity: 0.8 }], has_sufficient_context: true };

async function openChat(ask = vi.fn().mockResolvedValue(answer)) {
  renderAt(<HelpChat ask={ask} />);
  await userEvent.click(screen.getByRole('button', { name: 'Help' }));
  return ask;
}

describe('HelpChat', () => {
  it('opens with a disclaimer and focus in the input', async () => {
    await openChat();
    expect(screen.getByRole('complementary', { name: 'Help chat' })).toBeInTheDocument();
    expect(screen.getByText(/Answers come from the User Guide/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ask a question' })).toHaveFocus();
  });

  it('sends on Enter and shows the answer with guide links', async () => {
    const ask = await openChat();
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask a question' }), 'How do I ask?{Enter}');
    expect(ask).toHaveBeenCalledWith('How do I ask?');
    expect(await screen.findByTestId('chat-answer')).toHaveTextContent('Click Help.');
    expect(screen.getByTestId('chat-source')).toHaveAttribute('href', '/guide/02-help#asking');
  });

  it('Shift+Enter adds a new line and blank input keeps Send disabled', async () => {
    const ask = await openChat();
    const input = screen.getByRole('textbox', { name: 'Ask a question' });
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await userEvent.type(input, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(input).toHaveValue('line one\nline two');
    expect(ask).not.toHaveBeenCalled();
  });

  it('limits input length and shows the counter near the limit', async () => {
    await openChat();
    const input = screen.getByRole('textbox', { name: 'Ask a question' });
    await userEvent.click(input);
    await userEvent.paste('x'.repeat(MAX_QUESTION + 20));
    expect((input as HTMLTextAreaElement).value).toHaveLength(MAX_QUESTION);
    expect(screen.getByText(`${MAX_QUESTION}/${MAX_QUESTION}`)).toBeInTheDocument();
  });

  it('shows the backend error with Retry, and Retry resends the question', async () => {
    const ask = vi.fn().mockRejectedValueOnce(new ApiError(503, { detail: 'The AI service is unavailable.' })).mockResolvedValue(answer);
    await openChat(ask);
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask a question' }), 'help{Enter}');
    expect(await screen.findByTestId('chat-error')).toHaveTextContent('The AI service is unavailable.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('chat-answer')).toBeInTheDocument();
    expect(ask).toHaveBeenNthCalledWith(2, 'help');
    expect(screen.queryByTestId('chat-error')).not.toBeInTheDocument();
  });

  it('uses a generic message for unexpected errors', async () => {
    await openChat(vi.fn().mockRejectedValue(new Error('boom')));
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask a question' }), 'help{Enter}');
    expect(await screen.findByTestId('chat-error')).toHaveTextContent('The assistant is unavailable');
  });

  it('keeps the conversation after close / reopen and clears it with New conversation', async () => {
    await openChat();
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask a question' }), 'q1{Enter}');
    await screen.findByTestId('chat-answer');
    await userEvent.click(screen.getByRole('button', { name: 'Close help' }));
    await userEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByTestId('chat-question')).toHaveTextContent('q1');
    expect(JSON.parse(sessionStorage.getItem('help-chat-messages') ?? '[]')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'New conversation' }));
    await waitFor(() => expect(screen.queryByTestId('chat-question')).not.toBeInTheDocument());
  });

  it('Escape closes the panel', async () => {
    await openChat();
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask a question' }), '{Escape}');
    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument();
  });
});
