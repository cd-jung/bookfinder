import type { SvgIconComponent } from '@mui/icons-material';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import MonitorHeartOutlined from '@mui/icons-material/MonitorHeartOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';

export interface NavItem {
  /** i18n key */
  labelKey: string;
  to: string;
  icon: SvgIconComponent;
  /** Static page served next to the app (not a client route). */
  external?: boolean;
  /** The site that serves this page; on the other site the entry links there. */
  site: 'public' | 'admin';
}

export const NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.search', to: '/', icon: SearchOutlined, site: 'public' },
  { labelKey: 'nav.guide', to: '/guide', icon: MenuBookOutlined, site: 'public' },
  { labelKey: 'nav.logs', to: '/logs', icon: MonitorHeartOutlined, site: 'admin' },
  { labelKey: 'nav.coverage', to: '/coverage', icon: FactCheckOutlined, site: 'admin' },
];

/** Where a menu entry points from the current site: an in-app route, or the other site's full URL. */
export function navHref(item: NavItem, site: 'public' | 'admin' | 'all', adminUrl: string, publicUrl: string) {
  if (site === 'all' || site === item.site) return { href: item.to, external: !!item.external };
  const base = item.site === 'admin' ? adminUrl : publicUrl;
  return { href: `${base.replace(/\/$/, '')}${item.to}`, external: true };
}
