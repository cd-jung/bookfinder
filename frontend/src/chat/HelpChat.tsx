import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Markdown from 'react-markdown';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  IconButton,
  Link,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Unstable_TrapFocus as TrapFocus,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import HelpOutlined from '@mui/icons-material/HelpOutlined';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import ContentCopy from '@mui/icons-material/ContentCopy';
import ThumbUpOutlined from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownOutlined from '@mui/icons-material/ThumbDownOutlined';
import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined';
import { ApiError } from '../api/client';
import { chatApi, MAX_QUESTION, SUGGESTED_QUESTIONS, TIMEOUT_MS, type ChatApi } from './api';
import { useChat } from './useChat';
import { useChatStore, type Message } from './useChatStore';

function errorText(error: unknown) {
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'The assistant took too long to respond. Please try again.';
  if (error instanceof ApiError) return error.status === 0 ? 'The assistant is unavailable. Please try again later.' : error.detail;
  return 'Something went wrong. Please try again.';
}

function Feedback({ message, question, api }: { message: Message; question: string; api: ChatApi }) {
  const [state, setState] = useState<'idle' | 'comment' | 'sent'>('idle');
  const [comment, setComment] = useState('');
  const send = (helpful: boolean, text = '') => {
    setState('sent');
    void api.feedback({ question, answer: message.text, helpful, comment: text }).catch(() => undefined);
  };
  if (state === 'sent') return <Typography variant="caption" color="text.secondary" role="status">Thanks for the feedback</Typography>;
  if (state === 'comment') {
    return (
      <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
        <TextField size="small" value={comment} onChange={(e) => setComment(e.target.value.slice(0, 1000))} placeholder="What was wrong? (optional)" slotProps={{ htmlInput: { 'aria-label': 'Feedback comment' } }} />
        <Button size="small" onClick={() => send(false, comment)}>Submit</Button>
      </Stack>
    );
  }
  return (
    <>
      <Tooltip title="Helpful"><IconButton size="small" aria-label="Helpful" onClick={() => send(true)}><ThumbUpOutlined fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Not helpful"><IconButton size="small" aria-label="Not helpful" onClick={() => setState('comment')}><ThumbDownOutlined fontSize="small" /></IconButton></Tooltip>
    </>
  );
}

/** Floating "Help" assistant (flows 05-06): answers how to use BookFinder from the User Guide, with links. */
export default function HelpChat({ api = chatApi }: { api?: ChatApi }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const chat = useChat();
  const [localOpen, setLocalOpen] = useState(false);
  const open = chat.open || localOpen;
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState('');
  const { messages, add, removeLast, clear } = useChatStore();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      if (chat.prefill) {
        setDraft(chat.prefill);
        chat.consumePrefill();
      }
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, chat]);
  useEffect(() => endRef.current?.scrollIntoView?.({ block: 'end' }), [messages, busy]);

  const close = () => {
    setLocalOpen(false);
    chat.closeChat();
  };

  const send = async (question: string, retry = false) => {
    const text = question.trim();
    if (!text || busy) return;
    const history = messages.filter((m) => m.role === 'user' && !m.error).map((m) => m.text).filter((q) => q !== text).slice(-2);
    if (retry) removeLast();
    else add({ role: 'user', text });
    setDraft('');
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), TIMEOUT_MS);
    try {
      const result = await api.ask(text, history, controller.signal);
      add({ role: 'assistant', text: result.answer, sources: result.sources, question: text });
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason?.name !== 'TimeoutError') {
        add({ role: 'assistant', text: 'Stopped.', stopped: true, question: text });
      } else {
        add({ role: 'assistant', text: errorText(controller.signal.reason ?? error), error: true, question: text });
      }
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  };

  const copyAnswer = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text.replace(/\*\*|`/g, ''));
      setCopied('Answer copied');
    } catch {
      setCopied('Copy failed');
    }
    setTimeout(() => setCopied(''), 2000);
  };

  if (!open) {
    return (
      <Fab variant="extended" color="primary" onClick={() => setLocalOpen(true)} sx={{ position: 'fixed', right: 24, bottom: 24 }}>
        <HelpOutlined sx={{ mr: 1 }} />
        Help
      </Fab>
    );
  }

  return (
    <TrapFocus open>
      <Paper
        component="aside"
        aria-label="Help chat"
        elevation={8}
        onKeyDown={(e) => e.key === 'Escape' && !confirmClear && close()}
        sx={{
          position: 'fixed',
          zIndex: (t) => t.zIndex.modal,
          display: 'flex',
          flexDirection: 'column',
          ...(fullScreen ? { inset: 0, borderRadius: 0 } : { right: 24, bottom: 24, width: 420, height: 600, maxHeight: 'calc(100vh - 48px)' }),
        }}
        data-testid="help-chat"
      >
        <Stack direction="row" sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', alignItems: 'center' }}>
          <Typography variant="subtitle1" component="h2" sx={{ flex: 1 }}>Help</Typography>
          <Tooltip title="New conversation">
            <span>
              <IconButton aria-label="New conversation" onClick={() => setConfirmClear(true)} disabled={!messages.length || busy}>
                <DeleteSweepOutlined />
              </IconButton>
            </span>
          </Tooltip>
          <IconButton aria-label="Close help" onClick={close}><CloseIcon /></IconButton>
        </Stack>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }} aria-live="polite">
          <Typography sx={{ mb: 1 }}>Hi! I can explain how to use BookFinder. What would you like to know?</Typography>
          <Alert severity="info" icon={false} sx={{ mb: 1.5 }}>Answers come from the User Guide and may be inaccurate.</Alert>
          {!messages.length && (
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }} aria-label="Suggested questions">
              {SUGGESTED_QUESTIONS.map((q) => (
                <Chip key={q} label={q} variant="outlined" onClick={() => void send(q)} data-testid="suggested-question" />
              ))}
            </Stack>
          )}
          <Stack spacing={1.5}>
            {messages.map((m) =>
              m.role === 'user' ? (
                <Box key={m.id} data-testid="chat-question" sx={{ alignSelf: 'flex-end', bgcolor: 'primary.main', color: 'primary.contrastText', px: 1.5, py: 1, borderRadius: 2, maxWidth: '85%', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {m.text}
                </Box>
              ) : m.error ? (
                <Alert key={m.id} severity="error" data-testid="chat-error" action={<Button color="inherit" size="small" onClick={() => void send(m.question ?? '', true)} disabled={busy}>Retry</Button>}>
                  {m.text}
                </Alert>
              ) : (
                <Box key={m.id} data-testid="chat-answer" data-stopped={m.stopped ? 'true' : undefined} sx={{ bgcolor: 'action.hover', px: 1.5, py: 1, borderRadius: 2, maxWidth: '95%', overflowWrap: 'anywhere', '& p': { my: 0.5 } }}>
                  {m.stopped ? (
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>Stopped.</Typography>
                  ) : (
                    <Markdown
                      skipHtml
                      components={{
                        a: ({ href, children }) => <Link href={href} target="_blank" rel="noopener noreferrer">{children}</Link>,
                      }}
                    >
                      {m.text}
                    </Markdown>
                  )}
                  {!!m.sources?.length && (
                    <Stack component="ul" spacing={0.5} sx={{ pl: 2, mt: 1, mb: 0 }} aria-label="Sources">
                      {m.sources.map((s) => (
                        <li key={s.url}>
                          <Link component={RouterLink} to={s.url} data-testid="chat-source" onClick={() => fullScreen && close()}>
                            {s.section}
                          </Link>
                        </li>
                      ))}
                    </Stack>
                  )}
                  {!m.stopped && (
                    <Stack direction="row" sx={{ mt: 0.5, alignItems: 'center' }}>
                      <Tooltip title="Copy answer"><IconButton size="small" aria-label="Copy answer" onClick={() => void copyAnswer(m.text)}><ContentCopy fontSize="small" /></IconButton></Tooltip>
                      <Feedback message={m} question={m.question ?? ''} api={api} />
                    </Stack>
                  )}
                </Box>
              ),
            )}
            {busy && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }} role="status" data-testid="chat-typing">
                <CircularProgress size={16} />
                <Typography variant="body2" sx={{ flex: 1 }}>Looking it up…</Typography>
                <Button size="small" startIcon={<StopIcon />} onClick={() => abortRef.current?.abort()}>Stop generating</Button>
              </Stack>
            )}
            {copied && <Typography variant="caption" role="status">{copied}</Typography>}
            <div ref={endRef} />
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', alignItems: 'flex-end' }}>
          <TextField
            inputRef={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_QUESTION))}
            onKeyDown={onKeyDown}
            placeholder="Ask a question"
            multiline
            maxRows={4}
            fullWidth
            size="small"
            disabled={busy}
            slotProps={{ htmlInput: { maxLength: MAX_QUESTION, 'aria-label': 'Ask a question' } }}
            helperText={draft.length > MAX_QUESTION - 100 ? `${draft.length}/${MAX_QUESTION}` : undefined}
          />
          <IconButton color="primary" aria-label="Send" onClick={() => void send(draft)} disabled={!draft.trim() || busy}>
            <SendIcon />
          </IconButton>
        </Stack>

        <Dialog open={confirmClear} onClose={() => setConfirmClear(false)} aria-labelledby="clear-chat-title" disablePortal>
          <DialogTitle id="clear-chat-title">Start a new conversation?</DialogTitle>
          <DialogContent>The current conversation will be cleared.</DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => {
                clear();
                setConfirmClear(false);
                inputRef.current?.focus();
              }}
            >
              Clear
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </TrapFocus>
  );
}
