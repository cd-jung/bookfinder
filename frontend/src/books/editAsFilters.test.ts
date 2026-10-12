import { describe, expect, it } from 'vitest';
import { editAsFilters } from './editAsFilters';

describe('editAsFilters', () => {
  it('maps every supported condition', () => {
    const { filters, unsupported } = editAsFilters({
      and: [
        { field: 'genre', op: 'in', value: ['fantasy', 'poetry'] },
        { field: 'format', op: 'eq', value: 'eBook' },
        { field: 'language', op: 'eq', value: 'Korean' },
        { field: 'author', op: 'eq', value: 'Han Kang' },
        { field: 'in_stock', op: 'eq', value: true },
        { field: 'published_year', op: 'gt', value: 2015 },
        { field: 'published_year', op: 'lte', value: 2020 },
        { field: 'price', op: 'lt', value: 20 },
        { field: 'price', op: 'gte', value: 5 },
        { field: 'rating', op: 'gte', value: 4.2 },
      ],
    });
    expect(unsupported).toEqual([]);
    expect(filters).toEqual({ genre: ['fantasy', 'poetry'], format: ['eBook'], language: 'Korean', author: 'Han Kang', inStock: true, yearFrom: 2016, yearTo: 2020, priceMax: 20, priceMin: 5, minRating: 4 });
  });

  it('handles year eq / gte / lt and a single condition', () => {
    expect(editAsFilters({ field: 'published_year', op: 'eq', value: 2001 }).filters).toMatchObject({ yearFrom: 2001, yearTo: 2001 });
    expect(editAsFilters({ and: [{ field: 'published_year', op: 'gte', value: 2001 }, { field: 'published_year', op: 'lt', value: 2010 }] }).filters).toMatchObject({ yearFrom: 2001, yearTo: 2009 });
  });

  it('reports what the panel cannot express', () => {
    const { unsupported } = editAsFilters({
      and: [
        { template: 'award_winner', params: {} },
        { or: [{ field: 'genre', op: 'eq', value: 'fantasy' }] },
        { not: { field: 'format', op: 'eq', value: 'Audiobook' } },
        { field: 'in_stock', op: 'eq', value: false },
        { field: 'title', op: 'icontains', value: 'x' },
      ],
    });
    expect(unsupported).toEqual(['award_winner', 'OR group', 'NOT condition', 'out of stock', 'title icontains']);
  });
});
