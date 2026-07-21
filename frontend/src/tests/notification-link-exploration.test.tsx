/**
 * Bug Condition Exploration Tests - Success Notifications Missing Navigation Action
 *
 * These tests verify the EXPECTED behavior: when a success notification is shown
 * after entity creation, it should contain a clickable action button/link
 * that allows the user to navigate to the newly created item.
 *
 * On UNFIXED code, these tests will FAIL because showSuccess() renders the message
 * as plain text inside an Alert component with no action button or navigation mechanism.
 *
 * Failure confirms the bug exists: notifications are plain text only.
 *
 * **Validates: Requirements 1.6, 1.7**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { render, cleanup, act } from '@testing-library/react';
import { NotificationProvider, useNotification } from '../contexts/NotificationContext';

/**
 * Test wrapper component that triggers showSuccess and exposes the notification UI.
 * Calls showSuccess with a given message when rendered.
 */
function NotificationTrigger({ message, action }: { message: string; action?: { label: string; onClick: () => void } }) {
  const { showSuccess } = useNotification();

  // Trigger notification on button click for controlled testing
  return (
    <button
      data-testid="trigger-notification"
      onClick={() => {
        if (action) {
          // The expected correct API: showSuccess(message, action)
          (showSuccess as (msg: string, action?: { label: string; onClick: () => void }) => void)(message, action);
        } else {
          showSuccess(message);
        }
      }}
    >
      Trigger
    </button>
  );
}

/**
 * Helper to render the notification system and trigger a success notification.
 */
function renderAndTriggerNotification(
  message: string,
  action?: { label: string; onClick: () => void }
) {
  const result = render(
    <NotificationProvider>
      <NotificationTrigger message={message} action={action} />
    </NotificationProvider>
  );

  // Click the trigger button to fire showSuccess
  const triggerButton = result.getByTestId('trigger-notification');
  act(() => {
    triggerButton.click();
  });

  return result;
}

/**
 * Checks if the rendered notification contains any action button for navigation.
 * Looks for buttons within the Alert (excluding the close/dismiss button).
 */
function findNavigationActionInNotification(container: HTMLElement): HTMLElement[] {
  // Look for action buttons inside the alert/snackbar
  // MUI Alert action buttons are placed in the Alert's action area
  const alertElements = container.querySelectorAll('[role="alert"]');
  const actionButtons: HTMLElement[] = [];

  alertElements.forEach(alert => {
    // Find buttons inside the alert that are NOT the close button
    const buttons = alert.querySelectorAll('button');
    buttons.forEach(button => {
      const ariaLabel = button.getAttribute('aria-label') || '';
      const textContent = button.textContent || '';
      // Exclude close/dismiss buttons - we're looking for navigation actions
      const isCloseButton =
        ariaLabel.toLowerCase() === 'close' ||
        textContent.toLowerCase() === 'close' ||
        button.querySelector('svg[data-testid="CloseIcon"]') !== null;

      if (!isCloseButton && textContent.trim().length > 0) {
        actionButtons.push(button as HTMLElement);
      }
    });
  });

  // Also check for any link elements inside the alert
  alertElements.forEach(alert => {
    const links = alert.querySelectorAll('a[href], [role="link"]');
    links.forEach(link => {
      actionButtons.push(link as HTMLElement);
    });
  });

  return actionButtons;
}

/**
 * Generator for entity creation success messages.
 */
const arbitrarySuccessMessage = () =>
  fc.constantFrom(
    'Thing created successfully',
    'Container created successfully',
    'Location created successfully',
    'Person created successfully',
    'Category created successfully'
  );

/**
 * Generator for entity IDs that would be used for navigation.
 */
const arbitraryEntityId = () =>
  fc.uuid().map(id => id.toString());

describe('Bug Condition Exploration: Success Notifications Missing Navigation Action', () => {
  it('Property 1: Success notification with action should render a clickable navigation button (property test, 100 runs)', () => {
    /**
     * **Validates: Requirements 1.6, 1.7**
     *
     * This property asserts: for any success notification triggered after entity creation
     * with an action parameter, the rendered notification should contain at least one
     * clickable action button for navigation.
     *
     * On UNFIXED code: FAILS because showSuccess() does not accept or render
     * an action parameter - it only renders plain text in the Alert.
     */
    fc.assert(
      fc.property(
        arbitrarySuccessMessage(),
        arbitraryEntityId(),
        (message, _entityId) => {
          cleanup();

          const mockOnClick = () => { /* navigate to entity */ };
          const action = { label: 'View', onClick: mockOnClick };

          renderAndTriggerNotification(message, action);

          // Find action buttons in the notification
          const actionButtons = findNavigationActionInNotification(document.body);

          // Expected behavior: at least one action button should exist
          // for navigating to the newly created entity
          expect(actionButtons.length).toBeGreaterThan(0);

          // Additionally, if there's a button, it should have the expected label
          if (actionButtons.length > 0) {
            const hasViewLabel = actionButtons.some(
              btn => btn.textContent?.toLowerCase().includes('view')
            );
            expect(hasViewLabel).toBe(true);
          }

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Concrete example: showSuccess("Thing created successfully") with action should render a "View" button', () => {
    /**
     * **Validates: Requirements 1.6, 1.7**
     *
     * Concrete demonstration of the bug: call showSuccess with an action parameter
     * and verify a "View" button appears in the notification.
     *
     * On UNFIXED code: FAILS because showSuccess only accepts a string message
     * and renders it as plain text inside the Alert with no action button.
     */
    const mockNavigate = () => {};

    renderAndTriggerNotification('Thing created successfully', {
      label: 'View',
      onClick: mockNavigate,
    });

    // The notification should contain a "View" button for navigation
    const actionButtons = findNavigationActionInNotification(document.body);

    // On unfixed code, this will be 0 because no action button is rendered
    expect(actionButtons.length).toBeGreaterThan(0);
    expect(actionButtons.some(btn => btn.textContent?.includes('View'))).toBe(true);
  });

  it('Concrete example: showSuccess("Container created successfully") with action should render a navigation element', () => {
    /**
     * **Validates: Requirements 1.6**
     *
     * Another concrete test showing that even for different entity types,
     * the notification should provide a clickable navigation action.
     *
     * On UNFIXED code: FAILS — no navigation element is rendered in the Alert.
     */
    const mockNavigate = () => {};

    renderAndTriggerNotification('Container created successfully', {
      label: 'View',
      onClick: mockNavigate,
    });

    const actionButtons = findNavigationActionInNotification(document.body);

    // Expected: at least one navigation action in the notification
    expect(actionButtons.length).toBeGreaterThan(0);
  });
});
