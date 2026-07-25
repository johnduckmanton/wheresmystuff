# Design Document

## Introduction

This design addresses four frontend-only mobile UI bugs in the WheresMyStuff application. Each fix is a targeted prop or style change in a single component file — no architectural changes, new components, or backend modifications are required.

The project uses React 19 with Material-UI v7 and TypeScript. All changes use the `sx` prop for styling, consistent with existing patterns.

## Architecture Overview

No new architecture is introduced. The fixes modify three existing components:

```
frontend/src/components/MobileNavigation.tsx  → Bugs 1 & 2
frontend/src/pages/Home.tsx                   → Bug 3
frontend/src/components/PhotoSearchButton.tsx  → Bug 4
```

Each fix is independent and can be applied in any order without conflicts.

---

## Component Changes

### 1. Moving Tab Icon (MobileNavigation.tsx)

**Problem:** The Moving tab uses `MoveToInbox` (a box icon), while the web Home page uses `LocalShipping` (a truck icon) for the same feature.

**Fix:** Replace the `MoveToInbox` import alias with `LocalShipping`.

```tsx
// Before
import { MoveToInbox as MovingIcon } from '@mui/icons-material';

// After
import { LocalShipping as MovingIcon } from '@mui/icons-material';
```

The alias `MovingIcon` is preserved so no JSX changes are needed — only the import source changes.

---

### 2. AI Photo Tab Icon Alignment (MobileNavigation.tsx)

**Problem:** The `AutoAwesome` icon renders slightly higher than adjacent icons because its SVG viewBox differs from standard 24px MUI icons, causing a subtle vertical offset.

**Fix:** Apply explicit sizing and vertical alignment styles to the `AutoAwesomeIcon` in the AI Photo tab's `BottomNavigationAction`.

```tsx
<BottomNavigationAction
  label="AI Photo"
  icon={
    <AutoAwesomeIcon
      sx={{ fontSize: 24, display: 'block', verticalAlign: 'middle' }}
    />
  }
  sx={{ color: 'text.secondary' }}
/>
```

The key styles:
- `fontSize: 24` — forces the icon to the same size as other nav icons
- `display: 'block'` — removes inline baseline offset
- `verticalAlign: 'middle'` — ensures centered alignment within the action area

---

### 3. Home Module Card Sizing (Home.tsx)

**Problem:** On mobile, the "Moving & Storage" title text wraps to two lines, making that card taller than the "Inventory" card.

**Fix:** Add `whiteSpace: 'nowrap'` and a slightly reduced font size to the mobile card title Typography to prevent wrapping while keeping the text readable.

```tsx
<Typography
  variant={isMobile ? 'subtitle1' : 'h6'}
  sx={{
    fontWeight: 600,
    ...(isMobile && {
      whiteSpace: 'nowrap',
      fontSize: '0.85rem',
    }),
  }}
>
  Moving & Storage
</Typography>
```

The same style is applied to the "Inventory" card title for visual consistency, even though it doesn't wrap. The `0.85rem` size keeps the text readable without truncation.

---

### 4. Photo Search Button Color (PhotoSearchButton.tsx)

**Problem:** The Fab uses `color="default"`, which renders a white background with black icon regardless of the active theme mode.

**Fix:** Change `color="default"` to `color="primary"` on the Fab. This uses the theme's primary color (blue in light mode, purple in dark mode) with a white icon, providing proper contrast in both modes.

```tsx
// Before
<Fab
  size="small"
  color="default"
  onClick={() => setPhase('picker')}
  aria-label="Search by photo"
  sx={{ boxShadow: 1 }}
>
  <ImageSearchIcon />
</Fab>

// After
<Fab
  size="small"
  color="primary"
  onClick={() => setPhase('picker')}
  aria-label="Search by photo"
  sx={{ boxShadow: 1 }}
>
  <ImageSearchIcon sx={{ color: 'white' }} />
</Fab>
```

The theme already defines `MuiFab.primary` styles for dark mode (`backgroundColor: '#8A2BE2'`, `color: '#ffffff'`), so this change works correctly in both themes without additional overrides.

---

## Data Model

No data model changes. All fixes are purely presentational.

## Error Handling

No error handling changes. These are CSS/prop fixes with no failure modes.

## Interfaces

No API or interface changes.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Analysis

All acceptance criteria in this spec are concrete UI styling checks — they verify specific prop values, icon types, or CSS rules applied to specific elements. None of them vary meaningfully with input or benefit from randomized testing across a range of values.

**Classification summary:**
- Requirements 1.1–1.3: EXAMPLE (specific icon identity check)
- Requirements 2.1–2.3: EXAMPLE (specific alignment style check)
- Requirements 3.1–3.4: EXAMPLE (specific CSS/layout style check)
- Requirements 4.1–4.5: EXAMPLE (specific color prop/style check)

**No property-based tests are appropriate for this spec.** These bugs are best validated with:
- Example-based unit tests asserting specific rendered props and styles
- Visual regression tests (optional, for layout verification)

### Testing Strategy

Each bug should have 1–2 focused unit tests:

1. **Moving Icon Test:** Render `MobileNavigation`, assert the Moving tab contains a `LocalShippingIcon` (via `data-testid` or SVG path check).

2. **AI Photo Alignment Test:** Render `MobileNavigation`, assert the `AutoAwesomeIcon` element has `fontSize: 24` style applied.

3. **Card Nowrap Test:** Render `Home` at mobile breakpoint, assert the "Moving & Storage" Typography has `whiteSpace: 'nowrap'` in its computed styles.

4. **Fab Color Test:** Render `PhotoSearchButton` with `variant="icon"`, assert the Fab does NOT have `color="default"` and DOES have `color="primary"`.

These tests are straightforward assertions on rendered output — exactly what example-based tests are designed for.
