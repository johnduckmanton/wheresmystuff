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
            primary: { main: '#8A2BE2' },
            secondary: { main: '#3dd6a0' },
            error: { main: '#f44336' },
            background: { default: '#0a0a0a', paper: '#161616' },
            text: { primary: '#f0f0f0', secondary: '#b0b0b0' },
            action: {
              active: '#3dd6a0',
              hover: 'rgba(61, 214, 160, 0.08)',
              selected: 'rgba(61, 214, 160, 0.16)',
              disabled: 'rgba(240, 240, 240, 0.3)',
              disabledBackground: 'rgba(240, 240, 240, 0.12)',
            },
            divider: 'rgba(61, 214, 160, 0.2)',
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
      // Force vibrant colors in dark mode (MUI desaturates by default)
      ...(mode === 'dark' && {
        MuiButton: {
          styleOverrides: {
            root: {
              // Default text buttons use green
              color: '#3dd6a0',
            },
            containedPrimary: {
              backgroundColor: '#8A2BE2',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#7B1FA2',
              },
            },
            containedSecondary: {
              backgroundColor: '#3dd6a0',
              color: '#000000',
              '&:hover': {
                backgroundColor: '#2bb88a',
              },
            },
            containedError: {
              backgroundColor: '#f44336',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#d32f2f',
              },
            },
            outlinedPrimary: {
              borderColor: '#8A2BE2',
              color: '#8A2BE2',
              '&:hover': {
                borderColor: '#9F4BF7',
                backgroundColor: 'rgba(138, 43, 226, 0.08)',
              },
            },
            outlinedSecondary: {
              borderColor: '#3dd6a0',
              color: '#3dd6a0',
              '&:hover': {
                borderColor: '#5ee8b7',
                backgroundColor: 'rgba(61, 214, 160, 0.08)',
              },
            },
            textPrimary: {
              color: '#8A2BE2',
            },
            textSecondary: {
              color: '#3dd6a0',
            },
            textError: {
              color: '#f44336',
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundColor: '#8A2BE2',
            },
          },
        },
        MuiSvgIcon: {
          styleOverrides: {
            root: {
              color: '#3dd6a0',
            },
            colorPrimary: {
              color: '#8A2BE2',
            },
            colorSecondary: {
              color: '#3dd6a0',
            },
            colorError: {
              color: '#f44336',
            },
            colorDisabled: {
              color: 'rgba(240, 240, 240, 0.3)',
            },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              color: '#3dd6a0',
              '&:hover': {
                backgroundColor: 'rgba(61, 214, 160, 0.08)',
              },
              '&:focus-visible': {
                outline: '2px solid #3dd6a0',
                outlineOffset: '2px',
              },
              '& .MuiTouchRipple-root': {
                color: '#3dd6a0',
              },
            },
            colorPrimary: {
              color: '#8A2BE2',
              '&:hover': {
                backgroundColor: 'rgba(138, 43, 226, 0.08)',
              },
              '&:focus-visible': {
                outline: '2px solid #8A2BE2',
              },
              '& .MuiTouchRipple-root': {
                color: '#8A2BE2',
              },
            },
            colorSecondary: {
              color: '#3dd6a0',
              '&:hover': {
                backgroundColor: 'rgba(61, 214, 160, 0.08)',
              },
              '& .MuiTouchRipple-root': {
                color: '#3dd6a0',
              },
            },
            colorError: {
              color: '#f44336',
              '&:hover': {
                backgroundColor: 'rgba(244, 67, 54, 0.08)',
              },
              '& .MuiTouchRipple-root': {
                color: '#f44336',
              },
            },
          },
        },
        MuiInputBase: {
          styleOverrides: {
            root: {
              color: '#f0f0f0',
              '& .MuiSvgIcon-root': {
                color: '#3dd6a0',
              },
            },
          },
        },
        MuiInputAdornment: {
          styleOverrides: {
            root: {
              color: '#3dd6a0',
              '& .MuiSvgIcon-root': {
                color: '#3dd6a0',
              },
            },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            notchedOutline: {
              borderColor: 'rgba(61, 214, 160, 0.3)',
            },
            root: {
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#3dd6a0',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#8A2BE2',
              },
            },
          },
        },
        MuiInputLabel: {
          styleOverrides: {
            root: {
              color: '#b0b0b0',
              '&.Mui-focused': {
                color: '#8A2BE2',
              },
            },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              color: '#b0b0b0',
              '&.Mui-selected': {
                color: '#8A2BE2',
              },
            },
          },
        },
        MuiTabs: {
          styleOverrides: {
            indicator: {
              backgroundColor: '#8A2BE2',
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              borderColor: 'rgba(61, 214, 160, 0.3)',
            },
            colorPrimary: {
              backgroundColor: '#8A2BE2',
              color: '#ffffff',
            },
            colorSecondary: {
              backgroundColor: '#3dd6a0',
              color: '#000000',
            },
            deleteIcon: {
              color: 'rgba(240, 240, 240, 0.5)',
              '&:hover': {
                color: '#f44336',
              },
            },
          },
        },
        MuiCheckbox: {
          styleOverrides: {
            root: {
              color: '#3dd6a0',
              '&.Mui-checked': {
                color: '#3dd6a0',
              },
            },
          },
        },
        MuiSwitch: {
          styleOverrides: {
            switchBase: {
              '&.Mui-checked': {
                color: '#8A2BE2',
                '& + .MuiSwitch-track': {
                  backgroundColor: '#8A2BE2',
                },
              },
            },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              backgroundColor: '#161616',
              '& .MuiSvgIcon-root': {
                color: '#3dd6a0',
              },
              '& .MuiIconButton-root': {
                color: '#3dd6a0',
              },
              '& .MuiIconButton-colorError, & [color="error"] .MuiSvgIcon-root': {
                color: '#f44336',
              },
            },
          },
        },
        MuiBottomNavigation: {
          styleOverrides: {
            root: {
              backgroundColor: '#161616',
            },
          },
        },
        MuiBottomNavigationAction: {
          styleOverrides: {
            root: {
              color: '#b0b0b0',
              '&.Mui-selected': {
                color: '#3dd6a0',
              },
              '& .MuiSvgIcon-root': {
                color: 'inherit',
              },
            },
          },
        },
        MuiListItemIcon: {
          styleOverrides: {
            root: {
              color: '#3dd6a0',
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              borderBottomColor: 'rgba(61, 214, 160, 0.1)',
            },
          },
        },
        MuiFab: {
          styleOverrides: {
            primary: {
              backgroundColor: '#8A2BE2',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#7B1FA2',
              },
            },
          },
        },
        MuiBadge: {
          styleOverrides: {
            colorPrimary: {
              backgroundColor: '#8A2BE2',
            },
            colorSecondary: {
              backgroundColor: '#3dd6a0',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
            },
          },
        },
      }),
    },
  });
}

// Backward-compatible default export for App.tsx outer ThemeProvider
export const theme = createAppTheme('light');
