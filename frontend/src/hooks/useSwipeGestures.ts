import { useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook for handling swipe gestures on mobile devices
 * Validates: Requirements 13.1, 13.2, 13.3
 */

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // Minimum distance for a swipe
  preventDefaultTouchmoveEvent?: boolean;
}

interface TouchPosition {
  x: number;
  y: number;
}

export function useSwipeGestures(options: SwipeGestureOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    preventDefaultTouchmoveEvent = false,
  } = options;

  const touchStartPos = useRef<TouchPosition | null>(null);
  const touchEndPos = useRef<TouchPosition | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
    touchEndPos.current = null;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (preventDefaultTouchmoveEvent) {
      e.preventDefault();
    }
    
    const touch = e.touches[0];
    touchEndPos.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  }, [preventDefaultTouchmoveEvent]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartPos.current || !touchEndPos.current) {
      return;
    }

    const deltaX = touchEndPos.current.x - touchStartPos.current.x;
    const deltaY = touchEndPos.current.y - touchStartPos.current.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Determine if this is a horizontal or vertical swipe
    if (absDeltaX > absDeltaY) {
      // Horizontal swipe
      if (absDeltaX > threshold) {
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }
    } else {
      // Vertical swipe
      if (absDeltaY > threshold) {
        if (deltaY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }
    }

    // Reset positions
    touchStartPos.current = null;
    touchEndPos.current = null;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Add touch event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefaultTouchmoveEvent });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, preventDefaultTouchmoveEvent]);

  return elementRef;
}

/**
 * Hook for handling swipe-to-delete functionality
 * Common pattern in mobile apps for deleting list items
 */
export function useSwipeToDelete(onDelete: () => void, threshold: number = 100) {
  const swipeRef = useSwipeGestures({
    onSwipeLeft: onDelete,
    threshold,
  });

  return swipeRef;
}

/**
 * Hook for handling swipe navigation
 * Common pattern for navigating between screens or tabs
 */
export function useSwipeNavigation(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold: number = 80
) {
  const swipeRef = useSwipeGestures({
    onSwipeLeft,
    onSwipeRight,
    threshold,
  });

  return swipeRef;
}

/**
 * Hook for handling pull-to-refresh functionality
 */
export function usePullToRefresh(onRefresh: () => void, threshold: number = 100) {
  const swipeRef = useSwipeGestures({
    onSwipeDown: onRefresh,
    threshold,
    preventDefaultTouchmoveEvent: true,
  });

  return swipeRef;
}