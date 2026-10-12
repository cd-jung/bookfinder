import type { FilterNode } from './api';
import { EMPTY_FILTERS, type Filters } from './searchState';

/**
 * "Edit as filters": copy the AI filter's conditions into the filter panel (NL-007).
 * Only a top-level AND of simple conditions (or one condition) can be expressed by the panel;
 * everything else is reported back as `unsupported` so the UI can show a notice.
 */
export function editAsFilters(node: FilterNode): { filters: Filters; unsupported: string[] } {
  const filters: Filters = { ...EMPTY_FILTERS, genre: [], format: [] };
  const unsupported: string[] = [];
  const conditions = 'and' in node ? node.and : [node];
  for (const c of conditions) {
    if (!('field' in c)) {
      unsupported.push('template' in c ? c.template : 'or' in c ? 'OR group' : 'NOT condition');
      continue;
    }
    const value = c.value;
    const values = Array.isArray(value) ? value.map(String) : [String(value)];
    const n = Number(value);
    switch (`${c.field}:${c.op}`) {
      case 'genre:eq':
      case 'genre:in':
        filters.genre.push(...values);
        break;
      case 'format:eq':
      case 'format:in':
        filters.format.push(...values);
        break;
      case 'language:eq':
        filters.language = String(value);
        break;
      case 'author:eq':
        filters.author = String(value);
        break;
      case 'in_stock:eq':
        if (value === true) filters.inStock = true;
        else unsupported.push('out of stock');
        break;
      case 'published_year:gt':
        filters.yearFrom = n + 1;
        break;
      case 'published_year:gte':
        filters.yearFrom = n;
        break;
      case 'published_year:lt':
        filters.yearTo = n - 1;
        break;
      case 'published_year:lte':
        filters.yearTo = n;
        break;
      case 'published_year:eq':
        filters.yearFrom = n;
        filters.yearTo = n;
        break;
      case 'price:lt':
      case 'price:lte':
        filters.priceMax = n;
        break;
      case 'price:gt':
      case 'price:gte':
        filters.priceMin = n;
        break;
      case 'rating:gt':
      case 'rating:gte':
        filters.minRating = Math.min(5, Math.max(1, Math.round(n)));
        break;
      default:
        unsupported.push(`${c.field} ${c.op}`);
    }
  }
  return { filters, unsupported };
}
