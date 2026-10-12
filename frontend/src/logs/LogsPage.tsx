import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import SearchIcon from '@mui/icons-material/Search';
import { ApiError } from '../api/client';
import { logsApi, type LogPage, type LogStats, type LogsApi, type Translation } from './api';
import RequestsChart from './RequestsChart';

const EXAMPLES = ['errors in the last hour', 'slow requests over 500ms', '4xx or 5xx responses'];
const RANGES = [1, 6, 24, 72, 168];
const LEVEL_COLOR = { INFO: 'default', WARN: 'warning', ERROR: 'error' } as const;

function StatCard({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <Card variant="outlined" sx={{ flex: '1 1 160px' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h5" component="p" data-testid={testId}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function errorText(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 422) return 'The question could not be translated. Please rephrase it.';
    if (error.status === 502 || error.status === 503) return 'The AI search is unavailable. Use keyword search instead.';
    return error.detail;
  }
  return fallback;
}

export default function LogsPage({ api = logsApi }: { api?: LogsApi }) {
  const [hours, setHours] = useState(24);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [statsError, setStatsError] = useState('');

  const [mode, setMode] = useState<'nl' | 'keyword'>('nl');
  const [question, setQuestion] = useState('');
  const [keyword, setKeyword] = useState('');
  const [level, setLevel] = useState('');
  const [translating, setTranslating] = useState(false);
  const [nl, setNl] = useState<Translation | null>(null);
  const [searchError, setSearchError] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<LogPage | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);

  const loadStats = useCallback(() => {
    setStatsError('');
    api.stats(hours).then(setStats, (e) => setStatsError(errorText(e, 'Could not load the dashboard.')));
  }, [api, hours]);

  useEffect(loadStats, [loadStats]);

  useEffect(() => {
    let cancelled = false;
    setLoadingRows(true);
    const query = mode === 'nl' ? { nlFilter: nl?.filter, page } : { q: keyword, level, page };
    api
      .list(query)
      .then(
        (data) => !cancelled && setRows(data),
        (e) => !cancelled && setSearchError(errorText(e, 'Could not load logs.')),
      )
      .finally(() => !cancelled && setLoadingRows(false));
    return () => {
      cancelled = true;
    };
  }, [api, mode, nl, keyword, level, page]);

  const runQuestion = async (text: string) => {
    if (!text.trim() || translating) return;
    setTranslating(true);
    setSearchError('');
    try {
      setNl(await api.translate(text.trim()));
      setPage(1);
    } catch (e) {
      setNl(null);
      setSearchError(errorText(e, 'The question could not be translated. Please rephrase it.'));
    } finally {
      setTranslating(false);
    }
  };

  const submitQuestion = (event: FormEvent) => {
    event.preventDefault();
    void runQuestion(question);
  };

  const [keywordDraft, setKeywordDraft] = useState('');
  const submitKeyword = (event: FormEvent) => {
    event.preventDefault();
    setKeyword(keywordDraft.trim());
    setPage(1);
  };

  const switchMode = (next: 'nl' | 'keyword') => {
    setMode(next);
    setSearchError('');
    setPage(1);
    if (next === 'keyword') setNl(null);
  };

  return (
    <Stack spacing={3}>
      <Stack sx={{ alignItems: 'center' }} direction="row" spacing={2}>
        <Typography variant="h4" component="h1" sx={{ flex: 1 }}>
          Logs &amp; Monitoring
        </Typography>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="range-label">Time range</InputLabel>
          <Select labelId="range-label" label="Time range" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {RANGES.map((h) => (
              <MenuItem key={h} value={h}>
                {h < 24 ? `Last ${h} h` : `Last ${h / 24} d`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Box component="section" aria-label="Dashboard">
        {statsError && <Alert severity="error" action={<Chip label="Retry" onClick={loadStats} />}>{statsError}</Alert>}
        {!stats && !statsError && <Skeleton variant="rounded" height={120} />}
        {stats && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <StatCard label="Requests" value={String(stats.total)} testId="stat-requests" />
              <StatCard label="Error rate (5xx)" value={`${stats.errorRate}%`} testId="stat-error-rate" />
              <StatCard label="p95 latency" value={`${stats.p95Ms} ms`} testId="stat-p95" />
              <StatCard label="Client errors (4xx)" value={String(stats.clientErrors)} testId="stat-client-errors" />
            </Stack>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>Requests per hour</Typography>
              <RequestsChart data={stats.perHour} />
            </Paper>
          </Stack>
        )}
      </Box>

      <Paper variant="outlined" component="section" aria-label="Log search" sx={{ p: 2 }}>
        <Tabs value={mode} onChange={(_, v) => switchMode(v)} sx={{ mb: 2 }}>
          <Tab value="nl" label="Ask in plain language (AI)" />
          <Tab value="keyword" label="Keyword" />
        </Tabs>
        {mode === 'nl' ? (
          <Box component="form" onSubmit={submitQuestion}>
            <TextField
              fullWidth
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={translating}
              placeholder="e.g. errors in the last hour"
              slotProps={{
                htmlInput: { maxLength: 500, 'aria-label': 'Search logs in plain language' },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton type="submit" aria-label="Translate and search" disabled={translating || !question.trim()}>
                        {translating ? <CircularProgress size={20} /> : <AutoAwesome />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
              {EXAMPLES.map((example) => (
                <Chip
                  key={example}
                  label={example}
                  variant="outlined"
                  onClick={() => {
                    setQuestion(example);
                    void runQuestion(example);
                  }}
                />
              ))}
            </Stack>
          </Box>
        ) : (
          <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1} onSubmit={submitKeyword}>
            <TextField
              fullWidth
              size="small"
              value={keywordDraft}
              onChange={(e) => setKeywordDraft(e.target.value)}
              placeholder="Path or message"
              slotProps={{
                htmlInput: { 'aria-label': 'Search logs by keyword', type: 'search' },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton type="submit" aria-label="Search"><SearchIcon /></IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="level-label">Level</InputLabel>
              <Select labelId="level-label" label="Level" value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
                <MenuItem value="">All levels</MenuItem>
                <MenuItem value="INFO">INFO</MenuItem>
                <MenuItem value="WARN">WARN</MenuItem>
                <MenuItem value="ERROR">ERROR</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        )}

        <Box sx={{ mt: 2 }}>
          {nl && mode === 'nl' && (
            <Alert severity="info" role="status" sx={{ mb: 2 }}>
              <strong>Interpreted as:</strong> {nl.description}
            </Alert>
          )}
          {searchError && <Alert severity="error" sx={{ mb: 2 }}>{searchError}</Alert>}
          <Typography variant="body2" color="text.secondary" aria-live="polite" sx={{ mb: 1 }} data-testid="log-count">
            {rows ? `${rows.total} log entries` : ' '}
          </Typography>
          <TableContainer>
            <Table size="small" aria-label="Request logs">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Path</TableCell>
                  <TableCell align="right">Status</TableCell>
                  <TableCell align="right">Duration</TableCell>
                  <TableCell>Message</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingRows && !rows ? (
                  <TableRow><TableCell colSpan={7}><Skeleton /></TableCell></TableRow>
                ) : rows && rows.results.length === 0 ? (
                  <TableRow><TableCell colSpan={7}>No log entries match.</TableCell></TableRow>
                ) : (
                  rows?.results.map((r) => (
                    <TableRow key={r.id} data-testid="log-row">
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(r.createdAt).toLocaleString()}</TableCell>
                      <TableCell><Chip size="small" label={r.level} color={LEVEL_COLOR[r.level]} /></TableCell>
                      <TableCell>{r.method}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{r.path}</TableCell>
                      <TableCell align="right" data-testid="log-status">{r.statusCode}</TableCell>
                      <TableCell align="right">{r.durationMs} ms</TableCell>
                      <TableCell>{r.message}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {rows && rows.pages > 1 && (
            <Pagination sx={{ mt: 2 }} page={rows.page} count={rows.pages} onChange={(_, p) => setPage(p)} />
          )}
        </Box>
      </Paper>
    </Stack>
  );
}
