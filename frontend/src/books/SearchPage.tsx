import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import ClearIcon from '@mui/icons-material/Clear';
import FilterList from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import { ApiError } from '../api/client';
import { useChat } from '../chat/useChat';
import { useOnline } from '../common/useOnline';
import { booksApi, type BookPage, type BooksApi, type Facets, type Translation } from './api';
import BookDialog from './BookDialog';
import { HELP_PREFILL_EMPTY, MAX_QUESTION, NL_EXAMPLES } from './constants';
import { editAsFilters } from './editAsFilters';
import FilterPanel from './FilterPanel';
import ResultsArea from './ResultsArea';
import { apiParams, EMPTY_FILTERS, filterChips, parseSearch, toParams, type Filters, type SearchState } from './searchState';


function translateError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 422) return 'The question could not be translated. Please rephrase it.';
    if (error.status === 429 || error.status === 400) return error.detail;
  }
  return 'The AI search is unavailable. Use keyword search instead.';
}

function listError(error: unknown) {
  if (error instanceof ApiError && (error.status === 503 || error.status === 504)) return 'Search took too long, try a narrower question';
  if (error instanceof ApiError && error.status === 400) return error.detail;
  return 'Could not load books';
}

/** BookFinder search (flows 01-04): keyword & filters, natural language (AI), results and detail. */
export default function SearchPage({ api = booksApi }: { api?: BooksApi }) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const online = useOnline();
  const { openChat } = useChat();
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseSearch(params), [params]);

  const [facets, setFacets] = useState<Facets | null>(null);
  const [facetsError, setFacetsError] = useState(false);
  const [data, setData] = useState<BookPage | null>(null);
  const [shownKey, setShownKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [keywordDraft, setKeywordDraft] = useState(state.mode === 'keyword' ? state.q : '');
  const [question, setQuestion] = useState(state.mode === 'nl' ? state.q : '');
  const [nl, setNl] = useState<(Translation & { question: string }) | null>(null);
  const [translating, setTranslating] = useState(false);
  const [nlError, setNlError] = useState('');
  const [notice, setNotice] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(state.filters);
  const lastCard = useRef<number | null>(null);

  const update = useCallback(
    (patch: Partial<SearchState>, options: { replace?: boolean } = {}) => {
      setParams(toParams({ ...state, page: 1, ...patch }), { replace: options.replace });
    },
    [setParams, state],
  );

  const loadFacets = useCallback(() => {
    setFacetsError(false);
    api.facets().then(setFacets, () => setFacetsError(true));
  }, [api]);
  useEffect(loadFacets, [loadFacets]);

  // Keep the inputs in sync with Back / Forward and deep links.
  useEffect(() => {
    if (state.mode === 'keyword') setKeywordDraft(state.q);
    else setQuestion(state.q);
  }, [state.mode, state.q]);

  // Natural language mode: translate the question from the URL (also after a reload, NL-009).
  const nlKey = state.mode === 'nl' ? state.q : '';
  useEffect(() => {
    if (!nlKey) {
      setNl(null);
      return;
    }
    if (nl?.question === nlKey) return;
    let live = true;
    setTranslating(true);
    setNlError('');
    api
      .translate(nlKey)
      .then(
        (t) => live && setNl({ ...t, question: nlKey }),
        (e) => {
          if (!live) return;
          setNl(null);
          setNlError(translateError(e));
        },
      )
      .finally(() => live && setTranslating(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nlKey, api]);

  // Results request.
  const listKey = JSON.stringify(apiParams(state, state.mode === 'nl' ? nl?.filter : undefined));
  const waitingForNl = state.mode === 'nl' && !!state.q && nl?.question !== state.q;
  useEffect(() => {
    if (waitingForNl) return;
    if (state.mode === 'nl' && state.q && nlError) return;
    let live = true;
    setLoading(true);
    setSlow(false);
    setError('');
    const slowTimer = setTimeout(() => live && setSlow(true), 3000);
    api
      .list(JSON.parse(listKey))
      .then(
        (page) => {
          if (!live) return;
          setData(page);
          setShownKey(listKey);
          if (state.page > page.pages || state.page !== page.page) update({ page: page.page }, { replace: true });
        },
        (e) => live && setError(listError(e)),
      )
      .finally(() => {
        clearTimeout(slowTimer);
        if (live) {
          setLoading(false);
          setSlow(false);
        }
      });
    return () => {
      live = false;
      clearTimeout(slowTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey, waitingForNl, nlError, reload, api]);

  const genreName = useCallback((slug: string) => facets?.genres.find((g) => g.slug === slug)?.name ?? slug, [facets]);
  const chips = filterChips(state.filters, genreName);

  const setFilters = (filters: Filters) => update({ filters });
  const submitKeyword = (event?: FormEvent) => {
    event?.preventDefault();
    update({ q: keywordDraft.trim() });
  };
  const runQuestion = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || translating) return;
    setQuestion(trimmed);
    update({ mode: 'nl', q: trimmed });
  };
  const switchMode = (mode: 'keyword' | 'nl') => {
    setNlError('');
    if (mode === 'keyword') update({ mode, q: '' });
    else update({ mode, q: question.trim() });
  };
  const applyEditAsFilters = () => {
    if (!nl) return;
    const { filters, unsupported } = editAsFilters(nl.filter);
    setNotice(unsupported.length ? `Some conditions cannot be shown as filters: ${unsupported.join(', ')}` : '');
    update({ mode: 'keyword', q: '', filters });
  };
  const openBook = (id: number, el?: HTMLElement) => {
    if (el) lastCard.current = id;
    setParams(toParams({ ...state, book: id }));
  };
  const closeBook = useCallback(() => {
    setParams(toParams({ ...state, book: undefined }));
    const id = lastCard.current;
    setTimeout(() => (document.querySelector(`[data-book-id="${id}"]`) as HTMLElement | null)?.focus(), 0);
  }, [setParams, state]);
  const bookNotFound = useCallback(() => {
    setNotice('Book not found');
    setParams(toParams({ ...state, book: undefined }), { replace: true });
  }, [setParams, state]);

  const filterPanel = facets && (
    <FilterPanel
      facets={facets}
      counts={data?.facets}
      filters={desktop ? state.filters : draftFilters}
      onChange={desktop ? setFilters : setDraftFilters}
      authors={api.authors}
      disabled={!online}
    />
  );

  const emptyActions =
    state.mode === 'nl' ? (
      <>
        <Button variant="contained" onClick={() => switchMode('keyword')}>Try keyword search</Button>
        <Button onClick={() => openChat(HELP_PREFILL_EMPTY)}>Get help</Button>
      </>
    ) : (
      <>
        {!!chips.length && (
          <Button variant="contained" onClick={() => setFilters(chips[chips.length - 1].remove(state.filters))}>Remove last filter</Button>
        )}
        <Button onClick={() => openChat(HELP_PREFILL_EMPTY)}>Get help</Button>
      </>
    );

  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1">Find books</Typography>
      {!online && <Alert severity="warning">You are offline. Search is disabled until you are back online.</Alert>}
      {facetsError && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={loadFacets}>Retry</Button>}>
          Could not load the catalogue filters.
        </Alert>
      )}
      {notice && <Alert severity="info" onClose={() => setNotice('')}>{notice}</Alert>}

      <Paper variant="outlined" sx={{ p: 2 }} component="section" aria-label="Search">
        <Tabs value={state.mode} onChange={(_, v) => switchMode(v)} sx={{ mb: 2 }}>
          <Tab value="keyword" label="Keyword & filters" />
          <Tab value="nl" label="Ask in plain language (AI)" />
        </Tabs>
        {state.mode === 'keyword' ? (
          <Box component="form" onSubmit={submitKeyword} role="search">
            <TextField
              fullWidth
              type="search"
              value={keywordDraft}
              onChange={(e) => setKeywordDraft(e.target.value)}
              placeholder="Title, author, ISBN, publisher or description"
              disabled={!online}
              slotProps={{
                htmlInput: { 'aria-label': 'Search books', maxLength: 200 },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      {keywordDraft && (
                        <IconButton
                          aria-label="Clear search"
                          onClick={() => {
                            setKeywordDraft('');
                            update({ q: '' });
                          }}
                        >
                          <ClearIcon />
                        </IconButton>
                      )}
                      <IconButton type="submit" aria-label="Search" disabled={!online}>
                        <SearchIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
        ) : (
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              runQuestion(question);
            }}
          >
            <TextField
              fullWidth
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION))}
              placeholder="e.g. Korean novels after 2015 under $20 with 4+ stars"
              disabled={translating || !online}
              slotProps={{
                htmlInput: { 'aria-label': 'Ask in plain language', maxLength: MAX_QUESTION },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton type="submit" aria-label="Translate and search" disabled={translating || !question.trim() || !online}>
                        {translating ? <CircularProgress size={20} aria-label="Translating" /> : <AutoAwesome />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
              {NL_EXAMPLES.map((example) => (
                <Chip key={example} label={example} variant="outlined" onClick={() => runQuestion(example)} disabled={translating} data-testid="nl-example" />
              ))}
            </Stack>
            {nl && state.mode === 'nl' && (
              <Alert
                severity="info"
                role="status"
                sx={{ mt: 2 }}
                action={<Button color="inherit" size="small" onClick={applyEditAsFilters}>Edit as filters</Button>}
              >
                <strong>Interpreted as:</strong> {nl.description}
              </Alert>
            )}
            {nlError && <Alert severity="error" sx={{ mt: 2 }} data-testid="nl-error">{nlError}</Alert>}
          </Box>
        )}
      </Paper>

      {!desktop && facets && (
        <Box>
          <Button variant="outlined" startIcon={<FilterList />} onClick={() => { setDraftFilters(state.filters); setDrawerOpen(true); }}>
            Filters{chips.length ? ` (${chips.length})` : ''}
          </Button>
          <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} slotProps={{ paper: { sx: { width: 300, p: 2 } } }}>
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>Filters</Typography>
            {filterPanel}
            <Button variant="contained" sx={{ mt: 2 }} onClick={() => { setFilters(draftFilters); setDrawerOpen(false); }}>
              Apply
            </Button>
          </Drawer>
        </Box>
      )}

      <Stack direction="row" spacing={3} sx={{ alignItems: 'flex-start' }}>
        {desktop && <Box sx={{ width: 260, flexShrink: 0 }}>{filterPanel}</Box>}
        <ResultsArea
          data={waitingForNl ? null : data}
          loading={loading || waitingForNl}
          ready={!loading && !waitingForNl && (shownKey === listKey || !!error)}
          slow={slow}
          error={error}
          onRetry={() => setReload((n) => n + 1)}
          sort={state.sort}
          page={state.page}
          onSort={(sort) => update({ sort })}
          onPage={(page) => {
            update({ page });
            window.scrollTo?.({ top: 0 });
          }}
          chips={chips}
          onRemoveChip={(chip) => setFilters(chip.remove(state.filters))}
          onClearAll={() => {
            setKeywordDraft('');
            update({ q: state.mode === 'nl' ? state.q : '', filters: EMPTY_FILTERS });
          }}
          onOpenBook={openBook}
          emptyActions={emptyActions}
        />
      </Stack>

      {state.book && (
        <BookDialog
          bookId={state.book}
          detail={api.detail}
          onClose={closeBook}
          onOpenBook={(id) => openBook(id)}
          onAuthor={(name) => {
            setKeywordDraft(name);
            setParams(toParams({ mode: 'keyword', q: name, filters: EMPTY_FILTERS, sort: 'relevance', page: 1 }));
          }}
          onNotFound={bookNotFound}
        />
      )}
    </Stack>
  );
}
