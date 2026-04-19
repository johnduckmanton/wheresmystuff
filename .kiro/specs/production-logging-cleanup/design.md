# Production Logging Cleanup Bugfix Design

## Overview

Two related production-readiness bugs exist. First, the frontend API client (`frontend/src/services/api.ts`) contains ~40+ unconditional `console.log` statements that leak authentication tokens, request/response payloads, and HTTP headers to the browser console in production. Second, multiple backend services silently fall back to hardcoded defaults when required environment variables (`TABLE_NAME`, `BUCKET_NAME`, `QR_REPORT_BUCKET_NAME`) are missing, causing operations against wrong resources instead of failing fast. The fix wraps frontend debug logging behind the existing `isDevelopmentMode` guard and replaces backend silent fallbacks with fail-fast validation at module load time.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — (1) any API call in a production build unconditionally executes debug `console.log` statements, or (2) a required backend environment variable is missing and the service silently uses a wrong default
- **Property (P)**: The desired behavior — (1) production builds produce no debug console output from the API client, or (2) backend services throw immediately when a required env var is missing
- **Preservation**: Existing behaviors that must remain unchanged — development-mode logging, `console.error` for actual errors, 401 handling, normal operation when env vars are set, mock mode for AI features
- **`isDevelopmentMode`**: The boolean in `frontend/src/config/development.ts` that is `true` when `import.meta.env.MODE === 'development'` and no `VITE_API_URL` is set
- **`logDevelopmentInfo()`**: The helper in `frontend/src/config/development.ts` that logs dev-mode info only when `isDevelopmentMode` is true
- **Silent fallback**: The pattern `process.env.TABLE_NAME || 'home-inventory'` that masks missing configuration by substituting a default value

## Bug Details

### Bug Condition

The bug manifests in two independent scenarios:

**Scenario A (Frontend Logging):** When any API request is made in a production build, the `ApiClient` class in `frontend/src/services/api.ts` unconditionally executes `console.log` statements that output authentication tokens (including 50-char previews), full session objects, request/response payloads, HTTP headers, and API configuration to the browser console.

**Scenario B (Backend Env Vars):** When a required environment variable (`TABLE_NAME`, `BUCKET_NAME`, `QR_REPORT_BUCKET_NAME`) is missing at Lambda cold start, the backend service silently falls back to a hardcoded default or `undefined`, causing operations against the wrong DynamoDB table or S3 bucket without any error.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { context: 'frontend' | 'backend', environment: string, envVars: Record<string, string | undefined> }
  OUTPUT: boolean

  IF input.context == 'frontend' THEN
    RETURN input.environment != 'development'
           AND apiClientExecutesConsoleLog(input)
  END IF

  IF input.context == 'backend' THEN
    RETURN input.envVars['TABLE_NAME'] == undefined
           OR input.envVars['BUCKET_NAME'] == undefined (for imageProcessor, s3, barcodeService)
           OR input.envVars['QR_REPORT_BUCKET_NAME'] == undefined (for qrCode handler)
           OR input.envVars['OPENAI_API_KEY'] == undefined (for aiAnalysisService, warn only)
  END IF

  RETURN false
END FUNCTION
```

### Examples

- **Production API call**: User makes a GET request in production → browser console shows `🔍 Request Interceptor Debug:`, `- Auth Session: {tokens: ...}`, `- Token preview: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6...` — **Expected**: no console output
- **Production POST call**: User creates an item → browser console shows `🔍 API Client POST Debug:`, `- Data: {name: "Laptop", ...}`, `- Headers: {Authorization: "Bearer eyJ..."}` — **Expected**: no console output
- **Missing TABLE_NAME**: Lambda starts without `TABLE_NAME` set → `dynamodb.js` silently uses `'home-inventory'` and queries wrong table — **Expected**: Lambda throws `Error: TABLE_NAME environment variable is required` at initialization
- **Missing BUCKET_NAME**: `imageProcessor.js` starts without `BUCKET_NAME` → `BUCKET_NAME` is `undefined`, S3 operations fail with cryptic AWS SDK errors — **Expected**: Lambda throws `Error: BUCKET_NAME environment variable is required`
- **Missing OPENAI_API_KEY**: `aiAnalysisService.js` stores `undefined` as API key → API calls to OpenAI fail with unhelpful auth errors — **Expected**: constructor logs a warning; service can still operate in mock mode

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Development-mode debug logging via `isDevelopmentMode` and `logDevelopmentInfo()` must continue to work for developer troubleshooting
- `console.error` calls for actual errors (network failures, API errors, auth session fetch failures) must remain in all environments
- The 401 response interceptor must continue to log the auth failure, sign out the user, and trigger `authErrorCallback`
- Backend services must initialize and operate normally when all required environment variables are properly set
- `AI_MOCK_MODE=true` must continue to bypass OpenAI API calls regardless of `OPENAI_API_KEY` presence
- The `console.warn` for missing token / no headers must remain (it indicates a real auth issue, not debug noise)
- Scripts in `backend/scripts/` are developer tools and their fallback defaults should NOT be changed

**Scope:**
All inputs that do NOT involve (1) debug `console.log` statements in the API client running in production, or (2) missing required backend environment variables should be completely unaffected by this fix. This includes:
- All API client functionality (request/response handling, error handling, CRUD methods)
- All backend business logic and data operations
- Authentication and authorization flows
- CORS validation and rate limiting

## Hypothesized Root Cause

Based on the bug description, the most likely issues are:

1. **Unconditional console.log in API client**: The `console.log` statements in `api.ts` were added during development for debugging authentication and request flows. They were never wrapped in an `isDevelopmentMode` guard despite the project already having that utility in `frontend/src/config/development.ts`. The file already imports `isDevelopmentMode` but only uses it for mock data routing, not for log gating.

2. **Copy-paste pattern for TABLE_NAME fallback**: The `process.env.TABLE_NAME || 'home-inventory'` pattern was likely established early in development for local testing convenience. It was then copied across 20+ service files without considering that in production, a missing `TABLE_NAME` should be a fatal error, not a silent fallback.

3. **No startup validation for S3 bucket names**: `BUCKET_NAME` and `QR_REPORT_BUCKET_NAME` are read from `process.env` at module scope but never validated. Unlike `USER_POOL_ID` (which `auth.js` already validates with a throw), these bucket variables have no guard.

4. **OPENAI_API_KEY stored without validation**: `AIAnalysisService` constructor assigns `this.openaiApiKey = process.env.OPENAI_API_KEY` without checking if it's defined. Since AI features are optional, this should warn rather than throw, but currently it does neither.

## Correctness Properties

Property 1: Bug Condition - Production Debug Logging Suppressed

_For any_ API call made when `isDevelopmentMode` is `false` (production/staging builds), the `ApiClient` class SHALL NOT execute any `console.log` statements in the request interceptor, `post()` method, `generateUploadUrl()`, `generateDocumentUploadUrl()`, `generateQRCode()`, or `uploadPhoto()` methods.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Bug Condition - Backend Fail-Fast on Missing Required Env Vars

_For any_ backend service module load where `TABLE_NAME`, `BUCKET_NAME`, or `QR_REPORT_BUCKET_NAME` is not set in `process.env`, the module SHALL throw an `Error` with a message identifying the missing variable, preventing silent fallback to a wrong resource.

**Validates: Requirements 2.5, 2.6, 2.7**

Property 3: Bug Condition - OPENAI_API_KEY Warning

_For any_ initialization of `AIAnalysisService` where `OPENAI_API_KEY` is not set in `process.env`, the constructor SHALL log a warning indicating the missing variable rather than silently storing `undefined`.

**Validates: Requirements 2.8**

Property 4: Preservation - Development Logging Unchanged

_For any_ API call made when `isDevelopmentMode` is `true`, the `ApiClient` class SHALL continue to execute all existing debug `console.log` statements, preserving the current developer troubleshooting experience.

**Validates: Requirements 3.1, 3.5**

Property 5: Preservation - Error Logging and Auth Flow Unchanged

_For any_ API call that results in an error (network failure, server error, 401), the `ApiClient` SHALL continue to log via `console.error` and handle 401 responses with sign-out and callback, exactly as before the fix.

**Validates: Requirements 3.2, 3.3**

Property 6: Preservation - Backend Normal Operation Unchanged

_For any_ backend service module load where all required environment variables are properly set, the service SHALL initialize and operate identically to the unfixed code, with no behavioral change.

**Validates: Requirements 3.4, 3.6**

## Fix Implementation

### Changes Required

**File**: `frontend/src/services/api.ts`

**Approach**: Wrap all debug `console.log` statements in `if (isDevelopmentMode)` guards. The file already imports `isDevelopmentMode` from `../config/development`.

**Specific Changes**:
1. **Request interceptor**: Wrap the block of ~15 `console.log` statements (lines 48-101) in `if (isDevelopmentMode) { ... }`. Keep `console.warn` for missing token (real issue) and `console.error` for auth session failures.
2. **`post()` method**: Wrap the 4 `console.log` statements at the start and the 4 success `console.log` statements in `if (isDevelopmentMode) { ... }`. Keep all `console.error` statements for actual failures.
3. **`generateUploadUrl()`**: Wrap the 9 `console.log` statements in `if (isDevelopmentMode) { ... }`.
4. **`generateDocumentUploadUrl()`**: Wrap the 7 `console.log` statements in `if (isDevelopmentMode) { ... }`.
5. **`generateQRCode()`**: Wrap the 5 `console.log` statements in `if (isDevelopmentMode) { ... }`.
6. **`uploadPhoto()`**: Wrap the 4+ `console.log` statements in `if (isDevelopmentMode) { ... }`.

---

**Files**: Backend service files with `TABLE_NAME` fallback (services only, not scripts):
- `backend/services/dynamodb.js`
- `backend/services/milestoneService.js`
- `backend/services/collaborationService.js`
- `backend/services/storageService.js`
- `backend/services/notificationService.js`
- `backend/services/taskService.js`
- `backend/services/containerService.js`
- `backend/services/containerSharingService.js`
- `backend/services/analyticsService.js`
- `backend/services/budgetService.js`
- `backend/services/movingProjectService.js`
- `backend/services/dataMigrationService.js`
- `backend/services/packingService.js`
- `backend/services/projectSharingService.js`
- `backend/services/rateLimitService.js`
- `backend/services/storageAlertService.js`
- `backend/services/databaseOptimizationService.js`
- `backend/services/auditLogService.js`
- `backend/services/cacheService.js`
- `backend/services/dataSynchronizationService.js`
- `backend/services/dataValidationService.js`
- `backend/services/reportService.js`
- `backend/services/scanHistoryService.js`
- `backend/services/projectAssignmentService.js`
- `backend/services/inventoryService.js` (two occurrences with `'home-inventory-dev'`)
- `backend/services/invitationService.js`
- `backend/services/userService.js`
- `backend/handlers/packing.js` (one occurrence inside a function)

**Change**: Replace `process.env.TABLE_NAME || 'home-inventory'` with:
```js
const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) {
  throw new Error('TABLE_NAME environment variable is required');
}
```

---

**File**: `backend/handlers/imageProcessor.js`

**Change**: Replace `const BUCKET_NAME = process.env.BUCKET_NAME;` with:
```js
const BUCKET_NAME = process.env.BUCKET_NAME;
if (!BUCKET_NAME) {
  throw new Error('BUCKET_NAME environment variable is required');
}
```

---

**File**: `backend/services/s3.js`

**Change**: Add validation after `const BUCKET_NAME = process.env.BUCKET_NAME;`:
```js
if (!BUCKET_NAME) {
  throw new Error('BUCKET_NAME environment variable is required');
}
```

---

**File**: `backend/services/barcodeService.js`

**Change**: Add validation after `const BUCKET_NAME = process.env.BUCKET_NAME;`:
```js
if (!BUCKET_NAME) {
  throw new Error('BUCKET_NAME environment variable is required');
}
```

---

**File**: `backend/handlers/qrCode.js`

**Change**: Replace `const QR_BUCKET_NAME = process.env.QR_REPORT_BUCKET_NAME;` with:
```js
const QR_BUCKET_NAME = process.env.QR_REPORT_BUCKET_NAME;
if (!QR_BUCKET_NAME) {
  throw new Error('QR_REPORT_BUCKET_NAME environment variable is required');
}
```

---

**File**: `backend/services/aiAnalysisService.js`

**Change**: Update the constructor to warn when `OPENAI_API_KEY` is missing:
```js
constructor() {
  this.openaiApiKey = process.env.OPENAI_API_KEY;
  if (!this.openaiApiKey) {
    console.warn('OPENAI_API_KEY environment variable is not set. AI analysis features will not work unless AI_MOCK_MODE is enabled.');
  }
  this.openaiBaseUrl = 'https://api.openai.com/v1';
}
```

---

**Note**: Files in `backend/scripts/` (e.g., `diagnose-data.js`, `migrate-existing-data.js`) are developer/migration tools and should retain their fallback defaults. Only `backend/services/` and `backend/handlers/` files are changed.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that verify `console.log` is called unconditionally in the API client and that backend services accept missing env vars without throwing. Run these tests on the UNFIXED code to observe the buggy behavior.

**Test Cases**:
1. **Production Console Leak Test**: Mock `isDevelopmentMode` as `false`, create an `ApiClient`, trigger a request, and assert that `console.log` was called with token/session data (will pass on unfixed code, confirming the bug)
2. **POST Debug Leak Test**: Mock `isDevelopmentMode` as `false`, call `post()`, and assert `console.log` was called with request data (will pass on unfixed code)
3. **TABLE_NAME Fallback Test**: Unset `process.env.TABLE_NAME`, require `dynamodb.js`, and assert `TABLE_NAME` equals `'home-inventory'` (will pass on unfixed code, confirming silent fallback)
4. **BUCKET_NAME Undefined Test**: Unset `process.env.BUCKET_NAME`, require `imageProcessor.js`, and assert `BUCKET_NAME` is `undefined` (will pass on unfixed code)

**Expected Counterexamples**:
- `console.log` is invoked with sensitive data regardless of environment mode
- Backend modules load successfully with missing env vars, silently using wrong defaults

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  IF input.context == 'frontend' THEN
    result := makeApiCall_fixed(input)
    ASSERT console.log NOT called with debug/token data
  END IF
  IF input.context == 'backend' THEN
    ASSERT requireModule_fixed(input) THROWS Error matching /environment variable is required/
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  IF input.context == 'frontend' AND isDevelopmentMode THEN
    ASSERT console.log IS called (dev logging preserved)
  END IF
  IF input.context == 'frontend' AND isErrorCase THEN
    ASSERT console.error IS called (error logging preserved)
  END IF
  IF input.context == 'backend' AND allEnvVarsSet THEN
    ASSERT module loads successfully
    ASSERT service operates identically to unfixed code
  END IF
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (random API methods, random env var combinations)
- It catches edge cases that manual unit tests might miss (e.g., a `console.log` in an obscure method)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for development-mode logging and normal backend operation, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Dev Mode Logging Preservation**: Verify that when `isDevelopmentMode` is `true`, all debug `console.log` calls still execute
2. **Error Logging Preservation**: Verify that `console.error` calls for network errors, API errors, and 401 responses still execute in all environments
3. **Auth Flow Preservation**: Verify that 401 handling (sign out + callback) works identically after the fix
4. **Backend Normal Init Preservation**: Verify that when all env vars are set, services initialize and operate identically

### Unit Tests

- Test that `console.log` is NOT called in request interceptor when `isDevelopmentMode` is `false`
- Test that `console.log` IS called in request interceptor when `isDevelopmentMode` is `true`
- Test that `console.error` is still called for auth session fetch failures in all environments
- Test that `post()` does not log request/response data when `isDevelopmentMode` is `false`
- Test that each backend service throws when `TABLE_NAME` is missing
- Test that `imageProcessor.js` throws when `BUCKET_NAME` is missing
- Test that `qrCode.js` throws when `QR_REPORT_BUCKET_NAME` is missing
- Test that `aiAnalysisService.js` logs a warning when `OPENAI_API_KEY` is missing
- Test that backend services initialize normally when all env vars are set

### Property-Based Tests

- Generate random API method names and verify no `console.log` calls occur in production mode
- Generate random combinations of set/unset env vars and verify backend services throw for required vars and warn for optional vars
- Generate random request/response payloads and verify the API client handles them identically (same return values, same errors) regardless of the logging changes

### Integration Tests

- Test full API request flow in production mode and verify browser console is clean of debug output
- Test backend Lambda cold start with all env vars set and verify normal operation
- Test backend Lambda cold start with missing env vars and verify clear error messages
- Test AI analysis handler with `AI_MOCK_MODE=true` and missing `OPENAI_API_KEY` to verify mock mode still works
