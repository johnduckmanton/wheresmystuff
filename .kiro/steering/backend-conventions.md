---
inclusion: fileMatch
fileMatchPattern: "backend/**"
---

# Backend Conventions

## Language & Runtime
- Node.js 20.x, CommonJS (`require`/`module.exports`)
- No TypeScript in backend — plain JavaScript with JSDoc comments

## Handler Pattern
Each handler file in `backend/handlers/` exports a single Lambda handler function wrapped with middleware:

```js
const handler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  // 1. Authenticate
  await authenticate(event);
  // 2. Route by HTTP method and path
  const httpMethod = event.requestContext.http.method;
  // 3. Delegate to internal handle* functions
  // 4. Return response using success() or error() from utils/response.js
};

module.exports.handler = withCorsValidation(withRateLimit(handler));
```

Key conventions:
- Extract `origin` from headers for CORS responses
- Build a `context` object with endpoint, method, userId, IP, userAgent for audit logging
- Use `authenticate(event)` from `middleware/auth.js` — it attaches `event.user`
- Use `authorizeInventoryAccess(event.user.userId, inventoryId)` for resource authorization
- Route internally using `switch` on `httpMethod` and path segments
- Parse body with `JSON.parse(event.body)` — always check for null body first

## Response Utilities (`backend/utils/response.js`)
- `success(data, statusCode, origin)` — wraps data in `{ success: true, data }`
- `error(message, statusCode, origin)` — wraps in `{ success: false, error }` (legacy)
- `secureError(errorObj, context, origin)` — preferred for new code, uses error handler with request IDs
- All responses include CORS + security headers via `getAllHeaders(origin)`

## Error Handling (`backend/utils/errorHandler.js`)
- Use `handleError(error, context)` as the main error router
- Error types: AUTHENTICATION, AUTHORIZATION, VALIDATION, NOT_FOUND, RATE_LIMIT, SERVER, DATABASE
- Client responses use generic messages — never expose stack traces, table names, or query details
- Server-side logging includes full error details via `logDetailedError()`
- Validation errors use `createValidationErrorResponse(errors)` which sanitizes internal references

## Error Handling Convention: error() vs secureError()

**`error(message, statusCode, origin)`** — Use for intentional responses where YOU control the message:
- Input validation failures (400)
- Resource not found (404)
- Access denied (403)
- Method not allowed (405)
- Any case where the message is a string literal you wrote

**`secureError(errorObj, context, origin)`** — Use for unexpected errors in catch blocks:
- Any catch block where `err.message` may contain internal details
- Database errors, service failures, unhandled exceptions
- Never pass `err.message` to `error()` in a catch block

**Pattern for inner handle* functions:**
```js
async function handleCreate(event, origin) {
  try {
    // validation — use error() with safe messages
    if (!body.name) {
      return error('Name is required', 400, origin);
    }
    // business logic...
    return success(result, 201, origin);
  } catch (err) {
    // Known error conditions — use error() with safe messages
    if (err.message === 'Entity not found') {
      return error('Resource not found', 404, origin);
    }
    if (err.statusCode === 403) {
      return error('Access denied', 403, origin);
    }
    // Unexpected errors — throw to outer secureError
    throw err;
  }
}
```

## Input Validation (`backend/utils/validation.js` + `backend/utils/schemas.js`)
- Validate required fields with `validateRequired(data, fields)`
- Validate UUIDs with `validateUUID(id)`
- Sanitize all string inputs with `sanitizeInput(str)` — HTML entity encoding
- Use `validateAndSanitize(data, schema)` for schema-based validation
- Schema definitions live in `backend/utils/schemas.js` with regex patterns for UUIDs

## Service Layer (`backend/services/`)
- Services contain business logic, handlers handle HTTP concerns
- Services interact with DynamoDB via `backend/services/dynamodb.js`
- Use `uuid` package (v9) for generating IDs
- Always include `createdAt`/`updatedAt` timestamps on records

## Middleware Stack
Applied as wrapper functions (outermost runs first):
1. `withCorsValidation` — validates request origin against ALLOWED_ORIGINS
2. `withRateLimit` — per-user, per-endpoint rate limiting via DynamoDB with TTL
3. `authenticate` — JWT verification against Cognito JWKS, attaches `event.user`

## Testing (Jest)
- Config: `backend/jest.config.js`
- Test files: `backend/tests/*.test.js`
- Setup: `backend/tests/setup.js` — mocks console, timers, cacheService, performanceMonitoringService
- Timeout: 30s (for property-based tests)
- Property-based testing: `fast-check` v4
- Run: `npm test` (in backend directory)
- Mocks: `clearMocks`, `resetMocks`, `restoreMocks` all enabled

## Dependencies
- AWS SDK v3 clients: DynamoDB, S3, Cognito, SES, CloudWatch
- `jsonwebtoken` + `jwks-rsa` for JWT verification
- `qrcode` for QR generation
- `sharp` for image processing
- `uuid` for ID generation

## Environment Variables
Key variables set via SAM template:
- `TABLE_NAME`, `BUCKET_NAME`, `QR_REPORT_BUCKET_NAME`
- `USER_POOL_ID`, `USER_POOL_CLIENT_ID`
- `ALLOWED_ORIGINS`, `NODE_ENV`, `SECURITY_LEVEL`
