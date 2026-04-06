# Design Document: Mobile UX Improvements

## Overview

This document covers the technical design for nine mobile UX improvements to the "Where's My Stuff!" home inventory app. The app is built with React, TypeScript, and MUI v6, deployed as a SPA backed by AWS Lambda/DynamoDB.

The improvements fall into three categories:
- **Display**: Card-based list view (Req 1), Thing detail bottom sheet (Req 4)
- **Interaction**: Context-aware FAB (Req 2), Photo on General tab (Req 3), Bulk operations (Req 6), Optimistic updates (Req 7)
- **Navigation**: Fix /scan route (Req 5), Last-used module memory (Req 8), Unified mobile nav (Req 9)

All mobile detection uses the existing `useMobileDetection` hook (`isMobile` = viewport < 600px / MUI `sm` breakpoint).

---

## Architecture

The changes are entirely frontend. No backend API changes are required. The architecture follows the existing patterns:

```
App.tsx (router + MainLayout)
  ├── MobileNavigation (bottom bar, mobile only) ← needs to be added to App.tsx
  ├── Header (hamburger hidden on mobile) ← conditional render change
  ├── Sidebar (hidden on mobile) ← conditional render change
  └── Pages
        ├── Things.tsx ← major changes (card list, FAB, bulk ops, optimistic updates)
        ├── Containers.tsx / ContainerList ← FAB addition
        └── Scan.tsx ← new page
```

### State Management

No new global state is introduced. Changes are local to each page component:
- `Things.tsx` gains `selectedIds: Set<string>`, `detailThing: Thing | null`, `isSelectMode: boolean`
- Last-used module is persisted via a lightweight `useLastUsedModule` hook that reads/writes `localStorage`
- Optimistic updates replace the `loadData()` call after mutations with direct state splicing

---

## Components and Interfaces

### New Components

#### `MobileThingCard`
```
frontend/src/components/MobileThingCard.tsx
```
Mirrors `MobileContainerCard` pattern. Props:
```typescript
interface MobileThingCardProps {
  thing: Thing;
  categoryName?: string;
  locationName?: string;
  isSelectMode: boolean;
  isSelected: boolean;
  onTap: (thing: Thing) => void;           // opens detail sheet
  onEdit: (thing: Thing) => void;
  onDelete: (thing: Thing) => void;
  onSelectionToggle: (thing: Thing) => void;
}
```
Layout (top-to-bottom):
- Row: `PhotoThumbnail` (40px) | name (`Typography subtitle1`) | overflow `IconButton` (MoreVert)
- Row: category `Chip` (small) | location text (`Typography body2`, `LocationOn` icon)
- When `isSelectMode=true`: `Checkbox` overlaid top-left, card border highlighted

#### `ThingDetailSheet`
```
frontend/src/components/ThingDetailSheet.tsx
```
MUI `SwipeableDrawer` anchored to bottom, `puller` handle at top.
```typescript
interface ThingDetailSheetProps {
  thing: Thing | null;
  open: boolean;
  categoryName?: string;
  locationName?: string;
  roomName?: string;
  containerName?: string;
  ownerName?: string;
  onClose: () => void;
  onEdit: (thing: Thing) => void;
}
```
Content sections:
1. Location breadcrumb: `Location → Room → Container` (omit unset levels), displayed as `Typography h6` with `NavigateNext` separators
2. Primary photo (`PhotoThumbnail` size=120, centered)
3. Metadata chips: category, owner
4. Description text
5. Sticky bottom bar: `Edit` button (contained) + `Close` button (outlined)

#### `ThingBulkActionBar`
```
frontend/src/components/ThingBulkActionBar.tsx
```
Fixed bottom bar (above MobileNavigation on mobile, inline on desktop):
```typescript
interface ThingBulkActionBarProps {
  selectedCount: number;
  locations: Location[];
  containers: Container[];
  onMoveToLocation: (locationId: string) => void;
  onMoveToContainer: (containerId: string) => void;
  onClearSelection: () => void;
}
```
Shows: `"{N} selected"` | `Move to Location` button | `Move to Container` button | `✕` clear

#### `ScanPage`
```
frontend/src/pages/Scan.tsx
```
Full-page wrapper around the existing `BarcodeScanner` component (repurposed from dialog to page). On successful scan, resolves the scanned value as a container ID and navigates to `/containers?highlight={id}` (or a container detail route if one exists). On invalid scan, shows an inline `Alert`.

#### `useLastUsedModule` hook
```
frontend/src/hooks/useLastUsedModule.ts
```
```typescript
const STORAGE_KEY = 'wms_last_module';
type Module = 'inventory' | 'moving';

export function useLastUsedModule() {
  const set = (module: Module) =>
    localStorage.setItem(STORAGE_KEY, module);
  const get = (): Module | null =>
    localStorage.getItem(STORAGE_KEY) as Module | null;
  return { set, get };
}
```
Used in a `useEffect` inside a `RouteModuleTracker` component (rendered once inside `MainLayout`) that watches `location.pathname` and calls `set()` when the path matches inventory or moving routes.

---

## Data Models

No new data models. Existing `Thing`, `Location`, `Room`, `Category`, `Person`, `Container` types from `frontend/src/types/entities.ts` are used as-is.

### Optimistic Update State Shape

`Things.tsx` state changes:

```typescript
// Before (current)
const [things, setThings] = useState<Thing[]>([]);
const [allThings, setAllThings] = useState<Thing[]>([]);

// After: same shape, but mutations update both arrays directly
// instead of calling loadData()

// New state
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [isSelectMode, setIsSelectMode] = useState(false);
const [detailThing, setDetailThing] = useState<Thing | null>(null);
```

### localStorage Keys

| Key | Value | Set by |
|-----|-------|--------|
| `wms_last_module` | `"inventory"` \| `"moving"` | `RouteModuleTracker` |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: ThingCard renders required fields for any Thing

*For any* Thing with a non-empty name, rendering `MobileThingCard` should display the thing's name, a category chip (or empty chip if no category), and a location label (or empty if no location).

**Validates: Requirements 1.3, 1.5**

### Property 2: ThingCard photo display matches photo presence

*For any* Thing, if `photos` is non-empty then `MobileThingCard` renders a `PhotoThumbnail` with `photoKey = photos[0]`; if `photos` is empty or absent then a placeholder icon is rendered instead.

**Validates: Requirements 1.3, 1.4**

### Property 3: Card list respects active filters

*For any* list of Things and any combination of active filter values (category, location, room, owner, tags, name), the rendered card list on mobile should contain exactly the Things that satisfy all active filter predicates — no more, no fewer.

**Validates: Requirements 1.11**

### Property 4: Photo state is shared between General and Media tabs

*For any* sequence of photo add/remove operations performed via the General tab photo control, the resulting `formData.photos` array should be identical to the array that would result from performing the same operations via the Media tab control.

**Validates: Requirements 3.3, 3.4, 3.5**

### Property 5: General tab photo overflow indicator

*For any* `formData.photos` array with length N > 3, the General tab photo control should render exactly 3 thumbnail elements and one overflow indicator showing `"+(N-3) more"`.

**Validates: Requirements 3.8**

### Property 6: Location breadcrumb omits unset levels

*For any* Thing, the `ThingDetailSheet` breadcrumb should contain exactly the location levels that are set (locationId, roomId, containerId), in the order Location → Room → Container, with no gaps or extra separators for unset levels.

**Validates: Requirements 4.2**

### Property 7: Detail view displays all required fields

*For any* Thing, the `ThingDetailSheet` should render the thing's name, primary photo (if photos is non-empty), category name (if set), owner name (if set), and description (if set).

**Validates: Requirements 4.3**

### Property 8: QR scan navigates to correct container

*For any* valid container ID encoded as a QR/barcode value, scanning it on the `/scan` route should trigger navigation to the container detail view for that specific container ID.

**Validates: Requirements 5.3**

### Property 9: Bulk move updates all selected Things

*For any* non-empty selection of Thing IDs and any target locationId, confirming "Move to Location" should result in `apiClient.updateThing` being called once for each selected ID with the new `locationId`, and the Things list should reflect the updated location for each.

**Validates: Requirements 6.4**

### Property 10: Bulk move to container updates all selected Things

*For any* non-empty selection of Thing IDs and any target containerId, confirming "Move to Container" should result in `apiClient.updateThing` being called once for each selected ID with the new `containerId`, and the Things list should reflect the updated container for each.

**Validates: Requirements 6.5**

### Property 11: Optimistic create adds Thing without reference data refetch

*For any* new Thing returned by a successful `createThing` API response, the Things list should contain that Thing immediately, and the reference data fetch functions (getLocations, getRooms, getCategories, getPeople, getProjects, getContainers) should not have been called.

**Validates: Requirements 7.1, 7.5**

### Property 12: Optimistic update replaces Thing without reference data refetch

*For any* updated Thing returned by a successful `updateThing` API response, the Things list should contain exactly one entry for that Thing ID with the updated data, and reference data fetch functions should not have been called.

**Validates: Requirements 7.2, 7.5**

### Property 13: Optimistic delete removes Thing without reference data refetch

*For any* Thing ID that is successfully deleted, the Things list should contain no entry with that ID after the delete response, and reference data fetch functions should not have been called.

**Validates: Requirements 7.3, 7.5**

### Property 14: Last-used module persisted for all inventory routes

*For any* route path that starts with `/things`, `/locations`, `/categories`, `/people`, or `/inventory`, navigating to that route should set `localStorage.getItem('wms_last_module')` to `"inventory"`.

**Validates: Requirements 8.1**

### Property 15: Last-used module persisted for all moving routes

*For any* route path that starts with `/moving`, `/containers`, `/projects`, or `/storage`, navigating to that route should set `localStorage.getItem('wms_last_module')` to `"moving"`.

**Validates: Requirements 8.2**

### Property 16: Home redirect uses last-used module

*For any* valid last-used module value (`"inventory"` or `"moving"`) stored in localStorage, navigating to `/` or `/home` should redirect to `/things` (for `"inventory"`) or `/moving` (for `"moving"`) rather than rendering the Home page.

**Validates: Requirements 8.3**

---

## Error Handling

### Optimistic Update Failures (Req 7.4)
When a create/update/delete API call fails, the optimistic state change must be rolled back:
- **Create**: remove the optimistically-added item from `things` and `allThings`
- **Update**: restore the previous version of the item in both arrays
- **Delete**: re-insert the item at its original index in both arrays
- In all cases, call `showError()` with the API error message

### Bulk Operation Failures (Req 6.8)
Bulk moves use `Promise.allSettled` to attempt all updates. If any fail:
- Items that succeeded are updated in state
- Items that failed remain with their original location/container
- A single error notification lists the failure count: `"N items could not be moved"`
- Selection is cleared only for successfully moved items

### Scan Route Errors (Req 5.4)
The `ScanPage` maintains local `error: string | null` state. On invalid/unrecognised scan, set error and display an `Alert` with a "Try again" button that resets the scanner.

### Last-Used Module (Req 8)
`localStorage` access is wrapped in try/catch. If storage is unavailable (private browsing quota exceeded), the feature degrades silently — the Home page is shown as normal.

---

## Testing Strategy

### Unit Tests (example-based)

Focus on specific behaviors and edge cases:
- `MobileThingCard`: renders with/without photos, overflow menu actions, select mode checkbox
- `ThingDetailSheet`: breadcrumb with all combinations of set/unset location levels, close button
- `ThingBulkActionBar`: renders correct count, triggers correct callbacks
- `ScanPage`: renders scanner, shows error on invalid scan
- `useLastUsedModule`: get/set/missing value
- `Things.tsx` (mobile): FAB renders, detail sheet opens on card tap, empty state, loading state
- `Things.tsx` (desktop): EntityTable renders, FAB absent, row click opens edit dialog
- `MobileNavigation`: Scan tab active at `/scan`, More menu items present
- `Header`: hamburger hidden on mobile
- `App.tsx`: `/scan` route defined, home redirect logic

### Property-Based Tests

Using **fast-check** (already a common choice for TypeScript/React projects). Each property test runs a minimum of 100 iterations.

**Tag format**: `// Feature: mobile-ux-improvements, Property {N}: {property_text}`

| Property | Generator inputs | Assertion |
|----------|-----------------|-----------|
| P1: ThingCard required fields | `fc.record({ id, name, categoryId?, locationId? })` | name, chip, location label present |
| P2: ThingCard photo display | `fc.array(fc.string(), { minLength: 0, maxLength: 5 })` for photos | thumbnail vs placeholder |
| P3: Card list respects filters | `fc.array(thingArb)` + `fc.record(filterArb)` | rendered cards === filtered set |
| P4: Photo state shared between tabs | `fc.array(fc.string())` for photo keys | formData.photos identical after ops |
| P5: General tab overflow indicator | `fc.array(fc.string(), { minLength: 4, maxLength: 20 })` | 3 thumbnails + "+N more" |
| P6: Breadcrumb omits unset levels | `fc.record({ locationId?, roomId?, containerId? })` | breadcrumb contains only set levels |
| P7: Detail view required fields | `fc.record(thingArb)` | all set fields rendered |
| P8: QR scan navigates correctly | `fc.uuid()` as container ID | navigate called with correct path |
| P9: Bulk move to location | `fc.set(fc.uuid())` + `fc.uuid()` for locationId | updateThing called N times with locationId |
| P10: Bulk move to container | `fc.set(fc.uuid())` + `fc.uuid()` for containerId | updateThing called N times with containerId |
| P11: Optimistic create | `fc.record(thingArb)` | list grows by 1, no reference data calls |
| P12: Optimistic update | `fc.record(thingArb)` | list entry updated, no reference data calls |
| P13: Optimistic delete | `fc.uuid()` as thing ID | list shrinks by 1, no reference data calls |
| P14: Inventory route tracking | `fc.constantFrom('/things', '/locations', '/categories', '/people', '/inventory')` + `fc.string()` suffix | localStorage = "inventory" |
| P15: Moving route tracking | `fc.constantFrom('/moving', '/containers', '/projects', '/storage')` + `fc.string()` suffix | localStorage = "moving" |
| P16: Home redirect | `fc.constantFrom('inventory', 'moving')` | redirect to correct default page |

### Integration / Smoke Tests

- FAB bottom offset ≥ 72px (visual/snapshot)
- Sidebar absent on mobile (snapshot)
- Hamburger absent on mobile (snapshot)
- Inventory selector accessible in More menu on mobile (snapshot)
