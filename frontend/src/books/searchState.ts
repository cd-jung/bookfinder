/**
 * Search state <-> URL query string. The URL is the source of truth (reload, deep links,
 * Back / Forward all restore the search). Unknown params are ignored and invalid values fall
 * back to defaults (PAGE-008).
 */
export const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price', label: 'Price low-high' },
] as const;

export type Sort = (typeof SORTS)[number]['value'];

export interface Filters {
  genre: string[];
  author: string;
  yearFrom?: number;
  yearTo?: number;
  language: string;
  format: string[];
  inStock: boolean;
  minRating?: number;
  priceMin?: number;
  priceMax?: number;
}

export interface SearchState {
  mode: 'keyword' | 'nl';
  q: string;
  filters: Filters;
  sort: Sort;
  page: number;
  book?: number;
}

export const EMPTY_FILTERS: Filters = { genre: [], author: '', language: '', format: [], inStock: false };

const int = (raw: string | null, min = 1, max = 100000) => {
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return n >= min && n <= max ? n : undefined;
};
const num = (raw: string | null) => (raw && /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : undefined);
const list = (raw: string | null) => (raw ? raw.split(',').filter(Boolean) : []);

export function parseSearch(params: URLSearchParams): SearchState {
  const sort = params.get('sort');
  const yearFrom = int(params.get('year_from'), 0, 3000);
  const yearTo = int(params.get('year_to'), 0, 3000);
  const validYears = !(yearFrom && yearTo && yearFrom > yearTo);
  const rating = num(params.get('min_rating'));
  return {
    mode: params.get('mode') === 'nl' ? 'nl' : 'keyword',
    q: (params.get('q') ?? '').slice(0, 500),
    filters: {
      genre: list(params.get('genre')),
      author: params.get('author') ?? '',
      yearFrom: validYears ? yearFrom : undefined,
      yearTo: validYears ? yearTo : undefined,
      language: params.get('language') ?? '',
      format: list(params.get('format')),
      inStock: params.get('in_stock') === '1',
      minRating: rating && rating >= 1 && rating <= 5 ? rating : undefined,
      priceMin: num(params.get('price_min')),
      priceMax: num(params.get('price_max')),
    },
    sort: SORTS.some((s) => s.value === sort) ? (sort as Sort) : 'relevance',
    page: int(params.get('page')) ?? 1,
    book: int(params.get('book'), 1, 1_000_000_000),
  };
}

export function toParams(state: SearchState): URLSearchParams {
  const p = new URLSearchParams();
  const { filters: f } = state;
  if (state.mode === 'nl') p.set('mode', 'nl');
  if (state.q) p.set('q', state.q);
  if (f.genre.length) p.set('genre', f.genre.join(','));
  if (f.author) p.set('author', f.author);
  if (f.yearFrom) p.set('year_from', String(f.yearFrom));
  if (f.yearTo) p.set('year_to', String(f.yearTo));
  if (f.language) p.set('language', f.language);
  if (f.format.length) p.set('format', f.format.join(','));
  if (f.inStock) p.set('in_stock', '1');
  if (f.minRating) p.set('min_rating', String(f.minRating));
  if (f.priceMin !== undefined) p.set('price_min', String(f.priceMin));
  if (f.priceMax !== undefined) p.set('price_max', String(f.priceMax));
  if (state.sort !== 'relevance') p.set('sort', state.sort);
  if (state.page > 1) p.set('page', String(state.page));
  if (state.book) p.set('book', String(state.book));
  return p;
}

/** Query params for GET /api/books (keyword q is dropped in natural language mode). */
export function apiParams(state: SearchState, nlFilter?: unknown): Record<string, string | number | undefined> {
  const p = Object.fromEntries(toParams({ ...state, book: undefined, mode: 'keyword', q: state.mode === 'nl' ? '' : state.q }));
  if (nlFilter) p.nl_filter = JSON.stringify(nlFilter);
  return p;
}

export interface Chip {
  key: string;
  label: string;
  remove: (f: Filters) => Filters;
}

/** Active filter chips, in a stable order (the last chip is what "Remove last filter" removes). */
export function filterChips(f: Filters, genreName: (slug: string) => string = (s) => s): Chip[] {
  const chips: Chip[] = [];
  f.genre.forEach((g) => chips.push({ key: `genre:${g}`, label: `Genre: ${genreName(g)}`, remove: (x) => ({ ...x, genre: x.genre.filter((v) => v !== g) }) }));
  if (f.author) chips.push({ key: 'author', label: `Author: ${f.author}`, remove: (x) => ({ ...x, author: '' }) });
  if (f.yearFrom || f.yearTo)
    chips.push({ key: 'year', label: `Year: ${f.yearFrom ?? '…'}–${f.yearTo ?? '…'}`, remove: (x) => ({ ...x, yearFrom: undefined, yearTo: undefined }) });
  if (f.language) chips.push({ key: 'language', label: `Language: ${f.language}`, remove: (x) => ({ ...x, language: '' }) });
  f.format.forEach((v) => chips.push({ key: `format:${v}`, label: `Format: ${v}`, remove: (x) => ({ ...x, format: x.format.filter((y) => y !== v) }) }));
  if (f.inStock) chips.push({ key: 'stock', label: 'In stock only', remove: (x) => ({ ...x, inStock: false }) });
  if (f.minRating) chips.push({ key: 'rating', label: `Rating: ${f.minRating}+ stars`, remove: (x) => ({ ...x, minRating: undefined }) });
  if (f.priceMin !== undefined || f.priceMax !== undefined)
    chips.push({ key: 'price', label: `Price: $${f.priceMin ?? 0}–$${f.priceMax ?? '…'}`, remove: (x) => ({ ...x, priceMin: undefined, priceMax: undefined }) });
  return chips;
}
