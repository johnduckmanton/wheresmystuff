# Implementation Plan: Show Password Toggle

## Overview

This implementation adds password visibility toggle functionality to authentication dialogs. The approach follows a bottom-up strategy: build the core PasswordToggleButton component first, enhance the PasswordField component to use it, then integrate with all authentication dialogs. Property-based tests are included as optional sub-tasks to validate universal correctness properties.

## Tasks

- [x] 1. Set up testing infrastructure
  - Install @fast-check/jest for property-based testing
  - Configure test utilities for component rendering and accessibility testing
  - Create test generators for visibility states, dialog types, and keyboard events
  - _Requirements: All (testing foundation)_

- [x] 2. Implement PasswordToggleButton component
  - [x] 2.1 Create PasswordToggleButton component with TypeScript interface
    - Implement component with props: isVisible, onToggle, fieldId, className
    - Render Eye icon when masked, EyeOff icon when visible
    - Add click handler that calls onToggle callback
    - _Requirements: 1.1, 1.5, 4.1, 4.2_
  
  - [x] 2.2 Add keyboard accessibility support
    - Handle Space and Enter key presses for toggle activation
    - Set tabIndex={0} for keyboard navigation
    - Add visible focus indicator styling
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 2.3 Add ARIA attributes for screen reader support
    - Set role="button" on toggle element
    - Add aria-label that changes based on state ("Show password" / "Hide password")
    - Add aria-pressed attribute reflecting visibility state
    - Add aria-controls pointing to password input fieldId
    - _Requirements: 2.4, 2.5_
  
  - [x] 2.4 Add touch target sizing and visual styling
    - Ensure minimum 44x44px touch target size
    - Apply hover and focus state styling from design system
    - Position button for consistent placement
    - _Requirements: 4.2, 4.3, 4.4_
  
  - [ ]* 2.5 Write unit tests for PasswordToggleButton
    - Test icon rendering in both states
    - Test onToggle callback invocation on click
    - Test keyboard activation (Space and Enter keys)
    - Test ARIA attributes in both states
    - Test focus indicator visibility
    - Test touch target size meets minimum
    - _Requirements: 1.5, 2.1, 2.2, 2.3, 2.4, 4.4_
  
  - [ ]* 2.6 Write property test for PasswordToggleButton
    - **Property 3: State Reflection in UI**
    - **Validates: Requirements 1.5, 2.4**
    - Generate random visibility states, verify icon and aria-label match expected values
  
  - [ ]* 2.7 Write property test for keyboard activation
    - **Property 4: Keyboard Activation**
    - **Validates: Requirements 2.3**
    - Generate random key events (Space/Enter), verify toggle behavior matches click behavior

- [x] 3. Enhance PasswordField component
  - [x] 3.1 Add visibility state management to PasswordField
    - Add internal state: const [isPasswordVisible, setIsPasswordVisible] = useState(false)
    - Add showToggle prop (default true) to PasswordFieldProps interface
    - Conditionally render PasswordToggleButton when showToggle is true
    - _Requirements: 1.1, 3.1, 5.1_
  
  - [x] 3.2 Implement input type switching based on visibility state
    - Set input type to "password" when isPasswordVisible is false
    - Set input type to "text" when isPasswordVisible is true
    - Pass isPasswordVisible and toggle handler to PasswordToggleButton
    - _Requirements: 1.2, 1.3, 1.4_
  
  - [x] 3.3 Add lifecycle reset behavior
    - Reset isPasswordVisible to false on component unmount
    - Add cleanup in useEffect to prevent state updates on unmounted components
    - _Requirements: 3.2, 3.3_
  
  - [ ]* 3.4 Write unit tests for enhanced PasswordField
    - Test toggle button renders by default
    - Test input type is "password" initially
    - Test input type changes to "text" when toggled
    - Test input type returns to "password" when toggled again
    - Test toggle button can be disabled via showToggle prop
    - Test value persists across visibility changes
    - Test state resets on unmount
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3_
  
  - [ ]* 3.5 Write property test for bidirectional state toggle
    - **Property 2: Bidirectional State Toggle**
    - **Validates: Requirements 1.3, 1.4**
    - Generate random initial states, toggle twice, verify return to original state
  
  - [ ]* 3.6 Write property test for state change announcement
    - **Property 5: State Change Announcement**
    - **Validates: Requirements 2.5**
    - Generate random state transitions, verify ARIA attributes update correctly

- [x] 4. Checkpoint - Verify core components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Integrate with LoginDialog
  - [x] 5.1 Update LoginDialog to use enhanced PasswordField
    - Replace existing password input with enhanced PasswordField component
    - Ensure toggle button is positioned correctly
    - _Requirements: 1.1, 5.1, 5.2_
  
  - [x] 5.2 Add dialog lifecycle reset
    - Reset password visibility state in onClose handler
    - Reset password visibility state in onSubmit handler
    - _Requirements: 3.2, 3.3_
  
  - [ ]* 5.3 Write integration tests for LoginDialog
    - Test toggle button presence in rendered dialog
    - Test toggle functionality works in dialog context
    - Test state resets when dialog closes
    - Test state resets when form submits
    - _Requirements: 1.1, 3.2, 3.3, 5.1, 5.2_

- [x] 6. Integrate with RegisterDialog
  - [x] 6.1 Update RegisterDialog password fields
    - Replace password input with enhanced PasswordField component
    - Replace confirm password input with enhanced PasswordField component
    - Ensure each field has independent toggle button
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 6.2 Add dialog lifecycle reset for multiple fields
    - Reset both password visibility states in onClose handler
    - Reset both password visibility states in onSubmit handler
    - _Requirements: 3.2, 3.3_
  
  - [ ]* 6.3 Write integration tests for RegisterDialog
    - Test both toggle buttons present
    - Test independent state management for each field
    - Test both states reset on dialog close
    - Test both states reset on form submit
    - _Requirements: 5.1, 5.2, 5.3, 3.2, 3.3_
  
  - [ ]* 6.4 Write property test for independent field state
    - **Property 9: Independent Field State**
    - **Validates: Requirements 5.3**
    - Generate dialogs with multiple fields, toggle one, verify others unchanged

- [x] 7. Integrate with PasswordChangeDialog
  - [x] 7.1 Update PasswordChangeDialog password fields
    - Replace current password input with enhanced PasswordField
    - Replace new password input with enhanced PasswordField
    - Replace confirm password input with enhanced PasswordField
    - Ensure each field has independent toggle button
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 7.2 Add dialog lifecycle reset for all three fields
    - Reset all three password visibility states in onClose handler
    - Reset all three password visibility states in onSubmit handler
    - _Requirements: 3.2, 3.3_
  
  - [ ]* 7.3 Write integration tests for PasswordChangeDialog
    - Test all three toggle buttons present
    - Test independent state management for each field
    - Test all states reset on dialog close
    - Test all states reset on form submit
    - _Requirements: 5.1, 5.2, 5.3, 3.2, 3.3_

- [x] 8. Checkpoint - Verify dialog integrations
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 9. Add cross-cutting property-based tests
  - [ ]* 9.1 Write property test for toggle button presence
    - **Property 1: Toggle Button Presence**
    - **Validates: Requirements 1.1, 5.1**
    - Generate random dialog configurations, verify toggle button exists in rendered output
  
  - [ ]* 9.2 Write property test for dialog lifecycle reset
    - **Property 6: Dialog Lifecycle Reset**
    - **Validates: Requirements 3.2, 3.3**
    - Generate random visibility states, trigger lifecycle events, verify reset to masked
  
  - [ ]* 9.3 Write property test for consistent positioning
    - **Property 7: Consistent Positioning**
    - **Validates: Requirements 4.3**
    - Generate different dialog types, verify toggle button positioning is consistent
  
  - [ ]* 9.4 Write property test for cross-dialog consistency
    - **Property 8: Cross-Dialog Consistency**
    - **Validates: Requirements 5.2**
    - Generate pairs of dialogs, verify toggle behavior is identical

- [ ]* 10. Add accessibility and edge case tests
  - [ ]* 10.1 Write accessibility tests
    - Test toggle button has role="button"
    - Test toggle button has tabIndex={0}
    - Test toggle button has aria-controls pointing to password input ID
    - Test screen reader announcements with @testing-library/jest-dom
    - _Requirements: 2.1, 2.2, 2.4, 2.5_
  
  - [ ]* 10.2 Write edge case tests
    - Test empty password field with toggle
    - Test disabled password field with disabled toggle
    - Test rapid clicking doesn't cause state inconsistencies
    - Test component unmounts cleanly without warnings
    - Test toggle works with form validation
    - Test toggle state doesn't interfere with form submission
    - _Requirements: All_

- [x] 11. Final checkpoint - Complete feature validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use @fast-check/jest with minimum 100 iterations
- All property tests are tagged with feature name and property reference
- Checkpoints ensure incremental validation at logical breakpoints
- Implementation uses TypeScript as specified in the design document
- Core implementation tasks (non-optional) provide full feature functionality
- Optional test tasks provide additional confidence in correctness
