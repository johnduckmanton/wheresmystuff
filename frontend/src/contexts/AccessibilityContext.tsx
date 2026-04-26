import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useTheme } from '@mui/material/styles';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { ThemeMode } from '../theme';

interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  keyboardNavigation: boolean;
  screenReaderMode: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  colorBlindnessMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  themeMode: ThemeMode;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (updates: Partial<AccessibilitySettings>) => void;
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  focusElement: (elementId: string) => void;
  skipToContent: () => void;
}

const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  keyboardNavigation: true,
  screenReaderMode: false,
  fontSize: 'medium',
  colorBlindnessMode: 'none',
  themeMode: 'light',
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

interface AccessibilityProviderProps {
  children: ReactNode;
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem('accessibility-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate themeMode — if invalid, reset to 'light' and overwrite localStorage
        if (parsed.themeMode && parsed.themeMode !== 'light' && parsed.themeMode !== 'dark') {
          parsed.themeMode = 'light';
          const corrected = { ...defaultSettings, ...parsed };
          localStorage.setItem('accessibility-settings', JSON.stringify(corrected));
          return corrected;
        }
        return { ...defaultSettings, ...parsed };
      } catch {
        return defaultSettings;
      }
    }
    
    // Detect system preferences
    const systemSettings: Partial<AccessibilitySettings> = {};
    
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      systemSettings.themeMode = 'dark';
    }
    
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      systemSettings.highContrast = true;
    }
    
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      systemSettings.reducedMotion = true;
    }
    
    return { ...defaultSettings, ...systemSettings };
  });

  const baseTheme = useTheme();

  // Create accessibility-enhanced theme
  const accessibilityTheme = React.useMemo(() => {
    const fontSizeMultiplier = {
      small: 0.875,
      medium: 1,
      large: 1.125,
      'extra-large': 1.25,
    }[settings.fontSize];

    const colorFilters = {
      none: {},
      protanopia: {
        filter: 'url(#protanopia-filter)',
      },
      deuteranopia: {
        filter: 'url(#deuteranopia-filter)',
      },
      tritanopia: {
        filter: 'url(#tritanopia-filter)',
      },
    }[settings.colorBlindnessMode];

    return createTheme({
      ...baseTheme,
      palette: {
        ...baseTheme.palette,
        // Dark palette applied first so high-contrast can override
        ...(settings.themeMode === 'dark' && {
          mode: 'dark' as const,
          primary: {
            main: '#8A2BE2',
          },
          secondary: {
            main: '#3dd6a0',
          },
          error: {
            main: '#f44336',
          },
          background: {
            default: '#0a0a0a',
            paper: '#161616',
          },
          text: {
            primary: '#f0f0f0',
            secondary: '#b0b0b0',
          },
          action: {
            active: '#3dd6a0',
            hover: 'rgba(61, 214, 160, 0.08)',
            selected: 'rgba(61, 214, 160, 0.16)',
            disabled: 'rgba(240, 240, 240, 0.3)',
            disabledBackground: 'rgba(240, 240, 240, 0.12)',
          },
          divider: 'rgba(61, 214, 160, 0.2)',
        }),
        // High-contrast overrides take precedence over dark palette
        ...(settings.highContrast && {
          primary: {
            main: '#000000',
            contrastText: '#ffffff',
          },
          secondary: {
            main: '#ffffff',
            contrastText: '#000000',
          },
          background: {
            default: '#ffffff',
            paper: '#ffffff',
          },
          text: {
            primary: '#000000',
            secondary: '#000000',
          },
          divider: '#000000',
        }),
      },
      typography: {
        ...baseTheme.typography,
        fontSize: 14 * fontSizeMultiplier,
        h1: {
          ...baseTheme.typography.h1,
          fontSize: `${2.5 * fontSizeMultiplier}rem`,
        },
        h2: {
          ...baseTheme.typography.h2,
          fontSize: `${2 * fontSizeMultiplier}rem`,
        },
        h3: {
          ...baseTheme.typography.h3,
          fontSize: `${1.75 * fontSizeMultiplier}rem`,
        },
        h4: {
          ...baseTheme.typography.h4,
          fontSize: `${1.5 * fontSizeMultiplier}rem`,
        },
        h5: {
          ...baseTheme.typography.h5,
          fontSize: `${1.25 * fontSizeMultiplier}rem`,
        },
        h6: {
          ...baseTheme.typography.h6,
          fontSize: `${1.125 * fontSizeMultiplier}rem`,
        },
        body1: {
          ...baseTheme.typography.body1,
          fontSize: `${1 * fontSizeMultiplier}rem`,
        },
        body2: {
          ...baseTheme.typography.body2,
          fontSize: `${0.875 * fontSizeMultiplier}rem`,
        },
      },
      components: {
        ...baseTheme.components,
        MuiCssBaseline: {
          styleOverrides: {
            '*': {
              ...colorFilters,
              ...(settings.reducedMotion && {
                animationDuration: '0.01ms !important',
                animationIterationCount: '1 !important',
                transitionDuration: '0.01ms !important',
                scrollBehavior: 'auto !important',
              }),
            },
            body: {
              ...(settings.highContrast && {
                backgroundColor: '#ffffff !important',
                color: '#000000 !important',
              }),
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              ...(baseTheme.components?.MuiButton?.styleOverrides?.root as object || {}),
              minHeight: settings.largeText ? 48 : 44,
              fontSize: settings.largeText ? '1.125rem' : '1rem',
              ...(settings.highContrast && {
                border: '2px solid #000000',
                '&:hover': {
                  backgroundColor: '#000000',
                  color: '#ffffff',
                },
                '&:focus': {
                  outline: '3px solid #0066cc',
                  outlineOffset: '2px',
                },
              }),
            },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              ...(baseTheme.components?.MuiIconButton?.styleOverrides?.root as object || {}),
              minHeight: settings.largeText ? 52 : 48,
              minWidth: settings.largeText ? 52 : 48,
              '&:focus': {
                outline: '3px solid #0066cc',
                outlineOffset: '2px',
              },
            },
          },
        },
        MuiTextField: {
          styleOverrides: {
            root: {
              ...(baseTheme.components?.MuiTextField?.styleOverrides?.root as object || {}),
              '& .MuiInputBase-root': {
                minHeight: settings.largeText ? 56 : 48,
                fontSize: settings.largeText ? '1.125rem' : '1rem',
              },
              '& .MuiInputBase-input': {
                fontSize: settings.largeText ? '1.125rem' : '1rem',
              },
              '&:focus-within': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '3px',
                  borderColor: '#0066cc',
                },
              },
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              ...(baseTheme.components?.MuiCard?.styleOverrides?.root as object || {}),
              ...(settings.highContrast && {
                border: '2px solid #000000',
              }),
              '&:focus': {
                outline: '3px solid #0066cc',
                outlineOffset: '2px',
              },
            },
          },
        },
      },
    });
  }, [baseTheme, settings]);

  const updateSettings = (updates: Partial<AccessibilitySettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    localStorage.setItem('accessibility-settings', JSON.stringify(newSettings));
  };

  const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  const focusElement = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: settings.reducedMotion ? 'auto' : 'smooth', block: 'center' });
    }
  };

  const skipToContent = () => {
    const mainContent = document.getElementById('main-content') || document.querySelector('main');
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: settings.reducedMotion ? 'auto' : 'smooth' });
    }
  };

  // Apply global accessibility classes
  useEffect(() => {
    const body = document.body;
    
    // Apply accessibility classes
    body.classList.toggle('high-contrast', settings.highContrast);
    body.classList.toggle('large-text', settings.largeText);
    body.classList.toggle('reduced-motion', settings.reducedMotion);
    body.classList.toggle('keyboard-navigation', settings.keyboardNavigation);
    body.classList.toggle('screen-reader-mode', settings.screenReaderMode);
    
    // Apply font size class
    body.classList.remove('font-small', 'font-medium', 'font-large', 'font-extra-large');
    body.classList.add(`font-${settings.fontSize}`);
    
    // Apply color blindness filter
    body.classList.remove('protanopia', 'deuteranopia', 'tritanopia');
    if (settings.colorBlindnessMode !== 'none') {
      body.classList.add(settings.colorBlindnessMode);
    }
  }, [settings]);

  // Listen for system preference changes
  useEffect(() => {
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleContrastChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('accessibility-settings')) {
        updateSettings({ highContrast: e.matches });
      }
    };
    
    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('accessibility-settings')) {
        updateSettings({ reducedMotion: e.matches });
      }
    };
    
    contrastQuery.addEventListener('change', handleContrastChange);
    motionQuery.addEventListener('change', handleMotionChange);
    
    return () => {
      contrastQuery.removeEventListener('change', handleContrastChange);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  const contextValue: AccessibilityContextType = {
    settings,
    updateSettings,
    announceToScreenReader,
    focusElement,
    skipToContent,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      <ThemeProvider theme={accessibilityTheme}>
        {children}
        {/* Color blindness filters */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            <filter id="protanopia-filter">
              <feColorMatrix values="0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0" />
            </filter>
            <filter id="deuteranopia-filter">
              <feColorMatrix values="0.625,0.375,0,0,0 0.7,0.3,0,0,0 0,0.3,0.7,0,0 0,0,0,1,0" />
            </filter>
            <filter id="tritanopia-filter">
              <feColorMatrix values="0.95,0.05,0,0,0 0,0.433,0.567,0,0 0,0.475,0.525,0,0 0,0,0,1,0" />
            </filter>
          </defs>
        </svg>
      </ThemeProvider>
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}