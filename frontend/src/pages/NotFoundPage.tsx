import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <Stack sx={{ alignItems: 'flex-start' }} spacing={2}>
      <Typography variant="h4" component="h1">
        Page not found
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Go to Home
      </Button>
    </Stack>
  );
}
