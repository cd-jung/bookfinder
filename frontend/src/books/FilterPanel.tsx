import { useEffect, useState } from 'react';
import {
  Autocomplete,
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { BookPage, BooksApi, Facets } from './api';
import type { Filters } from './searchState';

interface Props {
  facets: Facets;
  counts?: BookPage['facets'];
  filters: Filters;
  onChange: (next: Filters) => void;
  authors: BooksApi['authors'];
  disabled?: boolean;
}

function AuthorFilter({ value, onChange, authors, disabled }: { value: string; onChange: (v: string) => void; authors: BooksApi['authors']; disabled?: boolean }) {
  const { t } = useTranslation();
  const [input, setInput] = useState(value);
  const [options, setOptions] = useState<string[]>([]);
  useEffect(() => {
    if (input.trim().length < 2) {
      setOptions([]);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      authors(input.trim()).then((r) => live && setOptions(r.results), () => live && setOptions([]));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [input, authors]);
  return (
    <Autocomplete
      size="small"
      options={options}
      value={value || null}
      inputValue={input}
      onInputChange={(_, v) => setInput(v)}
      onChange={(_, v) => onChange(v ?? '')}
      filterOptions={(x) => x}
      disabled={disabled}
      noOptionsText={input.trim().length < 2 ? t('filters.authorHint') : t('filters.authorNone')}
      renderInput={(params) => <TextField {...params} label={t('filters.author')} />}
    />
  );
}

function YearFilter({ from, to, onChange, disabled }: { from?: number; to?: number; onChange: (from?: number, to?: number) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ from: from ? String(from) : '', to: to ? String(to) : '' });
  // Sync each box separately, so committing 'From' does not wipe what is being typed in 'To'.
  useEffect(() => setDraft((d) => ({ ...d, from: from ? String(from) : '' })), [from]);
  useEffect(() => setDraft((d) => ({ ...d, to: to ? String(to) : '' })), [to]);
  const fromN = draft.from ? Number(draft.from) : undefined;
  const toN = draft.to ? Number(draft.to) : undefined;
  const invalid = fromN !== undefined && toN !== undefined && fromN > toN;
  const commit = () => {
    if (!invalid && (fromN !== from || toN !== to)) onChange(fromN, toN);
  };
  return (
    <Box>
      <FormLabel component="legend" sx={{ fontSize: 14 }}>{t('filters.year')}</FormLabel>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        {(['from', 'to'] as const).map((key) => (
          <TextField
            key={key}
            size="small"
            label={key === 'from' ? t('filters.yearFrom') : t('filters.yearTo')}
            value={draft[key]}
            disabled={disabled}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            error={invalid}
            slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': key === 'from' ? t('filters.yearFromAria') : t('filters.yearToAria') } }}
          />
        ))}
      </Stack>
      {invalid && (
        <Typography variant="caption" color="error" role="alert" data-testid="year-error">
          {t('filters.yearError')}
        </Typography>
      )}
    </Box>
  );
}

function PriceFilter({ range, min, max, onChange, disabled }: { range: [number, number]; min?: number; max?: number; onChange: (min?: number, max?: number) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const [value, setValue] = useState<number[]>([min ?? range[0], max ?? range[1]]);
  useEffect(() => setValue([min ?? range[0], max ?? range[1]]), [min, max, range]);
  return (
    <Box sx={{ px: 1 }}>
      <FormLabel id="price-label" sx={{ fontSize: 14 }}>
        {t('filters.price', { min: value[0], max: value[1] })}
      </FormLabel>
      <Slider
        value={value}
        min={range[0]}
        max={range[1]}
        disabled={disabled}
        onChange={(_, v) => setValue(v as number[])}
        onChangeCommitted={(_, v) => {
          const [lo, hi] = v as number[];
          onChange(lo > range[0] ? lo : undefined, hi < range[1] ? hi : undefined);
        }}
        getAriaLabel={(i) => (i === 0 ? t('filters.priceMin') : t('filters.priceMax'))}
        valueLabelDisplay="auto"
      />
    </Box>
  );
}

/** Filter panel (flow 02). Calls onChange with the whole new filter set. */
export default function FilterPanel({ facets, counts, filters, onChange, authors, disabled }: Props) {
  const { t } = useTranslation();
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const count = (kind: keyof BookPage['facets'], key: string) => (counts ? ` (${counts[kind][key] ?? 0})` : '');
  return (
    <Stack spacing={2.5} data-testid="filter-panel" component="section" aria-label={t('filters.region')}>
      <FormControl component="fieldset" disabled={disabled}>
        <FormLabel component="legend" sx={{ fontSize: 14 }}>{t('filters.genre')}</FormLabel>
        <FormGroup>
          {facets.genres.map((g) => (
            <FormControlLabel
              key={g.slug}
              control={<Checkbox size="small" checked={filters.genre.includes(g.slug)} onChange={() => onChange({ ...filters, genre: toggle(filters.genre, g.slug) })} />}
              label={`${t(`values.genre.${g.slug}`, { defaultValue: g.name })}${count('genre', g.slug)}`}
            />
          ))}
        </FormGroup>
      </FormControl>
      <AuthorFilter value={filters.author} onChange={(author) => onChange({ ...filters, author })} authors={authors} disabled={disabled} />
      <YearFilter from={filters.yearFrom} to={filters.yearTo} onChange={(yearFrom, yearTo) => onChange({ ...filters, yearFrom, yearTo })} disabled={disabled} />
      <FormControl size="small" disabled={disabled}>
        <InputLabel id="language-label">{t('filters.language')}</InputLabel>
        <Select labelId="language-label" label={t('filters.language')} value={filters.language} onChange={(e) => onChange({ ...filters, language: e.target.value })}>
          <MenuItem value="">{t('filters.anyLanguage')}</MenuItem>
          {facets.languages.map((l) => (
            <MenuItem key={l} value={l}>{`${t(`values.language.${l}`, { defaultValue: l })}${count('language', l)}`}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl component="fieldset" disabled={disabled}>
        <FormLabel component="legend" sx={{ fontSize: 14 }}>{t('filters.format')}</FormLabel>
        <FormGroup>
          {facets.formats.map((f) => (
            <FormControlLabel
              key={f}
              control={<Checkbox size="small" checked={filters.format.includes(f)} onChange={() => onChange({ ...filters, format: toggle(filters.format, f) })} />}
              label={`${t(`values.format.${f}`, { defaultValue: f })}${count('format', f)}`}
            />
          ))}
        </FormGroup>
      </FormControl>
      <FormControlLabel
        control={<Switch checked={filters.inStock} onChange={(e) => onChange({ ...filters, inStock: e.target.checked })} disabled={disabled} />}
        label={t('filters.inStock')}
      />
      <FormControl size="small" disabled={disabled}>
        <InputLabel id="rating-label">{t('filters.minRating')}</InputLabel>
        <Select
          labelId="rating-label"
          label={t('filters.minRating')}
          value={filters.minRating ? String(filters.minRating) : ''}
          onChange={(e) => onChange({ ...filters, minRating: e.target.value ? Number(e.target.value) : undefined })}
        >
          <MenuItem value="">{t('filters.anyRating')}</MenuItem>
          {[1, 2, 3, 4, 5].map((r) => (
            <MenuItem key={r} value={String(r)}>{r === 5 ? t('filters.stars5') : t('filters.stars', { count: r })}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <PriceFilter range={facets.priceRange} min={filters.priceMin} max={filters.priceMax} onChange={(priceMin, priceMax) => onChange({ ...filters, priceMin, priceMax })} disabled={disabled} />
    </Stack>
  );
}
