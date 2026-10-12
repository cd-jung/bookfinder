import { useEffect, useState } from 'react';
import { Alert, Box, Link, Skeleton, Stack, Typography } from '@mui/material';
import { Trans, useTranslation } from 'react-i18next';

/** The generated report (scripts/build-site.sh); its <meta name="generator"> marks the real file. */
export const REPORT_URL = '/reports/coverage.html';
const MARKER = 'name="generator" content="coverage-report"';

type State = 'loading' | 'ready' | 'missing';



/** Coverage page: the static coverage report shown inside the app layout. */
export default function CoveragePage({ src = REPORT_URL }: { src?: string }) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    let live = true;
    // In development the report does not exist and the dev server answers with the app itself.
    fetch(src, { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((html) => live && setState(html.includes(MARKER) ? 'ready' : 'missing'))
      .catch(() => live && setState('missing'));
    return () => {
      live = false;
    };
  }, [src]);

  return (
    <Stack spacing={2} sx={{ height: { md: 'calc(100vh - 112px)' } }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1" sx={{ flex: 1 }}>
          {t('coverage.title')}
        </Typography>
        {state === 'ready' && (
          <Link href={src} target="_blank" rel="noopener noreferrer">
            {t('coverage.openNewTab')}
          </Link>
        )}
      </Stack>
      {state === 'loading' && <Skeleton variant="rounded" height={480} />}
      {state === 'missing' && (
        <Alert severity="info">
          <Trans i18nKey="coverage.missing" values={{ unit: 'npm run test:unit', build: 'npm run build:site' }} />
        </Alert>
      )}
      {state === 'ready' && i18n.language !== 'en' && (
        <Typography variant="body2" color="text.secondary" data-testid="coverage-note">
          {t('coverage.note')}
        </Typography>
      )}
      {state === 'ready' && (
        <Box
          component="iframe"
          src={src}
          title={t('coverage.frame')}
          data-testid="coverage-frame"
          sx={{ flex: 1, width: '100%', minHeight: { xs: '75vh', md: 0 }, border: 1, borderColor: 'divider', borderRadius: 1 }}
        />
      )}
    </Stack>
  );
}
