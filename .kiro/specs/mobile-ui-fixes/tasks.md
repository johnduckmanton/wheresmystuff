# Implementation Plan: Mobile UI Fixes

## Overview

Four independent frontend UI bug fixes targeting icon consistency, alignment, card sizing, and theme-aware button styling in the mobile interface. Each fix is a targeted prop or style change in a single component file. All changes use TypeScript with Material-UI v7 `sx` prop styling.

## Tasks

- [x] 1. Fix Moving tab icon in MobileNavigation
  - [x] 1.1 Replace MoveToInbox import with LocalShipping in MobileNavigation.tsx
    - In `frontend/src/components/MobileNavigation.tsx`, change the import from `MoveToInbox as MovingIcon` to `LocalShipping as MovingIcon`
    - The alias `MovingIcon` stays the same so no JSX changes are needed
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 1.2 Write unit test for Moving tab icon
    - Render `MobileNavigation` and assert the Moving tab contains a `LocalShipping` icon (check for the correct SVG `data-testid` or component presence)
    - _Requirements: 1.1, 1.3_

- [x] 2. Fix AI Photo tab icon alignment in MobileNavigation
  - [x] 2.1 Add explicit sizing and alignment styles to AutoAwesomeIcon in MobileNavigation.tsx
    - In `frontend/src/components/MobileNavigation.tsx`, wrap the `AutoAwesomeIcon` in the AI Photo tab with `sx={{ fontSize: 24, display: 'block', verticalAlign: 'middle' }}`
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 2.2 Write unit test for AI Photo icon alignment
    - Render `MobileNavigation` and assert the `AutoAwesomeIcon` element has the expected alignment styles applied
    - _Requirements: 2.1, 2.2_

- [x] 3. Fix Home module card sizing on mobile
  - [x] 3.1 Add whiteSpace and fontSize styles to mobile card titles in Home.tsx
    - In `frontend/src/pages/Home.tsx`, update both module card `Typography` elements to include `...(isMobile && { whiteSpace: 'nowrap', fontSize: '0.85rem' })` in their `sx` prop
    - Apply to both "Inventory" and "Moving & Storage" card titles for visual consistency
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 3.2 Write unit test for card title nowrap styling
    - Render `Home` at mobile breakpoint and assert the "Moving & Storage" Typography has `whiteSpace: 'nowrap'` style
    - _Requirements: 3.2, 3.3_

- [x] 4. Fix Photo Search button theme-aware color
  - [x] 4.1 Change Fab color prop and add white icon color in PhotoSearchButton.tsx
    - In `frontend/src/components/PhotoSearchButton.tsx`, change `color="default"` to `color="primary"` on the Fab component
    - Add `sx={{ color: 'white' }}` to the `ImageSearchIcon` inside the Fab for proper contrast
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 4.2 Write unit test for Fab color prop
    - Render `PhotoSearchButton` with `variant="icon"` and assert the Fab has `color="primary"` (not `color="default"`)
    - _Requirements: 4.4, 4.5_

- [x] 5. Verification checkpoint
  - [x] 5.1 Run TypeScript compilation and tests
    - Run `npm run build` in the frontend directory to confirm no type errors
    - Run `npm test` in the frontend directory to confirm no regressions
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each fix is independent — they can be applied in any order without conflicts
- All changes are frontend-only; no backend or data model modifications
- The project uses Vitest for testing (`npm test` in the frontend directory)
- No property-based tests are needed — all acceptance criteria are concrete style/prop assertions best validated with example-based unit tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.2", "4.2"] },
    { "id": 2, "tasks": ["5.1"] }
  ]
}
```
