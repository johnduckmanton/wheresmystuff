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
          // Touch-friendly button sizes on mobile
          '@media (max-width:600px)': {
            minHeight: 44,
            minWidth: 44,
            padding: '12px 16px',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          // Touch-friendly icon button sizes on mobile
          '@media (max-width:600px)': {
            minHeight: 48,
            minWidth: 48,
            padding: 12,
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          // Larger FAB on mobile for better touch targets
          '@media (max-width:600px)': {
            width: 64,
            height: 64,
          },
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
            maxHeight: 'calc(100% - 32px)',
          },
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          // Mobile-friendly dialog titles
          '@media (max-width:600px)': {
            fontSize: '1.25rem',
            padding: '16px 16px 8px',
          },
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          // Mobile-friendly dialog content
          '@media (max-width:600px)': {
            padding: '8px 16px',
          },
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          // Mobile-friendly dialog actions
          '@media (max-width:600px)': {
            padding: '8px 16px 16px',
            gap: 8,
            '& .MuiButton-root': {
              flex: 1,
              minHeight: 44,
            },
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        // Better mobile input experience
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          // Mobile-friendly text fields
          '@media (max-width:600px)': {
            '& .MuiInputBase-root': {
              minHeight: 48,
            },
            '& .MuiInputBase-input': {
              fontSize: '16px', // Prevents zoom on iOS
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          // Mobile-friendly cards
          '@media (max-width:600px)': {
            borderRadius: 12,
            '&:active': {
              transform: 'scale(0.98)',
              transition: 'transform 0.1s ease',
            },
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          // Mobile-friendly card content
          '@media (max-width:600px)': {
            padding: 16,
            '&:last-child': {
              paddingBottom: 16,
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          // Touch-friendly chips on mobile
          '@media (max-width:600px)': {
            minHeight: 32,
            '& .MuiChip-label': {
              padding: '0 8px',
            },
          },
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          // Ensure bottom navigation is touch-friendly
          height: 56,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: '6px 12px 8px',
          },
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          // Touch-friendly list items
          '@media (max-width:600px)': {
            minHeight: 48,
            padding: '12px 16px',
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          // Touch-friendly menu items
          '@media (max-width:600px)': {
            minHeight: 48,
            padding: '12px 16px',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          // Mobile-friendly table cells
          '@media (max-width:600px)': {
            padding: '8px 4px',
            fontSize: '0.875rem',
          },
        },
      },
    },
  },
});
