# Implementation Plan: Dark Theme Settings

## Overview

Add dark theme support by refactoring the theme module into a factory function, extending the AccessibilityContext with theme mode state and system preference detection, renaming the settings dialog, and adding theme toggle controls to both the Settings panel and User Profile page. All changes use TypeScript with MUI v7 and integrate into the existing ThemeProvider hierarchy.

## Tasks

- [x] 1. Refactor theme.ts to export createAppTheme factory function
  - [x] 1.1 Create `createAppTheme(mode)` factory function in `frontend/src/theme.ts`
    - Export `ThemeMode` type (`'light' | 'dark'`)
    - Export `createAppTheme(mode: ThemeMode)` that returns a complete MUI theme
    - Light mode: preserve existing palette (`background.default: #f5f5f5`, `background.paper: #ffffff`, `text.primary: #212121`, `text.secondary: #757575`, `primary.main: #1976d2`, `secondary.main: #dc004e`)
    - Dark mode: use `palette.mode: 'dark'`, `primary.main: #9046ff`, `secondary.main: #46ff90`, `background.default: #121212`, `background.paper: #1e1e1e`, `text.primary: #e0e0e0`, `text.secondary: #aaaaaa`
    - Preserve existing typography, breakpoints, and component overrides identically in both modes
    - Keep backward-compatible `export const theme = createAppTheme('light')` for the outer ThemeProvider in App.tsx
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.2 Write property test for theme factory (Property 1)
    - **Property 1: Theme factory produces valid theme for any mode**
    - For any valid ThemeMode, `createAppTheme(mode)` returns a theme where `palette.mode` equals the input, primary/secondary colors match the mode-specific values, and typography/breakpoints/component overrides are preserved identically across both modes
    - Use `fc.constantFrom('light', 'dark')` generator with minimum 100 iterations
    - Test file: `frontend/src/__tests__/theme.test.ts`
    - **Validates: Requirements 1.1, 1.4**

  - [ ]* 1.3 Write unit tests for theme factory
    - Test `createAppTheme('dark')` returns correct dark palette values (background, text, primary, secondary)
    - Test `createAppTheme('light')` returns correct light palette values matching current theme
    - Test default export `theme` is a valid light theme
    - Test file: `frontend/src/__tests__/theme.test.ts`
    - _Requirements: 1.2, 1.3_

- [x] 2. Extend AccessibilityContext with themeMode state management
  - [x] 2.1 Add `themeMode` to AccessibilityContext state and persistence
    - Add `themeMode: ThemeMode` field to the `AccessibilitySettings` interface with default `'light'`
    - Import `ThemeMode` from `../theme`
    - In the `useState` initializer: if localStorage has saved settings, validate `themeMode` is `'light'` or `'dark'`; if invalid, reset to `'light'` and overwrite localStorage
    - If no localStorage exists, detect system preference via `window.matchMedia('(prefers-color-scheme: dark)')` and set initial themeMode accordingly
    - In the `accessibilityTheme` useMemo: when `settings.themeMode === 'dark'`, set `palette.mode: 'dark'` and apply dark palette colors (`primary: #9046ff`, `secondary: #46ff90`, `background.default: #121212`, `background.paper: #1e1e1e`, `text.primary: #e0e0e0`, `text.secondary: #aaaaaa`) before high-contrast overrides
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 2.2 Write property test for persistence round-trip (Property 2)
    - **Property 2: Settings persistence round-trip**
    - For any valid ThemeMode, calling `updateSettings({ themeMode: mode })` persists to localStorage such that parsing the stored JSON returns the same themeMode value
    - Use `fc.constantFrom('light', 'dark')` generator with minimum 100 iterations
    - Test file: `frontend/src/contexts/__tests__/AccessibilityContext.test.tsx`
    - **Validates: Requirements 2.2, 3.1**

  - [ ]* 2.3 Write property test for invalid themeMode fallback (Property 3)
    - **Property 3: Invalid theme mode fallback**
    - For any string that is not `'light'` or `'dark'`, if stored as themeMode in localStorage, the provider initializes with themeMode `'light'` and overwrites the invalid value
    - Use `fc.string().filter(s => s !== 'light' && s !== 'dark')` generator with minimum 100 iterations
    - Test file: `frontend/src/contexts/__tests__/AccessibilityContext.test.tsx`
    - **Validates: Requirements 3.3**

  - [ ]* 2.4 Write unit tests for AccessibilityContext themeMode
    - Test context initializes themeMode from localStorage
    - Test context defaults to `'light'` when no localStorage exists and system prefers light
    - Test context defaults to `'dark'` when no localStorage exists and system prefers dark
    - Test explicit user choice persists to localStorage and overrides system preference
    - Test invalid themeMode in localStorage falls back to `'light'`
    - Test file: `frontend/src/contexts/__tests__/AccessibilityContext.test.tsx`
    - _Requirements: 2.3, 2.4, 3.2, 3.3, 7.1, 7.2, 7.3, 7.4_

- [x] 3. Checkpoint - Verify theme infrastructure compiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Rename Settings dialog and add Appearance section
  - [x] 4.1 Rename AccessibilitySettings dialog to "Settings" and add theme toggle
    - In `frontend/src/components/accessibility/AccessibilitySettings.tsx`:
    - Change dialog title from "Accessibility Settings" to "Settings"
    - Replace `AccessibilityIcon` with MUI `Settings` icon in the dialog header
    - Update `aria-labelledby` to reference the new "Settings" title element
    - Update close button aria-label to "Close settings" and announce "Settings closed" via `announceToScreenReader`
    - Add an "Appearance" section as the **first** section (before "Visual Settings") with a `PaletteIcon` header
    - Add a `Switch` control for dark mode: `checked={settings.themeMode === 'dark'}`, toggles between `'dark'` and `'light'` via `updateSettings({ themeMode: newMode })`
    - Announce theme changes to screen readers: `"Theme changed to ${newMode} mode"`
    - Set accessible label on the switch: `aria-label: 'Dark mode'`
    - Add helper text: "Switch between light and dark color schemes"
    - Update `resetToDefaults` to include `themeMode: 'light'`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 4.2 Write property test for toggle state (Property 4)
    - **Property 4: Toggle reflects context state**
    - For any valid ThemeMode in the context, the Settings panel toggle Switch has `checked` equal to `themeMode === 'dark'`
    - Use `fc.constantFrom('light', 'dark')` generator with minimum 100 iterations
    - Test file: `frontend/src/components/accessibility/__tests__/AccessibilitySettings.test.tsx`
    - **Validates: Requirements 5.2, 6.2**

  - [ ]* 4.3 Write unit tests for Settings dialog changes
    - Test dialog title is "Settings"
    - Test dialog uses Settings icon (not AccessibilityIcon)
    - Test dialog has correct aria-labelledby
    - Test close button announces "Settings closed"
    - Test Appearance section exists with theme toggle
    - Test Appearance section appears before Visual Settings section
    - Test toggle calls updateSettings on change
    - Test toggle change announces to screen reader
    - Test toggle has accessible label "Dark mode"
    - Test resetToDefaults resets themeMode to 'light'
    - Test file: `frontend/src/components/accessibility/__tests__/AccessibilitySettings.test.tsx`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 5. Add Preferences section to UserProfile page
  - [x] 5.1 Add theme toggle to UserProfile page
    - In `frontend/src/pages/UserProfile.tsx`:
    - Import `useAccessibility` from `../contexts/AccessibilityContext`
    - Import `Paper`, `FormControlLabel`, `Switch` from `@mui/material`
    - Add a "Preferences" section after the `MfaStatusSection` component
    - Wrap in a `Paper` with `sx={{ p: 3, mt: 3 }}`
    - Add a `Switch` for dark mode matching the same pattern as the Settings panel toggle
    - Announce theme changes to screen readers on toggle
    - Set accessible label: `aria-label: 'Dark mode'`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 5.2 Write unit tests for UserProfile Preferences section
    - Test Preferences section renders with theme toggle
    - Test toggle reflects current themeMode from context
    - Test toggle calls updateSettings on change
    - Test toggle announces to screen reader
    - Test Preferences section appears after MFA section
    - Test file: `frontend/src/pages/__tests__/UserProfile.test.tsx`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 6. Update Header menu item and App.tsx wiring
  - [x] 6.1 Update Header.tsx menu item from "Accessibility" to "Settings"
    - In `frontend/src/components/Header.tsx`:
    - Replace `AccessibilityIcon` import with `Settings as SettingsIcon` from `@mui/icons-material`
    - Change menu item label from "Accessibility" to "Settings"
    - Replace `AccessibilityIcon` with `SettingsIcon` in the menu item
    - Keep the `openAccessibilitySettings` method reference unchanged for backward compatibility
    - _Requirements: 4.1, 4.2_

  - [x] 6.2 Verify App.tsx ThemeProvider integration
    - Confirm `App.tsx` outer ThemeProvider uses the backward-compatible `theme` export from `theme.ts`
    - Confirm the AccessibilityProvider's inner ThemeProvider correctly overrides palette.mode based on themeMode
    - Confirm theme changes apply without page reload via the existing ThemeProvider hierarchy
    - _Requirements: 2.5, 8.1, 8.2, 8.3_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `reducedMotion` CSS override in AccessibilityContext already handles Requirement 8.2 (instant theme changes when reduced motion is enabled)
- No changes needed to individual page components — MUI's `sx` prop with theme-aware tokens updates automatically via ThemeProvider
