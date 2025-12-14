import { createTheme } from '@mui/material/styles';

/**
 * Theme Configuration with Responsive Breakpoints
 * Breakpoints:
 * - xs: 0px (mobile)
 * - sm: 600px (tablet portrait)
 * - md: 900px (tablet landscape)
 * - lg: 1200px (desktop)
 * - xl: 1536px (large desktop)
 * Validates: Requirements 20.2, 20.3, 20.4
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
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
    // Responsive font sizes
    h6: {
      fontSize: '1.25rem',
      '@media (max-width:600px)': {
        fontSize: '1rem',
      },
    },
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
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          // Responsive dialog sizing
          '@media (max-width:600px)': {
            margin: 16,
            maxWidth: 'calc(100% - 32px)',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        // Better mobile input experience
        variant: 'outlined',
      },
    },
  },
});
