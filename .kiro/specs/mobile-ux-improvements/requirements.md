# Requirements Document

## Introduction

This feature improves the mobile experience and overall usability of the "Where's My Stuff!" home inventory app across nine areas: replacing the unusable DataGrid table on the Things page with a card-based list view; adding a context-aware FAB for quick item creation; surfacing photo upload on the first form tab; adding a "where is it?" detail view; fixing the broken `/scan` route; adding bulk operations on Things; making saves feel instant with optimistic updates; remembering the last-used module to skip the home screen; and unifying mobile navigation to a single bottom-bar pattern.

The app is built with React, TypeScript, and MUI, and already has `MobileContainerCard`, `useMobileDetection`, and `MobileNavigation` as established patterns.

## Glossary

- **Things_Page**: The `/things` route that lists all inventory items for the current inventory
- **ThingCard**: The new mobile card component that replaces the DataGrid row for a single Thing on mobile
- **ThingFormDialog**: The multi-tab dialog used to create and edit Things; tabs are General, Location, Purchase, Media
- **FAB**: Floating Action Button — an MUI `Fab` component fixed to the bottom-right of the screen
- **EntityTable**: The existing MUI DataGrid wrapper used on Things, Containers, and other list pages
- **MobileContainerCard**: The existing mobile card component for Containers, used as the design pattern for ThingCard
- **MobileNavigation**: The existing bottom navigation bar component rendered on mobile
- **useMobileDetection**: The existing custom hook that returns `isMobile` (true when viewport < 600px)
- **Mobile**: A viewport width below 600px (MUI `xs` breakpoint, i.e., `theme.breakpoints.down('sm')`)
- **Desktop**: A viewport width of 900px or above (MUI `md` breakpoint)
- **Bottom sheet**: A slide-up drawer anchored to the bottom of the viewport, used for contextual detail views on mobile
- **Optimistic update**: Updating the UI immediately on user action before the API response, then reverting on failure
- **Last-used module**: The most recently visited top-level module (inventory or moving), persisted in `localStorage`

## Requirements

### Requirement 1: Card-Based List View for Things on Mobile

**User Story:** As a mobile user, I want to see my Things displayed as cards instead of a data table, so that I can browse and interact with my inventory on a small screen without horizontal scrolling or tiny tap targets.

#### Acceptance Criteria

1. WHILE the viewport is Mobile, THE Things_Page SHALL render Things as a vertically-scrolling list of ThingCards instead of the EntityTable.
2. WHILE the viewport is Desktop, THE Things_Page SHALL render Things using the existing EntityTable, unchanged.
3. THE ThingCard SHALL display the Thing's primary photo as a thumbnail when at least one photo exists, using the existing `PhotoThumbnail` component or equivalent.
4. IF a Thing has no photos, THE ThingCard SHALL display a placeholder icon in place of the thumbnail.
5. THE ThingCard SHALL display the Thing's name, category (as a MUI Chip), and location name as visible text.
6. THE ThingCard SHALL provide an overflow menu (three-dot icon button) containing Edit and Delete actions, matching the interaction pattern of `MobileContainerCard`.
7. WHEN a user taps a ThingCard outside the overflow menu, THE Things_Page SHALL open the ThingFormDialog in edit mode for that Thing.
8. THE ThingCard SHALL have a minimum tap target height of 44px for all interactive elements, consistent with `useTouchButtonSize` values.
9. WHILE the Things_Page is loading data on Mobile, THE Things_Page SHALL display a loading skeleton or spinner in place of the card list.
10. IF the Things list is empty on Mobile, THE Things_Page SHALL display an empty-state message prompting the user to add their first Thing.
11. THE ThingCard list SHALL respect the existing filter and search state, displaying only Things that match the active filters.

### Requirement 2: Context-Aware Floating Action Button

**User Story:** As a mobile user, I want a prominent floating action button that lets me quickly add the relevant entity for the page I'm on, so that I don't have to hunt for the Add button in the page header.

#### Acceptance Criteria

1. WHILE the viewport is Mobile, THE Things_Page SHALL render a FAB fixed to the bottom-right of the screen with an Add icon and the label "Add Thing".
2. WHILE the viewport is Mobile, THE Containers_Page SHALL render a FAB fixed to the bottom-right of the screen with an Add icon and the label "Add Container".
3. WHEN a user taps the FAB on the Things_Page, THE Things_Page SHALL open the ThingFormDialog in create mode, equivalent to tapping the existing "Add Thing" button.
4. WHEN a user taps the FAB on the Containers_Page, THE Containers_Page SHALL open the container creation dialog, equivalent to tapping the existing "Add Container" button.
5. WHILE the viewport is Desktop, THE FAB SHALL NOT be rendered on any page.
6. THE FAB SHALL be positioned so that it does not overlap the MobileNavigation bottom bar; the FAB bottom offset SHALL be at least 72px from the bottom of the viewport to clear the 56px navigation bar.
7. THE FAB SHALL have a minimum touch target size of 56px × 56px, consistent with MUI `Fab` default sizing.
8. WHERE the page already renders a FAB for another purpose (e.g., the Accessibility Settings FAB in `App.tsx`), THE new context-aware FAB SHALL be positioned so the two FABs do not overlap, with the context-aware FAB appearing above the accessibility FAB.
9. WHILE the viewport is Mobile and the Things_Page is loading data, THE FAB SHALL remain visible and tappable.

### Requirement 3: Photo Field Promoted to General Tab in ThingFormDialog

**User Story:** As a mobile user, I want to be able to add a photo when I first open the add-item form, so that I don't miss the photo feature because it's buried on a later tab.

#### Acceptance Criteria

1. WHILE the viewport is Mobile and ThingFormDialog is open, THE ThingFormDialog SHALL display a photo upload control on the General tab (tab index 0) in addition to its existing location on the Media tab.
2. WHILE the viewport is Desktop, THE ThingFormDialog SHALL display tabs and photo placement unchanged from the current implementation.
3. THE photo upload control on the General tab SHALL use the existing `PhotoUploadZone` component and share the same `formData.photos` state as the Media tab upload, so that photos added on either tab are reflected in both.
4. WHEN a user uploads a photo via the General tab control, THE ThingFormDialog SHALL add the uploaded photo key to `formData.photos`, identical in behaviour to uploading via the Media tab.
5. WHEN a user removes a photo via the General tab control, THE ThingFormDialog SHALL remove the corresponding photo key from `formData.photos`.
6. THE photo upload control on the General tab SHALL be positioned below the Name field and above the Description field so it is visible without scrolling on a typical mobile viewport.
7. IF photos already exist on the Thing being edited, THE General tab photo control SHALL display the existing photos using `PhotoPreviewGrid` or equivalent, consistent with the Media tab behaviour.
8. THE General tab photo control SHALL display a maximum of 3 photo thumbnails inline; WHEN more than 3 photos exist, THE ThingFormDialog SHALL indicate the additional count (e.g., "+2 more") rather than expanding the layout.

### Requirement 4: Thing Detail / "Where Is It?" View

**User Story:** As a user physically looking for something in my home, I want to tap on a Thing and immediately see a clear answer to "where is this?", so that I don't have to read through a full edit form to find the location.

#### Acceptance Criteria

1. WHEN a user taps a ThingCard on Mobile, THE Things_Page SHALL open a read-only Thing detail view before (or instead of) the edit form, displaying the location breadcrumb prominently.
2. THE detail view SHALL display the full location breadcrumb in the format: Location → Room → Container, omitting any levels that are not set for that Thing.
3. THE detail view SHALL display the Thing's name, primary photo (if any), category, owner, and description.
4. THE detail view SHALL provide an Edit button that opens the ThingFormDialog in edit mode for that Thing.
5. THE detail view SHALL be dismissible via a close button or back gesture.
6. WHILE the viewport is Desktop, the existing behaviour of tapping a row opening the edit dialog directly SHALL remain unchanged.
7. THE detail view SHALL be implemented as a bottom sheet (slide-up drawer) on Mobile, consistent with standard mobile UX patterns.

---

### Requirement 5: QR Code Scan Route

**User Story:** As a mobile user, I want the Scan tab in the bottom navigation to open a working QR code scanner, so that I can quickly look up a container by scanning its label.

#### Acceptance Criteria

1. THE application router SHALL define a `/scan` route that renders a QR code scanning interface.
2. WHEN a user navigates to `/scan`, THE application SHALL display the existing QR code scanner component (or equivalent) that allows scanning a container's QR code.
3. WHEN a valid container QR code is scanned on the `/scan` route, THE application SHALL navigate to the container detail view for the scanned container.
4. WHEN an invalid or unrecognised QR code is scanned, THE `/scan` route SHALL display an error message to the user.
5. THE `/scan` route SHALL be a protected route requiring authentication, consistent with all other app routes.
6. THE MobileNavigation Scan tab SHALL correctly highlight as active when the current path is `/scan`.

---

### Requirement 6: Bulk Operations on Things

**User Story:** As a user unpacking boxes, I want to select multiple Things at once and move them all to a new location or container, so that I don't have to edit each item individually.

#### Acceptance Criteria

1. WHILE the viewport is Mobile, THE Things_Page SHALL provide a way to enter a multi-select mode on the ThingCard list.
2. WHILE in multi-select mode, EACH ThingCard SHALL display a checkbox or visual selection indicator.
3. WHILE one or more ThingCards are selected, THE Things_Page SHALL display a bulk action bar showing the count of selected items and actions: "Move to Location" and "Move to Container".
4. WHEN a user confirms "Move to Location", THE Things_Page SHALL update the `locationId` of all selected Things to the chosen location and clear the selection.
5. WHEN a user confirms "Move to Container", THE Things_Page SHALL update the `containerId` of all selected Things to the chosen container and clear the selection.
6. WHILE the viewport is Desktop, THE EntityTable SHALL support row selection and display the same bulk action bar when rows are selected.
7. WHEN a bulk operation completes successfully, THE Things_Page SHALL display a success notification stating how many items were updated.
8. WHEN a bulk operation fails, THE Things_Page SHALL display an error notification and leave the selection unchanged.

---

### Requirement 7: Optimistic Updates on Things Save

**User Story:** As a user, I want the Things list to update immediately after I save a change, so that the app feels fast and responsive rather than reloading all data after every edit.

#### Acceptance Criteria

1. WHEN a user creates a new Thing via ThingFormDialog, THE Things_Page SHALL add the new Thing to the displayed list immediately upon successful API response, without re-fetching locations, rooms, categories, people, projects, or containers.
2. WHEN a user updates an existing Thing via ThingFormDialog, THE Things_Page SHALL update that Thing's entry in the displayed list immediately upon successful API response, without re-fetching reference data.
3. WHEN a user deletes a Thing, THE Things_Page SHALL remove that Thing from the displayed list immediately upon successful API response, without re-fetching reference data.
4. IF the API call fails during create, update, or delete, THE Things_Page SHALL display an error notification and leave the list unchanged.
5. THE reference data (locations, rooms, categories, people, projects, containers) SHALL only be re-fetched when the inventory selection changes, not after individual Thing operations.

---

### Requirement 8: Last-Used Module Navigation

**User Story:** As a returning user, I want the app to remember which module I was using last and take me straight there, so that I don't have to tap through the Home screen every session.

#### Acceptance Criteria

1. WHEN a user navigates to the Inventory module (any route under `/things`, `/locations`, `/categories`, `/people`, `/inventory`), THE application SHALL persist `"inventory"` as the last-used module in `localStorage`.
2. WHEN a user navigates to the Moving module (any route under `/moving`, `/containers`, `/projects`, `/storage`), THE application SHALL persist `"moving"` as the last-used module in `localStorage`.
3. WHEN a user navigates to `/` or `/home` and a last-used module value exists in `localStorage`, THE application SHALL redirect to the default page for that module (`/things` for inventory, `/moving` for moving) instead of showing the Home page.
4. WHEN no last-used module value exists (first visit or cleared storage), THE application SHALL show the Home page as currently implemented.
5. THE Home page SHALL remain accessible via the sidebar Home link regardless of the last-used module value.

---

### Requirement 9: Unified Mobile Navigation

**User Story:** As a mobile user, I want a single consistent navigation pattern, so that I'm not confused by having both a hamburger sidebar and a bottom navigation bar that partially overlap in purpose.

#### Acceptance Criteria

1. WHILE the viewport is Mobile, THE application SHALL use the bottom navigation bar (`MobileNavigation`) as the primary navigation mechanism.
2. WHILE the viewport is Mobile, THE bottom navigation bar SHALL include tabs covering all primary destinations: Home, Things, Locations/Categories (grouped), Moving/Containers, and a More menu.
3. WHILE the viewport is Mobile, THE hamburger menu icon in the Header SHALL be hidden; the sidebar SHALL NOT be accessible via hamburger on mobile.
4. WHILE the viewport is Mobile, THE sidebar SHALL NOT render at all (neither as overlay nor permanent drawer).
5. THE More menu in the bottom navigation SHALL include links to: Locations, Categories, People, Projects, Storage, and Settings/Profile.
6. WHILE the viewport is Desktop, THE sidebar and Header SHALL behave exactly as they currently do, with no changes.
7. THE inventory selector (currently in the sidebar) SHALL be accessible on mobile via the More menu or a dedicated control in the Header, so users can switch inventories without the sidebar.
