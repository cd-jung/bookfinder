import type { SvgIconComponent } from '@mui/icons-material';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import MonitorHeartOutlined from '@mui/icons-material/MonitorHeartOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';

export interface NavItem {
  label: string;
  to: string;
  icon: SvgIconComponent;
  /** Static page served next to the app (not a client route). */
  external?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Book Search', to: '/', icon: SearchOutlined },
  { label: 'User Guide', to: '/guide', icon: MenuBookOutlined },
  { label: 'Logs & Monitoring', to: '/logs', icon: MonitorHeartOutlined },
  { label: 'Coverage', to: '/coverage/', icon: FactCheckOutlined, external: true },
];
