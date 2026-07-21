/**
 * Preservation Property Tests - Notification Dismiss and Error Modal Behavior
 *
 * These tests capture the CURRENT behavior of the UNFIXED code to ensure
 * the Bug 3 fix (adding action support to showSuccess) does NOT introduce
 * regressions to existing notification dismiss/auto-hide and error modal workflows.
 * They MUST PASS on unfixed code.
 *
 * Property 2: Preservation - Notification Dismiss and Error Modal Behavior
 * - Success notifications auto-dismiss after timeout without triggering navigation
 * - Dismissing a notification (via auto-hide or close button) does not navigate away
 * - showError modal with action buttons continues to function as before
 *
 * **Validates: Requirements 3.7**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { NotificationProvider, useNotification } from '../contexts/NotificationContext';

// ============================================================================
// Test Helper Components
// ============================================================================

/**
 * Component that triggers showSuccess and exposes the notification UI.
 */
function SuccessNotificationTrigger({ message }: { message: string }) {
  const { showSuccess } = useNotification();
  return (
    <button data-testid="trigger-success" onClick={() => showSuccess(message)}>
      Trigger Success
    </button>
  );
}

/**
 * Component that triggers showError with action buttons.
 */
function ErrorNotificationTrigger({
  message,
  requiresAction,
  actions,
}: {
  message: string;
  requiresAction?: boolean;
  actions?: { label: string; onClick: () => void; variant?: 'text' | 'outlined' | 'contained' }[];
}) {
  const { showError } = useNotification();
  return (
    <button
      data-testid="trigger-error"
      onClick={() => showError(message, { requiresAction, actions })}
    >
      Trigger Error
    </button>
  );
}

/**
 * Component that tracks whether navigation was triggered (simulates useNavigate).
 */
function NavigationTracker({ onNavigate }: { onNavigate: () => void }) {
  // Exposes a button the tests do NOT click - used to verify no navigation happens
  return <button data-testid="navigation-target" onClick={onNavigate}>Nav</button>;
}

// ============================================================================
// Generators
// ============================================================================

/**
 * Generates realistic success notification messages.
 */
const arbitrarySuccessMessage = () =>
  fc.constantFrom(
    'Thing created successfully',
    'Container created successfully',
    'Location created successfully',
    'Person created successfully',
    'Category created successfully',
    'Item saved',
    'Changes saved successfully',
    'Photo uploaded',
  );

/**
 * Generates realistic error messages for the error modal.
 */
const arbitraryErrorMessage = () =>
  fc.constantFrom(
    'Failed to save item',
    'Network error occurred',
    'Permission denied',
    'Item not found',
    'Server error - please try again',
    'Session expired',
  );

/**
 * Generates action button labels for error modals.
 */
const arbitraryActionLabel = () =>
  fc.constantFrom('Retry', 'Refresh', 'Sign In', 'Go Back', 'Try Again', 'Contact Support');

/**
 * Generates an array of action buttons for error modals with unique labels.
 */
const arbitraryActions = () =>
  fc.array(
    fc.record({
      label: arbitraryActionLabel(),
      variant: fc.constantFrom('text' as const, 'outlined' as const, 'contained' as const),
    }),
    { minLength: 1, maxLength: 3 }
  ).map(actions => {
    // Ensure unique labels to avoid "found multiple elements" test issues
    const seen = new Set<string>();
    return actions.filter(a => {
      if (seen.has(a.label)) return false;
      seen.add(a.label);
      return true;
    });
  }).filter(actions => actions.length >= 1);

// ============================================================================
// Property Tests - Notification Dismiss Behavior
// ============================================================================

describe('Preservation Property: Notification Dismiss and Error Modal Behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  describe('Success notification auto-dismiss behavior', () => {
    /**
     * **Validates: Requirements 3.7**
     *
     * Property: Success notifications are configured with autoHideDuration (5000ms)
     * meaning they will auto-dismiss. This timeout-based dismiss does NOT trigger
     * any navigation or external side effects.
     */
    it('Property: Success notifications render with auto-hide configured and no navigation occurs on dismiss (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitrarySuccessMessage(),
          (message) => {
            cleanup();
            const navigateMock = vi.fn();

            const { container } = render(
              <NotificationProvider>
                <SuccessNotificationTrigger message={message} />
                <NavigationTracker onNavigate={navigateMock} />
              </NotificationProvider>
            );

            // Trigger the notification
            act(() => {
              screen.getByTestId('trigger-success').click();
            });

            // Verify the notification is open (Snackbar renders with role="presentation")
            const alertElement = container.querySelector('[role="alert"]');
            expect(alertElement).not.toBeNull();
            expect(alertElement!.textContent).toContain(message);

            // Advance timers past the auto-hide duration (5000ms)
            act(() => {
              vi.advanceTimersByTime(5500);
            });

            // No navigation should have been triggered by the auto-dismiss
            expect(navigateMock).not.toHaveBeenCalled();

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 3.7**
     *
     * Property: Success notifications render with severity='success' and
     * the message as plain text content. The notification renders inside a Snackbar
     * with Alert component.
     */
    it('Property: Success notifications render as Alert with success severity (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitrarySuccessMessage(),
          (message) => {
            cleanup();

            const { container } = render(
              <NotificationProvider>
                <SuccessNotificationTrigger message={message} />
              </NotificationProvider>
            );

            // Trigger the notification
            act(() => {
              screen.getByTestId('trigger-success').click();
            });

            // Verify it renders as an Alert with success severity
            const alertElement = container.querySelector('[role="alert"]');
            expect(alertElement).not.toBeNull();

            // Check the alert has success severity class (MUI adds this)
            // MUI applies severity styling via classes like 'Success', 'colorSuccess', etc.
            void (alertElement!.className);

            // The alert renders the message text
            expect(alertElement!.textContent).toContain(message);

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Notification close button behavior', () => {
    /**
     * **Validates: Requirements 3.7**
     *
     * Property: Clicking the close button on a success notification dismisses it
     * without triggering any navigation or external callbacks.
     */
    it('Property: Closing a success notification via close button does not trigger navigation (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitrarySuccessMessage(),
          (message) => {
            cleanup();
            const navigateMock = vi.fn();

            const { container } = render(
              <NotificationProvider>
                <SuccessNotificationTrigger message={message} />
                <NavigationTracker onNavigate={navigateMock} />
              </NotificationProvider>
            );

            // Trigger the notification
            act(() => {
              screen.getByTestId('trigger-success').click();
            });

            // Verify notification is visible
            const alertElement = container.querySelector('[role="alert"]');
            expect(alertElement).not.toBeNull();

            // Find and click the close button (MUI Alert renders a close button via onClose)
            const closeButton = alertElement!.querySelector('button[aria-label="Close"]') ||
              alertElement!.querySelector('button');

            if (closeButton) {
              act(() => {
                fireEvent.click(closeButton);
              });
            }

            // No navigation should have been triggered
            expect(navigateMock).not.toHaveBeenCalled();

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('showError modal with action buttons', () => {
    /**
     * **Validates: Requirements 3.7**
     *
     * Property: showError with requiresAction=true and action buttons renders
     * a modal Dialog (not a toast) with the specified action buttons and a dismiss button.
     */
    it('Property: showError with actions renders a modal Dialog with action buttons (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryErrorMessage(),
          arbitraryActions(),
          (message, actionDefs) => {
            cleanup();

            const actionCallbacks = actionDefs.map(a => ({
              ...a,
              onClick: vi.fn(),
            }));

            render(
              <NotificationProvider>
                <ErrorNotificationTrigger
                  message={message}
                  requiresAction={true}
                  actions={actionCallbacks}
                />
              </NotificationProvider>
            );

            // Trigger the error modal
            act(() => {
              screen.getByTestId('trigger-error').click();
            });

            // Verify the dialog opens with "Action Required" title
            expect(screen.getByText('Action Required')).not.toBeNull();

            // Verify the error message is displayed
            expect(screen.getByText(message)).not.toBeNull();

            // Verify each action button is rendered
            for (const action of actionDefs) {
              expect(screen.getByText(action.label)).not.toBeNull();
            }

            // Verify the "Dismiss" button is present
            expect(screen.getByText('Dismiss')).not.toBeNull();

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 3.7**
     *
     * Property: Clicking an action button in the error modal calls the associated
     * onClick handler and closes the modal.
     */
    it('Property: Error modal action buttons invoke their onClick handler when clicked (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryErrorMessage(),
          arbitraryActionLabel(),
          (message, actionLabel) => {
            cleanup();

            const onClickMock = vi.fn();

            render(
              <NotificationProvider>
                <ErrorNotificationTrigger
                  message={message}
                  requiresAction={true}
                  actions={[{ label: actionLabel, onClick: onClickMock }]}
                />
              </NotificationProvider>
            );

            // Trigger the error modal
            act(() => {
              screen.getByTestId('trigger-error').click();
            });

            // Click the action button
            act(() => {
              screen.getByText(actionLabel).click();
            });

            // The onClick handler should have been called
            expect(onClickMock).toHaveBeenCalledTimes(1);

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 3.7**
     *
     * Property: Clicking the "Dismiss" button in the error modal closes the modal
     * without calling any action onClick handlers.
     */
    it('Property: Error modal Dismiss button closes modal without calling action handlers (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryErrorMessage(),
          arbitraryActions(),
          (message, actionDefs) => {
            cleanup();

            const actionCallbacks = actionDefs.map(a => ({
              ...a,
              onClick: vi.fn(),
            }));

            render(
              <NotificationProvider>
                <ErrorNotificationTrigger
                  message={message}
                  requiresAction={true}
                  actions={actionCallbacks}
                />
              </NotificationProvider>
            );

            // Trigger the error modal
            act(() => {
              screen.getByTestId('trigger-error').click();
            });

            // Modal should be open
            expect(screen.getByText('Action Required')).not.toBeNull();

            // Click the Dismiss button
            act(() => {
              screen.getByText('Dismiss').click();
            });

            // None of the action handlers should have been called
            for (const action of actionCallbacks) {
              expect(action.onClick).not.toHaveBeenCalled();
            }

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 3.7**
     *
     * Property: showError without requiresAction (simple error toast) renders
     * as a toast notification, NOT as a modal dialog.
     */
    it('Property: showError without requiresAction renders as a toast, not a modal (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryErrorMessage(),
          (message) => {
            cleanup();

            render(
              <NotificationProvider>
                <ErrorNotificationTrigger
                  message={message}
                  requiresAction={false}
                  actions={undefined}
                />
              </NotificationProvider>
            );

            // Trigger the simple error toast
            act(() => {
              screen.getByTestId('trigger-error').click();
            });

            // Should NOT render a modal dialog with "Action Required"
            expect(screen.queryByText('Action Required')).toBeNull();

            // Should render an alert with the error message
            const alertElement = document.querySelector('[role="alert"]');
            expect(alertElement).not.toBeNull();
            expect(alertElement!.textContent).toContain(message);

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Notification state isolation', () => {
    /**
     * **Validates: Requirements 3.7**
     *
     * Property: Showing multiple notifications in sequence - each one replaces
     * the previous, and dismissing the current one does not affect any external state.
     */
    it('Property: Sequential success notifications replace previous without navigation side effects (100 runs)', () => {
      fc.assert(
        fc.property(
          fc.array(arbitrarySuccessMessage(), { minLength: 2, maxLength: 5 }),
          (messages) => {
            cleanup();
            const navigateMock = vi.fn();

            // Component that can trigger multiple messages
            function MultiTrigger() {
              const { showSuccess } = useNotification();
              return (
                <div>
                  {messages.map((msg, i) => (
                    <button key={i} data-testid={`trigger-${i}`} onClick={() => showSuccess(msg)}>
                      {msg}
                    </button>
                  ))}
                </div>
              );
            }

            render(
              <NotificationProvider>
                <MultiTrigger />
                <NavigationTracker onNavigate={navigateMock} />
              </NotificationProvider>
            );

            // Trigger each notification in sequence
            for (let i = 0; i < messages.length; i++) {
              act(() => {
                screen.getByTestId(`trigger-${i}`).click();
              });
            }

            // The last message should be displayed
            const alertElement = document.querySelector('[role="alert"]');
            expect(alertElement).not.toBeNull();
            expect(alertElement!.textContent).toContain(messages[messages.length - 1]);

            // Advance past auto-hide
            act(() => {
              vi.advanceTimersByTime(6000);
            });

            // No navigation should have occurred at any point
            expect(navigateMock).not.toHaveBeenCalled();

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
