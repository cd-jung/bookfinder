import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Stack sx={{ alignItems: 'flex-start' }} spacing={2}>
      <Typography variant="h4" component="h1">
        {t('common.notFoundTitle')}
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        {t('common.goHome')}
      </Button>
    </Stack>
  );
}
