/**
 * Test utilities for component rendering and accessibility testing
 * 
 * Provides helper functions and custom render methods for testing
 * React components with proper context providers and accessibility checks.
 */

import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

/**
 * Custom render function that wraps components with necessary providers
 * Extends the default render from @testing-library/react
 * 
 * @param ui - The React component to render
 * @param options - Optional render options
 * @returns Render result with all testing utilities
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { ...options });
}

/**
 * Helper to check if an element has proper accessibility attributes
 * 
 * @param element - The DOM element to check
 * @returns Object with accessibility validation results
 */
export function checkAccessibility(element: HTMLElement) {
  return {
    hasRole: (role: string) => element.getAttribute('role') === role,
    hasAriaLabel: () => element.hasAttribute('aria-label'),
    getAriaLabel: () => element.getAttribute('aria-label'),
    hasAriaPressed: () => element.hasAttribute('aria-pressed'),
    getAriaPressed: () => element.getAttribute('aria-pressed'),
    hasAriaControls: () => element.hasAttribute('aria-controls'),
    getAriaControls: () => element.getAttribute('aria-controls'),
    hasTabIndex: () => element.hasAttribute('tabIndex'),
    getTabIndex: () => element.getAttribute('tabIndex'),
    isFocusable: () => {
      const tabIndex = element.getAttribute('tabIndex');
      return tabIndex !== null && parseInt(tabIndex) >= 0;
    },
  };
}

/**
 * Helper to simulate keyboard events on an element
 * 
 * @param element - The DOM element to trigger the event on
 * @param key - The key to press ('Space' or 'Enter')
 */
export function simulateKeyPress(element: HTMLElement, key: 'Space' | 'Enter') {
  const eventInit = key === 'Space' 
    ? { key: ' ', code: 'Space', keyCode: 32 }
    : { key: 'Enter', code: 'Enter', keyCode: 13 };
  
  const keyDownEvent = new KeyboardEvent('keydown', eventInit);
  const keyUpEvent = new KeyboardEvent('keyup', eventInit);
  
  element.dispatchEvent(keyDownEvent);
  element.dispatchEvent(keyUpEvent);
}

/**
 * Helper to check minimum touch target size (44x44px per WCAG guidelines)
 * 
 * @param element - The DOM element to check
 * @returns Whether the element meets minimum touch target size
 */
export function meetsMinimumTouchTarget(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width >= 44 && rect.height >= 44;
}

/**
 * Re-export commonly used testing utilities
 */
export { screen, waitFor, within } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
