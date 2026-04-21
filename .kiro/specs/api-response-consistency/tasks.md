# Implementation Plan: API Response Consistency

## Overview

Mechanical refactor to fix two inconsistencies: (1) standardize the `getContainers()` return type and simplify all frontend callers, and (2) fix backend error handling in `things.js` and `locations.js` to use `secureError()` for unexpected errors. No new business logic is introduced.

## Tasks

- [x] 1. Add `ContainerListResponse` type and update API client
  - [x] 1.1 Define `ContainerListResponse` interface in `frontend/src/types/entities.ts`
    - Add `ContainerListResponse` interface with fields: `containers: Container[]`, `count: number`, `hasMore: boolean`, `lastEvaluatedKey?: string`
    - Verify it is re-exported via `frontend/src/types/index.ts` (which already does `export * from './entities'`)
    - _Requirements: 1.1_

  - [x] 1.2 Update `getContainers()` return type in `frontend/src/services/api.ts`
    - Change return type from `Promise<Container[] | { containers: Container[], count: number, hasMore: boolean, lastEvaluatedKey?: any }>` to `Promise<ContainerListResponse>`
    - Import `ContainerListResponse` from the types module
    - Remove the `Container[]` branch from the union type
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Simplify frontend callers to use typed response
  - [x] 2.1 Update `pages/Home.tsx` to access `response.containers` directly
    - Remove `Array.isArray()` check and `as any` cast
    - Access container array via `response.containers`
    - _Requirements: 2.1, 2.4_

  - [x] 2.2 Update `pages/MovingDashboard.tsx` to access `response.containers` directly
    - Remove `Array.isArray()` check and `as any` cast
    - Access container array via `response.containers`
    - _Requirements: 2.2, 2.4_

  - [x] 2.3 Update `components/ContainerList.tsx` to access `response.containers` directly
    - Remove `Array.isArray()` check and `as any` cast
    - Access container array via `response.containers`
    - _Requirements: 2.3, 2.4_

  - [x] 2.4 Update `components/ContainerContentsView.tsx` to access `response.containers` directly
    - Remove `Array.isArray()` check and `as any` cast
    - Access container array via `response.containers`
    - _Requirements: 2.4_

  - [x] 2.5 Update `components/ProjectDetailDialog.tsx` to access `response.containers` directly
    - Remove `Array.isArray()` check and `as any` cast
    - Access container array via `response.containers`
    - _Requirements: 2.4_

  - [x] 2.6 Update `components/ContainerAssignmentDialog.tsx` to access `response.containers` directly
    - Remove `Array.isArray()` check and filter pattern
    - Use `response.containers.filter(...)` directly
    - _Requirements: 2.4_

  - [x] 2.7 Update `pages/Things.tsx` to access `response.containers` directly
    - Remove defensive type check pattern at line ~145
    - Access container array via `response.containers`
    - _Requirements: 2.4_

- [x] 3. Checkpoint — Verify frontend type safety
  - Run `tsc` or `npm run build` in `frontend/` to confirm no type errors after the union type removal and caller updates
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Fix backend error handling in `things.js` and `locations.js`
  - [x] 4.1 Fix `handleUpdate` catch block in `backend/handlers/things.js`
    - Replace `return error('Failed to update thing: ' + err.message, 500, origin)` with `throw err` so the outer handler's `secureError()` catches it
    - Verify all other inner functions in things.js already use `throw` for unexpected errors (no changes needed for those)
    - _Requirements: 3.1, 3.6_

  - [x] 4.2 Fix `origin` threading in `backend/handlers/locations.js`
    - Extract `origin` from the event headers in the outer handler function
    - Pass `origin` to the `secureError()` call in the outer catch block
    - Verify inner functions' `throw new Error(...)` pattern propagates correctly to the outer `secureError()`
    - _Requirements: 3.1, 3.7_

  - [ ]* 4.3 Write unit tests for error handling changes
    - Test that `things.handleUpdate` returns a `secureError`-style response (generic message + requestId) for unexpected errors
    - Test that `locations` handler includes CORS headers (via `origin`) in error responses
    - Test that intentional error responses (validation, not-found, method-not-allowed) still use `error()` with correct messages and status codes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 5.1, 5.2, 5.3_

- [x] 5. Document error handling convention
  - [x] 5.1 Add error handling convention section to `.kiro/steering/backend-conventions.md`
    - Document when to use `error()` (intentional responses with developer-controlled messages: validation 400, not-found 404, access-denied 403, method-not-allowed 405)
    - Document when to use `secureError()` (unexpected errors in catch blocks where `err.message` may contain internal details)
    - Include code example showing the correct pattern for a handler catch block with inner `handle*` function
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Final checkpoint — Run all tests and verify
  - Run `npm test` in `frontend/` to verify no frontend test regressions
  - Run `npm test` in `backend/` to verify no backend test regressions
  - Run `npm run build` in `frontend/` to verify full type-safe build
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- No property-based tests — this is a mechanical refactor with no new algorithms or data transformations
- Each task references specific requirements for traceability
- The backend `containers.js` handler is already correct and needs no changes
- Requirement 5 (preserve intentional error responses) is validated by not changing those code paths — tasks 4.1 and 4.2 only touch unexpected-error catch blocks
