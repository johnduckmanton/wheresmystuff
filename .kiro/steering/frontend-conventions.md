---
inclusion: fileMatch
fileMatchPattern: "frontend/**"
---

# Frontend Conventions

## Tech Stack
- React 19 with TypeScript (strict mode)
- Vite 7 for build/dev server
- Material-UI v7 (`@mui/material`, `@mui/icons-material`, `@mui/lab`, `@mui/x-data-grid`)
- React Router v7 (`react-router-dom`)
- Axios for HTTP
- AWS Amplify v6 for Cognito auth
- ESM modules (`"type": "module"` in package.json)

## Component Patterns
- Functional components only, with hooks
- Props defined as TypeScript interfaces (e.g., `interface ContainerListProps { ... }`)
- Default exports for components: `export default function ComponentName() { ... }`
- Components live flat in `frontend/src/components/` — named by feature (e.g., `ContainerList.tsx`, `ContainerFormDialog.tsx`)
- Subdirectories only for `__tests__/`, `accessibility/`, `packing/`
- MUI imports: named imports from `@mui/material` and `@mui/icons-material`

## State Management
- React Context API — no Redux or Zustand
- Contexts in `frontend/src/contexts/`:
  - `InventoryContext` — current inventory selection and data
  - `NotificationContext` — toast/snackbar notifications (`showSuccess`, `showError`)
  - `AccessibilityContext` — screen reader announcements, accessibility preferences
  - `LoadingContext` — global loading state
- Use context hooks: `useInventory()`, `useNotification()`, `useAccessibility()`

## API Client (`frontend/src/services/api.ts`)
- Singleton `ApiClient` class with Axios instance
- Request interceptor injects JWT from `aws-amplify/auth` (`fetchAuthSession`)
- Prefers access token, falls back to ID token
- Typed methods for all backend endpoints
- Response type: `ApiResponse<T>` with `{ success, data?, error? }`
- Import as: `import apiClient from '../services/api'`

## TypeScript Types (`frontend/src/types/entities.ts`)
- All entity interfaces defined centrally and re-exported from `types/index.ts`
- Use `const` objects with `as const` for enums (e.g., `ContainerStatus`, `HandlingFlag`, `ContainerType`)
- Derive union types: `type ContainerStatus = typeof ContainerStatus[keyof typeof ContainerStatus]`
- All IDs are UUID strings
- Dates are ISO 8601 strings
- Optional fields use `?` syntax

## Custom Hooks (`frontend/src/hooks/`)
- Prefix with `use` (e.g., `useMobileDetection`, `useVoiceCommands`)
- Keep hooks focused on a single concern

## Styling
- Material-UI's `sx` prop for inline styles
- Theme defined in `frontend/src/theme.ts`
- Global CSS in `frontend/src/index.css` and `frontend/src/App.css`
- No CSS modules or styled-components

## Linting
- ESLint 9 flat config (`frontend/eslint.config.js`)
- Plugins: `typescript-eslint`, `react-hooks`, `react-refresh`
- Run: `npm run lint` (in frontend directory)

## Testing (Vitest)
- Config: `frontend/vitest.config.ts`
- Environment: jsdom
- Setup: `frontend/src/tests/setup.ts` — extends expect with jest-dom matchers, mocks matchMedia/localStorage/Canvas/QRCode
- Property-based testing: `@fast-check/vitest` — use `fcIt` from setup for property tests
- Minimum 100 iterations per property test
- Timeout: 10s
- Run: `npm test` (in frontend directory) — this runs `vitest --run`
- Do NOT add extra `--run` flags — the script already includes it

## Build
- `npm run build` → `tsc -b && vite build`
- Output: `dist/`
- Dev server: `npm run dev` (port 5173)

## Accessibility
- `AccessibilityContext` for screen reader announcements
- `announceToScreenReader(message, priority)` for dynamic content updates
- Components in `components/accessibility/` for specialized a11y features
