import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Alert, Link } from '@mui/material';
import { useTranslation } from 'react-i18next';

/** A page that lives on the other site (public <-> admin): send the browser there, keeping path and query. */
export default function OtherSite({ url }: { url: string }) {
  const { pathname, search, hash } = useLocation();
  const { t } = useTranslation();
  const target = `${url.replace(/\/$/, '')}${pathname}${search}${hash}`;
  useEffect(() => {
    if (url) window.location.assign(target);
  }, [url, target]);
  return (
    <Alert severity="info">
      {t('admin.moved')} <Link href={target}>{target}</Link>
    </Alert>
  );
}
