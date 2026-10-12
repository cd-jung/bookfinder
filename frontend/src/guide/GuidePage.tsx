import { useEffect, type ReactNode } from 'react';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import { Alert, Box, Link, List, ListItem, ListItemButton, ListItemText, Paper, Stack, Typography } from '@mui/material';
import { GUIDE_PAGES } from './pages';
import { slugify } from './slug';

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

const heading =
  (level: 'h1' | 'h2' | 'h3' | 'h4') =>
  ({ children }: { children?: ReactNode }) => {
    const variants = { h1: 'h4', h2: 'h5', h3: 'h6', h4: 'subtitle1' } as const;
    return (
      <Typography id={slugify(textOf(children))} variant={variants[level]} component={level} sx={{ mt: 3, mb: 1, scrollMarginTop: 80 }}>
        {children}
      </Typography>
    );
  };

export default function GuidePage() {
  const { page } = useParams();
  const { hash } = useLocation();
  const current = page ? GUIDE_PAGES.find((p) => p.slug === page) : GUIDE_PAGES[0];

  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView?.({ block: 'start' });
    else window.scrollTo?.(0, 0);
  }, [hash, current?.slug]);

  return (
    <Stack sx={{ alignItems: 'flex-start' }} direction={{ xs: 'column', md: 'row' }} spacing={3}>
      <Paper variant="outlined" component="nav" aria-label="User Guide pages" sx={{ width: { xs: '100%', md: 240 }, flexShrink: 0 }}>
        <List dense>
          {GUIDE_PAGES.map((p) => (
            <ListItem key={p.slug} disablePadding>
            <ListItemButton
              component={RouterLink}
              to={`/guide/${p.slug}`}
              selected={p.slug === current?.slug}
              aria-current={p.slug === current?.slug ? 'page' : undefined}
            >
              <ListItemText primary={p.title} />
            </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Paper>
      <Box component="article" sx={{ flex: 1, minWidth: 0, '& li': { mb: 0.5 } }} data-testid="guide-article">
        {current ? (
          <Markdown
            skipHtml
            components={{
              h1: heading('h1'),
              h2: heading('h2'),
              h3: heading('h3'),
              h4: heading('h4'),
              p: ({ children }) => <Typography sx={{ mb: 1.5 }}>{children}</Typography>,
              a: ({ href, children }) =>
                href?.startsWith('/') ? (
                  <Link component={RouterLink} to={href}>
                    {children}
                  </Link>
                ) : (
                  <Link href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </Link>
                ),
            }}
          >
            {current.content}
          </Markdown>
        ) : (
          <Alert severity="warning">This User Guide page does not exist.</Alert>
        )}
      </Box>
    </Stack>
  );
}
