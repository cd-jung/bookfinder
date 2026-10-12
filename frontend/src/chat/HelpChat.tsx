import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Fab,
  IconButton,
  Link,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import HelpOutline from '@mui/icons-material/HelpOutlined';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined';
import { ApiError } from '../api/client';
import { askGuide, MAX_QUESTION } from './api';
import { useChatStore } from './useChatStore';

/** Floating "Help" assistant: answers how to use the app from the User Guide, with links to it. */
export default function HelpChat({ ask = askGuide }: { ask?: typeof askGuide }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const { messages, add, removeLast, clear } = useChatStore();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => endRef.current?.scrollIntoView?.({ block: 'end' }), [messages, busy]);

  const send = async (question: string, retry = false) => {
    const text = question.trim();
    if (!text || busy) return;
    if (retry) removeLast();
    else add({ role: 'user', text });
    setDraft('');
    setBusy(true);
    try {
      const result = await ask(text);
      add({ role: 'assistant', text: result.answer, sources: result.sources });
    } catch (error) {
      const detail = error instanceof ApiError ? error.detail : 'The assistant is unavailable. Please try again later.';
      add({ role: 'assistant', text: detail, error: true, question: text });
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
    if (event.key === 'Escape') setOpen(false);
  };

  if (!open) {
    return (
      <Fab variant="extended" color="primary" onClick={() => setOpen(true)} sx={{ position: 'fixed', right: 24, bottom: 24 }}>
        <HelpOutline sx={{ mr: 1 }} />
        Help
      </Fab>
    );
  }

  return (
    <Paper
      component="aside"
      aria-label="Help chat"
      elevation={8}
      sx={{
        position: 'fixed',
        zIndex: (t) => t.zIndex.modal,
        display: 'flex',
        flexDirection: 'column',
        ...(fullScreen ? { inset: 0, borderRadius: 0 } : { right: 24, bottom: 24, width: 400, height: 560 }),
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle1" component="h2" sx={{ flex: 1 }}>
          Help
        </Typography>
        <Tooltip title="New conversation">
          <span>
            <IconButton aria-label="New conversation" onClick={clear} disabled={!messages.length || busy}>
              <DeleteSweepOutlined />
            </IconButton>
          </span>
        </Tooltip>
        <IconButton aria-label="Close help" onClick={() => setOpen(false)}>
          <CloseIcon />
        </IconButton>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }} aria-live="polite">
        <Alert severity="info" icon={false} sx={{ mb: 2 }}>
          Ask how to use the app. Answers come from the User Guide and may be incomplete.
        </Alert>
        <Stack spacing={1.5}>
          {messages.map((m) =>
            m.role === 'user' ? (
              <Box
                key={m.id}
                data-testid="chat-question"
                sx={{ alignSelf: 'flex-end', bgcolor: 'primary.main', color: 'primary.contrastText', px: 1.5, py: 1, borderRadius: 2, maxWidth: '85%', whiteSpace: 'pre-wrap' }}
              >
                {m.text}
              </Box>
            ) : m.error ? (
              <Alert
                key={m.id}
                severity="error"
                data-testid="chat-error"
                action={
                  <Button color="inherit" size="small" onClick={() => void send(m.question ?? '', true)} disabled={busy}>
                    Retry
                  </Button>
                }
              >
                {m.text}
              </Alert>
            ) : (
              <Box key={m.id} data-testid="chat-answer" sx={{ bgcolor: 'action.hover', px: 1.5, py: 1, borderRadius: 2, maxWidth: '95%' }}>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
                {!!m.sources?.length && (
                  <Stack component="ul" spacing={0.5} sx={{ pl: 2, mt: 1, mb: 0 }} aria-label="Sources">
                    {m.sources.map((s) => (
                      <li key={s.url}>
                        <Link component={RouterLink} to={s.url} data-testid="chat-source">
                          {s.section}
                        </Link>
                      </li>
                    ))}
                  </Stack>
                )}
              </Box>
            ),
          )}
          {busy && (
            <Stack sx={{ alignItems: 'center' }} direction="row" spacing={1} role="status">
              <CircularProgress size={16} />
              <Typography variant="body2">Looking it up…</Typography>
            </Stack>
          )}
          <div ref={endRef} />
        </Stack>
      </Box>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end', p: 1.5, borderTop: 1, borderColor: 'divider' }}>
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
    </Paper>
  );
}
