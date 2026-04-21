# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Production Debug Logging Suppressed & Backend Fail-Fast on Missing Env Vars
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior — they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate both bugs exist
  - **Scoped PBT Approach**: Scope the property to concrete failing cases for reproducibility
  - **Frontend Bug Condition (Properties 1 from design)**:
    - Mock `isDevelopmentMode` as `false` (production mode)
    - Create an `ApiClient` instance and trigger a request via the request interceptor
    - Assert that `console.log` is NOT called with debug/token/session data
    - Also test `post()`, `generateUploadUrl()`, `generateDocumentUploadUrl()`, `generateQRCode()`, `uploadPhoto()` methods
    - On UNFIXED code: test will FAIL because `console.log` IS called unconditionally (confirms the bug)
  - **Backend Bug Condition (Property 2 from design)**:
    - Delete `process.env.TABLE_NAME`, then require `backend/services/dynamodb.js`
    - Assert that the module throws an Error matching `/TABLE_NAME.*required/`
    - On UNFIXED code: test will FAIL because module loads silently with fallback `'home-inventory'` (confirms the bug)
    - Repeat for `BUCKET_NAME` in `imageProcessor.js`, `s3.js`, `barcodeService.js`
    - Repeat for `QR_REPORT_BUCKET_NAME` in `qrCode.js`
  - **OPENAI_API_KEY Warning (Property 3 from design)**:
    - Delete `process.env.OPENAI_API_KEY`, instantiate `AIAnalysisService`
    - Assert that `console.warn` is called with a message about the missing key
    - On UNFIXED code: test will FAIL because constructor silently stores `undefined` (confirms the bug)
  - Run all tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — it proves the bugs exist)
  - Document counterexamples found (e.g., "`console.log` called 15 times in request interceptor in production mode", "`dynamodb.js` loads with TABLE_NAME='home-inventory' when env var is missing")
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Development Logging, Error Handling, and Backend Normal Operation Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code first, then write tests that capture observed behavior**:
  - **Development Logging Preservation (Property 4 from design)**:
    - Observe: When `isDevelopmentMode` is `true`, `console.log` IS called in request interceptor with debug info
    - Observe: When `isDevelopmentMode` is `true`, `post()` logs request/response data
    - Write property-based test: for all API methods, when `isDevelopmentMode` is `true`, `console.log` is called with debug data
    - Verify test passes on UNFIXED code
  - **Error Logging and Auth Flow Preservation (Property 5 from design)**:
    - Observe: When a request fails with a network error, `console.error` is called regardless of environment
    - Observe: When a 401 response is received, the interceptor logs the auth failure, calls `signOut()`, and triggers `authErrorCallback`
    - Write property-based test: for all error scenarios, `console.error` is called and 401 handling triggers sign-out
    - Verify test passes on UNFIXED code
  - **Backend Normal Operation Preservation (Property 6 from design)**:
    - Observe: When `TABLE_NAME` is set, `dynamodb.js` initializes normally and uses the provided value
    - Observe: When `BUCKET_NAME` is set, `imageProcessor.js` and `s3.js` initialize normally
    - Observe: When `QR_REPORT_BUCKET_NAME` is set, `qrCode.js` initializes normally
    - Observe: When `AI_MOCK_MODE=true`, AI handler uses mock analysis regardless of `OPENAI_API_KEY`
    - Write property-based test: for all backend services with all required env vars set, modules load successfully and use the provided values
    - Verify test passes on UNFIXED code
  - Run all preservation tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix frontend production debug logging

  - [x] 3.1 Wrap console.log statements in request interceptor behind isDevelopmentMode guard
    - Wrap the ~15 `console.log` statements in the request interceptor (auth token debug, session objects, token metadata) inside `if (isDevelopmentMode) { ... }`
    - Keep `console.warn` for missing token (real auth issue, not debug noise)
    - Keep `console.error` for auth session fetch failures
    - _Bug_Condition: isBugCondition(input) where input.context == 'frontend' AND input.environment != 'development' AND apiClientExecutesConsoleLog(input)_
    - _Expected_Behavior: console.log NOT called with debug/token data in production_
    - _Preservation: console.warn for missing token and console.error for auth failures remain in all environments_
    - _Requirements: 2.1, 3.2, 3.3_

  - [x] 3.2 Wrap console.log statements in post() method behind isDevelopmentMode guard
    - Wrap the 4 request `console.log` statements and 4 success `console.log` statements in `if (isDevelopmentMode) { ... }`
    - Keep all `console.error` statements for actual POST failures
    - _Bug_Condition: isBugCondition(input) where post() logs request payloads and response data in production_
    - _Expected_Behavior: console.log NOT called with request/response data in production_
    - _Preservation: console.error for POST failures remains in all environments_
    - _Requirements: 2.2, 3.2_

  - [x] 3.3 Wrap console.log statements in generateUploadUrl() and generateDocumentUploadUrl() behind isDevelopmentMode guard
    - Wrap the 9 `console.log` statements in `generateUploadUrl()` in `if (isDevelopmentMode) { ... }`
    - Wrap the 7 `console.log` statements in `generateDocumentUploadUrl()` in `if (isDevelopmentMode) { ... }`
    - _Bug_Condition: isBugCondition(input) where upload URL methods log parameter values in production_
    - _Expected_Behavior: console.log NOT called with parameter values or request data in production_
    - _Preservation: Upload URL generation functionality unchanged_
    - _Requirements: 2.3_

  - [x] 3.4 Wrap console.log statements in generateQRCode() and uploadPhoto() behind isDevelopmentMode guard
    - Wrap the 5 `console.log` statements in `generateQRCode()` in `if (isDevelopmentMode) { ... }`
    - Wrap the 4+ `console.log` statements in `uploadPhoto()` in `if (isDevelopmentMode) { ... }`
    - _Bug_Condition: isBugCondition(input) where QR/photo methods log IDs and file metadata in production_
    - _Expected_Behavior: console.log NOT called with IDs, file metadata, or API config in production_
    - _Preservation: QR code generation and photo upload functionality unchanged_
    - _Requirements: 2.4_

  - [x] 3.5 Verify bug condition exploration test now passes for frontend logging
    - **Property 1: Expected Behavior** - Production Debug Logging Suppressed
    - **IMPORTANT**: Re-run the SAME frontend tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior (no console.log in production)
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run frontend bug condition exploration tests from step 1
    - **EXPECTED OUTCOME**: Tests PASS (confirms frontend logging bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.6 Verify preservation tests still pass for frontend
    - **Property 2: Preservation** - Development Logging and Error Handling Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests for frontend (dev logging, error logging, auth flow)
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in frontend behavior)
    - Confirm all frontend preservation tests still pass after fix
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 4. Fix backend environment variable validation

  - [x] 4.1 Replace TABLE_NAME silent fallbacks with fail-fast validation in all service files
    - Replace `process.env.TABLE_NAME || 'home-inventory'` with fail-fast validation in all 25+ service files:
      `dynamodb.js`, `milestoneService.js`, `collaborationService.js`, `storageService.js`, `notificationService.js`, `taskService.js`, `containerService.js`, `containerSharingService.js`, `analyticsService.js`, `budgetService.js`, `movingProjectService.js`, `dataMigrationService.js`, `packingService.js`, `projectSharingService.js`, `rateLimitService.js`, `storageAlertService.js`, `databaseOptimizationService.js`, `auditLogService.js`, `cacheService.js`, `dataSynchronizationService.js`, `dataValidationService.js`, `reportService.js`, `scanHistoryService.js`, `projectAssignmentService.js`, `inventoryService.js` (two occurrences with `'home-inventory-dev'`), `invitationService.js`, `userService.js`
    - Also fix `backend/handlers/packing.js` (one occurrence inside a function)
    - Pattern: `const TABLE_NAME = process.env.TABLE_NAME; if (!TABLE_NAME) { throw new Error('TABLE_NAME environment variable is required'); }`
    - Do NOT change files in `backend/scripts/` — those are developer tools that should keep their fallback defaults
    - _Bug_Condition: isBugCondition(input) where input.envVars['TABLE_NAME'] == undefined_
    - _Expected_Behavior: module throws Error matching /TABLE_NAME.*required/_
    - _Preservation: When TABLE_NAME is set, services initialize and operate identically to unfixed code_
    - _Requirements: 2.5, 3.4_

  - [x] 4.2 Add BUCKET_NAME fail-fast validation
    - Add validation in `backend/handlers/imageProcessor.js`: throw if `BUCKET_NAME` is missing
    - Add validation in `backend/services/s3.js`: throw if `BUCKET_NAME` is missing
    - Add validation in `backend/services/barcodeService.js`: throw if `BUCKET_NAME` is missing
    - Pattern: `if (!BUCKET_NAME) { throw new Error('BUCKET_NAME environment variable is required'); }`
    - _Bug_Condition: isBugCondition(input) where input.envVars['BUCKET_NAME'] == undefined_
    - _Expected_Behavior: module throws Error matching /BUCKET_NAME.*required/_
    - _Preservation: When BUCKET_NAME is set, services initialize normally_
    - _Requirements: 2.6_

  - [x] 4.3 Add QR_REPORT_BUCKET_NAME fail-fast validation
    - Add validation in `backend/handlers/qrCode.js`: throw if `QR_REPORT_BUCKET_NAME` is missing
    - Pattern: `if (!QR_BUCKET_NAME) { throw new Error('QR_REPORT_BUCKET_NAME environment variable is required'); }`
    - _Bug_Condition: isBugCondition(input) where input.envVars['QR_REPORT_BUCKET_NAME'] == undefined_
    - _Expected_Behavior: module throws Error matching /QR_REPORT_BUCKET_NAME.*required/_
    - _Preservation: When QR_REPORT_BUCKET_NAME is set, handler initializes normally_
    - _Requirements: 2.7_

  - [x] 4.4 Add OPENAI_API_KEY warning in AIAnalysisService constructor
    - Update `backend/services/aiAnalysisService.js` constructor to log `console.warn` when `OPENAI_API_KEY` is missing
    - Warning message: `'OPENAI_API_KEY environment variable is not set. AI analysis features will not work unless AI_MOCK_MODE is enabled.'`
    - Do NOT throw — AI features are optional and mock mode must still work
    - _Bug_Condition: isBugCondition(input) where input.envVars['OPENAI_API_KEY'] == undefined_
    - _Expected_Behavior: console.warn called with message about missing key_
    - _Preservation: AI_MOCK_MODE=true continues to bypass OpenAI API calls regardless of OPENAI_API_KEY_
    - _Requirements: 2.8, 3.6_

  - [x] 4.5 Verify bug condition exploration test now passes for backend env vars
    - **Property 1: Expected Behavior** - Backend Fail-Fast on Missing Required Env Vars & OPENAI_API_KEY Warning
    - **IMPORTANT**: Re-run the SAME backend tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior (throw on missing required env vars, warn on missing OPENAI_API_KEY)
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run backend bug condition exploration tests from step 1
    - **EXPECTED OUTCOME**: Tests PASS (confirms backend env var bugs are fixed)
    - _Requirements: 2.5, 2.6, 2.7, 2.8_

  - [x] 4.6 Verify preservation tests still pass for backend
    - **Property 2: Preservation** - Backend Normal Operation Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests for backend (normal init with env vars set, mock mode)
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in backend behavior)
    - Confirm all backend preservation tests still pass after fix
    - _Requirements: 3.4, 3.6_

- [x] 5. Checkpoint - Ensure all tests pass
  - Run the full test suite to confirm all exploration and preservation tests pass
  - Verify no regressions in existing tests
  - Confirm frontend: no `console.log` in production mode, dev logging preserved
  - Confirm backend: all services throw on missing required env vars, normal operation unchanged
  - Confirm `backend/scripts/` files are untouched
  - Ask the user if questions arise
