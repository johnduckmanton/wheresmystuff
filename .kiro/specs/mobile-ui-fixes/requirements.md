# Requirements Document

## Introduction

This specification addresses four visual bugs in the mobile interface of the WheresMyStuff application. All bugs are frontend-only, low priority, and affect icon consistency, alignment, sizing, and theming in the mobile view. The project uses React 19 with Material-UI v7 and TypeScript.

## Glossary

- **MobileNavigation**: The bottom navigation bar component rendered on mobile devices (`MobileNavigation.tsx`)
- **HomeModule**: The Home page dashboard component displaying module cards (`Home.tsx`)
- **PhotoSearchButton**: The floating action button component that initiates photo-based search (`PhotoSearchButton.tsx`)
- **BottomNav**: The MUI `BottomNavigation` widget containing navigation action icons
- **ModuleCard**: A card on the Home page representing a top-level feature module (Inventory, Moving & Storage)
- **ThemeMode**: The active color scheme, either `light` or `dark`, defined in `theme.ts`

## Requirements

### Requirement 1: Moving Tab Icon Consistency

**User Story:** As a mobile user, I want the Moving tab icon in the bottom navigation to match the icon used on the web interface, so that the interface is visually consistent across platforms.

#### Acceptance Criteria

1. WHEN the MobileNavigation renders the Moving tab icon, THE MobileNavigation SHALL display the `LocalShipping` icon (truck) instead of the `MoveToInbox` icon (box).
2. THE MobileNavigation SHALL import the `LocalShipping` icon from `@mui/icons-material` for the Moving tab.
3. WHEN the Moving tab is rendered, THE MobileNavigation SHALL display a truck icon that is visually identical to the icon used for Moving & Storage on the web Home page.

### Requirement 2: AI Photo Tab Icon Alignment

**User Story:** As a mobile user, I want the AI Photo icon in the bottom navigation to be vertically aligned with the other icons, so that the navigation bar looks uniform.

#### Acceptance Criteria

1. WHEN the MobileNavigation renders the AI Photo tab icon, THE MobileNavigation SHALL render the `AutoAwesome` icon at the same vertical position as all other bottom navigation icons.
2. THE MobileNavigation SHALL apply explicit sizing styles to the `AutoAwesome` icon so that the icon dimensions match the other navigation icons (24px default).
3. WHEN the AI Photo tab icon is rendered, THE MobileNavigation SHALL apply vertical alignment styles that prevent the icon from rendering higher than adjacent icons in the BottomNav.

### Requirement 3: Home Module Card Equal Sizing on Mobile

**User Story:** As a mobile user, I want the Inventory and Moving & Storage module cards on the Home page to be the same height, so that the layout looks balanced and professional.

#### Acceptance Criteria

1. WHILE the viewport is at mobile breakpoint (below `sm`), THE HomeModule SHALL render both module cards at equal height.
2. WHILE the viewport is at mobile breakpoint, THE HomeModule SHALL prevent text wrapping in the "Moving & Storage" card title that causes unequal card heights.
3. WHEN the Home page renders on mobile, THE HomeModule SHALL apply styling to the module card titles that keeps text on a single line (using reduced font size, `whiteSpace: 'nowrap'`, or adjusted padding).
4. WHILE the viewport is at mobile breakpoint, THE HomeModule SHALL ensure the "Moving & Storage" card title remains fully readable without truncation.

### Requirement 4: Photo Search Button Theme-Aware Styling

**User Story:** As a mobile user, I want the Photo Search floating action button to match the active color theme, so that it does not appear as a white circle with a black icon regardless of the current theme mode.

#### Acceptance Criteria

1. WHEN the PhotoSearchButton renders in `icon` variant, THE PhotoSearchButton SHALL use theme-aware colors for the Fab background and icon color.
2. WHILE ThemeMode is `light`, THE PhotoSearchButton SHALL render the Fab with colors consistent with the light theme palette (primary or secondary color).
3. WHILE ThemeMode is `dark`, THE PhotoSearchButton SHALL render the Fab with colors consistent with the dark theme palette (primary or secondary color).
4. THE PhotoSearchButton SHALL NOT use `color="default"` on the Fab component, as this produces a static white background with black icon that ignores the active theme.
5. WHEN the PhotoSearchButton Fab is rendered, THE PhotoSearchButton SHALL display the `ImageSearch` icon in a color that provides sufficient contrast against the Fab background in both light and dark modes.
