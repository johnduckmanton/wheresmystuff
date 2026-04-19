# Requirements Document

## Introduction

The frontend application has approximately 100 components but only 8 test files, all of which are bugfix regression tests. Core user flows including inventory CRUD, container management, and authentication have no component-level tests. This feature establishes a testing strategy and adds tests for the most critical components, context providers, the API client data layer, and utility functions to achieve meaningful coverage of the most-used code paths.

## Glossary

- **Test_Suite**: The collection of Vitest test files executed via `npm test` in the frontend directory
- **Context_Provider**: A React Context provider component (`InventoryProvider`, `NotificationProvider`) that supplies shared state to child components
- **API_Client**: The singleton `ApiClient` class in `frontend/src/services/api.ts` that handles all HTTP communication with the backend via Axios
- **EntityTable**: The reusable `EntityTable` component that renders data grids with filtering, sorting, and pagination using MUI DataGrid
- **ContainerList**: The `ContainerList` component that displays containers with CRUD operations, search, and mobile responsiveness
- **ContainerFormDialog**: The `ContainerFormDialog` component that provides a form for creating and editing containers with validation
- **SignIn**: The `SignIn` component that handles email/password authentication, MFA challenges, and password reset flows via AWS Amplify
- **Test_Setup**: The shared test configuration in `frontend/src/tests/setup.ts` that provides mocks for browser APIs, canvas, and QR code generation
- **Property_Test**: A test using the fast-check library (`@fast-check/vitest`) that verifies a property holds across many randomly generated inputs (minimum 100 iterations)
- **Render_Helper**: The `renderWithProviders` function in `frontend/src/tests/testUtils.tsx` that wraps components with required context providers for testing

## Requirements

### Requirement 1: Test Infrastructure Enhancement

**User Story:** As a developer, I want a robust test infrastructure with shared render helpers and mock factories, so that writing new tests is fast and consistent.

#### Acceptance Criteria

1. THE Render_Helper SHALL wrap rendered components with `NotificationProvider` and a mock `InventoryProvider` so that components depending on these contexts render without errors
2. THE Test_Setup SHALL export reusable mock factory functions for creating `Container`, `Thing`, `Location`, `Room`, and `Inventory` entity objects with valid default values
3. THE Test_Setup SHALL export a mock factory for the `apiClient` module that stubs all public methods with `vi.fn()` implementations
4. WHEN a test imports the API_Client mock factory, THE mock factory SHALL return an object whose method signatures match the real `ApiClient` class

### Requirement 2: InventoryContext Provider Tests

**User Story:** As a developer, I want tests for the InventoryContext provider, so that I can confidently refactor the most-used context without breaking dependent components.

#### Acceptance Criteria

1. WHEN the `InventoryProvider` renders with an authenticated user, THE Test_Suite SHALL verify that `loadInventories` is called and inventories are populated
2. WHEN no inventories exist for the user, THE `InventoryProvider` SHALL create a default inventory named "My Inventory" and the Test_Suite SHALL verify this behavior
3. WHEN the user is not authenticated, THE `InventoryProvider` SHALL clear the inventories list and set `currentInventory` to null, and the Test_Suite SHALL verify this behavior
4. WHEN inventories are loaded and no `currentInventory` is selected, THE `InventoryProvider` SHALL auto-select the first inventory, and the Test_Suite SHALL verify this behavior
5. WHEN `useInventory` is called outside of an `InventoryProvider`, THE hook SHALL throw an error with the message "useInventory must be used within an InventoryProvider"

### Requirement 3: NotificationContext Provider Tests

**User Story:** As a developer, I want tests for the NotificationContext provider, so that the notification system used across the entire app is verified.

#### Acceptance Criteria

1. WHEN `showSuccess` is called with a message, THE `NotificationProvider` SHALL render a Snackbar with severity "success" containing that message
2. WHEN `showError` is called with a message and no options, THE `NotificationProvider` SHALL render a Snackbar with severity "error" containing that message
3. WHEN `showError` is called with `requiresAction: true` and an actions array, THE `NotificationProvider` SHALL render a Dialog modal instead of a Snackbar
4. WHEN `showInfo` is called with a message, THE `NotificationProvider` SHALL render a Snackbar with severity "info" containing that message
5. WHEN `useNotification` is called outside of a `NotificationProvider`, THE hook SHALL throw an error with the message "useNotification must be used within a NotificationProvider"
6. WHEN the Snackbar close reason is "clickaway", THE `NotificationProvider` SHALL keep the notification open

### Requirement 4: API Client Core Method Tests

**User Story:** As a developer, I want tests for the API client's core CRUD methods and error handling, so that the data layer is verified independently of UI components.

#### Acceptance Criteria

1. WHEN the API_Client `get` method receives a response with `success: true` and `data`, THE API_Client SHALL return the `data` value
2. WHEN the API_Client `get` method receives a response with `success: false`, THE API_Client SHALL throw an Error with the response's `error` message
3. WHEN the API_Client receives a 401 response, THE response interceptor SHALL call `signOut` and invoke the `authErrorCallback`
4. WHEN the API_Client receives no response (network error), THE response interceptor SHALL reject with the message "Network error - please check your connection"
5. WHEN the API_Client `post` method receives a response with `success: true` and `data`, THE API_Client SHALL return the `data` value
6. WHEN the API_Client `put` method receives a response with `success: false`, THE API_Client SHALL throw an Error with the response's `error` message
7. THE API_Client request interceptor SHALL set the Authorization header to `Bearer <token>` using the access token from `fetchAuthSession`
8. WHEN the access token is not available, THE API_Client request interceptor SHALL fall back to the ID token from `fetchAuthSession`

### Requirement 5: API Client Entity Method Tests

**User Story:** As a developer, I want tests for the API client's entity-specific methods (inventories, containers, things), so that URL construction and parameter passing are verified.

#### Acceptance Criteria

1. WHEN `getInventories` is called, THE API_Client SHALL send a GET request to `/inventories`
2. WHEN `createInventory` is called with name and description, THE API_Client SHALL send a POST request to `/inventories` with the provided data
3. WHEN `getContainers` is called with an `inventoryId`, THE API_Client SHALL send a GET request to `/containers?inventoryId={inventoryId}`
4. WHEN `createContainer` is called with container data, THE API_Client SHALL send a POST request to `/containers` with the provided data
5. WHEN `deleteContainer` is called with `force: true`, THE API_Client SHALL include `force=true` in the request URL query parameters
6. WHEN `getThings` is called with an `inventoryId` and pagination options, THE API_Client SHALL include the `inventoryId`, `limit`, and `lastEvaluatedKey` as query parameters

### Requirement 6: EntityTable Component Tests

**User Story:** As a developer, I want tests for the EntityTable component, so that the reusable data grid used across multiple views is verified.

#### Acceptance Criteria

1. WHEN EntityTable receives columns and data, THE EntityTable SHALL render a DataGrid with the correct column headers and row data
2. WHEN EntityTable receives an `onEdit` callback, THE EntityTable SHALL render an edit action button for each row that calls `onEdit` with the row data when clicked
3. WHEN EntityTable receives an `onDelete` callback, THE EntityTable SHALL render a delete action button for each row that calls `onDelete` with the row data when clicked
4. WHEN EntityTable receives `loading: true`, THE EntityTable SHALL display a loading indicator
5. WHEN the viewport is mobile-sized, THE EntityTable SHALL render a card-based list layout instead of the DataGrid
6. WHEN EntityTable receives data and a global search term is entered, THE EntityTable SHALL filter rows to only those containing the search term in any column value
7. FOR ALL arrays of valid column definitions and row data, THE EntityTable SHALL render exactly the number of rows matching the data array length (property test)

### Requirement 7: ContainerList Component Tests

**User Story:** As a developer, I want tests for the ContainerList component, so that the primary container management view is verified.

#### Acceptance Criteria

1. WHEN ContainerList renders with a selected inventory, THE ContainerList SHALL fetch and display the list of containers for that inventory
2. WHEN the user clicks the Add button, THE ContainerList SHALL open the ContainerFormDialog
3. WHEN the user clicks the Edit button on a container row, THE ContainerList SHALL open the ContainerFormDialog pre-populated with that container's data
4. WHEN the user clicks the Delete button on a container row, THE ContainerList SHALL open a confirmation dialog before deleting
5. WHEN the delete confirmation is accepted, THE ContainerList SHALL call `apiClient.deleteContainer` and remove the container from the displayed list
6. WHEN container deletion succeeds, THE ContainerList SHALL call `showSuccess` with a confirmation message
7. IF container deletion fails, THEN THE ContainerList SHALL call `showError` with the error message

### Requirement 8: ContainerFormDialog Component Tests

**User Story:** As a developer, I want tests for the ContainerFormDialog, so that container creation and editing with validation is verified.

#### Acceptance Criteria

1. WHEN ContainerFormDialog opens with no container prop, THE ContainerFormDialog SHALL render an empty form for creating a new container
2. WHEN ContainerFormDialog opens with a container prop, THE ContainerFormDialog SHALL pre-populate the form fields with the container's existing values
3. WHEN the user submits the form without a required name field, THE ContainerFormDialog SHALL display a validation error for the name field
4. WHEN the user submits a valid new container form, THE ContainerFormDialog SHALL call `apiClient.createContainer` with the form data and invoke the `onSuccess` callback
5. WHEN the user submits a valid edit form, THE ContainerFormDialog SHALL call `apiClient.updateContainer` with the container ID and updated data
6. WHEN the API call fails during form submission, THE ContainerFormDialog SHALL display the error message and keep the dialog open

### Requirement 9: SignIn Component Tests

**User Story:** As a developer, I want tests for the SignIn component, so that the authentication entry point is verified for common user flows.

#### Acceptance Criteria

1. WHEN SignIn renders, THE SignIn component SHALL display email and password input fields and a submit button
2. WHEN the user submits valid credentials and `signIn` returns `isSignedIn: true`, THE SignIn component SHALL navigate to the home route "/"
3. WHEN `signIn` returns a `NEW_PASSWORD_REQUIRED` challenge, THE SignIn component SHALL display new password and confirm password fields
4. WHEN `signIn` returns an `SMS_MFA` or `TOTP_MFA` challenge, THE SignIn component SHALL display an MFA code input field
5. WHEN `signIn` throws an error, THE SignIn component SHALL display the error message in an Alert component
6. WHILE the sign-in request is in progress, THE SignIn component SHALL display a loading indicator and disable the submit button

### Requirement 10: Utility Function Tests

**User Story:** As a developer, I want tests for shared utility functions, so that validation helpers and data formatting used across components are verified.

#### Acceptance Criteria

1. FOR ALL valid `Container` objects, THE `ContainerStatus` type SHALL only contain values defined in the `ContainerStatus` const object (property test)
2. FOR ALL valid `HandlingFlag` arrays, each element SHALL only contain values defined in the `HandlingFlag` const object (property test)
3. FOR ALL valid `ApiResponse` objects with `success: true`, THE `data` field SHALL be defined (property test)
4. FOR ALL valid entity objects with `dateAdded` fields, THE `dateAdded` value SHALL be a valid ISO 8601 string (property test)
