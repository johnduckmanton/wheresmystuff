import { useEffect, useCallback, type RefObject } from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';

interface KeyboardNavigationOptions {
  onEnter?: () => void;
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
  onSpace?: () => void;
  onTab?: () => void;
  onShiftTab?: () => void;
  enabled?: boolean;
}

/**
 * Hook for enhanced keyboard navigation
 * Validates: Requirements 13.1, 13.2
 */
export function useKeyboardNavigation(
  ref: RefObject<HTMLElement>,
  options: KeyboardNavigationOptions = {}
) {
  const { settings, announceToScreenReader } = useAccessibility();
  const { enabled = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled || !settings.keyboardNavigation) return;

      const { key, shiftKey, ctrlKey, metaKey } = event;

      // Don't interfere with browser shortcuts
      if (ctrlKey || metaKey) return;

      switch (key) {
        case 'Enter':
          if (options.onEnter) {
            event.preventDefault();
            options.onEnter();
            announceToScreenReader('Activated', 'polite');
          }
          break;

        case 'Escape':
          if (options.onEscape) {
            event.preventDefault();
            options.onEscape();
            announceToScreenReader('Cancelled', 'polite');
          }
          break;

        case 'ArrowUp':
          if (options.onArrowUp) {
            event.preventDefault();
            options.onArrowUp();
          }
          break;

        case 'ArrowDown':
          if (options.onArrowDown) {
            event.preventDefault();
            options.onArrowDown();
          }
          break;

        case 'ArrowLeft':
          if (options.onArrowLeft) {
            event.preventDefault();
            options.onArrowLeft();
          }
          break;

        case 'ArrowRight':
          if (options.onArrowRight) {
            event.preventDefault();
            options.onArrowRight();
          }
          break;

        case 'Home':
          if (options.onHome) {
            event.preventDefault();
            options.onHome();
            announceToScreenReader('First item', 'polite');
          }
          break;

        case 'End':
          if (options.onEnd) {
            event.preventDefault();
            options.onEnd();
            announceToScreenReader('Last item', 'polite');
          }
          break;

        case ' ':
          if (options.onSpace) {
            event.preventDefault();
            options.onSpace();
          }
          break;

        case 'Tab':
          if (shiftKey && options.onShiftTab) {
            options.onShiftTab();
          } else if (!shiftKey && options.onTab) {
            options.onTab();
          }
          break;
      }
    },
    [enabled, settings.keyboardNavigation, options, announceToScreenReader]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('keydown', handleKeyDown as any);

    return () => {
      element.removeEventListener('keydown', handleKeyDown as any);
    };
  }, [ref, handleKeyDown]);
}

/**
 * Hook for managing focus trap in dialogs and modals
 * Validates: Requirements 13.1, 13.2
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement>,
  isActive: boolean = true
) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Focus first element when trap activates
    firstElement?.focus();

    container.addEventListener('keydown', handleTabKey as any);

    return () => {
      container.removeEventListener('keydown', handleTabKey as any);
    };
  }, [containerRef, isActive]);
}

/**
 * Hook for managing roving tabindex in lists
 * Validates: Requirements 13.1
 */
export function useRovingTabIndex(
  listRef: RefObject<HTMLElement>,
  itemSelector: string = '[role="option"], [role="menuitem"], [role="tab"]'
) {
  const { settings } = useAccessibility();

  useEffect(() => {
    if (!settings.keyboardNavigation || !listRef.current) return;

    const list = listRef.current;
    const items = Array.from(list.querySelectorAll<HTMLElement>(itemSelector));
    
    if (items.length === 0) return;

    let currentIndex = 0;

    // Set initial tabindex
    items.forEach((item, index) => {
      item.setAttribute('tabindex', index === 0 ? '0' : '-1');
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const { key } = event;
      
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return;

      event.preventDefault();

      // Remove tabindex from current item
      items[currentIndex].setAttribute('tabindex', '-1');

      switch (key) {
        case 'ArrowDown':
          currentIndex = (currentIndex + 1) % items.length;
          break;
        case 'ArrowUp':
          currentIndex = (currentIndex - 1 + items.length) % items.length;
          break;
        case 'Home':
          currentIndex = 0;
          break;
        case 'End':
          currentIndex = items.length - 1;
          break;
      }

      // Set tabindex and focus on new item
      items[currentIndex].setAttribute('tabindex', '0');
      items[currentIndex].focus();
    };

    list.addEventListener('keydown', handleKeyDown as any);

    return () => {
      list.removeEventListener('keydown', handleKeyDown as any);
    };
  }, [listRef, itemSelector, settings.keyboardNavigation]);
}

/**
 * Hook for announcing dynamic content changes to screen readers
 * Validates: Requirements 13.2
 */
export function useAriaLive() {
  const { announceToScreenReader } = useAccessibility();

  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      announceToScreenReader(message, priority);
    },
    [announceToScreenReader]
  );

  return { announce };
}