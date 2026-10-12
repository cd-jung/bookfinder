import { describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { ApiError } from '../api/client';
import { renderAt } from '../test/render';
import { en } from '../i18n/locales/en';
import { MAX_QUESTION, type ChatApi } from './api';

const SUGGESTED_QUESTIONS = en.help.suggestions;
import { ChatProvider } from './ChatContext';
import HelpChat from './HelpChat';
import { useChat } from './useChat';

const answer = { answer: 'Click **Help**.', sources: [{ title: 'Help', section: 'Help > Asking', url: '/guide/05-help#asking', similarity: 0.8 }], has_sufficient_context: true };

function makeApi(overrides: Partial<ChatApi> = {}): ChatApi {
  return { ask: vi.fn().mockResolvedValue(answer), feedback: vi.fn().mockResolvedValue({ detail: 'ok' }), ...overrides };
}

async function openChat(api = makeApi()) {
  renderAt(
    <ChatProvider>
      <HelpChat api={api} />
    </ChatProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Help' }));
  return api;
}

const input = () => screen.getByRole('textbox', { name: 'Ask a question' });

describe('HelpChat', () => {
  it('opens with welcome, disclaimer, suggestions and focus in the input', async () => {
    await openChat();
    expect(screen.getByRole('complementary', { name: 'Help chat' })).toBeInTheDocument();
    expect(screen.getByText(/may be inaccurate/)).toBeInTheDocument();
    expect(screen.getAllByTestId('suggested-question')).toHaveLength(SUGGESTED_QUESTIONS.length);
    await waitFor(() => expect(input()).toHaveFocus());
  });

  it('sends on Enter with history and renders markdown answers with guide links', async () => {
    const api = await openChat();
    await userEvent.type(input(), 'First?{Enter}');
    await screen.findByTestId('chat-answer');
    await userEvent.type(input(), 'Second?{Enter}');
    await waitFor(() => expect(screen.getAllByTestId('chat-answer')).toHaveLength(2));
    expect(api.ask).toHaveBeenNthCalledWith(1, 'First?', [], expect.any(AbortSignal));
    expect(api.ask).toHaveBeenNthCalledWith(2, 'Second?', ['First?'], expect.any(AbortSignal));
    expect(screen.getAllByTestId('chat-answer')[0].querySelector('strong')).toHaveTextContent('Help');
    expect(screen.getAllByTestId('chat-source')[0]).toHaveAttribute('href', '/guide/05-help#asking');
  });

  it('suggested question chips send their question', async () => {
    const api = await openChat();
    await userEvent.click(screen.getAllByTestId('suggested-question')[0]);
    expect(api.ask).toHaveBeenCalledWith(SUGGESTED_QUESTIONS[0], [], expect.any(AbortSignal));
  });

  it('Shift+Enter adds a new line and blank input keeps Send disabled', async () => {
    const api = await openChat();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await userEvent.type(input(), 'line one{Shift>}{Enter}{/Shift}line two');
    expect(input()).toHaveValue('line one\nline two');
    expect(api.ask).not.toHaveBeenCalled();
  });

  it('limits input length and shows the counter near the limit', async () => {
    await openChat();
    await userEvent.click(input());
    await userEvent.paste('x'.repeat(MAX_QUESTION + 20));
    expect((input() as HTMLTextAreaElement).value).toHaveLength(MAX_QUESTION);
    expect(screen.getByText(`${MAX_QUESTION}/${MAX_QUESTION}`)).toBeInTheDocument();
  });

  it('shows backend errors with Retry; Retry resends', async () => {
    const api = makeApi({ ask: vi.fn().mockRejectedValueOnce(new ApiError(503, { detail: 'The AI service is unavailable.' })).mockResolvedValue(answer) });
    await openChat(api);
    await userEvent.type(input(), 'help{Enter}');
    expect(await screen.findByTestId('chat-error')).toHaveTextContent('The AI service is unavailable.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('chat-answer')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-error')).not.toBeInTheDocument();
  });

  it.each([
    [new ApiError(0, { detail: 'offline' }), 'The assistant is unavailable'],
    [new Error('boom'), 'Something went wrong'],
  ])('maps unexpected errors to a message', async (error, text) => {
    await openChat(makeApi({ ask: vi.fn().mockRejectedValue(error) }));
    await userEvent.type(input(), 'help{Enter}');
    expect(await screen.findByTestId('chat-error')).toHaveTextContent(text);
  });

  it('Stop generating cancels the request and marks it stopped', async () => {
    const ask = vi.fn((_q: string, _h?: string[], signal?: AbortSignal) => new Promise<never>((_, reject) => signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    await openChat(makeApi({ ask }));
    await userEvent.type(input(), 'slow{Enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'Stop generating' }));
    expect(await screen.findByTestId('chat-answer')).toHaveAttribute('data-stopped', 'true');
  });

  it('times out after 30 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const ask = vi.fn((_q: string, _h?: string[], signal?: AbortSignal) => new Promise<never>((_, reject) => signal?.addEventListener('abort', () => reject(signal.reason))));
    await openChat(makeApi({ ask }));
    await userEvent.type(input(), 'slow{Enter}');
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    expect(await screen.findByTestId('chat-error')).toHaveTextContent('took too long');
    vi.useRealTimers();
  });

  it('records thumbs up and thumbs down with a comment', async () => {
    const api = await openChat();
    await userEvent.type(input(), 'q{Enter}');
    await screen.findByTestId('chat-answer');
    await userEvent.click(screen.getByRole('button', { name: 'Not helpful' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Feedback comment' }), 'meh');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByText('Thanks for the feedback')).toBeInTheDocument();
    expect(api.feedback).toHaveBeenCalledWith({ question: 'q', answer: 'Click **Help**.', helpful: false, comment: 'meh' });
  });

  it('thumbs up sends positive feedback', async () => {
    const api = await openChat();
    await userEvent.type(input(), 'q{Enter}');
    await screen.findByTestId('chat-answer');
    await userEvent.click(screen.getByRole('button', { name: 'Helpful' }));
    expect(api.feedback).toHaveBeenCalledWith(expect.objectContaining({ helpful: true }));
  });

  it('copies an answer without markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await openChat();
    await userEvent.type(input(), 'q{Enter}');
    await screen.findByTestId('chat-answer');
    await userEvent.click(screen.getByRole('button', { name: 'Copy answer' }));
    expect(writeText).toHaveBeenCalledWith('Click Help.');
    expect(await screen.findByText('Answer copied')).toBeInTheDocument();
  });

  it('keeps the conversation after close / reopen; New conversation asks to confirm', async () => {
    await openChat();
    await userEvent.type(input(), 'q1{Enter}');
    await screen.findByTestId('chat-answer');
    await userEvent.click(screen.getByRole('button', { name: 'Close help' }));
    await userEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByTestId('chat-question')).toHaveTextContent('q1');
    await userEvent.click(screen.getByRole('button', { name: 'New conversation' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('chat-question')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New conversation' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(screen.queryByTestId('chat-question')).not.toBeInTheDocument());
  });

  it('Escape closes the panel', async () => {
    await openChat();
    await userEvent.type(input(), '{Escape}');
    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument();
  });

  it('opens prefilled from the chat context', async () => {
    function Opener() {
      const { openChat } = useChat();
      useEffect(() => openChat('Prefilled question'), [openChat]);
      return null;
    }
    renderAt(
      <ChatProvider>
        <Opener />
        <HelpChat api={makeApi()} />
      </ChatProvider>,
    );
    expect(await screen.findByRole('textbox', { name: 'Ask a question' })).toHaveValue('Prefilled question');
  });
});
