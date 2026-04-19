# Implementation Plan: Backend Test Recovery

## Overview

Diagnose and fix 10 skipped backend test files, then re-enable them in `jest.config.js`. Fixes are applied in priority order: auth timeout → mock setup (auditLog, notification, collaboration) → rateLimit mocks → PBT generators (inventory, userManagement) → integration mocks (e2e, integration-system-validation, userManagementIntegration) → jest.config.js cleanup. All changes are in test files only — no production code modifications.

## Tasks

- [ ] 1. Diagnose all skipped test files
  - Run each of the 10 skipped test files individually with `npx jest tests/<file> --no-coverage` in the `backend` directory
  - Capture the exact error output for each file to confirm the root cause matches the design analysis
  - Document which files fail due to mock setup, PBT generators, integration sequencing, or timeout
  - _Requirements: 1.1–1.6, 2.1–2.2, 3.1–3.2, 4.1_

- [ ] 2. Fix auth.test.js import ordering and timeout
  - [ ] 2.1 Fix mock and import ordering in auth.test.js
    - Move all `jest.mock()` calls (for `auditLogService`, `jwks-rsa`) before any `require()` calls that import `../middleware/auth`
    - Ensure `mockGetSigningKey` resolves quickly with no unnecessary delays
    - Verify the JWKS client mock is in place before the auth module loads
    - _Requirements: 4.1, 4.4, 1.7, 1.9_
  - [ ] 2.2 Verify auth.test.js PBT properties and timeout compliance
    - Run `npx jest tests/auth.test.js --no-coverage --verbose` and confirm all tests pass within 30 seconds
    - If timeout is still exceeded, reduce `numRuns` from 100 to 50 for the JWT-heavy property only
    - Confirm PBT tests verify JWT issuer, audience, expiration, and token_use claims
    - Confirm authentication failure logging tests check userId, success status, IP address, and user agent
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 6.1, 6.3_

- [ ] 3. Fix mock setup in auditLog, notification, and collaboration test files
  - [ ] 3.1 Fix auditLog.test.js mock setup
    - Ensure all `jest.mock()` calls are at the top level before any `require()` calls
    - Do NOT re-mock modules already mocked in `setup.js` (cacheService, performanceMonitoringService)
    - Mock all transitive dependencies the auditLogService depends on
    - Run `npx jest tests/auditLog.test.js --no-coverage --verbose` and confirm all tests pass
    - _Requirements: 1.2, 1.7, 1.8, 1.9, 6.1, 6.2_
  - [ ] 3.2 Fix notification.test.js mock setup
    - Ensure all `jest.mock()` calls are at the top level before any `require()` calls
    - Do NOT re-mock modules already mocked in `setup.js`
    - Mock any timer-based services that notificationService depends on before importing the module under test
    - Run `npx jest tests/notification.test.js --no-coverage --verbose` and confirm all tests pass
    - _Requirements: 1.3, 1.7, 1.8, 1.9, 6.1, 6.2_
  - [ ] 3.3 Fix collaboration.test.js mock setup
    - Ensure all `jest.mock()` calls are at the top level before any `require()` calls
    - Do NOT re-mock modules already mocked in `setup.js`
    - Mock all transitive dependencies of collaborationService (DynamoDB, auditLogService, and any additional services)
    - Run `npx jest tests/collaboration.test.js --no-coverage --verbose` and confirm all tests pass
    - _Requirements: 1.1, 1.7, 1.8, 6.1, 6.2_

- [ ] 4. Checkpoint — Verify auth and mock setup fixes
  - Ensure all tests pass for auth.test.js, auditLog.test.js, notification.test.js, and collaboration.test.js, ask the user if questions arise.

- [ ] 5. Fix rateLimit.test.js mock setup
  - [ ] 5.1 Fix rateLimit.test.js missing dependency mocks
    - Ensure all `jest.mock()` calls are at the top level before any `require()` calls
    - Mock all dependencies of the `withRateLimit` middleware: `rateLimitService`, `auditLogService`, `securityLogger`
    - Do NOT re-mock modules already mocked in `setup.js`
    - Run `npx jest tests/rateLimit.test.js --no-coverage --verbose` and confirm all tests pass
    - _Requirements: 1.4, 1.7, 1.8, 6.1, 6.2_

- [ ] 6. Fix PBT generator issues in inventory and userManagement test files
  - [ ] 6.1 Fix inventory.test.js PBT generators
    - Replace `fc.pre(ownerId !== memberUserId)` patterns with `fc.tuple(fc.uuid(), fc.uuid()).filter(([a, b]) => a !== b)` to avoid retry budget exhaustion
    - Replace `mockSend.mockReset()` inside property bodies with `mockSend.mockClear()` to preserve mock implementations across PBT iterations
    - Ensure all PBT generators produce inputs satisfying preconditions of the code under test
    - Verify `numRuns` remains at the value specified in the test (50 or 100)
    - Run `npx jest tests/inventory.test.js --no-coverage --verbose` and confirm all PBT tests pass
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 6.1, 6.4_
  - [ ] 6.2 Fix userManagement.test.js PBT generators and Cognito mock
    - Constrain `fc.emailAddress()` generators with `.filter()` to produce emails matching standard patterns that the Cognito mock can handle
    - Replace `fc.pre()` UUID uniqueness checks with `fc.tuple().filter()` pattern
    - Ensure Cognito mock (`@aws-sdk/client-cognito-identity-provider`) is properly set up before module imports
    - Verify `numRuns` remains at the value specified in the test
    - Run `npx jest tests/userManagement.test.js --no-coverage --verbose` and confirm all PBT tests pass
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 6.1, 6.4_

- [ ] 7. Checkpoint — Verify rateLimit and PBT fixes
  - Ensure all tests pass for rateLimit.test.js, inventory.test.js, and userManagement.test.js, ask the user if questions arise.

- [ ] 8. Fix integration test mock sequencing
  - [ ] 8.1 Fix e2e-moving-workflows.test.js
    - Remove redundant `cacheService` and `performanceMonitoringService` mock declarations that conflict with `setup.js`
    - Mock all handler dependencies: authentication middleware, rate limiting, audit logging, inventory access checks
    - Fix `mockResolvedValueOnce()` chains to account for all sequential database calls including middleware calls
    - Run `npx jest tests/e2e-moving-workflows.test.js --no-coverage --verbose` and confirm all workflow tests pass
    - _Requirements: 1.5, 3.1, 3.3, 3.4, 3.5, 6.1, 6.2_
  - [ ] 8.2 Fix integration-system-validation.test.js
    - Remove the duplicate bare `jest.mock('@aws-sdk/lib-dynamodb')` call — keep only the version with the factory implementation
    - Remove the early `require('@aws-sdk/lib-dynamodb')` that occurs between the two mock declarations
    - Mock all handler dependencies: authentication middleware, rate limiting, audit logging
    - Fix `mockResolvedValueOnce()` chains for multi-step workflow tests
    - Run `npx jest tests/integration-system-validation.test.js --no-coverage --verbose` and confirm all tests pass
    - _Requirements: 1.6, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2_
  - [ ] 8.3 Fix userManagementIntegration.test.js
    - Ensure shared `mockSend` correctly handles interleaved DynamoDB and Cognito calls
    - Fix mock response sequencing to account for both call types in the correct order
    - Ensure all `jest.mock()` calls are at the top level before any `require()` calls
    - Run `npx jest tests/userManagementIntegration.test.js --no-coverage --verbose` and confirm all tests pass
    - _Requirements: 3.3, 3.4, 3.5, 1.7, 1.8, 6.1, 6.2_

- [ ] 9. Checkpoint — Verify integration test fixes
  - Ensure all tests pass for e2e-moving-workflows.test.js, integration-system-validation.test.js, and userManagementIntegration.test.js, ask the user if questions arise.

- [ ] 10. Re-enable tests in jest.config.js and run full suite
  - [ ] 10.1 Remove skipped test entries from jest.config.js
    - Remove all 10 file patterns from the `testPathIgnorePatterns` array in `backend/jest.config.js`
    - Retain any `testPathIgnorePatterns` entries not related to the 10 skipped test files
    - _Requirements: 5.1, 5.4_
  - [ ] 10.2 Run full test suite and verify zero failures
    - Run `npm test` in the `backend` directory
    - Confirm all 10 previously-skipped test files execute and pass
    - Confirm all previously-passing test files continue to pass (no regressions)
    - Confirm the full suite completes within 120 seconds without hanging
    - Verify no new dependencies were added to `package.json`
    - _Requirements: 5.2, 5.3, 5.5, 6.5, 6.6_

- [ ] 11. Final checkpoint — Full suite green
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All fixes are in test files only — no production code changes
- Follow patterns from `backend/tests/MOCKING_GUIDE.md` for correct AWS SDK v3 mock setup
- Do NOT re-mock modules already mocked in `backend/tests/setup.js` (cacheService, performanceMonitoringService)
- Use `mockClear()` (not `mockReset()`) inside PBT iteration bodies to preserve mock implementations
- Prefer `.filter()` on generators over `fc.pre()` to avoid fast-check retry budget exhaustion
- Checkpoints ensure incremental validation after each fix category
- The global `setup.js` should remain unchanged to avoid breaking existing passing tests
