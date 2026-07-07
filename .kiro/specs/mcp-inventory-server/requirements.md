# Requirements Document

## Introduction

An MCP (Model Context Protocol) server that wraps the WheresMyStuff inventory management backend API, enabling users to interact with their home inventory through natural language via any MCP-compatible AI client (Kiro, Claude Desktop, etc.). The server exposes the existing backend API endpoints as MCP tools, handles JWT authentication against AWS Cognito, and provides search and query capabilities across Things, Locations, Rooms, Categories, Containers, and People.

## Glossary

- **MCP_Server**: The Model Context Protocol server process that exposes inventory operations as MCP tools to AI clients
- **MCP_Tool**: A discrete operation exposed by the MCP_Server that an AI client can invoke (e.g., search_things, create_thing)
- **Backend_API**: The existing WheresMyStuff Node.js/Lambda REST API that the MCP_Server communicates with
- **AI_Client**: Any MCP-compatible application that connects to the MCP_Server (e.g., Kiro, Claude Desktop)
- **Inventory**: A named collection of things, locations, rooms, and containers belonging to a user
- **Thing**: An item tracked in the inventory system (e.g., drill, camping stove, bike)
- **Location**: A physical place where things are stored (e.g., house, storage unit, office)
- **Room**: A subdivision of a Location (e.g., garage, basement, kitchen)
- **Container**: A grouping vessel for things (e.g., box, bin, bag) used for packing and moving
- **Category**: A classification label for things (e.g., tools, electronics, kitchenware)
- **Person**: A household member or person associated with ownership of things
- **Auth_Token**: A JWT access token issued by AWS Cognito used to authenticate requests to the Backend_API
- **AuthManager**: The component responsible for managing OAuth token lifecycle including browser-based login, token refresh, and secure token storage
- **Cognito_Hosted_UI**: The AWS Cognito-hosted login page that handles email/password and MFA authentication in the user's browser
- **Authorization_Code_Flow**: The OAuth 2.0 Authorization Code Grant flow used to exchange a code for access and refresh tokens
- **Refresh_Token**: A long-lived token (approximately 30 days) stored securely in the macOS Keychain, used to obtain new access tokens without re-authentication
- **Keychain**: The macOS Keychain Services used to securely store and retrieve the refresh token without plaintext file storage
- **Callback_Server**: A temporary local HTTP server started by the MCP_Server to receive the OAuth authorization code redirect from Cognito

## Requirements

### Requirement 1: MCP Server Initialization and Transport

**User Story:** As a user, I want the MCP server to start and communicate over standard I/O, so that any MCP-compatible AI client can connect to it.

#### Acceptance Criteria

1. THE MCP_Server SHALL implement the Model Context Protocol using stdio transport, reading JSON-RPC messages from stdin and writing JSON-RPC responses to stdout
2. WHEN the MCP_Server starts, THE MCP_Server SHALL register all MCP tools defined in Requirements 3 through 11 with their names, descriptions, and input schemas
3. THE MCP_Server SHALL expose a non-empty server name and a semantic version string in its initialization response
4. IF the MCP_Server fails to initialize due to missing configuration or an unhandled exception, THEN THE MCP_Server SHALL log an error message indicating the cause of the failure to stderr and exit with a non-zero status code
5. WHILE the MCP_Server is running, THE MCP_Server SHALL write only valid MCP protocol messages to stdout and direct all diagnostic or log output to stderr

### Requirement 2: Authentication and Token Management

**User Story:** As a user, I want the MCP server to authenticate via my browser using the same Cognito login flow as the web app (including MFA), so that no passwords or secrets are stored in configuration files.

#### Acceptance Criteria

1. THE MCP_Server SHALL read the Backend_API base URL from an environment variable named `WHERESMYSTUFF_API_URL`
2. THE MCP_Server SHALL read the Cognito User Pool ID from an environment variable named `WHERESMYSTUFF_USER_POOL_ID`
3. THE MCP_Server SHALL read the Cognito app client ID from an environment variable named `WHERESMYSTUFF_CLIENT_ID`
4. THE MCP_Server SHALL read the Cognito Hosted UI domain from an environment variable named `WHERESMYSTUFF_COGNITO_DOMAIN`
5. THE MCP_Server SHALL read the inventory ID from an environment variable named `WHERESMYSTUFF_INVENTORY_ID`
6. THE MCP_Server SHALL read the AWS region from an environment variable named `WHERESMYSTUFF_REGION`
7. IF any of the environment variables `WHERESMYSTUFF_API_URL`, `WHERESMYSTUFF_USER_POOL_ID`, `WHERESMYSTUFF_CLIENT_ID`, `WHERESMYSTUFF_COGNITO_DOMAIN`, `WHERESMYSTUFF_INVENTORY_ID`, or `WHERESMYSTUFF_REGION` is not set or is an empty string, THEN THE MCP_Server SHALL log an error message to stderr identifying the missing variable and exit with a non-zero status code
8. WHEN the MCP_Server starts, THE AuthManager SHALL attempt to retrieve a stored Refresh_Token from the macOS Keychain
9. WHEN a valid Refresh_Token is found in the Keychain, THE AuthManager SHALL exchange the Refresh_Token for a new access token by calling the Cognito token endpoint without opening a browser
10. WHEN no Refresh_Token is found in the Keychain or the stored Refresh_Token is expired or invalid, THE AuthManager SHALL initiate the browser-based Authorization_Code_Flow
11. WHEN initiating the browser-based login, THE AuthManager SHALL start a temporary Callback_Server on a random available port listening on localhost
12. WHEN the Callback_Server is started, THE AuthManager SHALL open the user's default browser to the Cognito_Hosted_UI authorization endpoint with the OAuth parameters: response_type=code, client_id, redirect_uri=http://localhost:{port}/callback, scope=openid email profile, and a cryptographically random state parameter
13. WHEN the Cognito_Hosted_UI redirects to the Callback_Server with an authorization code and a matching state parameter, THE AuthManager SHALL exchange the authorization code for access and refresh tokens by calling the Cognito token endpoint
14. WHEN the AuthManager receives a valid token response containing access and refresh tokens, THE AuthManager SHALL store the Refresh_Token securely in the macOS Keychain and shut down the Callback_Server
15. IF the state parameter in the callback does not match the originally generated state value, THEN THE AuthManager SHALL reject the callback, return an error page to the browser, and log a security warning to stderr
16. IF the token exchange fails due to an invalid or expired authorization code, THEN THE AuthManager SHALL log the error to stderr and exit with a non-zero status code
17. IF the browser-based login is not completed within 120 seconds of opening the browser, THEN THE AuthManager SHALL shut down the Callback_Server, log a timeout error to stderr, and exit with a non-zero status code
18. THE MCP_Server SHALL include the current access token in the Authorization header of every request to the Backend_API using the format `Bearer <access_token>`
19. WHEN the access token expires or the Backend_API returns an HTTP 401 response, THE AuthManager SHALL attempt to refresh the access token using the stored Refresh_Token before retrying the failed request
20. IF the Refresh_Token has expired (approximately 30 days) and cannot be used to obtain a new access token, THEN THE AuthManager SHALL initiate the browser-based Authorization_Code_Flow to obtain new tokens
21. THE MCP_Server SHALL NOT store any passwords, client secrets, or access tokens in plaintext files, environment variables, or configuration files
22. THE AuthManager SHALL store tokens in the macOS Keychain under a service name that includes the Cognito client ID to support multiple configurations

### Requirement 3: Search Things

**User Story:** As a user, I want to search for things in my inventory by name or tag, so that I can find items through natural language queries.

#### Acceptance Criteria

1. THE MCP_Server SHALL expose a `search_things` tool that accepts an optional text query (string, maximum 200 characters) and an optional tag list (array of strings, maximum 10 tags)
2. WHEN the `search_things` tool is invoked with a text query, THE MCP_Server SHALL send a GET request to the Backend_API `/things` endpoint with the query as a search parameter and the configured `WHERESMYSTUFF_INVENTORY_ID` as the `inventoryId` parameter
3. WHEN the `search_things` tool is invoked with tags, THE MCP_Server SHALL include the tags as a comma-separated `tags` parameter in the request
4. WHEN the `search_things` tool is invoked with both a text query and tags, THE MCP_Server SHALL include both parameters in the same request so that results match the text query and the provided tags
5. WHEN the `search_things` tool is invoked with neither a text query nor tags, THE MCP_Server SHALL return all things in the inventory by sending a GET request to the Backend_API `/things` endpoint with only the `inventoryId` parameter
6. THE MCP_Server SHALL return a text list of matching things with each entry including the thing's name, location, room, category, and tags
7. WHEN no things match the search criteria, THE MCP_Server SHALL return a message indicating no results were found

### Requirement 4: Get Things by Location

**User Story:** As a user, I want to ask what's in a specific location or room, so that I can check the contents of spaces in my home.

#### Acceptance Criteria

1. THE MCP_Server SHALL expose a `get_things_in_location` tool that accepts a single required string parameter representing a location name or room name, with a maximum length of 200 characters
2. WHEN the tool is invoked, THE MCP_Server SHALL query the Backend_API `/locations` endpoint and `/rooms` endpoint to find entities whose name matches the provided string using the name resolution rules defined in Requirement 13
3. WHEN multiple locations or rooms match the provided name, THE MCP_Server SHALL return all matches listing each match's name, type (location or room), and parent location name (for rooms), and prompt the user to clarify which one they mean
4. WHEN exactly one location or room is resolved, THE MCP_Server SHALL query the Backend_API `/things` endpoint filtered by the resolved locationId or roomId and return each thing's name, category, and tags
5. IF no location or room matches the provided name, THEN THE MCP_Server SHALL return a message indicating the location was not found and include any partial matches as suggestions
6. IF a location or room is resolved but contains no things, THEN THE MCP_Server SHALL return a message indicating the location or room exists but is empty

### Requirement 5: Create Thing

**User Story:** As a user, I want to add new things to my inventory through natural language, so that I can quickly catalogue items without opening the app.

#### Acceptance Criteria

1. THE MCP_Server SHALL expose a `create_thing` tool that accepts a name (required, 1–255 characters), and optional location name, room name, category name, description (max 1000 characters), and tags (max 20 tags, each alphanumeric including hyphens and underscores, max 50 characters each)
2. WHEN the tool is invoked with a location name, THE MCP_Server SHALL resolve the name to a location ID by performing a case-insensitive match against existing locations in the user's inventory before creating the thing
3. WHEN the tool is invoked with a room name, THE MCP_Server SHALL resolve the name to a room ID by performing a case-insensitive match against existing rooms in the user's inventory before creating the thing
4. WHEN the tool is invoked with a category name, THE MCP_Server SHALL resolve the name to a category ID by performing a case-insensitive match against existing categories in the user's inventory before creating the thing
5. IF a provided location, room, or category name does not match any existing entity in the user's inventory, THEN THE MCP_Server SHALL return an error message indicating which name could not be resolved
6. IF a provided location, room, or category name matches more than one existing entity, THEN THE MCP_Server SHALL return an error message listing the ambiguous matches so the user can clarify
7. THE MCP_Server SHALL send a POST request to the Backend_API `/things` endpoint with the resolved data including the user's inventory ID
8. WHEN the thing is created successfully, THE MCP_Server SHALL return a confirmation including the new thing's name, assigned location, and ID
9. IF the creation fails due to validation errors, THEN THE MCP_Server SHALL return an error message indicating which fields failed validation and the reason for each failure

### Requirement 6: Update Thing

**User Story:** As a user, I want to update properties of existing things, so that I can change locations, add descriptions, or modify tags via conversation.

#### Acceptance Criteria

1. THE MCP_Server SHALL expose an `update_thing` tool that accepts a thing identifier (name or ID) and one or more optional fields to update: location name, room name, category name, description, tags, notes, condition, value, make, model, and brand
2. WHEN the tool is invoked with a thing name, THE MCP_Server SHALL search for the thing by name using case-insensitive matching and resolve it to an ID
3. WHEN multiple things match the provided name, THE MCP_Server SHALL return the list of matches with each thing's name, location, and ID, and ask for clarification without performing any update
4. WHEN the thing identifier is resolved to a single thing, THE MCP_Server SHALL send a PUT request to the Backend_API `/things/{id}` endpoint with the updated fields merged with the thing's existing data
5. WHEN location, room, or category names are provided as updated fields, THE MCP_Server SHALL resolve each name to its corresponding ID before submitting the update
6. WHEN the update succeeds, THE MCP_Server SHALL return a confirmation listing each changed field with its previous and new value
7. IF no thing matches the provided identifier, THEN THE MCP_Server SHALL return an error indicating the thing was not found and suggest partial matches if any exist
8. IF the Backend_API returns a validation error for the update request, THEN THE MCP_Server SHALL return an error describing which fields failed validation

### Requirement 7: Move Thing

**User Story:** As a user, I want to move a thing to a different location or room by saying something like "move the bike to the basement," so that I can keep my inventory up to date.

#### Acceptance Criteria

1. THE MCP_Server SHALL expose a `move_thing` tool that accepts a thing identifier (name or ID) and a destination location or room name
2. WHEN the tool is invoked, THE MCP_Server SHALL resolve the thing name to an ID and the destination name to a location or room ID
3. WHEN multiple things match the provided name, THE MCP_Server SHALL return the matches with identifying details and ask for clarification rather than performing the move
4. WHEN the destination resolves to a room, THE MCP_Server SHALL update the thing's roomId to the resolved room ID and set the thing's locationId to the room's parent location ID by sending a PUT request to the Backend_API `/things/{id}` endpoint
5. WHEN the destination resolves to a location and not a room, THE MCP_Server SHALL update the thing's locationId to the resolved location ID and clear the thing's roomId by sending a PUT request to the Backend_API `/things/{id}` endpoint
6. WHEN the move succeeds, THE MCP_Server SHALL return a confirmation including the thing's name, the previous location, and the new destination name
7. IF the thing or destination cannot be resolved, THEN THE MCP_Server SHALL return an error indicating what could not be found, with partial match suggestions if any candidates exist

### Requirement 8: List Locations and Rooms

**User Story:** As a user, I want to list all my locations and rooms, so that I can understand how my inventory is organized.

#### Acceptance Criteria

1. THE MCP_Server SHALL expose a `list_locations` tool that returns all locations in the inventory
2. THE MCP_Server SHALL expose a `list_rooms` tool that accepts an optional location name and returns rooms
3. WHEN `list_locations` is invoked, THE MCP_Server SHALL send a GET request to the Backend_API `/locations` endpoint and return each location's name, description, and type
4. WHEN `list_rooms` is invoked without a location name, THE MCP_Server SHALL send a GET request to the Backend_API `/rooms` endpoint and return all rooms with each room's name and parent location name
5. WHEN `list_rooms` is invoked with a location name, THE MCP_Server SHALL resolve the location name to a location ID and return only rooms belonging to that location, including each room's name and parent location name
6. IF the location name provided to `list_rooms` cannot be resolved to any location, THEN THE MCP_Server SHALL return a message indicating the location was not found

### Requirement 9: List and Search Categories

**User Story:** As a user, I want to list categories and find things by category, so that I can organize my searches by type of item.

#### Acceptance Criteria

1. WHEN `list_categories` is invoked, THE MCP_Server SHALL send a GET request to the Backend_API `/categories` endpoint and return each category's name and description
2. THE MCP_Server SHALL expose a `get_things_by_category` tool that accepts a category name
3. WHEN `get_things_by_category` is invoked, THE MCP_Server SHALL resolve the category name to an ID and query things filtered by that category
4. WHEN `get_things_by_category` resolves matching things, THE MCP_Server SHALL return the list of things including each thing's name, location name, room name, and tags
5. IF no category matches the provided name, THEN THE MCP_Server SHALL return a message indicating the category was not found
6. WHEN `get_things_by_category` resolves a category that contains no things, THE MCP_Server SHALL return a message indicating the category exists but contains no items

### Requirement 10: Container Operations

**User Story:** As a user, I want to view and manage containers through natural language, so that I can check packing boxes, find which container holds a specific item, and browse moving containers.

#### Acceptance Criteria

1. THE MCP_Server SHALL expose a `list_containers` tool that returns all containers in the inventory including each container's name, ID, status, item count, and estimated total value
2. THE MCP_Server SHALL expose a `get_container_contents` tool that accepts a container name or ID
3. WHEN `get_container_contents` is invoked with a name, THE MCP_Server SHALL perform a case-insensitive exact match to resolve the container name to an ID and query the `/containers/{id}/contents` endpoint
4. WHEN `get_container_contents` resolves a container successfully, THE MCP_Server SHALL return the container's contents including item names, item count, and estimated value
5. IF no container matches the provided name or ID, THEN THE MCP_Server SHALL return a message indicating the container was not found
6. THE MCP_Server SHALL expose a `find_thing_container` tool that accepts a thing name or ID
7. WHEN `find_thing_container` is invoked with a name, THE MCP_Server SHALL perform a case-insensitive exact match to locate the thing and return the container it belongs to including container name, container ID, and container status
8. IF the thing is found but is not packed in any container, THEN THE MCP_Server SHALL return a message indicating the thing exists but is not packed in a container
9. IF no thing matches the provided name or ID, THEN THE MCP_Server SHALL return a message indicating the thing was not found in the inventory

### Requirement 11: Delete Thing

**User Story:** As a user, I want to remove things from my inventory, so that I can keep my catalogue current when I dispose of or give away items.

#### Acceptance Criteria

1. THE MCP_Server SHALL expose a `delete_thing` tool that accepts a thing identifier (name or ID)
2. WHEN the tool is invoked with a thing name, THE MCP_Server SHALL search for the thing by name using case-insensitive matching and resolve it to an ID
3. WHEN multiple things match the provided name, THE MCP_Server SHALL return the matches with each thing's name, location, and ID, and ask for clarification rather than deleting
4. WHEN the thing identifier is resolved to a single thing, THE MCP_Server SHALL send a DELETE request to the Backend_API `/things/{id}?inventoryId={inventoryId}` endpoint
5. WHEN the deletion succeeds, THE MCP_Server SHALL return a confirmation naming the deleted thing
6. IF no thing matches the provided identifier, THEN THE MCP_Server SHALL return an error indicating the thing was not found and suggest partial matches if any exist

### Requirement 12: Error Handling and API Communication

**User Story:** As a user, I want clear error messages when something goes wrong, so that I understand what happened and what to do next.

#### Acceptance Criteria

1. IF the Backend_API returns a 401 Unauthorized response and the AuthManager cannot refresh the access token, THEN THE MCP_Server SHALL return an error indicating the session has expired and the user must re-authenticate
2. IF the Backend_API returns a 403 Forbidden response, THEN THE MCP_Server SHALL return an error indicating the user does not have access to the requested resource
3. IF the Backend_API returns a 404 Not Found response, THEN THE MCP_Server SHALL return an error indicating the requested resource does not exist
4. IF the Backend_API returns a 429 Too Many Requests response, THEN THE MCP_Server SHALL return an error indicating rate limiting and include the Retry-After duration from the response header if present, or indicate to retry after at least 60 seconds if no Retry-After header is provided
5. IF the Backend_API is unreachable due to connection refused, DNS resolution failure, or connection timeout, or returns a 5xx error, THEN THE MCP_Server SHALL retry the request up to 2 additional times with a 2-second delay between attempts before returning an error indicating a server communication problem
6. THE MCP_Server SHALL enforce a 30-second timeout per individual Backend_API request, and IF a request exceeds this timeout, THEN THE MCP_Server SHALL abort the request and treat it as an unreachable Backend_API condition per criterion 5
7. IF the Backend_API returns an unexpected status code not covered by criteria 1 through 5 (such as 400, 409, or 422), THEN THE MCP_Server SHALL return an error indicating the operation failed, include the HTTP status code, and omit any response body details that may contain sensitive information

### Requirement 13: Name Resolution and Fuzzy Matching

**User Story:** As a user, I want the MCP server to understand approximate names and partial matches, so that natural language queries work even when I don't remember exact names.

#### Acceptance Criteria

1. WHEN resolving a name to an ID, THE MCP_Server SHALL perform case-insensitive matching against entity names for Locations, Rooms, Categories, Containers, and Things
2. WHEN no exact case-insensitive match is found, THE MCP_Server SHALL attempt partial substring matching (case-insensitive) and return up to 10 candidates
3. WHEN multiple candidates are found during name resolution, THE MCP_Server SHALL return all candidates (up to the maximum of 10) with each candidate's name, ID, and entity type for disambiguation
4. THE MCP_Server SHALL cache the list of locations, rooms, and categories for the duration of the server process to reduce API calls during name resolution
5. IF name resolution finds zero candidates after both exact and partial substring matching, THEN THE MCP_Server SHALL return a message indicating no matching entity was found for the provided name
6. IF the Backend_API is unreachable when populating the name resolution cache, THEN THE MCP_Server SHALL attempt to fetch the data on the next name resolution request rather than failing server startup
