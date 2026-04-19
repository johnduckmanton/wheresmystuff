# Requirements Document

## Introduction

This feature standardizes API response types and error handling patterns across the codebase. Two related inconsistencies exist today:

1. **Response type inconsistency**: The `getContainers()` API client method has a union return type (`Container[] | { containers, count, hasMore, lastEvaluatedKey }`), forcing every frontend caller to perform defensive `Array.isArray()` checks and `as any` casts. The backend always returns the object shape from `containerService.listContainers()`, so the frontend type should reflect that.

2. **Error handling inconsistency**: Backend handlers use a mix of `error()` (legacy, exposes raw messages) and `secureError()` (preferred, uses generic messages with request IDs) for error responses. Some handlers use `error()` with raw `err.message` in catch blocks for unexpected errors, leaking internal details. The convention should be: `error()` for intentional validation/404 responses with safe messages, `secureError()` for unexpected errors in catch blocks.

## Glossary

- **API_Client**: The singleton `ApiClient` class in `frontend/src/services/api.ts` that wraps Axios and provides typed methods for all backend endpoints
- **Container_List_Response**: The standardized response shape `{ containers: Container[], count: number, hasMore: boolean, lastEvaluatedKey?: string }` returned by the container list endpoint
- **Handler**: A Lambda handler function in `backend/handlers/` that processes HTTP requests and returns responses
- **error_function**: The legacy `error(message, statusCode, origin)` function in `backend/utils/response.js` that returns a plain error message to the client
- **secureError_function**: The preferred `secureError(errorObj, context, origin)` function in `backend/utils/response.js` that uses the error handler to return generic messages with request IDs
- **Frontend_Caller**: Any React component or page that calls `apiClient.getContainers()` and consumes the response

## Requirements

### Requirement 1: Standardize Container List API Response Type

**User Story:** As a frontend developer, I want the `getContainers()` method to return a single consistent type, so that I do not need defensive type checks or unsafe casts when consuming container data.

#### Acceptance Criteria

1. THE API_Client SHALL define the `getContainers()` method with a return type of `Promise<Container_List_Response>` where `Container_List_Response` is `{ containers: Container[], count: number, hasMore: boolean, lastEvaluatedKey?: string }`.
2. THE API_Client SHALL remove the `Container[]` branch from the `getContainers()` return type union.
3. WHEN the container list endpoint returns data, THE API_Client SHALL provide the response as a `Container_List_Response` object to the caller.

### Requirement 2: Update Frontend Callers to Use Consistent Response Type

**User Story:** As a frontend developer, I want all components that consume container list data to access `response.containers` directly, so that the code is type-safe and free of `as any` casts.

#### Acceptance Criteria

1. WHEN `Home` page receives a container list response, THE Home component SHALL access the container array via the `containers` property of the response object without using `as any` casts.
2. WHEN `MovingDashboard` page receives a container list response, THE MovingDashboard component SHALL access the container array via the `containers` property of the response object without using `as any` casts.
3. WHEN `ContainerList` component receives a container list response, THE ContainerList component SHALL access the container array via the `containers` property of the response object without using `as any` casts.
4. THE Frontend_Caller SHALL remove all `Array.isArray()` defensive checks that guard against the container response being a plain array.

### Requirement 3: Standardize Error Handling in Catch Blocks

**User Story:** As a backend developer, I want a clear convention for when to use `error()` versus `secureError()`, so that unexpected errors never leak internal details to clients.

#### Acceptance Criteria

1. WHEN an unexpected error occurs in a Handler catch block, THE Handler SHALL use the secureError_function to generate the error response.
2. WHEN a Handler performs input validation and the input is invalid, THE Handler SHALL use the error_function with a safe, developer-authored message and an appropriate 4xx status code.
3. WHEN a Handler encounters a known "not found" condition, THE Handler SHALL use the error_function with a safe message and a 404 status code.
4. WHEN a Handler encounters a known "access denied" condition, THE Handler SHALL use the error_function with a safe message and a 403 status code.
5. THE containers Handler SHALL use the secureError_function for all unexpected errors in catch blocks instead of re-throwing or using the error_function with `err.message`.
6. THE things Handler SHALL use the secureError_function for all unexpected errors in catch blocks instead of using the error_function with `err.message` and a 500 status code.
7. THE locations Handler SHALL use the secureError_function for all unexpected errors in catch blocks instead of using the error_function with `err.message`.

### Requirement 4: Document Error Handling Convention

**User Story:** As a backend developer, I want the error handling convention documented in the codebase, so that new handlers follow the correct pattern from the start.

#### Acceptance Criteria

1. THE backend codebase SHALL contain a documented error handling convention that specifies when to use the error_function versus the secureError_function.
2. THE documentation SHALL state that the error_function is for intentional responses where the developer controls the message text (validation errors, not-found, method-not-allowed).
3. THE documentation SHALL state that the secureError_function is for unexpected errors in catch blocks where `err.message` may contain internal details.
4. THE documentation SHALL include at least one code example showing the correct pattern for a Handler catch block.

### Requirement 5: Preserve Intentional Error Responses

**User Story:** As a backend developer, I want validation and routing errors to remain clear and specific, so that API consumers receive actionable error messages for client-side mistakes.

#### Acceptance Criteria

1. WHEN a Handler receives an unsupported HTTP method, THE Handler SHALL continue to use the error_function with the message "Method not allowed" and a 405 status code.
2. WHEN a Handler receives an invalid UUID parameter, THE Handler SHALL continue to use the error_function with a descriptive message and a 400 status code.
3. WHEN a Handler receives a missing required query parameter, THE Handler SHALL continue to use the error_function with a descriptive message and a 400 status code.
