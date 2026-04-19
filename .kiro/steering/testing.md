---
inclusion: fileMatch
fileMatchPattern: "**/tests/**,**/*.test.*,**/*.spec.*,**/vitest.config.*,**/jest.config.*"
---

# Testing Conventions

## Two Test Stacks
- **Backend**: Jest (Node.js environment), config at `backend/jest.config.js`
- **Frontend**: Vitest (jsdom environment), config at `frontend/vitest.config.ts`

## Running Tests

### Backend
```bash
cd backend && npm test
```
- Jest runs with 30s timeout, `forceExit: true`
- Mocks are auto-cleared/reset/restored between tests

### Frontend
```bash
cd frontend && npm test
```
- This runs `vitest --run` — do NOT append extra `--run` or `--reporter` flags
- 10s timeout per test

## Property-Based Testing
Both stacks use `fast-check` for property-based testing:
- **Backend**: `fast-check` v4 with Jest — import directly from `fast-check`
- **Frontend**: `@fast-check/vitest` v0.2 — use `fcIt` exported from `frontend/src/tests/setup.ts`
- Minimum 100 iterations per property test
- Use longer timeouts for PBT tests (already configured globally)

## Backend Test Setup (`backend/tests/setup.js`)
- Sets `NODE_ENV=test`, `AWS_REGION=us-east-1`
- Silences `console.log` and `console.info` (keeps `error` and `warn` as jest.fn())
- Mocks `setInterval`/`setTimeout` globally to prevent hanging
- Pre-mocks `cacheService` and `performanceMonitoringService` (they create timers at import time)

## Frontend Test Setup (`frontend/src/tests/setup.ts`)
- Extends Vitest expect with `@testing-library/jest-dom` matchers
- Mocks: `window.matchMedia`, `localStorage`, Canvas API, `Image` constructor, `qrcode` library
- Runs `cleanup()` after each test via `@testing-library/react`

## Test File Locations
- Backend: `backend/tests/*.test.js`
- Frontend: `frontend/src/components/__tests__/*.test.tsx` and `frontend/src/tests/*.test.ts`

## Skipped Backend Tests
Several backend test files are skipped in `jest.config.js` due to complex mock setup or long-running PBT:
- auth, e2e-moving-workflows, userManagementIntegration, integration-system-validation
- inventory, userManagement, collaboration, auditLog, notification, rateLimit

When adding new tests, be aware of these exclusions and ensure new test files don't have similar issues.

## Mocking Patterns

### Backend
- Mock AWS SDK clients at the module level with `jest.mock()`
- Mock DynamoDB operations: `send` method on the client
- Always mock `cacheService` and `performanceMonitoringService` (done in setup)
- Use `jest.fn()` for service method mocks

### Frontend
- Use `@testing-library/react` for component rendering and interaction
- Use `@testing-library/user-event` for user interactions
- Mock `apiClient` methods with `vi.mock('../services/api')`
- Mock contexts by wrapping components in test providers
