import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { APP_NAME } from '../config';
import { NAV_ITEMS } from './navItems';
import HelpChat from '../chat/HelpChat';
import { ChatProvider } from '../chat/ChatContext';

const DRAWER_WIDTH = 240;

export default function AppLayout() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  const menu = (
    <nav aria-label="Main menu">
      <List>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const linkProps = item.external
            ? { component: 'a' as const, href: item.to }
            : { component: RouterLink, to: item.to };
          return (
            <ListItem key={item.to} disablePadding>
            <ListItemButton
              {...linkProps}
              selected={!item.external && isActive(item.to)}
              aria-current={!item.external && isActive(item.to) ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              <ListItemIcon>
                <Icon />
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </nav>
  );

  return (
    <ChatProvider>
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          {!desktop && (
            <IconButton color="inherit" edge="start" aria-label="Open menu" onClick={() => setOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component={RouterLink} to="/" sx={{ color: 'inherit', textDecoration: 'none' }}>
            {APP_NAME}
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant={desktop ? 'permanent' : 'temporary'}
        open={desktop || open}
        onClose={() => setOpen(false)}
        sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
      >
        <Toolbar />
        {menu}
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: 3 } }}>
        <Toolbar />
        <Outlet />
      </Box>
      <HelpChat />
    </Box>
    </ChatProvider>
  );
}
