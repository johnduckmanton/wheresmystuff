# Requirements Document

## Introduction

This feature adds dark theme support to the application. Users can toggle between light and dark color modes via the Settings panel (renamed from "Accessibility Settings") or from the User Profile page. The preference persists across sessions using localStorage. The implementation leverages MUI's native dark mode support through `createTheme({ palette: { mode: 'dark' } })`.

## Glossary

- **App**: The root React application rendered by `App.tsx`, which wraps all routes in a `ThemeProvider`.
- **Theme_Module**: The `frontend/src/theme.ts` module that exports the MUI theme configuration created via `createTheme`.
- **Settings_Panel**: The dialog component currently named `AccessibilitySettings` (to be renamed "Settings"), rendered as a modal overlay from `MainLayout`.
- **Settings_Context**: The React context (currently `AccessibilityContext`) that manages user preferences including theme mode, persists them to localStorage, and provides them to consuming components.
- **User_Profile_Page**: The page at `/profile` (`frontend/src/pages/UserProfile.tsx`) that displays and allows editing of user account information.
- **Theme_Mode**: A string value of either `"light"` or `"dark"` that determines the application's color scheme.
- **Theme_Toggle**: A UI control (switch or segmented button) that allows the user to change the Theme_Mode.
- **LocalStorage**: The browser's `window.localStorage` API used for persisting user preferences across sessions.

## Requirements

### Requirement 1: Dark Theme Definition

**User Story:** As a user, I want the application to have a well-defined dark color scheme, so that I can use the app comfortably in low-light environments.

#### Acceptance Criteria

1. THE Theme_Module SHALL export a function that accepts a Theme_Mode parameter and returns a complete MUI theme object.
2. WHEN Theme_Mode is `"dark"`, THE Theme_Module SHALL produce a theme with `palette.mode` set to `"dark"` and dark-appropriate values for `background.default`, `background.paper`, `text.primary`, and `text.secondary`.
3. WHEN Theme_Mode is `"light"`, THE Theme_Module SHALL produce a theme with `palette.mode` set to `"light"` using the current light palette values (`background.default: #f5f5f5`, `background.paper: #ffffff`, `text.primary: #212121`, `text.secondary: #757575`).
4. THE Theme_Module SHALL preserve the existing `primary.main` (`#1976d2`), `secondary.main` (`#dc004e`), typography, breakpoints, and component override configurations in both light and dark themes.

### Requirement 2: Theme Mode State Management

**User Story:** As a user, I want my theme preference to be managed centrally, so that all parts of the application reflect my chosen color scheme consistently.

#### Acceptance Criteria

1. THE Settings_Context SHALL include a `themeMode` property of type Theme_Mode in its state.
2. THE Settings_Context SHALL provide an `updateSettings` method that accepts a partial settings object including `themeMode` and applies the change to the context state.
3. WHEN the Settings_Context initializes, THE Settings_Context SHALL read the persisted theme preference from LocalStorage and use it as the initial Theme_Mode value.
4. IF no persisted theme preference exists in LocalStorage, THEN THE Settings_Context SHALL default Theme_Mode to `"light"`.
5. THE App SHALL pass the Theme_Mode from Settings_Context to the Theme_Module to generate the active MUI theme for the `ThemeProvider`.

### Requirement 3: Theme Preference Persistence

**User Story:** As a user, I want my dark or light theme choice to be remembered, so that I do not have to re-select it every time I open the application.

#### Acceptance Criteria

1. WHEN the user changes the Theme_Mode, THE Settings_Context SHALL write the updated preference to LocalStorage.
2. WHEN the application loads, THE Settings_Context SHALL read the Theme_Mode from LocalStorage and apply it before the first render completes.
3. IF the LocalStorage value for Theme_Mode is corrupted or unrecognized, THEN THE Settings_Context SHALL fall back to `"light"` mode and overwrite the invalid value in LocalStorage.

### Requirement 4: Rename Accessibility Settings to Settings

**User Story:** As a user, I want the settings panel to be called "Settings" instead of "Accessibility Settings", so that it clearly represents a broader set of preferences including theme selection.

#### Acceptance Criteria

1. THE Settings_Panel SHALL display the title "Settings" in its dialog header.
2. THE Settings_Panel SHALL use a general settings icon (MUI `Settings` icon) instead of the `Accessibility` icon in the dialog header.
3. THE Settings_Panel SHALL set its `aria-labelledby` attribute to reference the updated "Settings" title element.
4. WHEN the Settings_Panel close button is activated, THE Settings_Panel SHALL announce "Settings closed" to screen readers via the Settings_Context `announceToScreenReader` method.

### Requirement 5: Theme Toggle in Settings Panel

**User Story:** As a user, I want to toggle between dark and light themes from the Settings panel, so that I can change the color scheme from the central settings location.

#### Acceptance Criteria

1. THE Settings_Panel SHALL display a Theme_Toggle control within a clearly labeled "Appearance" section.
2. THE Theme_Toggle SHALL reflect the current Theme_Mode value from the Settings_Context.
3. WHEN the user activates the Theme_Toggle, THE Settings_Panel SHALL call the Settings_Context `updateSettings` method with the new Theme_Mode value.
4. WHEN the user changes the Theme_Mode via the Theme_Toggle, THE Settings_Panel SHALL announce the change to screen readers (e.g., "Theme changed to dark mode").
5. THE Theme_Toggle SHALL have an accessible label that describes its purpose (e.g., "Dark mode").
6. THE "Appearance" section SHALL appear as the first section in the Settings_Panel, before the existing "Visual Settings" section.

### Requirement 6: Theme Toggle on User Profile Page

**User Story:** As a user, I want to change my theme preference from my profile page, so that I can adjust the color scheme without opening the Settings panel.

#### Acceptance Criteria

1. THE User_Profile_Page SHALL display a Theme_Toggle control within a "Preferences" section.
2. THE Theme_Toggle on the User_Profile_Page SHALL reflect the current Theme_Mode value from the Settings_Context.
3. WHEN the user activates the Theme_Toggle on the User_Profile_Page, THE User_Profile_Page SHALL call the Settings_Context `updateSettings` method with the new Theme_Mode value.
4. WHEN the user changes the Theme_Mode via the User_Profile_Page Theme_Toggle, THE User_Profile_Page SHALL announce the change to screen readers.
5. THE "Preferences" section SHALL appear after the existing profile information and MFA sections on the User_Profile_Page.

### Requirement 7: System Preference Detection

**User Story:** As a user, I want the application to respect my operating system's color scheme preference on first visit, so that the app matches my system settings without manual configuration.

#### Acceptance Criteria

1. WHEN no Theme_Mode preference exists in LocalStorage, THE Settings_Context SHALL check the system `prefers-color-scheme` media query.
2. WHEN the system `prefers-color-scheme` media query matches `"dark"` and no LocalStorage preference exists, THE Settings_Context SHALL set the initial Theme_Mode to `"dark"`.
3. WHEN the system `prefers-color-scheme` media query matches `"light"` or has no preference and no LocalStorage preference exists, THE Settings_Context SHALL set the initial Theme_Mode to `"light"`.
4. WHEN the user explicitly sets a Theme_Mode via the Theme_Toggle, THE Settings_Context SHALL persist that choice to LocalStorage and stop following the system preference.

### Requirement 8: Theme Transition Behavior

**User Story:** As a user, I want theme changes to apply smoothly, so that switching between light and dark modes is not visually jarring.

#### Acceptance Criteria

1. WHEN the Theme_Mode changes, THE App SHALL apply the new theme to the MUI `ThemeProvider` without requiring a page reload.
2. WHILE the `reducedMotion` accessibility setting is enabled, THE App SHALL apply theme changes instantly without any transition effects.
3. THE App SHALL ensure that all MUI components using the `sx` prop with theme-aware tokens (e.g., `background.default`, `text.primary`) update automatically when the Theme_Mode changes.
