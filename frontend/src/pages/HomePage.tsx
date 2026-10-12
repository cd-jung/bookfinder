import { Card, CardContent, Stack, Typography } from '@mui/material';
import { APP_NAME } from '../config';

/** Placeholder for the project's main feature. Replace this page first in a new project. */
export default function HomePage() {
  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1">
        {APP_NAME}
      </Typography>
      <Card variant="outlined">
        <CardContent>
          <Typography>
            The main feature goes here. Open the User Guide from the menu, or ask the Help assistant.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
