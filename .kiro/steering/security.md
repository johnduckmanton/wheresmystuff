---
inclusion: fileMatch
fileMatchPattern: "backend/middleware/**,backend/utils/errorHandler.*,backend/utils/securityLogger.*,backend/services/auditLogService.*"
---

# Security Conventions

## Error Responses
- Never expose stack traces, table names, query details, or internal paths to clients
- Use `secureError(errorObj, context, origin)` for new error responses (not the legacy `error()`)
- Error handler maps errors to generic client messages via `GENERIC_ERROR_MESSAGES`
- Every error response includes a `requestId` (UUID) for correlation with server logs
- Validation errors are sanitized to strip internal schema references, field names, and method names

## Authentication
- JWT tokens verified against Cognito JWKS endpoint
- `authenticate(event)` middleware attaches `event.user` with userId, email, groups
- Token validation: RS256 algorithm, issuer check, 30s clock tolerance
- JWKS client cached with 10-minute TTL and rate limiting (10 req/min)

## Authorization
- `authorizeInventoryAccess(userId, inventoryId)` checks membership before data access
- Roles: owner, administrator, member, read_only — with granular permissions
- Authorization failures logged to audit system

## Input Handling
- All string inputs sanitized with `sanitizeInput()` (HTML entity encoding)
- UUIDs validated with regex pattern before use in queries
- Request body parsed with null check: `event.body ? JSON.parse(event.body) : null`
- Schema-based validation via `validateAndSanitize(data, schema)`

## Audit Logging
- All operations logged with: userId, IP, userAgent, action, resource, success/failure
- Auth failures and authz failures get dedicated audit log entries
- Audit log integrity protected with HMAC signatures
- Logs partitioned by date in DynamoDB with optional TTL for retention

## Rate Limiting
- Per-user, per-endpoint rate limiting stored in DynamoDB
- Rate limit records use TTL for automatic cleanup
- Configurable windows and limits per endpoint

## CORS
- Origin validated against `ALLOWED_ORIGINS` environment variable
- `withCorsValidation` middleware wraps all handlers
- Security headers (CSP, HSTS, X-Frame-Options) added to all responses via `getSecurityHeaders()`

## Sensitive Data in Logs
- `sanitizeRequestData()` redacts fields containing: password, token, authorization, secret, key, credential, auth, session, cookie
- Never log raw JWT tokens or user credentials
