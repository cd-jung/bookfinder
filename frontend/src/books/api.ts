import { getJson, postJson } from '../api/client';

export interface Facets {
  genres: { slug: string; name: string }[];
  languages: string[];
  formats: string[];
  yearRange: [number, number];
  priceRange: [number, number];
}

export interface BookCardData {
  id: number;
  isbn: string;
  title: string;
  authors: string[];
  year: number;
  rating: number;
  ratingCount: number;
  price: number;
  inStock: boolean;
  language: string;
  genres: string[];
  coverColor: string | null;
}

export interface BookFormat {
  type: string;
  price: number;
  inStock: boolean;
  expectedDate: string | null;
}

export interface BookDetail extends BookCardData {
  description: string;
  pages: number;
  publisher: string;
  publishedDate: string;
  formats: BookFormat[];
  series: { name: string; position: number; size: number } | null;
  award: { name: string; year: number } | null;
  subjects: string[];
  similar: BookCardData[];
}

export interface BookPage {
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  results: BookCardData[];
  facets: { genre: Record<string, number>; language: Record<string, number>; format: Record<string, number> };
}

export interface Translation {
  filter: FilterNode;
  description: string;
}

export type FilterNode =
  | { and: FilterNode[] }
  | { or: FilterNode[] }
  | { not: FilterNode }
  | { field: string; op: string; value: unknown }
  | { template: string; params: Record<string, unknown> };

export const booksApi = {
  facets: () => getJson<Facets>('/api/books/facets'),
  list: (params: Record<string, string | number | undefined>) => getJson<BookPage>('/api/books', params),
  detail: (id: number) => getJson<BookDetail>(`/api/books/${id}`),
  authors: (q: string) => getJson<{ results: string[] }>('/api/authors', { q }),
  translate: (question: string) => postJson<Translation>('/api/nl-search/translate', { question }),
  examples: () => getJson<{ examples: string[] }>('/api/nl-search/examples'),
};

export type BooksApi = typeof booksApi;
