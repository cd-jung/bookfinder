import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { ApiError } from '../api/client';
import { ChatProvider } from '../chat/ChatContext';
import HelpChat from '../chat/HelpChat';
import { renderAt } from '../test/render';
import type { BookCardData, BookDetail, BookPage, BooksApi, Facets } from './api';
import { HELP_PREFILL_EMPTY } from './constants';
import SearchPage from './SearchPage';

const facets: Facets = {
  genres: [{ slug: 'fantasy', name: 'Fantasy' }, { slug: 'poetry', name: 'Poetry' }],
  languages: ['English', 'Korean'],
  formats: ['Paperback', 'eBook'],
  yearRange: [1950, 2026],
  priceRange: [2, 50],
};
const card = (id: number, extra: Partial<BookCardData> = {}): BookCardData => ({
  id, isbn: `97800000000${id}`, title: `Book ${id}`, authors: ['Ann Author'], year: 2000 + id, rating: 4.2, ratingCount: 10,
  price: 9.5, inStock: true, language: 'English', genres: ['fantasy'], coverColor: '#1f5fa8', ...extra,
});
const page = (results: BookCardData[], extra: Partial<BookPage> = {}): BookPage => ({
  total: results.length, page: 1, pages: 1, pageSize: 20, results,
  facets: { genre: { fantasy: results.length }, language: { English: results.length }, format: { Paperback: results.length } }, ...extra,
});
const detail = (id: number): BookDetail => ({
  ...card(id), description: 'A story.', pages: 300, publisher: 'Press', publishedDate: '2001-02-03',
  formats: [{ type: 'Paperback', price: 9.5, inStock: true, expectedDate: null }, { type: 'eBook', price: 4, inStock: false, expectedDate: '2026-11-01' }],
  series: null, award: null, subjects: [], similar: [card(99)],
});

function makeApi(overrides: Partial<BooksApi> = {}): BooksApi {
  return {
    facets: vi.fn().mockResolvedValue(facets),
    list: vi.fn().mockResolvedValue(page([card(1), card(2, { coverColor: null, inStock: false })])),
    detail: vi.fn((id: number) => Promise.resolve(detail(id))),
    authors: vi.fn().mockResolvedValue({ results: ['Han Kang'] }),
    translate: vi.fn().mockResolvedValue({ filter: { field: 'language', op: 'eq', value: 'Korean' }, description: 'language is Korean' }),
    ...overrides,
  };
}

function Url() {
  const location = useLocation();
  return <output data-testid="url">{location.search}</output>;
}

function setup(api = makeApi(), path = '/') {
  renderAt(
    <ChatProvider>
      <SearchPage api={api} />
      <HelpChat api={{ ask: vi.fn(), feedback: vi.fn() }} />
      <Url />
    </ChatProvider>,
    path,
  );
  return api;
}

const url = () => screen.getByTestId('url').textContent ?? '';

describe('SearchPage', () => {
  it('loads facets and popular books, with cover placeholder and availability', async () => {
    const api = setup();
    expect(await screen.findByText('2 books found')).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith({});
    expect(screen.getAllByTestId('book-card')).toHaveLength(2);
    expect(screen.getByTestId('cover-placeholder')).toHaveAccessibleName('No cover available');
    expect(screen.getAllByTestId('book-card-availability').map((b) => b.textContent)).toEqual(['In stock', 'Out of stock']);
    expect(screen.getByRole('region', { name: 'Results' })).toHaveAttribute('aria-busy', 'false');
  });

  it('runs a keyword search and clears it', async () => {
    const api = setup();
    await screen.findByText('2 books found');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search books' }), 'dune{Enter}');
    expect(url()).toBe('?q=dune');
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ q: 'dune' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(url()).toBe('');
  });

  it('applies filters through the mobile drawer and shows chips', async () => {
    const api = setup();
    await screen.findByText('2 books found');
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Fantasy/ }));
    await userEvent.click(screen.getByRole('switch', { name: 'In stock only' }));
    expect(url()).toBe('');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(url()).toBe('?genre=fantasy&in_stock=1');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument());
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ genre: 'fantasy', in_stock: '1' }));
    expect(screen.getAllByTestId('filter-chip').map((c) => c.textContent)).toEqual(['Genre: Fantasy', 'In stock only']);
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(url()).toBe('');
  });

  it('shows the inline year error and does not apply an invalid range', async () => {
    setup();
    await screen.findByText('2 books found');
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Year from' }), '2020');
    await userEvent.type(screen.getByRole('textbox', { name: 'Year to' }), '2010{Enter}');
    expect(screen.getByTestId('year-error')).toBeInTheDocument();
  });

  it('suggests authors after 2 characters', async () => {
    const api = setup();
    await screen.findByText('2 books found');
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.type(screen.getByRole('combobox', { name: 'Author' }), 'ha');
    expect(await screen.findByRole('option', { name: 'Han Kang' })).toBeInTheDocument();
    expect(api.authors).toHaveBeenCalledWith('ha');
  });

  it('empty results offer Remove last filter and Get help (prefilled)', async () => {
    const list = vi.fn().mockResolvedValueOnce(page([])).mockResolvedValue(page([card(1)]));
    const api = setup(makeApi({ list }), '/?genre=poetry&language=Korean');
    expect(await screen.findByText('No books match')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove last filter' }));
    expect(url()).toBe('?genre=poetry');
    expect(await screen.findByText('1 book found')).toBeInTheDocument();
    list.mockResolvedValue(page([]));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search books' }), 'zzz{Enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'Get help' }));
    expect(await screen.findByRole('textbox', { name: 'Ask a question' })).toHaveValue(HELP_PREFILL_EMPTY);
    expect(api.list).toHaveBeenCalled();
  });

  it('natural language: translate, Interpreted as, nl_filter, Edit as filters', async () => {
    const api = setup();
    await screen.findByText('2 books found');
    await userEvent.click(screen.getByRole('tab', { name: 'Ask in plain language (AI)' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask in plain language' }), 'korean books{Enter}');
    expect(await screen.findByText('language is Korean', { exact: false })).toHaveTextContent('Interpreted as: language is Korean');
    expect(url()).toBe('?mode=nl&q=korean+books');
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ nl_filter: '{"field":"language","op":"eq","value":"Korean"}' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit as filters' }));
    expect(url()).toBe('?language=Korean');
    expect(screen.getByRole('tab', { name: 'Keyword & filters' })).toHaveAttribute('aria-selected', 'true');
  });

  it('natural language example chips run their question', async () => {
    const api = setup();
    await userEvent.click(screen.getByRole('tab', { name: 'Ask in plain language (AI)' }));
    await userEvent.click(screen.getAllByTestId('nl-example')[1]);
    await waitFor(() => expect(api.translate).toHaveBeenCalledWith('fantasy or sci-fi, but not audiobooks'));
  });

  it.each([
    [new ApiError(422, { detail: 'x' }), 'The question could not be translated. Please rephrase it.'],
    [new ApiError(502, { detail: 'x' }), 'The AI search is unavailable. Use keyword search instead.'],
    [new ApiError(429, { detail: 'Too many questions, please wait 5 seconds' }), 'Too many questions, please wait 5 seconds'],
  ])('maps translate errors', async (error, message) => {
    setup(makeApi({ translate: vi.fn().mockRejectedValue(error) }), '/?mode=nl&q=x');
    expect(await screen.findByTestId('nl-error')).toHaveTextContent(message);
  });

  it('shows Try keyword search when the AI search finds nothing', async () => {
    setup(makeApi({ list: vi.fn().mockResolvedValue(page([])) }), '/?mode=nl&q=nothing');
    await userEvent.click(await screen.findByRole('button', { name: 'Try keyword search' }));
    expect(url()).toBe('');
  });

  it.each([
    [new ApiError(504, { detail: 'x' }), 'Search took too long, try a narrower question'],
    [new ApiError(400, { nl_filter: "Field 'x' is not allowed" }), "Field 'x' is not allowed"],
    [new ApiError(500, { detail: 'x' }), 'Could not load books'],
  ])('maps list errors and retries', async (error, message) => {
    const list = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(page([card(1)]));
    setup(makeApi({ list }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('1 book found')).toBeInTheDocument();
  });

  it('shows the facets error banner with Retry', async () => {
    const facetsMock = vi.fn().mockRejectedValueOnce(new ApiError(500, null)).mockResolvedValue(facets);
    setup(makeApi({ facets: facetsMock }));
    expect(await screen.findByText('Could not load the catalogue filters.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText('Could not load the catalogue filters.')).not.toBeInTheDocument());
  });

  it('opens a book in the dialog, opens a similar book and closes', async () => {
    const api = setup();
    await screen.findByText('2 books found');
    await userEvent.click(screen.getAllByTestId('book-card')[0].querySelector('button')!);
    expect(url()).toBe('?book=1');
    const dialog = await screen.findByRole('dialog', { name: 'Book 1' });
    expect(within(dialog).getByText('Out of stock · expected 2026-11-01')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByTestId('similar-book'));
    expect(url()).toBe('?book=99');
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    expect(url()).toBe('');
    expect(api.detail).toHaveBeenCalledWith(99);
  });

  it('clicking an author searches by that author', async () => {
    setup(makeApi(), '/?book=1');
    await userEvent.click(await screen.findByTestId('book-author'));
    expect(url()).toBe('?q=Ann+Author');
  });

  it('reports a missing book and keeps the results', async () => {
    setup(makeApi({ detail: vi.fn().mockRejectedValue(new ApiError(404, { detail: 'Book not found' })) }), '/?book=5');
    expect(await screen.findByText('Book not found')).toBeInTheDocument();
    await waitFor(() => expect(url()).toBe(''));
  });

  it('changes sort, page and view', async () => {
    const list = vi.fn((p: Record<string, unknown>) => Promise.resolve(page([card(1)], { total: 60, pages: 3, page: Number(p.page ?? 1) })));
    setup(makeApi({ list }));
    await screen.findByText('60 books found');
    await userEvent.click(screen.getByRole('combobox', { name: 'Sort by' }));
    await userEvent.click(screen.getByRole('option', { name: 'Newest' }));
    expect(url()).toBe('?sort=newest');
    await userEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(url()).toBe('?sort=newest&page=2');
    await userEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByTestId('results-list')).toBeInTheDocument();
    expect(localStorage.getItem('bookfinder-view')).toBe('list');
  });

  it('disables search while offline', async () => {
    setup();
    await screen.findByText('2 books found');
    window.dispatchEvent(new Event('offline'));
    expect(await screen.findByText(/You are offline/)).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search books' })).toBeDisabled();
    window.dispatchEvent(new Event('online'));
  });
});
