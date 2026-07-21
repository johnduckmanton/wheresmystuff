# Implementation Plan

## Bug 1: Lists Not Sorted by Most Recently Created First

- [x] 1. Write bug condition exploration test for default sort
  - **Property 1: Bug Condition** - Entity Lists Missing Default Sort
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate entity lists are not sorted by creation date
  - **Scoped PBT Approach**: Render Things page (and other entity list pages) with mock data containing various `dateAdded` values and verify the rendered order does NOT match descending date order
  - Test that rendering Things.tsx with items having dateAdded values [2024-01-01, 2024-03-01, 2024-02-01] produces output in arbitrary (non-sorted) order
  - Test that rendering ContainerList.tsx with items having createdAt values in random order produces output in non-sorted order
  - Test that Locations.tsx, People.tsx, Categories.tsx similarly render items without date-descending sort
  - Run tests on UNFIXED code - expect FAILURE (confirms bug exists: lists are not sorted by creation date)
  - Document counterexamples found (e.g., "Things page renders items in API response order, not date-descending order")
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests for sort and filter behavior (BEFORE implementing fix)
  - **Property 2: Preservation** - User Sort Override and Filter Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: When user clicks a column header to sort, the list respects that sort order on unfixed code
  - Observe: When filters/search are applied, results are correctly filtered on unfixed code
  - Write property-based test: for all user-initiated sort interactions (column header clicks), the displayed order matches the user's chosen sort regardless of default sort logic
  - Write property-based test: for all filter/search operations, filtered results contain only matching items
  - Verify tests pass on UNFIXED code (confirms baseline behavior to preserve)
  - _Requirements: 3.1, 3.2_

- [x] 3. Fix default sort for entity list pages

  - [x] 3.1 Add sortByDateDesc utility and apply to Things.tsx
    - Create a `sortByDateDesc` helper that sorts items by `dateAdded` or `createdAt` descending
    - Apply sort after fetching `thingsData` from API before calling `setThings()` and `setAllThings()`
    - Apply sort after filter operations in `applyFilters()`
    - _Bug_Condition: isBugCondition(input) where input.action == 'VIEW_ENTITY_LIST' AND input.sortOverride == NONE_
    - _Expected_Behavior: items displayed in descending dateAdded order_
    - _Preservation: user-initiated sort continues to override default_
    - _Requirements: 2.1, 3.1, 3.2_

  - [x] 3.2 Apply default sort to ContainerList.tsx
    - Sort containers by `createdAt` descending after fetch before setting state
    - _Requirements: 2.2_

  - [x] 3.3 Apply default sort to Locations.tsx, People.tsx, Categories.tsx
    - Sort each entity list by `dateAdded` descending after fetch before setting state
    - _Requirements: 2.3_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Entity Lists Default Sort
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (items sorted by creation date descending)
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - User Sort Override and Filter Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm user-initiated sort and filters continue to work after fix

## Bug 2: No Way to Delete Photos in Mobile Interface

- [x] 4. Write bug condition exploration test for mobile photo delete
  - **Property 1: Bug Condition** - ThingDetailSheet Missing Photo Delete Action
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate no delete action exists for photos in ThingDetailSheet
  - **Scoped PBT Approach**: Render ThingDetailSheet with a Thing that has 1-3 photos and verify no delete button/action is present
  - Test that rendering ThingDetailSheet with a Thing having `photos: ['photo1.jpg', 'photo2.jpg']` produces NO delete button elements
  - Query for delete icons, trash icons, or delete-related buttons within the photo section
  - Run test on UNFIXED code - expect FAILURE (confirms bug exists: no photo delete affordance)
  - Document counterexamples found (e.g., "ThingDetailSheet renders photos as display-only thumbnails with no delete action")
  - _Requirements: 1.4, 1.5_

- [x] 5. Write preservation property tests for desktop photo workflow (BEFORE implementing fix)
  - **Property 2: Preservation** - Desktop Photo Upload and Delete Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: ContainerPhotoUpload component renders delete buttons and handles photo deletion on unfixed code
  - Observe: Photo upload flow on desktop continues to add photos correctly on unfixed code
  - Write property-based test: for all desktop photo interactions (upload, delete via ContainerPhotoUpload), existing behavior is unchanged
  - Write property-based test: ThingFormDialog photo management on desktop continues to function
  - Verify tests pass on UNFIXED code (confirms baseline behavior to preserve)
  - _Requirements: 3.3, 3.4_

- [x] 6. Fix photo delete in ThingDetailSheet

  - [x] 6.1 Add photo delete UI to ThingDetailSheet
    - Add `onDeletePhoto?: (photoKey: string) => void` to `ThingDetailSheetProps` interface
    - Render all photos (not just primary) in a scrollable row
    - Add a delete icon overlay on each photo thumbnail
    - Add confirmation dialog before delete (consistent with existing delete patterns)
    - _Bug_Condition: isBugCondition(input) where input.action == 'VIEW_THING_PHOTOS' AND input.platform == 'MOBILE' AND input.intent == 'DELETE_PHOTO'_
    - _Expected_Behavior: each photo has a visible delete action; activating it removes the photo_
    - _Preservation: desktop photo management via ContainerPhotoUpload unchanged_
    - _Requirements: 2.4, 2.5, 3.3, 3.4_

  - [x] 6.2 Wire up onDeletePhoto handler in Things.tsx
    - Pass `onDeletePhoto` handler to ThingDetailSheet that calls `apiClient.deletePhoto()` and `apiClient.updateThing()` to remove the photo key from the Thing's `photos` array
    - Refresh the Thing data after successful deletion
    - _Requirements: 2.5_

  - [x] 6.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - ThingDetailSheet Photo Delete Action
    - **IMPORTANT**: Re-run the SAME test from task 4 - do NOT write a new test
    - Run bug condition exploration test from step 4
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - delete buttons now present)
    - _Requirements: 2.4, 2.5_

  - [x] 6.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Desktop Photo Upload and Delete Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 5 - do NOT write new tests
    - Run preservation property tests from step 5
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions to desktop photo workflows)

## Bug 3: Success Notification Does Not Link to Newly Created Item

- [x] 7. Write bug condition exploration test for notification links
  - **Property 1: Bug Condition** - Success Notifications Missing Navigation Action
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate success notifications lack clickable links
  - **Scoped PBT Approach**: Trigger `showSuccess()` via NotificationContext after entity creation and verify the rendered notification contains NO clickable link or button for navigation
  - Test that calling `showSuccess('Thing created successfully')` renders an Alert with plain text and no action button
  - Test that after creating an entity, the notification provides no navigation mechanism
  - Run test on UNFIXED code - expect FAILURE (confirms bug exists: notifications are plain text only)
  - Document counterexamples found (e.g., "showSuccess renders message as plain text Alert with no action prop")
  - _Requirements: 1.6, 1.7_

- [x] 8. Write preservation property tests for notification behavior (BEFORE implementing fix)
  - **Property 2: Preservation** - Notification Dismiss and Error Modal Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Success notifications auto-dismiss after timeout on unfixed code
  - Observe: Dismissing a notification does not trigger navigation on unfixed code
  - Observe: `showError` modal with action buttons continues to function on unfixed code
  - Write property-based test: for all notification dismiss interactions (auto-hide, close button), no navigation occurs
  - Write property-based test: for all error notifications, existing action button behavior is preserved
  - Verify tests pass on UNFIXED code (confirms baseline behavior to preserve)
  - _Requirements: 3.7_

- [x] 9. Fix success notifications to include navigation links

  - [x] 9.1 Extend NotificationContext with action support
    - Add optional `action?: { label: string; onClick: () => void }` parameter to `showSuccess()` signature
    - Update `NotificationState` interface to include the action field
    - Render a `<Button>` inside the `<Alert>` when action is provided
    - Ensure action button click triggers `onClick` and closes the notification
    - _Bug_Condition: isBugCondition(input) where input.action == 'CREATE_ENTITY' AND input.result == 'SUCCESS'_
    - _Expected_Behavior: notification contains clickable "View" button that navigates to created item_
    - _Preservation: notifications without action continue to render as plain text; dismiss behavior unchanged_
    - _Requirements: 2.6, 2.7, 3.7_

  - [x] 9.2 Update entity creation call sites
    - Update Things.tsx: pass `{ label: 'View', onClick: () => navigate to thing }` to `showSuccess` after creation
    - Update ContainerFormDialog.tsx: pass action to navigate to new container
    - Update Locations.tsx: pass action to navigate to new location
    - Update People.tsx: pass action to navigate to new person
    - Update Categories.tsx: pass action to navigate to new category
    - _Requirements: 2.6, 2.7_

  - [x] 9.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Success Notifications With Navigation Action
    - **IMPORTANT**: Re-run the SAME test from task 7 - do NOT write a new test
    - Run bug condition exploration test from step 7
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - notifications now have clickable links)
    - _Requirements: 2.6, 2.7_

  - [x] 9.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Notification Dismiss and Error Modal Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 8 - do NOT write new tests
    - Run preservation property tests from step 8
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions to dismiss/error behavior)

## Bug 4: Recently Added Things List Items Are Not Clickable

- [x] 10. Write bug condition exploration test for Home page clickability
  - **Property 1: Bug Condition** - Recently Added Things Not Clickable
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate recent things items do not respond to clicks
  - **Scoped PBT Approach**: Render Home page with recent things data, simulate click on a list item, and verify no navigation is triggered
  - Test that clicking a recently added thing item does not call `navigate()` or trigger any route change
  - Test that list items have no `onClick` handler, `role="button"`, or link wrapper
  - Run test on UNFIXED code - expect FAILURE (confirms bug exists: items are not interactive)
  - Document counterexamples found (e.g., "ListItem elements have no onClick handler and no role='button' attribute")
  - _Requirements: 1.8, 1.9_

- [x] 11. Write preservation property tests for Home page behavior (BEFORE implementing fix)
  - **Property 2: Preservation** - Home Page Container Navigation and Layout
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Recent containers section CardActionArea onClick navigates to `/containers` on unfixed code
  - Observe: Module cards (Inventory, Moving & Storage) navigate correctly on unfixed code
  - Observe: Top 3 most recent items display logic works correctly on unfixed code
  - Write property-based test: for all container card clicks on Home page, navigation to `/containers` occurs
  - Write property-based test: for all module card clicks, correct navigation is triggered
  - Write property-based test: recent items count and display logic produces correct output for various data sets
  - Verify tests pass on UNFIXED code (confirms baseline behavior to preserve)
  - _Requirements: 3.5, 3.8, 3.9_

- [x] 12. Fix recently added things clickability on Home page

  - [x] 12.1 Make recently added things items clickable
    - Replace `<ListItem>` with `<ListItemButton>` for each recent thing in the map
    - Add `onClick={() => navigate('/things', { state: { openThingId: thing.id } })}` handler
    - Add `sx={{ cursor: 'pointer' }}` and hover styles for visual affordance
    - Add proper accessibility: `<ListItemButton>` provides built-in keyboard and screen reader support
    - _Bug_Condition: isBugCondition(input) where input.action == 'CLICK_RECENT_THING' AND input.context == 'HOME_DASHBOARD'_
    - _Expected_Behavior: clicking a recent thing navigates to /things with state containing the thing's ID_
    - _Preservation: container cards, module cards, and top-3 display logic unchanged_
    - _Requirements: 2.8, 2.9, 3.5, 3.8, 3.9_

  - [x] 12.2 Handle navigation state in Things.tsx
    - Read `location.state.openThingId` on Things page mount
    - If present, open the detail view for that Thing (ThingDetailSheet or ThingFormDialog)
    - Clear the state after handling to prevent re-opening on subsequent navigation
    - _Requirements: 2.9_

  - [x] 12.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Recently Added Things Clickable
    - **IMPORTANT**: Re-run the SAME test from task 10 - do NOT write a new test
    - Run bug condition exploration test from step 10
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - items are now clickable and navigate)
    - _Requirements: 2.8, 2.9_

  - [x] 12.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Home Page Container Navigation and Layout
    - **IMPORTANT**: Re-run the SAME tests from task 11 - do NOT write new tests
    - Run preservation property tests from step 11
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions to container navigation, module cards, or display logic)

## Final Checkpoint

- [x] 13. Checkpoint - Ensure all tests pass
  - Run full test suite to confirm all exploration tests pass (bugs fixed)
  - Run full test suite to confirm all preservation tests pass (no regressions)
  - Verify no TypeScript compilation errors across modified files
  - Ensure all four bugs are resolved and no existing behavior is broken
  - Ask the user if questions arise
