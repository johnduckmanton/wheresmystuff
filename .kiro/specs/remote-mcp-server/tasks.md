# Implementation Plan: Remote MCP Server

## Overview

Convert the existing local stdio-based WheresMyStuff MCP server into a serverless remote MCP server using AWS Lambda, API Gateway HTTP API, and DynamoDB. All new code resides in `src/remote/` while existing tool handlers remain unchanged. Implementation follows bottom-up order: infrastructure → config → core components → OAuth → security → MCP handler → Lambda handler → logging → tests → build config.

## Tasks

- [x] 1. Infrastructure and project setup
  - [x] 1.1 Create SAM template with DynamoDB table and Lambda function
    - Create `mcp-server/template.yaml` defining the `AWS::Serverless::HttpApi`, `McpFunction` Lambda (Node.js 22.x, 256MB, 30s timeout), and `SessionsTable` DynamoDB table (PAY_PER_REQUEST, pk/sk keys, TTL on `ttl` attribute, SSE enabled)
    - Define all route events: POST /mcp, DELETE /mcp, GET /health, GET /.well-known/oauth-authorization-server, GET /authorize, GET /callback, POST /token
    - Include Parameters for ApiUrl, UserPoolId, ClientId, CognitoDomain, TokenSigningSecret
    - Set Globals environment variables referencing the table and parameters
    - Add DynamoDBCrudPolicy for the Lambda function
    - Output the MCP endpoint URL
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7_

  - [x] 1.2 Update package.json with Lambda runtime dependencies and build scripts
    - Add runtime dependencies: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `jose`
    - Add dev dependencies: `aws-sdk-client-mock`, `@types/aws-lambda`
    - Add build script that compiles TypeScript for Lambda deployment (output to `dist/`)
    - Ensure `sam build` integration works with the TypeScript compilation output
    - _Requirements: 10.1_

  - [x] 1.3 Create `src/remote/` directory structure
    - Create the `src/remote/` directory with placeholder files for all modules
    - _Requirements: 6.1_

- [x] 2. Configuration module
  - [x] 2.1 Implement remote config loader (`src/remote/remote-config.ts`)
    - Define `RemoteServerConfig` interface with all environment variable mappings
    - Implement `loadRemoteConfig()` function that reads and validates all required env vars
    - Throw descriptive error identifying missing variables if any required var is missing or empty
    - Parse optional variables with defaults: SESSION_TIMEOUT_MS (1800000), MAX_SESSIONS (1000), RATE_LIMIT_PER_MINUTE (100), MAX_PAYLOAD_BYTES (1048576)
    - Parse ALLOWED_ORIGINS as comma-separated list
    - _Requirements: 2.6, 2.7, 2.8, 2.9, 2.10_

  - [ ]* 2.2 Write property test for missing environment variable detection
    - **Property 16: Missing environment variable detection**
    - Generate random subsets of missing required vars, verify `loadRemoteConfig()` throws identifying the missing variables
    - **Validates: Requirements 2.10**

- [x] 3. Core components
  - [x] 3.1 Implement JWKS cache (`src/remote/jwks-cache.ts`)
    - Create `JwksCache` class using `jose` library's `createRemoteJWKSet`
    - Build JWKS URL from userPoolId and region: `https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json`
    - Cache the JWKS verifier in a module-level variable for reuse across warm Lambda invocations
    - Implement `validateCognitoToken(token)` method that verifies signature, audience, issuer, and expiration
    - _Requirements: 3.10, 10.6_

  - [ ]* 3.2 Write property test for JWKS caching across warm invocations
    - **Property 18: JWKS caching across warm invocations**
    - Simulate multiple invocations within one execution environment, verify JWKS endpoint fetched at most once
    - **Validates: Requirements 10.6**

  - [x] 3.3 Implement JWT validator (`src/remote/jwt-validator.ts`)
    - Create `JwtValidator` class with HS256 signing using `jose`
    - Implement `signToken(payload)` that creates a server-issued JWT with `iat` and `exp` claims
    - Implement `validateToken(token)` that verifies signature, checks expiration, returns decoded payload or null
    - Define `JwtPayload` interface with sub, email, cognitoAccessToken, cognitoRefreshToken, cognitoTokenExpiresAt
    - _Requirements: 3.5, 3.6, 3.7, 3.8_

  - [ ]* 3.4 Write property test for authentication enforcement
    - **Property 4: Authentication enforcement**
    - Generate valid and invalid JWTs (expired, wrong secret, malformed, missing), verify correct accept/reject behavior
    - **Validates: Requirements 3.2, 3.7, 3.8, 3.10**

  - [x] 3.5 Implement session store (`src/remote/session-store.ts`)
    - Create `SessionStore` class using `@aws-sdk/lib-dynamodb` DocumentClient
    - Implement `getSession(sessionId)` — GetCommand with pk=sessionId, sk=SESSION; return null if not found
    - Implement `createSession(session)` — PutCommand with full SessionRecord
    - Implement `touchSession(sessionId, timeoutMs)` — UpdateCommand for lastActivityAt and ttl
    - Implement `updateTokens(sessionId, accessToken, expiresAt)` — UpdateCommand
    - Implement `updateNameCache(sessionId, cache)` — UpdateCommand for nameCache field
    - Implement `updateRateLimit(sessionId, timestamps)` — UpdateCommand for requestTimestamps
    - Implement `deleteSession(sessionId)` — DeleteCommand
    - Implement `countActiveSessions()` — Scan with filter sk=SESSION (acceptable at low scale)
    - Define `SessionRecord` and `SerializedNameCache` interfaces
    - Generate session IDs using `crypto.randomBytes(32).toString('hex')` (64 hex chars)
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 10.2, 10.4_

  - [ ]* 3.6 Write property test for session ID format and uniqueness
    - **Property 2: Session ID format and uniqueness**
    - Generate many sessions, verify all IDs are exactly 64 hex characters and unique
    - **Validates: Requirements 1.4, 5.1, 8.5**

  - [ ]* 3.7 Write property test for session TTL management
    - **Property 13: Session TTL management**
    - Generate session operations at various timestamps, verify TTL is correctly calculated as `Math.floor((lastActivityAt + sessionTimeoutMs) / 1000)`
    - **Validates: Requirements 5.2, 5.5, 10.4**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. OAuth proxy
  - [x] 5.1 Implement OAuth proxy (`src/remote/oauth-proxy.ts`)
    - Implement `handleOAuthMetadata(config)` returning issuer, authorization_endpoint, token_endpoint, supported grant types and response types
    - Implement `handleAuthorize(event, config)` — generate cryptographically secure state, store pending auth state in DynamoDB (pk=OAUTH#{state}, sk=OAUTH_STATE, 10-min TTL), redirect to Cognito Hosted UI
    - Implement `handleCallback(event, config)` — retrieve pending auth state from DDB, exchange Cognito authorization code for tokens via POST to Cognito token endpoint, generate server authorization code, store code→tokens mapping (pk=CODE#{code}, sk=AUTH_CODE, 5-min TTL), redirect to client callback with server code
    - Implement `handleTokenExchange(event, config)` — retrieve code from DDB, create JwtValidator, sign server-issued JWT embedding Cognito tokens, return JWT to client
    - All DynamoDB records for OAuth use short TTLs for automatic cleanup
    - Use `crypto.randomBytes(32)` for state parameters and authorization codes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.5_

  - [ ]* 5.2 Write unit tests for OAuth proxy
    - Test metadata endpoint returns correct JSON structure
    - Test authorize generates valid redirect URL with state parameter
    - Test callback exchanges code and stores auth code in DDB
    - Test token exchange returns valid JWT
    - Test expired/invalid state returns appropriate errors
    - Use aws-sdk-client-mock for DynamoDB, nock for Cognito token endpoint
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6_

- [x] 6. Security middleware
  - [x] 6.1 Implement security middleware (`src/remote/security-middleware.ts`)
    - Implement `validateSecurity(event, config)` checking origin header and payload size
    - Origin validation: if `allowedOrigins` is non-empty, verify Origin header is in list; return 403 if not
    - Payload size: if body length exceeds `maxPayloadBytes`, return 413
    - Implement `checkRateLimit(session, maxPerMinute)` using sliding window on `requestTimestamps`
    - Filter timestamps older than 60 seconds, check count against limit, return boolean
    - _Requirements: 8.2, 8.3, 8.6, 8.7_

  - [ ]* 6.2 Write property test for origin validation
    - **Property 7: Origin validation**
    - Generate random origin headers and allowlists, verify correct accept/reject behavior
    - **Validates: Requirements 8.2, 8.7**

  - [ ]* 6.3 Write property test for per-session rate limiting
    - **Property 8: Per-session rate limiting**
    - Generate request sequences of varying lengths within 60-second windows, verify rate limit boundary is enforced correctly
    - **Validates: Requirements 8.3**

  - [ ]* 6.4 Write property test for payload size enforcement
    - **Property 9: Payload size enforcement**
    - Generate payloads of varying sizes around the configured boundary, verify correct accept/reject
    - **Validates: Requirements 8.6**

- [x] 7. MCP handler
  - [x] 7.1 Implement MCP handler (`src/remote/mcp-handler.ts`)
    - Implement `handleMcpPost(event, config, jwksCache)` as the core MCP protocol handler
    - Extract and validate Bearer token using JwtValidator
    - Return 401 with `WWW-Authenticate` header if token missing/invalid
    - Parse JSON-RPC body; return -32700 for invalid JSON, -32600 for invalid JSON-RPC structure
    - Handle `initialize` method: check max sessions (503 if at capacity), generate session ID, resolve inventory ID from Backend API, store session in DynamoDB, return MCP init response with `Mcp-Session-Id` header
    - Handle `tools/list` method: return all 13 tool definitions (imported from existing tool modules)
    - Handle `tools/call` method: load session from DDB, construct per-request `ApiClient` and `NameResolver` from session state, execute tool handler, persist name cache updates back to DDB
    - Handle `DELETE /mcp`: validate token, delete session from DDB, return 200
    - Implement token refresh logic: if Backend API returns 401, refresh Cognito token, update DDB session, retry
    - Map Backend API errors to appropriate MCP error responses (403, 404, 429, 5xx)
    - Return -32601 for unknown methods
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7, 1.8, 4.1, 4.2, 4.3, 4.5, 4.6, 5.4, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 7.2 Write property test for session isolation
    - **Property 1: Session isolation**
    - Generate multiple sessions with different user data, execute tool calls on each, verify no cross-contamination of tokens or inventory IDs
    - **Validates: Requirements 1.5, 2.3, 4.3, 4.4**

  - [ ]* 7.3 Write property test for invalid session ID rejection
    - **Property 3: Invalid session ID rejection**
    - Generate random strings that are not active session IDs, verify all get HTTP 404
    - **Validates: Requirements 1.6**

  - [ ]* 7.4 Write property test for JSON-RPC response validity
    - **Property 5: JSON-RPC response validity**
    - Generate valid JSON-RPC requests with various tool names and params, verify response is always valid JSON-RPC 2.0 with matching id
    - **Validates: Requirements 1.2**

  - [ ]* 7.5 Write property test for malformed request error codes
    - **Property 6: Malformed request error codes**
    - Generate invalid JSON (for -32700) and valid JSON violating JSON-RPC schema (for -32600), verify correct error codes
    - **Validates: Requirements 7.6**

  - [ ]* 7.6 Write property test for maximum sessions enforcement
    - **Property 14: Maximum sessions enforcement**
    - Generate session creation attempts at capacity, verify HTTP 503 is returned
    - **Validates: Requirements 5.4**

  - [ ]* 7.7 Write property test for tool handler equivalence
    - **Property 15: Tool handler equivalence**
    - Generate random tool calls with mocked API responses, verify output matches what the local server would produce
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

  - [ ]* 7.8 Write property test for Backend 5xx retry behavior
    - **Property 12: Backend 5xx retry behavior**
    - Generate failing backend responses (5xx, network errors), verify exactly 3 total attempts with delays before returning error
    - **Validates: Requirements 7.5**

  - [ ]* 7.9 Write property test for token refresh on Backend 401
    - **Property 20: Token refresh on Backend 401**
    - Generate 401 scenarios, verify refresh + retry + DynamoDB update sequence
    - **Validates: Requirements 4.5**

  - [ ]* 7.10 Write property test for name cache persistence in DynamoDB
    - **Property 19: Name cache persistence in DynamoDB**
    - Generate sessions with/without cache, verify cache stored on first use and loaded from DDB on subsequent invocations
    - **Validates: Requirements 10.8**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Lambda handler and request logger
  - [x] 9.1 Implement request logger (`src/remote/request-logger.ts`)
    - Implement `logRequest(event, statusCode, durationMs)` writing structured JSON to stdout
    - Include: timestamp (ISO 8601), method, path, sessionId (from header if present), statusCode, durationMs, requestId (Lambda context)
    - Implement `logSessionEvent(eventType, sessionId, userId)` for lifecycle events
    - Implement `logError(error, event?)` that logs stack traces but NEVER logs tokens or request bodies
    - _Requirements: 2.5, 9.1, 9.2, 9.4, 8.4_

  - [ ]* 9.2 Write property test for structured request logging
    - **Property 17: Structured request logging**
    - Generate random requests, verify log entries have all required fields and no sensitive data (tokens, bodies)
    - **Validates: Requirements 2.5, 9.1**

  - [ ]* 9.3 Write property test for no sensitive data leakage
    - **Property 11: No sensitive data leakage**
    - Generate error scenarios with tokens embedded in context, verify tokens never appear in error output or logs
    - **Validates: Requirements 7.7, 8.4**

  - [x] 9.4 Implement Lambda handler (`src/remote/lambda-handler.ts`)
    - Export `handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2>`
    - Initialize config and JWKS cache as module-level singletons on cold start
    - Parse route (method + path) from API Gateway event
    - Apply security middleware (origin, payload size) before routing
    - Route to: health, OAuth metadata, authorize, callback, token, MCP POST, MCP DELETE
    - Return 404 for unmatched routes
    - Add security headers to ALL responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Cache-Control: no-store`
    - Catch unhandled exceptions, log error, return generic 500
    - Call `logRequest()` for every response
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.4, 8.8, 9.4_

  - [ ]* 9.5 Write property test for security headers presence
    - **Property 10: Security headers presence**
    - Generate requests to various endpoints, verify all responses include required security headers
    - **Validates: Requirements 8.8**

  - [ ]* 9.6 Write unit tests for Lambda handler routing
    - Test correct routing for all paths/methods
    - Test 404 for unknown routes
    - Test health endpoint returns `{"status": "ok"}`
    - Test security headers present on all responses
    - Test graceful error handling for unhandled exceptions
    - Use aws-sdk-client-mock for DynamoDB
    - _Requirements: 2.1, 2.2, 8.8_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Build configuration and documentation
  - [x] 11.1 Configure TypeScript compilation for Lambda deployment
    - Update or create `tsconfig.json` entries for the `src/remote/` code targeting Node.js 22
    - Ensure `dist/remote/lambda-handler.js` is the compiled entry point matching the SAM template Handler path
    - Verify `sam build` can compile and package the Lambda correctly
    - _Requirements: 10.1_

  - [x] 11.2 Create samconfig.toml with deployment defaults
    - Configure default stack name, region, S3 bucket preferences
    - Set parameter overrides pointing to the correct Cognito and API resources
    - _Requirements: 10.1_

  - [x] 11.3 Update README with remote server setup and client configuration
    - Document environment variable requirements
    - Document SAM deployment steps (`sam build`, `sam deploy --guided`)
    - Document Claude Desktop client configuration JSON pointing to the API Gateway URL
    - Document the OAuth flow from a user's perspective
    - _Requirements: 1.1, 10.1_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1-20)
- Unit tests validate specific examples and edge cases
- All new code goes in `src/remote/` — existing tool handlers, server.ts, api-client.ts, name-resolver.ts, and formatters.ts are unchanged
- The Lambda handler directly processes API Gateway v2 events (no Express framework)
- DynamoDB mocking uses `aws-sdk-client-mock` for all tests interacting with the session store
- JWKS caching uses module-level variables that survive across warm Lambda invocations

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "3.3", "3.5"] },
    { "id": 3, "tasks": ["3.2", "3.4", "3.6", "3.7"] },
    { "id": 4, "tasks": ["5.1", "6.1"] },
    { "id": 5, "tasks": ["5.2", "6.2", "6.3", "6.4"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9", "7.10"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3", "9.4"] },
    { "id": 10, "tasks": ["9.5", "9.6"] },
    { "id": 11, "tasks": ["11.1", "11.2", "11.3"] }
  ]
}
```
