import { createTheme } from '@mui/material/styles';

/** Light and dark schemes follow the operating system setting. */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: { light: true, dark: true },
  shape: { borderRadius: 10 },
  typography: { fontFamily: 'Roboto, "Noto Sans KR", system-ui, sans-serif' },
});
