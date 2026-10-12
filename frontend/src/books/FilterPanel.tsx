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
      noOptionsText={input.trim().length < 2 ? 'Type at least 2 characters' : 'No authors found'}
      renderInput={(params) => <TextField {...params} label="Author" />}
    />
  );
}

function YearFilter({ from, to, onChange, disabled }: { from?: number; to?: number; onChange: (from?: number, to?: number) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState({ from: from ? String(from) : '', to: to ? String(to) : '' });
  // Sync each box separately, so committing 'From' does not wipe what is being typed in 'To'.
  useEffect(() => setDraft((d) => ({ ...d, from: from ? String(from) : '' })), [from]);
  useEffect(() => setDraft((d) => ({ ...d, to: to ? String(to) : '' })), [to]);
  const f = draft.from ? Number(draft.from) : undefined;
  const t = draft.to ? Number(draft.to) : undefined;
  const invalid = f !== undefined && t !== undefined && f > t;
  const commit = () => {
    if (!invalid && (f !== from || t !== to)) onChange(f, t);
  };
  return (
    <Box>
      <FormLabel component="legend" sx={{ fontSize: 14 }}>Publication year</FormLabel>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        {(['from', 'to'] as const).map((key) => (
          <TextField
            key={key}
            size="small"
            label={key === 'from' ? 'From' : 'To'}
            value={draft[key]}
            disabled={disabled}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            error={invalid}
            slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': key === 'from' ? 'Year from' : 'Year to' } }}
          />
        ))}
      </Stack>
      {invalid && (
        <Typography variant="caption" color="error" role="alert" data-testid="year-error">
          'From' year must not be after 'To' year.
        </Typography>
      )}
    </Box>
  );
}

function PriceFilter({ range, min, max, onChange, disabled }: { range: [number, number]; min?: number; max?: number; onChange: (min?: number, max?: number) => void; disabled?: boolean }) {
  const [value, setValue] = useState<number[]>([min ?? range[0], max ?? range[1]]);
  useEffect(() => setValue([min ?? range[0], max ?? range[1]]), [min, max, range]);
  return (
    <Box sx={{ px: 1 }}>
      <FormLabel id="price-label" sx={{ fontSize: 14 }}>
        Price: ${value[0]} – ${value[1]}
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
        getAriaLabel={(i) => (i === 0 ? 'Minimum price' : 'Maximum price')}
        valueLabelDisplay="auto"
      />
    </Box>
  );
}

/** Filter panel (flow 02). Calls onChange with the whole new filter set. */
export default function FilterPanel({ facets, counts, filters, onChange, authors, disabled }: Props) {
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const count = (kind: keyof BookPage['facets'], key: string) => (counts ? ` (${counts[kind][key] ?? 0})` : '');
  return (
    <Stack spacing={2.5} data-testid="filter-panel" component="section" aria-label="Filters">
      <FormControl component="fieldset" disabled={disabled}>
        <FormLabel component="legend" sx={{ fontSize: 14 }}>Genre</FormLabel>
        <FormGroup>
          {facets.genres.map((g) => (
            <FormControlLabel
              key={g.slug}
              control={<Checkbox size="small" checked={filters.genre.includes(g.slug)} onChange={() => onChange({ ...filters, genre: toggle(filters.genre, g.slug) })} />}
              label={`${g.name}${count('genre', g.slug)}`}
            />
          ))}
        </FormGroup>
      </FormControl>
      <AuthorFilter value={filters.author} onChange={(author) => onChange({ ...filters, author })} authors={authors} disabled={disabled} />
      <YearFilter from={filters.yearFrom} to={filters.yearTo} onChange={(yearFrom, yearTo) => onChange({ ...filters, yearFrom, yearTo })} disabled={disabled} />
      <FormControl size="small" disabled={disabled}>
        <InputLabel id="language-label">Language</InputLabel>
        <Select labelId="language-label" label="Language" value={filters.language} onChange={(e) => onChange({ ...filters, language: e.target.value })}>
          <MenuItem value="">Any language</MenuItem>
          {facets.languages.map((l) => (
            <MenuItem key={l} value={l}>{`${l}${count('language', l)}`}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl component="fieldset" disabled={disabled}>
        <FormLabel component="legend" sx={{ fontSize: 14 }}>Format</FormLabel>
        <FormGroup>
          {facets.formats.map((f) => (
            <FormControlLabel
              key={f}
              control={<Checkbox size="small" checked={filters.format.includes(f)} onChange={() => onChange({ ...filters, format: toggle(filters.format, f) })} />}
              label={`${f}${count('format', f)}`}
            />
          ))}
        </FormGroup>
      </FormControl>
      <FormControlLabel
        control={<Switch checked={filters.inStock} onChange={(e) => onChange({ ...filters, inStock: e.target.checked })} disabled={disabled} />}
        label="In stock only"
      />
      <FormControl size="small" disabled={disabled}>
        <InputLabel id="rating-label">Minimum rating</InputLabel>
        <Select
          labelId="rating-label"
          label="Minimum rating"
          value={filters.minRating ? String(filters.minRating) : ''}
          onChange={(e) => onChange({ ...filters, minRating: e.target.value ? Number(e.target.value) : undefined })}
        >
          <MenuItem value="">Any rating</MenuItem>
          {[1, 2, 3, 4, 5].map((r) => (
            <MenuItem key={r} value={String(r)}>{r === 5 ? '5 stars' : `${r}+ stars`}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <PriceFilter range={facets.priceRange} min={filters.priceMin} max={filters.priceMax} onChange={(priceMin, priceMax) => onChange({ ...filters, priceMin, priceMax })} disabled={disabled} />
    </Stack>
  );
}
