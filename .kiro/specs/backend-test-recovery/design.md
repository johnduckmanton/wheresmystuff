# Design Document: Backend Test Recovery

## Overview

This design addresses the recovery of 10 skipped backend test files in `backend/jest.config.js`. The tests were disabled due to three categories of failures: mock setup ordering issues (6 files), property-based test generator edge cases (2 files), and complex integration test mock sequencing problems (2 files). An additional auth test file has timeout concerns.

The approach is diagnosis-first: run each skipped test in isolation to identify the exact error, then apply targeted fixes following established patterns from the project's `MOCKING_GUIDE.md` and passing test files. No new dependencies are introduced; all fixes use existing libraries (Jest 30.2.0, fast-check 4.4.0) and the project's CommonJS module system.

### Diagnosis Strategy

Each skipped test file will be run individually using `npx jest <file> --no-coverage` to capture the exact error. Fixes are then applied per-category:

1. **Mock setup files** — fix `jest.mock()` / `require()` ordering and add missing transitive dependency mocks
2. **PBT files** — constrain generators to avoid invalid inputs and adjust assertions for edge cases
3. **Integration files** — complete dependency mocking and fix mock response sequencing
4. **Auth file** — fix import ordering and optimize PBT run count if needed for timeout

## Architecture

The test recovery work operates entirely within the existing test infrastructure:

```
backend/
├── jest.config.js              ← Remove 10 entries from testPathIgnorePatterns
├── tests/
│   ├── setup.js                ← Global setup (no changes expected)
│   ├── MOCKING_GUIDE.md        ← Reference for correct patterns
│   ├── __mocks__/              ← Shared mock utilities
│   ├── auth.test.js            ← Fix: import ordering + timeout optimization
│   ├── auditLog.test.js        ← Fix: mock setup conflict with global setup
│   ├── collaboration.test.js   ← Fix: missing transitive dependency mocks
│   ├── notification.test.js    ← Fix: mock setup conflict with global setup
│   ├── rateLimit.test.js       ← Fix: missing middleware dependency mocks
│   ├── inventory.test.js       ← Fix: PBT generator constraints
│   ├── userManagement.test.js  ← Fix: PBT generator constraints + Cognito mock
│   ├── e2e-moving-workflows.test.js          ← Fix: mock sequencing + dependencies
│   ├── integration-system-validation.test.js ← Fix: mock sequencing + double-mock
│   └── userManagementIntegration.test.js     ← Fix: mock setup + sequencing
│
├── services/                   ← Modules under test (no changes)
├── handlers/                   ← Modules under test (no changes)
└── middleware/                  ← Modules under test (no changes)
```

### Key Architectural Constraint

Jest hoists `jest.mock()` calls to the top of the file automatically, but only when they appear at the top level (not inside functions). The global `setup.js` already mocks `cacheService` and `performanceMonitoringService`. Test files that re-declare these mocks create conflicts because Jest processes both the setup file mocks and the test file mocks, and the order depends on hoisting behavior.

## Components and Interfaces

### Component 1: Mock Setup Fix Pattern (6 files)

**Affected files:** `collaboration.test.js`, `auditLog.test.js`, `notification.test.js`, `rateLimit.test.js`, `e2e-moving-workflows.test.js`, `integration-system-validation.test.js`

**Root Cause Analysis:**

The primary issue across these files is the interaction between the global `setup.js` mocks and per-file mock declarations. The global setup mocks `cacheService` and `performanceMonitoringService` via `jest.mock()` in `setupFilesAfterEnv`. When test files also declare `jest.mock()` for these same modules, or when test files import modules that transitively depend on unmocked services, failures occur.

Specific patterns observed:

| File | Issue |
|------|-------|
| `collaboration.test.js` | Mocks DynamoDB and `dynamodb.hasInventoryAccess` + `auditLogService`, but `collaborationService` may depend on additional services not mocked |
| `auditLog.test.js` | Mocks DynamoDB correctly, but `auditLogService` uses `crypto` module for HMAC generation which interacts with the mock `constructor.name` pattern |
| `notification.test.js` | Mocks DynamoDB correctly, but `notificationService` may have transitive dependencies on timer-based services |
| `rateLimit.test.js` | Imports `withRateLimit` from middleware which depends on `rateLimitService`, `auditLogService`, and `securityLogger` — not all are mocked |
| `e2e-moving-workflows.test.js` | Re-declares `cacheService` and `performanceMonitoringService` mocks (conflicts with global setup), and has incomplete handler dependency mocking |
| `integration-system-validation.test.js` | Double-mocks `@aws-sdk/lib-dynamodb` (once bare, once with implementation), and imports SDK modules between mock declarations |

**Fix Pattern:**

```javascript
// 1. All jest.mock() calls at top level (Jest hoists these)
// 2. Do NOT re-mock modules already mocked in setup.js
// 3. Mock ALL transitive dependencies before require()
// 4. Use mockImplementation in beforeEach, not in jest.mock()

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn()
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend }))
  },
  PutCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'PutCommand' } })),
  // ... all commands used by the module under test
}));

// Mock transitive dependencies
jest.mock('../services/auditLogService');
jest.mock('../utils/securityLogger');

// NOW import modules under test
const serviceUnderTest = require('../services/someService');
```

**Decision Rationale:** Rather than modifying the global `setup.js` (which would risk breaking passing tests), each test file is fixed independently. This preserves the existing test infrastructure while resolving per-file issues.

### Component 2: PBT Generator Fix Pattern (2 files)

**Affected files:** `inventory.test.js`, `userManagement.test.js`

**Root Cause Analysis:**

The PBT tests use `fast-check` generators that can produce inputs triggering edge cases in the code under test:

| File | Property | Issue |
|------|----------|-------|
| `inventory.test.js` | Property 4 (Membership grant) | Uses `fc.pre(ownerId !== memberUserId)` with two independent `fc.uuid()` generators. UUID collision is extremely rare but `fc.pre()` adds overhead. The real issue is likely mock setup — `mockSend.mockReset()` inside the property body conflicts with `clearMocks: true` in jest config |
| `inventory.test.js` | Property 3 (Entity listing) | Uses `fc.pre(accessibleInventoryId !== inaccessibleInventoryId)` — same pattern |
| `inventory.test.js` | Property 6 (Write operations) | Complex mock setup inside property body with conditional logic based on `hasAccess` boolean |
| `userManagement.test.js` | Property 1 (Email lookup) | Uses `fc.emailAddress()` which can generate emails with unusual TLDs or characters that Cognito mock doesn't handle |
| `userManagement.test.js` | Property 3 (Invitation token) | Uses `fc.emailAddress()` — same issue |
| `userManagement.test.js` | Property 4 (User ID visibility) | Uses `fc.pre(authenticatedUserId !== targetUserId)` — same UUID collision concern |

**Fix Pattern:**

```javascript
// Instead of fc.pre() for UUID uniqueness, generate a pair:
fc.tuple(fc.uuid(), fc.uuid()).filter(([a, b]) => a !== b)

// Instead of unconstrained fc.emailAddress():
fc.emailAddress().filter(email => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email))

// Instead of mockSend.mockReset() inside property body (conflicts with clearMocks):
// Use mockSend.mockClear() to clear call history without resetting implementation
// Or set up mock implementation fresh each iteration
```

**Key Insight:** The `clearMocks`, `resetMocks`, and `restoreMocks` Jest config options run between test cases, not between PBT iterations. Inside a single PBT test, the mock state accumulates across all 100 runs. Each iteration must explicitly clear or reconfigure mocks.

**Decision Rationale:** Generator constraints are preferred over `fc.pre()` filters because they avoid retry budget exhaustion. Mock management inside PBT iterations uses `mockClear()` (not `mockReset()`) to preserve the mock implementation while clearing call history.

### Component 3: Integration Test Mock Sequencing (3 files)

**Affected files:** `e2e-moving-workflows.test.js`, `integration-system-validation.test.js`, `userManagementIntegration.test.js`

**Root Cause Analysis:**

Integration tests simulate multi-step workflows where `mockDocClient.send` is called many times in sequence. The tests use `mockResolvedValueOnce()` chains to provide responses in order. Issues arise when:

1. The actual call count differs from the expected sequence (a service makes an unexpected intermediate call)
2. Handler wrappers (`withCorsValidation`, `withRateLimit`) make additional calls not accounted for in the mock sequence
3. Middleware dependencies (`auth.authenticate`, `rateLimitService.checkRateLimit`) are not mocked, causing real DynamoDB calls that consume mock responses out of order

**Fix Pattern for `integration-system-validation.test.js`:**

The file has a critical issue: it calls `jest.mock('@aws-sdk/lib-dynamodb')` twice — once bare (line ~52) and once with implementation (line ~120). It also `require()`s SDK modules between the two mock declarations (line ~113), which means the first require gets the bare mock, not the implementation.

```javascript
// WRONG (current pattern):
jest.mock('@aws-sdk/lib-dynamodb');  // bare mock
// ... other mocks ...
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');  // gets bare mock
jest.mock('@aws-sdk/lib-dynamodb', () => ({ ... }));  // too late, already required

// CORRECT:
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => mockDocClient) },
  GetCommand: jest.fn(),
  // ... all commands
}));
// Remove the bare mock and the early require
```

**Fix Pattern for `e2e-moving-workflows.test.js`:**

The file re-declares `cacheService` and `performanceMonitoringService` mocks that are already in `setup.js`. These redundant declarations should be removed. The file also needs to ensure all handler dependencies are mocked since it imports service modules that are wrapped with middleware.

**Fix Pattern for `userManagementIntegration.test.js`:**

Uses a shared `mockSend` for both DynamoDB and Cognito operations. When a test makes both DynamoDB and Cognito calls, the mock responses must account for both call types in the correct interleaved order.

### Component 4: Auth Test Timeout Optimization

**Affected file:** `auth.test.js`

**Root Cause Analysis:**

The auth test has a critical import ordering bug: it `require()`s `verifyToken` and `authenticate` from `../middleware/auth` at line 3, BEFORE the `jest.mock()` calls for `auditLogService` and `jwks-rsa` at lines 6-7. Jest hoists `jest.mock()` calls, but the `require()` at line 3 is also at the top level and executes in source order after hoisting. However, the `middleware/auth.js` module creates a JWKS client at module load time, and if the mock isn't properly set up, this can cause issues.

Additionally, Property 27 generates JWT tokens with `jwt.sign()` using HS256 algorithm, but the actual `verifyToken` function expects RS256 (Cognito's algorithm). This mismatch means every iteration goes through the error path, which may involve async operations that slow down the test.

**Fix Pattern:**

```javascript
// 1. Move jest.mock() calls BEFORE require()
jest.mock('../services/auditLogService');
jest.mock('jwks-rsa');

// NOW import
const { verifyToken, authenticate } = require('../middleware/auth');

// 2. Reduce numRuns for the JWT signing property if needed (50 instead of 100)
//    JWT signing is CPU-intensive; 50 runs still provides good coverage

// 3. Ensure mockGetSigningKey resolves quickly (no unnecessary delays)
```

**Decision Rationale:** The import ordering fix is the primary change. If the test still exceeds 30 seconds after the ordering fix, reducing `numRuns` from 100 to 50 for the JWT-heavy property is acceptable since JWT signing is deterministic and 50 iterations still cover the claim validation logic thoroughly.

## Data Models

No data model changes are required. This feature modifies only test files and the Jest configuration. All DynamoDB table schemas, service interfaces, and handler contracts remain unchanged.

The mock data patterns used in tests follow the existing DynamoDB single-table design:

| Pattern | Example |
|---------|---------|
| Inventory record | `{ pk: 'INVENTORY#<id>', sk: 'METADATA', ... }` |
| Membership record | `{ pk: 'INVENTORY#<id>', sk: 'MEMBER#<userId>', role: '...', ... }` |
| Audit log record | `{ pk: 'AUDITLOG#<date>', sk: '<timestamp>#<uuid>', eventType: '...', hmac: '...', ... }` |
| Rate limit record | `{ pk: 'RATELIMIT#<userId>#<endpoint>', sk: '<windowStart>', count: N, ... }` |
| Notification record | `{ pk: 'USER#<userId>', sk: 'NOTIFICATION#<timestamp>#<id>', ... }` |

## Error Handling

### Test-Level Error Handling

Each fix must preserve the original test's error handling assertions:

1. **Mock failures** — If a mock is misconfigured, Jest reports the error with a stack trace pointing to the mock setup. The fix ensures mocks are configured before any module imports.

2. **PBT shrinking** — When a fast-check property fails, fast-check shrinks the failing input to the minimal counterexample. Generator constraints must not interfere with shrinking (use `.filter()` on generators rather than `fc.pre()` where possible, since `fc.pre()` can cause shrinking to fail).

3. **Timeout handling** — Tests that approach the 30-second timeout should be investigated for:
   - Unresolved promises (missing `await` or unclosed handles)
   - Expensive operations inside PBT loops (JWT signing, crypto operations)
   - Mock responses that don't resolve (missing `mockResolvedValue`)

### Regression Prevention

After all fixes are applied:
- Run the full test suite (`npm test`) to verify no regressions in previously-passing tests
- Verify `forceExit: true` in jest.config.js handles any remaining open handles
- Verify the global `setup.js` is unchanged (or changes are backward-compatible)

## Testing Strategy

### Why Property-Based Testing Does Not Apply Here

This feature is a test infrastructure recovery effort, not a feature with business logic that has universal properties. The acceptance criteria are:
- **Smoke tests**: "Run file X, verify zero failures" (criteria 1.1–1.6, 2.1–2.2, 3.1–3.2, 4.1, 5.1–5.3, 5.5, 6.6)
- **Example/structural checks**: "Verify mock ordering is correct" (criteria 1.7–1.9, 3.3–3.5, 4.2–4.5, 6.1–6.5)
- **Configuration checks**: "Verify jest.config.js is updated" (criteria 5.1, 5.4)

There are no pure functions with input/output behavior to test with PBT. The existing PBT tests in the skipped files are being *fixed*, not *created* — the properties are already defined in prior design documents.

### Test Execution Plan

**Phase 1: Diagnosis** — Run each skipped test individually to capture exact errors:
```bash
npx jest tests/collaboration.test.js --no-coverage 2>&1
npx jest tests/auditLog.test.js --no-coverage 2>&1
# ... repeat for all 10 files
```

**Phase 2: Fix and Verify** — Apply fixes per category, verify each file passes individually:
```bash
npx jest tests/<fixed-file>.test.js --no-coverage --verbose
```

**Phase 3: Integration** — Remove entries from `testPathIgnorePatterns` and run full suite:
```bash
cd backend && npm test
```

**Verification Criteria:**
- All 10 previously-skipped test files execute and pass
- All previously-passing test files continue to pass
- Full suite completes within 120 seconds
- No new dependencies added to `package.json`
- PBT tests maintain their original `numRuns` values (50 or 100)
- `setup.js` remains compatible with all tests

### Fix Priority Order

1. **auth.test.js** — Import ordering fix (highest confidence, isolated change)
2. **auditLog.test.js**, **notification.test.js**, **collaboration.test.js** — Mock setup fixes (similar pattern)
3. **rateLimit.test.js** — Mock setup + missing dependency mocks
4. **inventory.test.js**, **userManagement.test.js** — PBT generator fixes
5. **e2e-moving-workflows.test.js** — Remove redundant mocks, fix sequencing
6. **integration-system-validation.test.js** — Fix double-mock, fix sequencing
7. **userManagementIntegration.test.js** — Fix mock setup + sequencing
8. **jest.config.js** — Remove all 10 entries from `testPathIgnorePatterns`
