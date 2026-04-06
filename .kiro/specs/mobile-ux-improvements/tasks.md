# Implementation Plan: Mobile UX Improvements

## Overview

Implement nine mobile UX improvements to the "Where's My Stuff!" React/TypeScript/MUI app. All changes are frontend-only. Tasks are ordered to build foundational components first, then integrate them into pages, then wire up navigation and state.

## Tasks

- [x] 1. Create `MobileThingCard` component
  - [x] 1.1 Implement `MobileThingCard.tsx` in `frontend/src/components/`
    - Mirror `MobileContainerCard` pattern with props: `thing`, `categoryName`, `locationName`, `isSelectMode`, `isSelected`, `onTap`, `onEdit`, `onDelete`, `onSelectionToggle`
    - Row layout: `PhotoThumbnail` (40px) | name (`Typography subtitle1`) | overflow `IconButton` (MoreVert)
    - Second row: category `Chip` (small) | location text (`Typography body2`, `LocationOn` icon)
    - When `isSelectMode=true`: `Checkbox` overlaid top-left, card border highlighted
    - Minimum tap target height 44px for all interactive elements
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.8, 6.2_

  - [ ]* 1.2 Write property test for `MobileThingCard` required fields (Property 1)
    - **Property 1: ThingCard renders required fields for any Thing**
    - **Validates: Requirements 1.3, 1.5**
    - Use `fc.record({ id, name, categoryId?, locationId? })` as generator

  - [ ]* 1.3 Write property test for `MobileThingCard` photo display (Property 2)
    - **Property 2: ThingCard photo display matches photo presence**
    - **Validates: Requirements 1.3, 1.4**
    - Use `fc.array(fc.string(), { minLength: 0, maxLength: 5 })` for photos

  - [ ]* 1.4 Write unit tests for `MobileThingCard`
    - Test renders with/without photos, overflow menu actions, select mode checkbox
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 6.2_

- [x] 2. Create `ThingDetailSheet` component
  - [x] 2.1 Implement `ThingDetailSheet.tsx` in `frontend/src/components/`
    - MUI `SwipeableDrawer` anchored bottom with puller handle
    - Props: `thing`, `open`, `categoryName`, `locationName`, `roomName`, `containerName`, `ownerName`, `onClose`, `onEdit`
    - Section 1: location breadcrumb `Location → Room → Container` omitting unset levels, `Typography h6` with `NavigateNext` separators
    - Section 2: primary `PhotoThumbnail` (size=120, centered)
    - Section 3: metadata chips (category, owner)
    - Section 4: description text
    - Sticky bottom bar: `Edit` button (contained) + `Close` button (outlined)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

  - [ ]* 2.2 Write property test for breadcrumb omitting unset levels (Property 6)
    - **Property 6: Location breadcrumb omits unset levels**
    - **Validates: Requirements 4.2**
    - Use `fc.record({ locationId?: fc.uuid(), roomId?: fc.uuid(), containerId?: fc.uuid() })`

  - [ ]* 2.3 Write property test for detail view required fields (Property 7)
    - **Property 7: Detail view displays all required fields**
    - **Validates: Requirements 4.3**
    - Use `fc.record(thingArb)` covering all optional fields

  - [ ]* 2.4 Write unit tests for `ThingDetailSheet`
    - Test breadcrumb with all combinations of set/unset location levels, close button, edit button callback
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [x] 3. Create `ThingBulkActionBar` component
  - [x] 3.1 Implement `ThingBulkActionBar.tsx` in `frontend/src/components/`
    - Props: `selectedCount`, `locations`, `containers`, `onMoveToLocation`, `onMoveToContainer`, `onClearSelection`
    - Fixed bottom bar showing: `"{N} selected"` | `Move to Location` button | `Move to Container` button | `✕` clear
    - Position above `MobileNavigation` on mobile (z-index aware)
    - _Requirements: 6.3, 6.4, 6.5_

  - [ ]* 3.2 Write unit tests for `ThingBulkActionBar`
    - Test renders correct count, triggers correct callbacks for each action
    - _Requirements: 6.3, 6.4, 6.5_

- [x] 4. Checkpoint — Ensure all component tests pass, ask the user if questions arise.

- [x] 5. Implement `useLastUsedModule` hook and `RouteModuleTracker`
  - [x] 5.1 Create `frontend/src/hooks/useLastUsedModule.ts`
    - `STORAGE_KEY = 'wms_last_module'`, type `Module = 'inventory' | 'moving'`
    - Export `{ set, get }` with `localStorage` wrapped in try/catch for silent degradation
    - _Requirements: 8.1, 8.2, 8.4_

  - [x] 5.2 Create `RouteModuleTracker` component (can live in `frontend/src/components/RouteModuleTracker.tsx`)
    - Watches `location.pathname` via `useEffect`
    - Calls `set('inventory')` for paths starting with `/things`, `/locations`, `/categories`, `/people`, `/inventory`
    - Calls `set('moving')` for paths starting with `/moving`, `/containers`, `/projects`, `/storage`
    - _Requirements: 8.1, 8.2_

  - [ ]* 5.3 Write property test for inventory route tracking (Property 14)
    - **Property 14: Last-used module persisted for all inventory routes**
    - **Validates: Requirements 8.1**
    - Use `fc.constantFrom('/things', '/locations', '/categories', '/people', '/inventory')` + `fc.string()` suffix

  - [ ]* 5.4 Write property test for moving route tracking (Property 15)
    - **Property 15: Last-used module persisted for all moving routes**
    - **Validates: Requirements 8.2**
    - Use `fc.constantFrom('/moving', '/containers', '/projects', '/storage')` + `fc.string()` suffix

  - [ ]* 5.5 Write property test for home redirect (Property 16)
    - **Property 16: Home redirect uses last-used module**
    - **Validates: Requirements 8.3**
    - Use `fc.constantFrom('inventory', 'moving')` as stored value

  - [ ]* 5.6 Write unit tests for `useLastUsedModule`
    - Test get/set/missing value, storage unavailable (mock `localStorage` to throw)
    - _Requirements: 8.1, 8.2, 8.4_

- [x] 6. Create `ScanPage` component
  - [x] 6.1 Implement `frontend/src/pages/Scan.tsx`
    - Full-page wrapper around existing `BarcodeScanner` component
    - On successful scan: navigate to `/containers?highlight={id}`
    - On invalid/unrecognised scan: set local `error` state and display `Alert` with "Try again" button that resets scanner
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 6.2 Write property test for QR scan navigation (Property 8)
    - **Property 8: QR scan navigates to correct container**
    - **Validates: Requirements 5.3**
    - Use `fc.uuid()` as container ID, assert `navigate` called with correct path

  - [ ]* 6.3 Write unit tests for `ScanPage`
    - Test renders scanner, shows error on invalid scan, "Try again" resets scanner
    - _Requirements: 5.2, 5.3, 5.4_

- [x] 7. Update `App.tsx` — router, navigation, and home redirect
  - [x] 7.1 Add `/scan` protected route pointing to `ScanPage`
    - _Requirements: 5.1, 5.5_

  - [x] 7.2 Add home redirect logic at `/` and `/home`
    - Read `useLastUsedModule().get()` and redirect to `/things` or `/moving` when a value exists
    - Fall through to existing Home page when no value stored
    - _Requirements: 8.3, 8.4, 8.5_

  - [x] 7.3 Render `RouteModuleTracker` once inside `MainLayout` (or `App.tsx`)
    - _Requirements: 8.1, 8.2_

  - [x] 7.4 Render `MobileNavigation` bottom bar inside `MainLayout` (mobile only)
    - Ensure it is not already conditionally rendered elsewhere to avoid duplication
    - _Requirements: 9.1, 9.2_

  - [ ]* 7.5 Write unit tests for `App.tsx` routing
    - Test `/scan` route defined, home redirect to `/things` and `/moving`, no redirect when no stored value
    - _Requirements: 5.1, 5.5, 8.3, 8.4_

- [x] 8. Update `Header` and `Sidebar` for mobile suppression
  - [x] 8.1 Hide hamburger menu icon in `Header` when `isMobile` is true
    - _Requirements: 9.3_

  - [x] 8.2 Suppress `Sidebar` render entirely when `isMobile` is true
    - _Requirements: 9.4_

  - [x] 8.3 Add inventory selector to `MobileNavigation` More menu (or dedicated Header control on mobile)
    - _Requirements: 9.7_

  - [ ]* 8.4 Write unit/snapshot tests for `Header` and `Sidebar` on mobile
    - Test hamburger hidden on mobile, sidebar absent on mobile
    - _Requirements: 9.3, 9.4_

- [x] 9. Update `Things.tsx` — card list, FAB, detail sheet, bulk ops, optimistic updates
  - [x] 9.1 Add new state to `Things.tsx`
    - `selectedIds: Set<string>`, `isSelectMode: boolean`, `detailThing: Thing | null`
    - _Requirements: 6.1, 4.1_

  - [x] 9.2 Render `MobileThingCard` list on mobile instead of `EntityTable`
    - Use `useMobileDetection` to branch; pass filter/search state through so card list respects active filters
    - Show loading skeleton/spinner while data loads on mobile
    - Show empty-state message when list is empty on mobile
    - _Requirements: 1.1, 1.2, 1.9, 1.10, 1.11_

  - [ ]* 9.3 Write property test for card list respecting filters (Property 3)
    - **Property 3: Card list respects active filters**
    - **Validates: Requirements 1.11**
    - Use `fc.array(thingArb)` + `fc.record(filterArb)`

  - [x] 9.4 Wire `ThingDetailSheet` — open on card tap, close, then open edit dialog from sheet
    - Set `detailThing` on card tap; clear on close; call `handleEdit` from sheet's Edit button
    - _Requirements: 4.1, 4.4, 4.5, 4.6_

  - [x] 9.5 Add mobile FAB for "Add Thing"
    - Render `Fab` on mobile only, bottom offset ≥ 72px, triggers existing create dialog
    - _Requirements: 2.1, 2.3, 2.5, 2.6, 2.7, 2.9_

  - [x] 9.6 Implement select mode and wire `ThingBulkActionBar`
    - Entry into select mode (long-press or dedicated button), checkbox per card, bulk action bar visibility
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 9.7 Implement "Move to Location" bulk operation with `Promise.allSettled`
    - Call `apiClient.updateThing` for each selected ID; update state for successes; show error for failures per design error-handling spec
    - _Requirements: 6.4, 6.7, 6.8_

  - [ ]* 9.8 Write property test for bulk move to location (Property 9)
    - **Property 9: Bulk move updates all selected Things**
    - **Validates: Requirements 6.4**
    - Use `fc.set(fc.uuid())` + `fc.uuid()` for locationId

  - [x] 9.9 Implement "Move to Container" bulk operation with `Promise.allSettled`
    - Same pattern as move to location but sets `containerId`
    - _Requirements: 6.5, 6.7, 6.8_

  - [ ]* 9.10 Write property test for bulk move to container (Property 10)
    - **Property 10: Bulk move to container updates all selected Things**
    - **Validates: Requirements 6.5**
    - Use `fc.set(fc.uuid())` + `fc.uuid()` for containerId

  - [x] 9.11 Replace `loadData()` calls after mutations with optimistic state updates
    - Create: append new Thing to `things` and `allThings` on success; remove on failure
    - Update: splice updated Thing in both arrays on success; restore previous on failure
    - Delete: remove Thing from both arrays on success; re-insert at original index on failure
    - Call `showError()` on any failure
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 9.12 Write property test for optimistic create (Property 11)
    - **Property 11: Optimistic create adds Thing without reference data refetch**
    - **Validates: Requirements 7.1, 7.5**

  - [ ]* 9.13 Write property test for optimistic update (Property 12)
    - **Property 12: Optimistic update replaces Thing without reference data refetch**
    - **Validates: Requirements 7.2, 7.5**

  - [ ]* 9.14 Write property test for optimistic delete (Property 13)
    - **Property 13: Optimistic delete removes Thing without reference data refetch**
    - **Validates: Requirements 7.3, 7.5**

  - [ ]* 9.15 Write unit tests for `Things.tsx` mobile view
    - FAB renders, detail sheet opens on card tap, empty state, loading state
    - _Requirements: 1.9, 1.10, 2.1, 2.3, 4.1_

- [x] 10. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 11. Update `ThingFormDialog` — photo on General tab
  - [x] 11.1 Add photo upload control to General tab (mobile only)
    - Render `PhotoUploadZone` below Name field and above Description field when `isMobile`
    - Share `formData.photos` state with Media tab (no separate state)
    - Display existing photos via `PhotoPreviewGrid` or equivalent
    - Cap inline display at 3 thumbnails; show `"+N more"` indicator when `photos.length > 3`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 11.2 Write property test for photo state shared between tabs (Property 4)
    - **Property 4: Photo state is shared between General and Media tabs**
    - **Validates: Requirements 3.3, 3.4, 3.5**
    - Use `fc.array(fc.string())` for photo keys, apply add/remove ops via both tabs

  - [ ]* 11.3 Write property test for General tab overflow indicator (Property 5)
    - **Property 5: General tab photo overflow indicator**
    - **Validates: Requirements 3.8**
    - Use `fc.array(fc.string(), { minLength: 4, maxLength: 20 })`

  - [ ]* 11.4 Write unit tests for `ThingFormDialog` General tab photo control
    - Test photo upload, removal, existing photos display, overflow indicator
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.7, 3.8_

- [x] 12. Update `Containers.tsx` — mobile FAB
  - [x] 12.1 Add mobile FAB for "Add Container" to `Containers.tsx` (or `ContainerList`)
    - Render `Fab` on mobile only, bottom offset ≥ 72px, triggers existing container creation dialog
    - _Requirements: 2.2, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 12.2 Write unit tests for Containers FAB
    - Test FAB renders on mobile, absent on desktop, triggers create dialog
    - _Requirements: 2.2, 2.4, 2.5_

- [x] 13. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check; tag each with `// Feature: mobile-ux-improvements, Property {N}: {property_text}`
- All mobile detection uses the existing `useMobileDetection` hook (`isMobile` = viewport < 600px)
- No backend changes required — all work is frontend only
