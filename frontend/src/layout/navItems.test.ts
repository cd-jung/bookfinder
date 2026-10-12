import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, navHref } from './navItems';

const byKey = (key: string) => NAV_ITEMS.find((i) => i.labelKey === key)!;

describe('navHref', () => {
  it('keeps every entry in-app for the combined site', () => {
    expect(navHref(byKey('nav.logs'), 'all', 'https://admin', 'https://pub')).toEqual({ href: '/logs', external: false });
  });

  it('sends admin pages to the admin site from the public site, and back', () => {
    expect(navHref(byKey('nav.logs'), 'public', 'https://admin/', 'https://pub')).toEqual({ href: 'https://admin/logs', external: true });
    expect(navHref(byKey('nav.search'), 'public', 'https://admin', 'https://pub')).toEqual({ href: '/', external: false });
    expect(navHref(byKey('nav.guide'), 'admin', 'https://admin', 'https://pub')).toEqual({ href: 'https://pub/guide', external: true });
    expect(navHref(byKey('nav.coverage'), 'admin', 'https://admin', 'https://pub')).toEqual({ href: '/coverage', external: false });
  });
});
