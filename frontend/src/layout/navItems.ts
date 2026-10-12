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
}

export const NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.search', to: '/', icon: SearchOutlined },
  { labelKey: 'nav.guide', to: '/guide', icon: MenuBookOutlined },
  { labelKey: 'nav.logs', to: '/logs', icon: MonitorHeartOutlined },
  { labelKey: 'nav.coverage', to: '/coverage', icon: FactCheckOutlined },
];
