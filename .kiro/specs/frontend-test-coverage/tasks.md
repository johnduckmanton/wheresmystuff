# Implementation Plan: Frontend Test Coverage

## Overview

This plan adds comprehensive frontend test coverage by enhancing the test infrastructure (render helper, mock factories), then building out tests layer by layer: context providers → API client → components → type invariants. Each task builds on the previous, and property-based tests are placed close to the implementation they validate. All code is TypeScript, all tests run via `npm test` (vitest --run) in the `frontend/` directory.

## Tasks

- [ ] 1. Enhance test infrastructure with render helper and mock factories
  - [ ] 1.1 Enhance `renderWithProviders` in `frontend/src/tests/testUtils.tsx`
    - Add `RenderWithProvidersOptions` interface with `inventoryContextValue`, `withNotificationProvider`, and `routerEntries` options
    - Wrap rendered components in `MemoryRouter`, `NotificationProvider`, and a mock `InventoryContext.Provider`
    - Return standard `RenderResult` plus `notificationMocks` references
    - _Requirements: 1.1_

  - [ ] 1.2 Create entity mock factories in `frontend/src/tests/generators.ts`
    - Add `createMockContainer`, `createMockThing`, `createMockLocation`, `createMockRoom`, `createMockInventory` factory functions
    - Each factory returns a valid entity with sensible defaults (UUIDs, ISO dates, required fields) and accepts `Partial<T>` overrides
    - _Requirements: 1.2_

  - [ ] 1.3 Create API client mock factory in `frontend/src/tests/generators.ts`
    - Add `createMockApiClient` function that returns an object with every public method of `ApiClient` stubbed as `vi.fn()`
    - Ensure method signatures match the real `ApiClient` class
    - _Requirements: 1.3, 1.4_

- [ ] 2. Implement context provider tests
  - [ ] 2.1 Create `InventoryContext.test.tsx` in `frontend/src/tests/__tests__/`
    - Mock `aws-amplify/auth` and `../services/api` at module level
    - Test `loadInventories` is called on render with authenticated user
    - Test default inventory "My Inventory" creation when no inventories exist
    - Test inventories cleared and `currentInventory` set to null when user is not authenticated
    - Test auto-selection of first inventory when none is selected
    - Test `useInventory` throws error when used outside provider
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 2.2 Create `NotificationContext.test.tsx` in `frontend/src/tests/__tests__/`
    - Test `showSuccess` renders Snackbar with severity "success"
    - Test `showError` renders Snackbar with severity "error"
    - Test `showError` with `requiresAction: true` renders Dialog modal
    - Test `showInfo` renders Snackbar with severity "info"
    - Test `useNotification` throws error when used outside provider
    - Test clickaway does not close the Snackbar
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 2.3 Write property test for notification rendering (Property 1)
    - **Property 1: Notification rendering preserves severity and message**
    - For any severity ("success", "error", "info") and any non-empty message string, the corresponding show method renders a Snackbar with the correct severity and message
    - Add to `NotificationContext.test.tsx`
    - Minimum 100 iterations
    - **Validates: Requirements 3.1, 3.2, 3.4**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement API client tests
  - [ ] 4.1 Create `ApiClient.test.ts` in `frontend/src/tests/__tests__/`
    - Mock `axios` and `aws-amplify/auth` at module level
    - Test `get` returns `data` when response has `success: true`
    - Test `get` throws Error with `error` message when response has `success: false`
    - Test response interceptor calls `signOut` and `authErrorCallback` on 401
    - Test response interceptor rejects with "Network error - please check your connection" on no response
    - Test `post` returns `data` when response has `success: true`
    - Test `put` throws Error with `error` message when response has `success: false`
    - Test request interceptor sets `Authorization: Bearer <token>` from access token
    - Test request interceptor falls back to ID token when access token unavailable
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 4.2 Write property test for successful API response data extraction (Property 2)
    - **Property 2: Successful API response data extraction**
    - For any response with `success: true` and a `data` field, for any CRUD method, the ApiClient returns the `data` value unchanged
    - Add to `ApiClient.test.ts`
    - Minimum 100 iterations
    - **Validates: Requirements 4.1, 4.5**

  - [ ]* 4.3 Write property test for failed API response error propagation (Property 3)
    - **Property 3: Failed API response error propagation**
    - For any response with `success: false` and an `error` message, for any CRUD method, the ApiClient throws an Error whose message matches the `error` value
    - Add to `ApiClient.test.ts`
    - Minimum 100 iterations
    - **Validates: Requirements 4.2, 4.6**

  - [ ] 4.4 Create `ApiClientEntities.test.ts` in `frontend/src/tests/__tests__/`
    - Mock `axios` and `aws-amplify/auth` at module level
    - Test `getInventories` sends GET to `/inventories`
    - Test `createInventory` sends POST to `/inventories` with name and description
    - Test `getContainers` sends GET to `/containers?inventoryId={inventoryId}`
    - Test `createContainer` sends POST to `/containers` with container data
    - Test `deleteContainer` with `force: true` includes `force=true` in query params
    - Test `getThings` includes `inventoryId`, `limit`, and `lastEvaluatedKey` as query params
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement component tests
  - [ ] 6.1 Create `EntityTable.test.tsx` in `frontend/src/components/__tests__/`
    - Use `renderWithProviders` to render EntityTable with mock data
    - Test column headers and row data render correctly
    - Test edit action button calls `onEdit` with row data
    - Test delete action button calls `onDelete` with row data
    - Test `loading: true` displays loading indicator
    - Mock `useMediaQuery` to test mobile card-based layout
    - Test global search filters rows by search term
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 6.2 Write property test for EntityTable row count invariant (Property 4)
    - **Property 4: EntityTable row count invariant**
    - For any array of valid column definitions and row data, EntityTable renders exactly `data.length` rows
    - Add to `EntityTable.test.tsx`
    - Minimum 100 iterations
    - **Validates: Requirements 6.7**

  - [ ]* 6.3 Write property test for EntityTable search filtering (Property 5)
    - **Property 5: EntityTable search filtering correctness**
    - For any dataset and search term that is a substring of at least one row's column value, EntityTable displays only matching rows
    - Add to `EntityTable.test.tsx`
    - Minimum 100 iterations
    - **Validates: Requirements 6.6**

  - [ ] 6.4 Create `ContainerList.test.tsx` in `frontend/src/components/__tests__/`
    - Use `renderWithProviders` with mock inventory context and mocked `apiClient`
    - Test containers are fetched and displayed on mount with selected inventory
    - Test Add button opens ContainerFormDialog
    - Test Edit button opens ContainerFormDialog pre-populated with container data
    - Test Delete button opens confirmation dialog
    - Test delete confirmation calls `apiClient.deleteContainer` and removes container
    - Test successful deletion calls `showSuccess`
    - Test failed deletion calls `showError` with error message
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 6.5 Create `ContainerFormDialog.test.tsx` in `frontend/src/components/__tests__/`
    - Use `renderWithProviders` with mocked `apiClient`
    - Test empty form renders when no container prop provided
    - Test form pre-populates with container data when container prop provided
    - Test validation error on submit without required name field
    - Test valid new container form calls `apiClient.createContainer` and `onSuccess`
    - Test valid edit form calls `apiClient.updateContainer` with container ID
    - Test API failure displays error message and keeps dialog open
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ] 6.6 Create `SignIn.test.tsx` in `frontend/src/components/__tests__/`
    - Mock `aws-amplify/auth` and `react-router-dom` at module level
    - Test email, password fields and submit button render
    - Test successful sign-in navigates to "/"
    - Test `NEW_PASSWORD_REQUIRED` challenge shows new password fields
    - Test `SMS_MFA` / `TOTP_MFA` challenge shows MFA code input
    - Test sign-in error displays error message in Alert
    - Test loading indicator and disabled submit button during request
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement entity type property tests
  - [ ] 8.1 Create `EntityTypes.property.test.ts` in `frontend/src/tests/__tests__/`
    - Set up fast-check generators for entity types using `fcIt` from setup.ts
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 8.2 Write property test for ContainerStatus value membership (Property 6)
    - **Property 6: ContainerStatus value membership**
    - For any value drawn from the `ContainerStatus` const object, that value is one of the defined status strings
    - Minimum 100 iterations
    - **Validates: Requirements 10.1**

  - [ ]* 8.3 Write property test for HandlingFlag value membership (Property 7)
    - **Property 7: HandlingFlag value membership**
    - For any array of values drawn from the `HandlingFlag` const object, every element is one of the defined flag strings
    - Minimum 100 iterations
    - **Validates: Requirements 10.2**

  - [ ]* 8.4 Write property test for ApiResponse success implies data defined (Property 8)
    - **Property 8: ApiResponse success implies data is defined**
    - For any `ApiResponse<T>` where `success` is `true`, the `data` field is defined
    - Minimum 100 iterations
    - **Validates: Requirements 10.3**

  - [ ]* 8.5 Write property test for entity dateAdded ISO 8601 validity (Property 9)
    - **Property 9: Entity dateAdded ISO 8601 validity**
    - For any entity with a `dateAdded` field, the value is a valid ISO 8601 string that parses to a valid Date
    - Minimum 100 iterations
    - **Validates: Requirements 10.4**

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each layer
- Property tests validate the 9 correctness properties defined in the design document
- All tests use TypeScript and run via `npm test` (vitest --run) in the `frontend/` directory
- The `@fast-check/vitest` integration uses `fcIt` from `frontend/src/tests/setup.ts` with minimum 100 iterations per property
