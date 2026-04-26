import { createTheme } from '@mui/material/styles';

/**
 * Theme Configuration with Light/Dark Mode Support
 * Factory function produces a complete MUI theme for the given mode.
 * Aggressive focus override to remove browser-specific blue boxes.
 */

export type ThemeMode = 'light' | 'dark';

export function createAppTheme(mode: ThemeMode = 'light') {
  return createTheme({
    palette: {
      mode,
      ...(mode === 'light'
        ? {
            primary: { main: '#1976d2' },
            secondary: { main: '#dc004e' },
            background: { default: '#f5f5f5', paper: '#ffffff' },
            text: { primary: '#212121', secondary: '#757575' },
          }
        : {
            primary: { main: '#9046ff' },
            secondary: { main: '#46ff90' },
            background: { default: '#121212', paper: '#1e1e1e' },
            text: { primary: '#e0e0e0', secondary: '#aaaaaa' },
          }),
    },
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
    },
    breakpoints: {
      values: {
        xs: 0,      // Mobile: 375x667
        sm: 600,    // Tablet portrait
        md: 900,    // Tablet landscape: 768x1024
        lg: 1200,   // Desktop
        xl: 1920,   // Large desktop: 1920x1080
      },
    },
    components: {
      // Global CSS baseline to aggressively remove browser focus styles
      MuiCssBaseline: {
        styleOverrides: {
          '*': {
            '&:focus': {
              outline: 'none !important',
              border: 'none !important',
              boxShadow: 'none !important',
            },
            '&:focus-visible': {
              outline: 'none !important',
              border: 'none !important',
              boxShadow: 'none !important',
            },
          },
          // Remove any browser-specific focus rings
          'input, textarea, select, button': {
            '&:focus': {
              outline: 'none !important',
              border: 'none !important',
              boxShadow: 'none !important',
            },
            '&:focus-visible': {
              outline: 'none !important',
              border: 'none !important',
              boxShadow: 'none !important',
            },
          },
        },
      },
    },
  });
}

// Backward-compatible default export for App.tsx outer ThemeProvider
export const theme = createAppTheme('light');
