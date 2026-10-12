import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { apiParams, EMPTY_FILTERS, filterChips, parseSearch, toParams } from './searchState';

describe('searchState', () => {
  it('round-trips a full search through the URL', () => {
    const qs = 'mode=nl&q=korean+novels&genre=fantasy%2Cpoetry&author=Han+Kang&year_from=2015&year_to=2018&language=Korean&format=eBook&in_stock=1&min_rating=4&price_min=5&price_max=20&sort=rating&page=3&book=7';
    const state = parseSearch(new URLSearchParams(qs));
    expect(state).toMatchObject({ mode: 'nl', q: 'korean novels', sort: 'rating', page: 3, book: 7 });
    expect(state.filters).toEqual({ genre: ['fantasy', 'poetry'], author: 'Han Kang', yearFrom: 2015, yearTo: 2018, language: 'Korean', format: ['eBook'], inStock: true, minRating: 4, priceMin: 5, priceMax: 20 });
    expect(parseSearch(toParams(state))).toEqual(state);
  });

  it('falls back to defaults for invalid values', () => {
    const state = parseSearch(new URLSearchParams('page=-1&sort=foo&min_rating=9&year_from=2020&year_to=2010&price_min=abc&mode=x'));
    expect(state).toMatchObject({ mode: 'keyword', sort: 'relevance', page: 1 });
    expect(state.filters).toEqual({ ...EMPTY_FILTERS, yearFrom: undefined, yearTo: undefined, minRating: undefined, priceMin: undefined, priceMax: undefined });
  });

  it('drops the keyword in NL mode and adds nl_filter', () => {
    const state = parseSearch(new URLSearchParams('mode=nl&q=question&in_stock=1&book=3'));
    expect(apiParams(state, { field: 'x' })).toEqual({ in_stock: '1', nl_filter: '{"field":"x"}' });
    expect(apiParams(parseSearch(new URLSearchParams('q=dune')))).toEqual({ q: 'dune' });
  });

  it('builds chips that remove their own filter', () => {
    const f = parseSearch(new URLSearchParams('genre=fantasy&author=A&year_to=2000&language=French&format=eBook&in_stock=1&min_rating=3&price_max=9')).filters;
    const chips = filterChips(f);
    expect(chips.map((c) => c.label)).toEqual([
      'Genre: fantasy', 'Author: A', 'Year: …–2000', 'Language: French', 'Format: eBook', 'In stock only', 'Rating: 3+ stars', 'Price: $0–$9',
    ]);
    expect(filterChips(f, i18n.t.bind(i18n) as never).map((c) => c.label)[0]).toBe('Genre: Fantasy');
    void i18n.changeLanguage('ko');
    expect(filterChips(f, i18n.t.bind(i18n) as never).map((c) => c.label).slice(0, 4)).toEqual(['장르: 판타지', '저자: A', '연도: …–2000', '언어: 프랑스어']);
    const cleared = chips.reduce((acc, chip) => chip.remove(acc), f);
    expect(filterChips(cleared)).toEqual([]);
  });
});
