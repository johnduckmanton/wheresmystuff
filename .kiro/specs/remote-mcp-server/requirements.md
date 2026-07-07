# Requirements Document

## Introduction

Convert the existing local stdio-based WheresMyStuff MCP inventory server into a remote/hosted MCP server using Streamable HTTP transport. The remote server allows multiple users to connect from Claude Desktop (or other MCP clients) by simply configuring a URL, without running any server locally. The server handles per-user OAuth authentication via Cognito, supports multi-tenancy (each user operates on their own inventory), and reuses the existing tool handlers for inventory operations.

## Glossary

- **Remote_MCP_Server**: The hosted web service that exposes WheresMyStuff inventory operations as MCP tools over Streamable HTTP transport
- **Streamable_HTTP_Transport**: The MCP SDK transport layer that uses HTTP POST for client-to-server messages and Server-Sent Events (SSE) for server-to-client streaming, replacing stdio transport
- **MCP_Client**: Any MCP-compatible application that connects to the Remote_MCP_Server via HTTP (e.g., Claude Desktop, Kiro)
- **Session**: A stateful connection between an MCP_Client and the Remote_MCP_Server, identified by a session ID and associated with a single authenticated user
- **OAuth_Provider**: The MCP protocol-level OAuth authentication mechanism that Remote_MCP_Server implements to authenticate users via Cognito before granting tool access
- **Cognito_User_Pool**: The existing AWS Cognito User Pool that stores user credentials and issues JWTs for the WheresMyStuff application
- **Backend_API**: The existing WheresMyStuff REST API (Lambda + API Gateway) that the Remote_MCP_Server communicates with on behalf of authenticated users
- **Inventory_ID**: A unique identifier for a user's inventory collection; resolved per-user from their Cognito identity rather than a static environment variable
- **Tool_Handler**: A function that processes an MCP tool invocation (e.g., search_things, create_thing) by making authenticated requests to the Backend_API
- **Health_Endpoint**: An HTTP GET endpoint that returns server status for load balancer health checks
- **Session_Store**: A server-side storage mechanism that maps session IDs to user authentication state and inventory context

## Requirements

### Requirement 1: Streamable HTTP Transport

**User Story:** As an MCP client user, I want to connect to the WheresMyStuff MCP server by configuring a URL, so that I can access my inventory without running a local server process.

#### Acceptance Criteria

1. THE Remote_MCP_Server SHALL implement the MCP Streamable HTTP transport, accepting HTTP POST requests at a configurable endpoint path (default `/mcp`)
2. WHEN an MCP_Client sends a JSON-RPC request via HTTP POST to the `/mcp` endpoint, THE Remote_MCP_Server SHALL process the request and return the JSON-RPC response in the HTTP response body
3. THE Remote_MCP_Server SHALL support Server-Sent Events (SSE) streaming for responses when the MCP_Client sends an `Accept: text/event-stream` header
4. WHEN the Remote_MCP_Server receives an `initialize` request, THE Remote_MCP_Server SHALL create a new Session and return a unique session ID in the `Mcp-Session-Id` response header
5. WHEN the MCP_Client includes an `Mcp-Session-Id` header in subsequent requests, THE Remote_MCP_Server SHALL associate the request with the corresponding Session
6. IF the MCP_Client sends a request with an invalid or expired session ID, THEN THE Remote_MCP_Server SHALL return HTTP 404 indicating the session is not found
7. WHEN the MCP_Client sends an HTTP DELETE request to the `/mcp` endpoint with a valid session ID, THE Remote_MCP_Server SHALL terminate the Session and release associated resources
8. THE Remote_MCP_Server SHALL expose the same server name ("wheresmystuff") and version string as the existing local MCP server in its initialization response

### Requirement 2: HTTP Server and Hosting

**User Story:** As a platform operator, I want the remote MCP server to run as a production web service, so that it can serve multiple concurrent users reliably.

#### Acceptance Criteria

1. THE Remote_MCP_Server SHALL run as an HTTP server listening on a configurable port (default 3000) read from the `PORT` environment variable
2. THE Remote_MCP_Server SHALL expose a `GET /health` endpoint that returns HTTP 200 with a JSON body containing `{"status": "ok"}` for load balancer health checks
3. WHEN multiple MCP_Clients connect concurrently, THE Remote_MCP_Server SHALL handle each Session independently without interference between sessions
4. THE Remote_MCP_Server SHALL support graceful shutdown by finishing in-progress requests before stopping when it receives a SIGTERM signal
5. THE Remote_MCP_Server SHALL log all requests to stdout in structured JSON format including timestamp, method, path, session ID (if present), response status, and duration in milliseconds
6. THE Remote_MCP_Server SHALL read the Backend_API base URL from the `WHERESMYSTUFF_API_URL` environment variable
7. THE Remote_MCP_Server SHALL read the Cognito User Pool ID from the `WHERESMYSTUFF_USER_POOL_ID` environment variable
8. THE Remote_MCP_Server SHALL read the Cognito app client ID from the `WHERESMYSTUFF_CLIENT_ID` environment variable
9. THE Remote_MCP_Server SHALL read the AWS region from the `WHERESMYSTUFF_REGION` environment variable
10. IF any of the required environment variables (`WHERESMYSTUFF_API_URL`, `WHERESMYSTUFF_USER_POOL_ID`, `WHERESMYSTUFF_CLIENT_ID`, `WHERESMYSTUFF_REGION`) is not set or is empty, THEN THE Remote_MCP_Server SHALL log an error identifying the missing variable and exit with a non-zero status code

### Requirement 3: Per-User OAuth Authentication

**User Story:** As a WheresMyStuff user, I want to authenticate with my existing Cognito credentials when connecting to the remote MCP server, so that only I can access my inventory data.

#### Acceptance Criteria

1. THE Remote_MCP_Server SHALL implement the MCP OAuth authentication flow as defined by the MCP specification, acting as an OAuth authorization server that delegates to Cognito
2. WHEN an unauthenticated MCP_Client sends a request to the `/mcp` endpoint, THE Remote_MCP_Server SHALL return HTTP 401 with a `WWW-Authenticate` header containing the OAuth metadata URL
3. THE Remote_MCP_Server SHALL expose an OAuth metadata endpoint at `/.well-known/oauth-authorization-server` that returns the authorization endpoint URL, token endpoint URL, and supported grant types
4. THE Remote_MCP_Server SHALL expose an authorization endpoint that redirects the user's browser to the Cognito Hosted UI for login (including MFA if configured)
5. WHEN Cognito redirects back to the Remote_MCP_Server's callback endpoint with an authorization code, THE Remote_MCP_Server SHALL exchange the code for Cognito tokens and issue its own access token to the MCP_Client
6. THE Remote_MCP_Server SHALL expose a token endpoint that the MCP_Client uses to exchange the authorization code for an access token
7. WHEN the MCP_Client includes a valid access token in the `Authorization: Bearer <token>` header, THE Remote_MCP_Server SHALL authenticate the request and associate it with the corresponding user's Session
8. IF the access token is missing, expired, or invalid, THEN THE Remote_MCP_Server SHALL return HTTP 401
9. THE Remote_MCP_Server SHALL support token refresh so that long-lived MCP sessions do not require re-authentication within the Cognito refresh token lifetime (approximately 30 days)
10. THE Remote_MCP_Server SHALL validate Cognito JWT tokens by verifying the signature against the Cognito JWKS endpoint, checking the token audience matches the configured client ID, and verifying the token has not expired

### Requirement 4: Multi-Tenancy and Per-User Inventory Resolution

**User Story:** As a WheresMyStuff user, I want the remote server to automatically use my inventory, so that I see only my own items without any manual inventory ID configuration.

#### Acceptance Criteria

1. WHEN a user authenticates successfully, THE Remote_MCP_Server SHALL resolve the user's inventory ID by querying the Backend_API using the user's Cognito access token
2. THE Remote_MCP_Server SHALL store the resolved inventory ID in the user's Session so that all subsequent tool invocations use the correct inventory
3. WHEN a Tool_Handler executes on behalf of a user, THE Remote_MCP_Server SHALL pass the user's Cognito access token in the Authorization header of requests to the Backend_API
4. THE Remote_MCP_Server SHALL isolate each user's Session data (tokens, inventory ID, name resolution cache) so that one user's data is never accessible to another user's Session
5. IF the Backend_API returns HTTP 401 for a user's request, THEN THE Remote_MCP_Server SHALL attempt to refresh the user's Cognito access token using their refresh token before retrying the request
6. IF the user's refresh token has expired and cannot be used to obtain a new access token, THEN THE Remote_MCP_Server SHALL return an MCP error indicating re-authentication is required

### Requirement 5: Session Management

**User Story:** As a platform operator, I want sessions to be managed with proper lifecycle and cleanup, so that server resources are not leaked.

#### Acceptance Criteria

1. WHEN a new Session is created, THE Session_Store SHALL assign a cryptographically random session ID (minimum 32 bytes, hex-encoded)
2. THE Remote_MCP_Server SHALL expire inactive sessions after a configurable timeout (default 30 minutes of no requests), releasing all associated resources
3. WHEN a Session expires or is explicitly terminated, THE Remote_MCP_Server SHALL remove the session's authentication tokens, inventory ID, and name resolution cache from the Session_Store
4. THE Remote_MCP_Server SHALL enforce a maximum number of concurrent sessions (configurable, default 1000), and IF the limit is reached, THEN THE Remote_MCP_Server SHALL return HTTP 503 for new session requests
5. WHEN a Session is active, THE Remote_MCP_Server SHALL refresh the session's inactivity timer on each request associated with that session

### Requirement 6: Tool Handler Reuse

**User Story:** As a developer, I want the remote server to reuse the existing tool handlers, so that inventory operations behave identically whether accessed locally or remotely.

#### Acceptance Criteria

1. THE Remote_MCP_Server SHALL register the same set of MCP tools as the existing local MCP server: search_things, get_things_in_location, create_thing, update_thing, move_thing, delete_thing, list_locations, list_rooms, list_categories, get_things_by_category, list_containers, get_container_contents, and find_thing_container
2. THE Remote_MCP_Server SHALL use the same tool definitions (names, descriptions, and input schemas) as the existing local MCP server
3. WHEN a tool is invoked, THE Remote_MCP_Server SHALL execute the same handler logic as the existing local server, using a per-session ApiClient configured with the user's authentication tokens and inventory ID
4. THE Remote_MCP_Server SHALL use the same name resolution logic (case-insensitive matching followed by substring matching, capped at 10 candidates) as the existing local server, with the name resolution cache scoped per-session

### Requirement 7: Error Handling

**User Story:** As a user, I want clear error messages when something goes wrong with the remote server, so that I understand whether the issue is authentication, server-side, or with my request.

#### Acceptance Criteria

1. IF the Backend_API returns HTTP 401 and token refresh fails, THEN THE Remote_MCP_Server SHALL return an MCP error response with a message indicating re-authentication is required
2. IF the Backend_API returns HTTP 403, THEN THE Remote_MCP_Server SHALL return an MCP error response indicating access is denied
3. IF the Backend_API returns HTTP 404, THEN THE Remote_MCP_Server SHALL return an MCP error response indicating the resource was not found
4. IF the Backend_API returns HTTP 429, THEN THE Remote_MCP_Server SHALL return an MCP error response indicating rate limiting and include retry guidance
5. IF the Backend_API is unreachable or returns HTTP 5xx, THEN THE Remote_MCP_Server SHALL retry up to 2 additional times with a 2-second delay before returning an error indicating a server communication problem
6. IF an MCP_Client sends a malformed JSON-RPC request, THEN THE Remote_MCP_Server SHALL return a JSON-RPC error response with code -32700 (Parse error) or -32600 (Invalid Request)
7. THE Remote_MCP_Server SHALL NOT include sensitive information (access tokens, internal stack traces, response bodies from the Backend_API) in error messages returned to MCP_Clients

### Requirement 8: Security

**User Story:** As a platform operator, I want the remote server to follow security best practices, so that user data is protected and the system is resilient to common attacks.

#### Acceptance Criteria

1. THE Remote_MCP_Server SHALL accept connections only over HTTPS in production (TLS termination may occur at a load balancer or reverse proxy)
2. THE Remote_MCP_Server SHALL validate the `Origin` header on requests and reject requests from disallowed origins with HTTP 403, using a configurable allowlist read from the `ALLOWED_ORIGINS` environment variable
3. THE Remote_MCP_Server SHALL set rate limits per session (configurable, default 100 requests per minute) and return HTTP 429 when exceeded
4. THE Remote_MCP_Server SHALL NOT log or store access tokens, refresh tokens, or user credentials in plaintext in application logs
5. THE Remote_MCP_Server SHALL generate all session IDs and state parameters using a cryptographically secure random number generator
6. THE Remote_MCP_Server SHALL validate all incoming JSON-RPC request payloads against the expected schema before processing, rejecting oversized payloads (configurable, default 1 MB) with HTTP 413
7. IF a request includes an `Origin` header that is not in the configured allowlist and the allowlist is non-empty, THEN THE Remote_MCP_Server SHALL reject the request with HTTP 403
8. THE Remote_MCP_Server SHALL set appropriate security headers on all HTTP responses including `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Cache-Control: no-store` for authenticated endpoints

### Requirement 9: Observability

**User Story:** As a platform operator, I want visibility into server health and request patterns, so that I can monitor, debug, and scale the service.

#### Acceptance Criteria

1. THE Remote_MCP_Server SHALL log each request in structured JSON format including: timestamp, HTTP method, path, session ID, response status code, and response time in milliseconds
2. THE Remote_MCP_Server SHALL log session lifecycle events (creation, expiry, explicit termination) with the session ID and user identifier (Cognito sub claim)
3. THE Remote_MCP_Server SHALL expose a `GET /metrics` endpoint that returns the current number of active sessions, total requests served since startup, and server uptime in seconds
4. IF an unhandled exception occurs during request processing, THEN THE Remote_MCP_Server SHALL log the error with a stack trace, return a generic error to the client, and continue serving other requests without crashing

### Requirement 10: Cost Optimization

**User Story:** As a platform operator, I want the remote MCP server to use the lowest-cost AWS infrastructure possible, so that hosting costs remain minimal for a low-to-moderate traffic personal/small-team service.

#### Acceptance Criteria

1. THE Remote_MCP_Server SHALL be deployable as an AWS Lambda function behind an API Gateway HTTP API (not REST API), using Lambda's pay-per-invocation pricing model to achieve near-zero cost at low traffic volumes
2. THE Remote_MCP_Server SHALL use DynamoDB with on-demand (pay-per-request) capacity mode for session state storage, rather than requiring an always-on compute instance with in-memory state
3. THE Remote_MCP_Server SHALL NOT require an Application Load Balancer, NAT Gateway, or any fixed-cost infrastructure component that incurs charges regardless of traffic volume
4. THE Remote_MCP_Server SHALL store session state (session ID, user tokens, inventory ID, session timestamps) in DynamoDB with a TTL attribute set to the session timeout value, enabling automatic cleanup without a separate garbage-collection process
5. THE Remote_MCP_Server SHALL be designed to operate within the AWS Free Tier for typical personal usage (fewer than 1000 requests per day), specifically: Lambda free tier (1M requests/month, 400K GB-seconds/month), API Gateway free tier (1M HTTP API calls/month for first 12 months), and DynamoDB free tier (25 GB storage, 25 WRU/25 RRU)
6. THE Remote_MCP_Server SHALL cache Cognito JWKS keys in the Lambda execution environment (warm starts) to minimize external network calls and reduce execution time
7. THE Remote_MCP_Server SHALL use Lambda Function URL or API Gateway HTTP API as the entry point, avoiding the higher per-request cost of API Gateway REST API
8. WHEN the name resolution cache for a session has not been populated, THE Remote_MCP_Server SHALL populate it from the Backend_API on demand and store it in the session's DynamoDB record, avoiding repeated API calls across Lambda invocations for the same session
