import { useState, useEffect } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';

/**
 * Custom hook for detecting mobile devices and screen sizes
 * Validates: Requirements 13.1, 13.2, 13.3
 */

export interface MobileDetectionResult {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  isLandscape: boolean;
  screenWidth: number;
  screenHeight: number;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

export function useMobileDetection(): MobileDetectionResult {
  const theme = useTheme();
  
  // Media queries for different breakpoints
  const isMobileQuery = useMediaQuery(theme.breakpoints.down('sm')); // < 600px
  const isTabletQuery = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600px - 900px
  const isDesktopQuery = useMediaQuery(theme.breakpoints.up('md')); // >= 900px
  const isLandscapeQuery = useMediaQuery('(orientation: landscape)');

  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Detect touch device
    const checkTouchDevice = () => {
      return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore - msMaxTouchPoints is IE specific
        navigator.msMaxTouchPoints > 0
      );
    };

    setIsTouchDevice(checkTouchDevice());

    // Handle window resize
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine device type
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (isMobileQuery) {
    deviceType = 'mobile';
  } else if (isTabletQuery) {
    deviceType = 'tablet';
  }

  return {
    isMobile: isMobileQuery,
    isTablet: isTabletQuery,
    isDesktop: isDesktopQuery,
    isTouchDevice,
    isLandscape: isLandscapeQuery,
    screenWidth: screenSize.width,
    screenHeight: screenSize.height,
    deviceType,
  };
}

/**
 * Hook for getting touch-friendly button sizes
 */
export function useTouchButtonSize() {
  const { isMobile, isTablet } = useMobileDetection();

  if (isMobile) {
    return {
      minHeight: 44,
      minWidth: 44,
      padding: '12px 16px',
      fontSize: '0.875rem',
    };
  }

  if (isTablet) {
    return {
      minHeight: 40,
      minWidth: 40,
      padding: '10px 14px',
      fontSize: '0.875rem',
    };
  }

  return {
    minHeight: 36,
    minWidth: 36,
    padding: '8px 12px',
    fontSize: '0.875rem',
  };
}

/**
 * Hook for getting responsive spacing values
 */
export function useResponsiveSpacing() {
  const { isMobile, isTablet } = useMobileDetection();

  if (isMobile) {
    return {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
    };
  }

  if (isTablet) {
    return {
      xs: 6,
      sm: 12,
      md: 16,
      lg: 20,
      xl: 24,
    };
  }

  return {
    xs: 8,
    sm: 16,
    md: 24,
    lg: 32,
    xl: 40,
  };
}

/**
 * Hook for getting responsive font sizes
 */
export function useResponsiveFontSize() {
  const { isMobile, isTablet } = useMobileDetection();

  if (isMobile) {
    return {
      h1: '1.75rem',
      h2: '1.5rem',
      h3: '1.25rem',
      h4: '1.125rem',
      h5: '1rem',
      h6: '0.875rem',
      body1: '0.875rem',
      body2: '0.75rem',
      caption: '0.625rem',
    };
  }

  if (isTablet) {
    return {
      h1: '2rem',
      h2: '1.75rem',
      h3: '1.5rem',
      h4: '1.25rem',
      h5: '1.125rem',
      h6: '1rem',
      body1: '1rem',
      body2: '0.875rem',
      caption: '0.75rem',
    };
  }

  return {
    h1: '2.5rem',
    h2: '2rem',
    h3: '1.75rem',
    h4: '1.5rem',
    h5: '1.25rem',
    h6: '1.125rem',
    body1: '1rem',
    body2: '0.875rem',
    caption: '0.75rem',
  };
}

/**
 * Hook for determining if component should use mobile layout
 */
export function useMobileLayout(customBreakpoint?: number) {
  const { screenWidth } = useMobileDetection();
  const breakpoint = customBreakpoint || 600;
  
  return screenWidth < breakpoint;
}

/**
 * Hook for getting optimal grid columns based on screen size
 */
export function useResponsiveGridColumns(
  mobileColumns: number = 1,
  tabletColumns: number = 2,
  desktopColumns: number = 3
) {
  const { isMobile, isTablet } = useMobileDetection();

  if (isMobile) return mobileColumns;
  if (isTablet) return tabletColumns;
  return desktopColumns;
}