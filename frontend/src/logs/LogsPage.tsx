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
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';
import { logsApi, type LogPage, type LogStats, type LogsApi, type Resources, type Translation } from './api';
import RequestsChart from './RequestsChart';
import ResourceHeadroom from './ResourceHeadroom';

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

type T = (key: string, options?: Record<string, unknown>) => string;

function errorText(error: unknown, fallback: string, t: T) {
  if (error instanceof ApiError) {
    if (error.status === 403) return t('admin.signInRequired');
    if (error.status === 422) return t('search.errors.untranslatable');
    if (error.status === 502 || error.status === 503) return t('search.errors.aiDown');
    if (error.status === 429) return t('search.errors.tooMany', { seconds: (error.body as { retryAfter?: number } | null)?.retryAfter ?? 60 });
    return error.detail;
  }
  return fallback;
}

export default function LogsPage({ api = logsApi }: { api?: LogsApi }) {
  const { t, i18n } = useTranslation();
  const [examples, setExamples] = useState<string[]>([]);
  const [hours, setHours] = useState(24);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [resources, setResources] = useState<Resources | null>(null);
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
    api.stats(hours).then(setStats, (e) => setStatsError(errorText(e, t('logs.dashboardError'), t)));
    api.resources().then(setResources, () => setResources(null));
  }, [api, hours, t]);

  useEffect(loadStats, [loadStats]);
  useEffect(() => {
    api.examples().then((r) => setExamples(r.examples), () => setExamples([]));
  }, [api, i18n.language]);

  useEffect(() => {
    let cancelled = false;
    setLoadingRows(true);
    const query = mode === 'nl' ? { nlFilter: nl?.filter, page } : { q: keyword, level, page };
    api
      .list(query)
      .then(
        (data) => !cancelled && setRows(data),
        (e) => !cancelled && setSearchError(errorText(e, t('logs.loadError'), t)),
      )
      .finally(() => !cancelled && setLoadingRows(false));
    return () => {
      cancelled = true;
    };
  }, [api, mode, nl, keyword, level, page, t]);

  const runQuestion = async (text: string) => {
    if (!text.trim() || translating) return;
    setTranslating(true);
    setSearchError('');
    try {
      setNl(await api.translate(text.trim()));
      setPage(1);
    } catch (e) {
      setNl(null);
      setSearchError(errorText(e, t('search.errors.untranslatable'), t));
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
          {t('logs.title')}
        </Typography>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="range-label">{t('logs.timeRange')}</InputLabel>
          <Select labelId="range-label" label={t('logs.timeRange')} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {RANGES.map((h) => (
              <MenuItem key={h} value={h}>
                {h < 24 ? t('logs.lastHours', { count: h }) : t('logs.lastDays', { count: h / 24 })}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Box component="section" aria-label={t('logs.dashboard')}>
        {statsError && <Alert severity="error" action={<Chip label={t('common.retry')} onClick={loadStats} />}>{statsError}</Alert>}
        {!stats && !statsError && <Skeleton variant="rounded" height={120} />}
        {stats && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <StatCard label={t('logs.requests')} value={String(stats.total)} testId="stat-requests" />
              <StatCard label={t('logs.errorRate')} value={`${stats.errorRate}%`} testId="stat-error-rate" />
              <StatCard label={t('logs.p95')} value={`${stats.p95Ms} ms`} testId="stat-p95" />
              <StatCard label={t('logs.clientErrors')} value={String(stats.clientErrors)} testId="stat-client-errors" />
            </Stack>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>{t('logs.perHour')}</Typography>
              <RequestsChart data={stats.perHour} />
            </Paper>
            {resources && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <ResourceHeadroom data={resources} />
              </Paper>
            )}
          </Stack>
        )}
      </Box>

      <Paper variant="outlined" component="section" aria-label={t('logs.search')} sx={{ p: 2 }}>
        <Tabs value={mode} onChange={(_, v) => switchMode(v)} sx={{ mb: 2 }}>
          <Tab value="nl" label={t('logs.tabNl')} />
          <Tab value="keyword" label={t('logs.tabKeyword')} />
        </Tabs>
        {mode === 'nl' ? (
          <Box component="form" onSubmit={submitQuestion}>
            <TextField
              fullWidth
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={translating}
              placeholder={t('logs.nlPlaceholder')}
              slotProps={{
                htmlInput: { maxLength: 500, 'aria-label': t('logs.nlLabel') },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton type="submit" aria-label={t('logs.nlSubmit')} disabled={translating || !question.trim()}>
                        {translating ? <CircularProgress size={20} /> : <AutoAwesome />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
              {examples.map((example) => (
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
              placeholder={t('logs.keywordPlaceholder')}
              slotProps={{
                htmlInput: { 'aria-label': t('logs.keywordLabel'), type: 'search' },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton type="submit" aria-label={t('logs.submit')}><SearchIcon /></IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="level-label">{t('logs.level')}</InputLabel>
              <Select labelId="level-label" label={t('logs.level')} value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
                <MenuItem value="">{t('logs.allLevels')}</MenuItem>
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
              <strong>{t('search.interpretedAs')}</strong> {nl.description}
            </Alert>
          )}
          {searchError && <Alert severity="error" sx={{ mb: 2 }}>{searchError}</Alert>}
          <Typography variant="body2" color="text.secondary" aria-live="polite" sx={{ mb: 1 }} data-testid="log-count">
            {rows ? t('logs.count', { count: rows.total }) : ' '}
          </Typography>
          <TableContainer>
            <Table size="small" aria-label={t('logs.table')}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('logs.columns.time')}</TableCell>
                  <TableCell>{t('logs.columns.level')}</TableCell>
                  <TableCell>{t('logs.columns.method')}</TableCell>
                  <TableCell>{t('logs.columns.path')}</TableCell>
                  <TableCell align="right">{t('logs.columns.status')}</TableCell>
                  <TableCell align="right">{t('logs.columns.duration')}</TableCell>
                  <TableCell>{t('logs.columns.message')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingRows && !rows ? (
                  <TableRow><TableCell colSpan={7}><Skeleton /></TableCell></TableRow>
                ) : rows && rows.results.length === 0 ? (
                  <TableRow><TableCell colSpan={7}>{t('logs.noMatch')}</TableCell></TableRow>
                ) : (
                  rows?.results.map((r) => (
                    <TableRow key={r.id} data-testid="log-row">
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(r.createdAt).toLocaleString(i18n.language)}</TableCell>
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
