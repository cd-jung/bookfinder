import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import GridView from '@mui/icons-material/GridView';
import ViewList from '@mui/icons-material/ViewList';
import { useTranslation } from 'react-i18next';
import type { BookPage } from './api';
import BookCard from './BookCard';
import { SORTS, type Chip as FilterChip, type Sort } from './searchState';

const VIEW_KEY = 'bookfinder-view';

function loadView(): 'grid' | 'list' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

interface Props {
  data: BookPage | null;
  loading: boolean;
  /** The shown results belong to the current search (E2E waits for aria-busy=false). */
  ready: boolean;
  slow: boolean;
  error: string;
  onRetry: () => void;
  sort: Sort;
  /** Current page from the URL (not from the possibly stale response). */
  page: number;
  onSort: (sort: Sort) => void;
  onPage: (page: number) => void;
  chips: FilterChip[];
  onRemoveChip: (chip: FilterChip) => void;
  onClearAll: () => void;
  onOpenBook: (id: number, el: HTMLElement) => void;
  emptyActions: React.ReactNode;
}

export default function ResultsArea(props: Props) {
  const { data, loading, ready, slow, error, onRetry, sort, page, onSort, onPage, chips, onRemoveChip, onClearAll, onOpenBook, emptyActions } = props;
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<'grid' | 'list'>(loadView);
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* per-viewer convenience only */
    }
  }, [view]);

  return (
    <Box component="section" aria-label={t('results.region')} aria-busy={!ready} sx={{ flex: 1, minWidth: 0 }}>
      {!!chips.length && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 2, alignItems: 'center' }} aria-label={t('chips.region')} data-testid="filter-chips">
          {chips.map((chip) => (
            <Chip key={chip.key} label={chip.label} onDelete={() => onRemoveChip(chip)} data-testid="filter-chip" />
          ))}
          <Button size="small" onClick={onClearAll}>{t('chips.clearAll')}</Button>
        </Stack>
      )}

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Typography aria-live="polite" sx={{ flex: 1, minWidth: 140 }} data-testid="result-count">
          {data ? t('results.found', { count: data.total, formatted: data.total.toLocaleString(i18n.language) }) : ' '}
        </Typography>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="sort-label">{t('results.sortBy')}</InputLabel>
          <Select labelId="sort-label" label={t('results.sortBy')} value={sort} onChange={(e) => onSort(e.target.value as Sort)}>
            {SORTS.map((s) => (
              <MenuItem key={s} value={s}>{t(`results.sort.${s}`)}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)} aria-label={t('results.view')}>
          <ToggleButton value="grid" aria-label={t('results.grid')}><GridView fontSize="small" /></ToggleButton>
          <ToggleButton value="list" aria-label={t('results.list')}><ViewList fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={onRetry}>{t('common.retry')}</Button>}>
          {error}
        </Alert>
      )}
      {loading && slow && (
        <Typography color="text.secondary" sx={{ mb: 1 }} data-testid="still-loading">{t('results.stillLoading')}</Typography>
      )}

      {loading && !data ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }} data-testid="results-skeleton">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={300} />
          ))}
        </Box>
      ) : data && data.total === 0 && !error ? (
        <Stack spacing={1.5} sx={{ alignItems: 'flex-start', py: 4 }} data-testid="empty-state">
          <Typography variant="h6" component="p">{t('results.noMatch')}</Typography>
          <Typography color="text.secondary">{t('results.noMatchHint')}</Typography>
          <Stack direction="row" spacing={1}>{emptyActions}</Stack>
        </Stack>
      ) : data ? (
        <Box sx={{ opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
          <Box
            component="ul"
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              display: 'grid',
              gap: 2,
              gridTemplateColumns: view === 'grid' ? { xs: '1fr', sm: 'repeat(auto-fill, minmax(200px, 1fr))' } : '1fr',
            }}
            data-testid={`results-${view}`}
          >
            {data.results.map((book) => (
              <li key={book.id}>
                <BookCard book={book} view={view} onOpen={onOpenBook} />
              </li>
            ))}
          </Box>
          {data.pages > 1 && (
            <Pagination sx={{ mt: 3 }} page={Math.min(page, data.pages)} count={data.pages} onChange={(_, p) => onPage(p)} showFirstButton showLastButton />
          )}
        </Box>
      ) : null}
    </Box>
  );
}
