import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from '../theme';

export function renderAt(ui: ReactElement, path = '/') {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </ThemeProvider>,
  );
}
