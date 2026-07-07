# Implementation Plan: MCP Inventory Server

## Overview

Build a standalone TypeScript MCP server package (`mcp-server/`) that exposes the WheresMyStuff backend API as MCP tools. The implementation follows a bottom-up approach: infrastructure changes first, then core components (config, auth, API client, name resolver, formatters), then tool handlers, and finally wiring everything together with the MCP server entry point.

## Tasks

- [x] 1. Infrastructure changes for OAuth support
  - [x] 1.1 Add Cognito UserPoolDomain resource to CloudFormation template
    - Add `AWS::Cognito::UserPoolDomain` resource with domain `wheresmystuff-${Environment}`
    - Add OAuth settings to existing `UserPoolClient` resource: `AllowedOAuthFlows: [code]`, `AllowedOAuthFlowsUserPoolClient: true`, `AllowedOAuthScopes: [openid, email, profile]`, `CallbackURLs: [http://localhost/callback]`, `SupportedIdentityProviders: [COGNITO]`
    - Preserve existing `ExplicitAuthFlows` and `GenerateSecret: false`
    - _Requirements: 2.10, 2.11, 2.12, 2.13_

- [x] 2. Set up project structure and dependencies
  - [x] 2.1 Initialize the mcp-server package
    - Create `mcp-server/` directory with `package.json`, `tsconfig.json`
    - Configure TypeScript with strict mode, ES2022 target, Node16 module resolution
    - Add dependencies: `@modelcontextprotocol/sdk`, `keytar`, `open`
    - Add devDependencies: `vitest`, `fast-check`, `@fast-check/vitest`, `nock`, `typescript`, `@types/node`
    - Add build script (`tsc`), test script (`vitest --run`), and dev script
    - Create `src/` and `tests/` directory structure matching the design file structure
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Implement Config module
  - [x] 3.1 Create config loader with environment variable validation
    - Create `src/config.ts` with `ServerConfig` interface and `loadConfig()` function
    - Read all 6 required environment variables: `WHERESMYSTUFF_API_URL`, `WHERESMYSTUFF_USER_POOL_ID`, `WHERESMYSTUFF_CLIENT_ID`, `WHERESMYSTUFF_COGNITO_DOMAIN`, `WHERESMYSTUFF_INVENTORY_ID`, `WHERESMYSTUFF_REGION`
    - If any variable is missing or empty, log descriptive error to stderr identifying the variable and exit with non-zero code
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.2 Write unit tests for config module
    - Test that each missing env var produces correct error message and exit
    - Test that valid config returns populated `ServerConfig`
    - Test that empty string values are treated as missing
    - _Requirements: 2.7_

- [ ] 4. Implement AuthManager
  - [x] 4.1 Implement Keychain token storage operations
    - Create `src/auth-manager.ts` with `AuthManager` class and `AuthTokens` interface
    - Implement `getStoredRefreshToken()`, `storeRefreshToken()`, `deleteStoredRefreshToken()` using `keytar`
    - Use service name pattern `wheresmystuff-mcp-{clientId}` with account `refresh-token`
    - _Requirements: 2.8, 2.14, 2.21, 2.22_

  - [x] 4.2 Implement token refresh flow
    - Implement `exchangeRefreshToken()` — POST to `https://{cognitoDomain}/oauth2/token` with `grant_type=refresh_token`
    - On success: return new `AuthTokens` with access token and expiry
    - On `invalid_grant`: delete stored token from Keychain and signal browser login needed
    - _Requirements: 2.9, 2.19, 2.20_

  - [x] 4.3 Implement browser-based OAuth Authorization Code flow
    - Implement `performBrowserLogin()`:
      - Generate cryptographically random state (32 bytes, hex)
      - Start temporary HTTP server on random localhost port
      - Open Cognito Hosted UI URL with `response_type=code`, `client_id`, `redirect_uri`, `scope=openid+email+profile`, `state`
      - Handle callback: validate state, extract code
      - Exchange authorization code for tokens via POST to token endpoint
      - Store refresh token in Keychain, shut down callback server
    - Validate state parameter matches — reject with error page and stderr warning on mismatch
    - Implement 120-second timeout — shut down server, log error, exit non-zero
    - _Requirements: 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17_

  - [x] 4.4 Implement main `getAccessToken()` and `refreshAccessToken()` entry points
    - `getAccessToken()`: check in-memory cache → try Keychain refresh → fall back to browser login
    - `refreshAccessToken()`: force refresh via stored token, fall through to browser if expired
    - Track `expiresAt` to avoid unnecessary refresh calls
    - _Requirements: 2.18, 2.19, 2.20_

  - [ ]* 4.5 Write unit tests for AuthManager
    - Mock `keytar` for Keychain operations
    - Test refresh flow success and `invalid_grant` fallback
    - Test state validation rejection
    - Test timeout behavior
    - Test that no secrets are written to stdout
    - _Requirements: 2.8, 2.9, 2.15, 2.16, 2.17_

- [ ] 5. Implement ApiClient
  - [x] 5.1 Create HTTP client with retry logic and auth header injection
    - Create `src/api-client.ts` with `ApiClient` class
    - Implement `get()`, `post()`, `put()`, `delete()` methods
    - Inject Bearer token from `authManager.getAccessToken()` on every request
    - Enforce 30-second timeout per request
    - Implement retry logic: retry on 5xx, connection error, timeout — up to 2 retries with 2s delay
    - On 401: call `authManager.refreshAccessToken()`, retry once
    - Map error codes: 401→session expired, 403→access denied, 404→not found, 429→rate limited (include Retry-After or default 60s), unexpected→include status code, omit body
    - Unwrap API response envelope (`{ success, data, error }`)
    - _Requirements: 2.18, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ]* 5.2 Write property test for retry behavior
    - **Property 7: Retry on server errors**
    - Generate random 5xx responses, verify exactly 3 attempts with 2s delays
    - **Validates: Requirements 12.5, 12.6**

  - [ ]* 5.3 Write property test for error sanitization
    - **Property 11: Unexpected error responses include status code but not body**
    - Generate random status codes not in {200, 201, 401, 403, 404, 429, 5xx} and random response bodies, verify body is not leaked
    - **Validates: Requirements 12.7**

  - [ ]* 5.4 Write property test for auth header invariant
    - **Property 4: Authorization header present on all API requests**
    - Generate random tool calls, verify Bearer header on all outgoing requests
    - **Validates: Requirements 2.18**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement NameResolver
  - [x] 7.1 Create entity cache and name resolution logic
    - Create `src/name-resolver.ts` with `NameResolver` class, `ResolvedEntity` and `ResolutionResult` interfaces
    - Implement lazy-loading cache for locations, rooms, categories (fetch on first access)
    - If API is unreachable during cache population, retry on next resolution request (don't fail startup)
    - Implement resolution algorithm: case-insensitive exact match → case-insensitive substring match → return up to 10 candidates sorted by relevance (prefix first, then substring)
    - Implement `resolveLocation()`, `resolveRoom()`, `resolveCategory()`, `resolveContainer()`, `resolveThing()`
    - Implement `invalidateCache()` for manual refresh
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ]* 7.2 Write property test for case-insensitive resolution
    - **Property 1: Case-insensitive name resolution**
    - Generate random entity names, vary case, verify same ID is returned
    - **Validates: Requirements 5.2, 5.3, 5.4, 6.2, 10.3, 11.2, 13.1**

  - [ ]* 7.3 Write property test for substring matching cap
    - **Property 2: Substring matching returns candidates capped at 10**
    - Generate entity lists of varying size, verify at most 10 candidates returned
    - **Validates: Requirements 13.2, 13.3**

  - [ ]* 7.4 Write property test for disambiguation completeness
    - **Property 3: Disambiguation returns all matching entities**
    - Generate multi-match scenarios, verify all matches appear (up to 10) with name, ID, type
    - **Validates: Requirements 4.3, 5.6, 6.3, 7.3, 11.3**

- [ ] 8. Implement Formatters
  - [x] 8.1 Create response formatting functions
    - Create `src/formatters.ts` with all formatting functions
    - `formatThingsList()` — include name, location, room, category, tags for each thing
    - `formatLocationsList()` — include name, description, type
    - `formatRoomsList()` — include name, parent location name
    - `formatCategoriesList()` — include name, description
    - `formatContainersList()` — include name, ID, status, item count, estimated value
    - `formatContainerContents()` — include container info, item names, count, value
    - `formatResolutionCandidates()` — include name, ID, entity type for each candidate
    - _Requirements: 3.6, 4.4, 8.3, 8.4, 9.1, 9.4, 10.1, 10.4_

  - [ ]* 8.2 Write property test for thing formatting completeness
    - **Property 8: Thing list formatting includes required fields**
    - Generate random thing records with varying fields, verify all present fields appear in output
    - **Validates: Requirements 3.6, 9.4**

- [x] 9. Implement tool handlers - Search and Read operations
  - [x] 9.1 Implement `search_things` tool handler
    - Create `src/tools/search-things.ts`
    - Accept optional `query` (max 200 chars) and optional `tags` (max 10)
    - Call GET `/things` with appropriate params and `inventoryId`
    - Format results with `formatThingsList()`, handle empty results
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 9.2 Implement `get_things_in_location` tool handler
    - Create `src/tools/get-things-in-location.ts`
    - Accept `name` (max 200 chars), resolve via NameResolver
    - Handle multiple matches (return candidates), single match (query things), no match (suggestions)
    - Handle empty location/room case
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 9.3 Implement `list_locations`, `list_rooms`, `list_categories` tool handlers
    - Create `src/tools/list-locations.ts`, `src/tools/list-rooms.ts`, `src/tools/list-categories.ts`
    - `list_locations`: GET `/locations`, format with `formatLocationsList()`
    - `list_rooms`: optional location name filter, resolve location if provided, GET `/rooms`
    - `list_categories`: GET `/categories`, format with `formatCategoriesList()`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1_

  - [x] 9.4 Implement `get_things_by_category` tool handler
    - Create `src/tools/get-things-by-category.ts`
    - Resolve category name to ID, query things filtered by category
    - Handle not found, empty category cases
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 9.5 Implement container tool handlers
    - Create `src/tools/list-containers.ts`, `src/tools/get-container-contents.ts`, `src/tools/find-thing-container.ts`
    - `list_containers`: GET `/containers`, format with `formatContainersList()`
    - `get_container_contents`: resolve container name/ID, GET `/containers/{id}/contents`
    - `find_thing_container`: resolve thing name/ID, return container info or "not in container"
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

- [ ] 10. Implement tool handlers - Write operations
  - [x] 10.1 Implement `create_thing` tool handler
    - Create `src/tools/create-thing.ts`
    - Accept name (1-255 chars), optional location/room/category/description/tags
    - Resolve names to IDs via NameResolver, handle ambiguity and not-found errors
    - POST to `/things` with resolved data and `inventoryId`
    - Return confirmation with name, location, and ID
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 10.2 Implement `update_thing` tool handler
    - Create `src/tools/update-thing.ts`
    - Accept thing identifier + optional update fields (location, room, category, description, tags, notes, condition, value, make, model, brand)
    - Resolve thing name to ID, handle multiple matches
    - Fetch existing thing data, merge with updates, PUT to `/things/{id}`
    - Report changed fields with previous and new values
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 10.3 Implement `move_thing` tool handler
    - Create `src/tools/move-thing.ts`
    - Accept thing identifier + destination name
    - Resolve thing and destination, handle ambiguity
    - If destination is room: set `roomId` and `locationId` (parent), PUT to `/things/{id}`
    - If destination is location: set `locationId`, clear `roomId`, PUT to `/things/{id}`
    - Return confirmation with thing name, previous location, new destination
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 10.4 Implement `delete_thing` tool handler
    - Create `src/tools/delete-thing.ts`
    - Accept thing identifier, resolve to ID, handle multiple matches
    - DELETE to `/things/{id}?inventoryId={inventoryId}`
    - Return confirmation naming the deleted thing
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 10.5 Write property test for update data merge
    - **Property 9: Update merges existing data with changes**
    - Generate random existing records and update subsets, verify correct merge in PUT body
    - **Validates: Requirements 6.4**

  - [ ]* 10.6 Write property test for move ID assignment
    - **Property 10: Move correctly updates IDs based on destination type**
    - Generate random room/location destinations, verify correct locationId/roomId updates
    - **Validates: Requirements 7.4, 7.5**

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Wire up MCP server entry point
  - [x] 12.1 Create MCP server setup and tool registration
    - Create `src/server.ts` — instantiate MCP server with name and version
    - Register all 13 tools with names, descriptions, and JSON Schema input definitions
    - Wire each tool to its handler function with ApiClient and NameResolver dependencies
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 12.2 Create entry point with initialization sequence
    - Create `src/index.ts` — main entry point
    - Load config → initialize AuthManager → get initial access token → initialize ApiClient → initialize NameResolver → create MCP server → connect stdio transport
    - All diagnostic output to stderr, only MCP protocol to stdout
    - Handle startup failures: log to stderr, exit non-zero
    - _Requirements: 1.1, 1.4, 1.5, 2.7_

  - [ ]* 12.3 Write property test for stdout protocol compliance
    - **Property 12: stdout contains only valid protocol messages**
    - Generate random tool calls (valid and invalid), verify all stdout output is valid JSON-RPC 2.0
    - **Validates: Requirements 1.5**

  - [ ]* 12.4 Write property test for token refresh on 401
    - **Property 5: Token refresh on 401**
    - Generate requests that return 401, verify refresh is attempted and new token used on retry
    - **Validates: Requirements 2.19**

- [x] 13. Create configuration example and documentation
  - [x] 13.1 Create mcp.json configuration example
    - Create `mcp-server/mcp.json` with example configuration for AI clients
    - Include all required env vars with placeholder values
    - Ensure NO secrets in the example file — only non-sensitive identifiers
    - Add comments explaining each env var
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.21_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The infrastructure change (task 1) can be deployed independently before the MCP server code
- The `keytar` package requires native compilation — ensure Node.js build tools are available
- All diagnostic/log output goes to stderr; stdout is reserved exclusively for MCP protocol messages

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3"] },
    { "id": 4, "tasks": ["4.4"] },
    { "id": 5, "tasks": ["4.5", "5.1"] },
    { "id": 6, "tasks": ["5.2", "5.3", "5.4", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.4", "8.1"] },
    { "id": 8, "tasks": ["8.2", "9.1", "9.2", "9.3", "9.4", "9.5"] },
    { "id": 9, "tasks": ["10.1", "10.2", "10.3", "10.4"] },
    { "id": 10, "tasks": ["10.5", "10.6"] },
    { "id": 11, "tasks": ["12.1"] },
    { "id": 12, "tasks": ["12.2", "13.1"] },
    { "id": 13, "tasks": ["12.3", "12.4"] }
  ]
}
```
