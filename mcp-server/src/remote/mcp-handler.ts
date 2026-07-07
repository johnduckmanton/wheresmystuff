// MCP protocol handler — processes initialize, tools/list, and tools/call requests

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { RemoteServerConfig } from "./remote-config.js";
import type { JwksCache } from "./jwks-cache.js";
import { JwtValidator, type JwtPayload } from "./jwt-validator.js";
import {
  SessionStore,
  generateSessionId,
  type SessionRecord,
  type SerializedNameCache,
} from "./session-store.js";
import { checkRateLimit } from "./security-middleware.js";
import { ApiClient, ApiClientError } from "../api-client.js";
import { NameResolver } from "../name-resolver.js";

import * as searchThings from "../tools/search-things.js";
import * as getThingsInLocation from "../tools/get-things-in-location.js";
import * as createThing from "../tools/create-thing.js";
import * as updateThing from "../tools/update-thing.js";
import * as moveThing from "../tools/move-thing.js";
import * as deleteThing from "../tools/delete-thing.js";
import * as listLocations from "../tools/list-locations.js";
import * as listRooms from "../tools/list-rooms.js";
import * as listCategories from "../tools/list-categories.js";
import * as getThingsByCategory from "../tools/get-things-by-category.js";
import * as listContainers from "../tools/list-containers.js";
import * as getContainerContents from "../tools/get-container-contents.js";
import * as findThingContainer from "../tools/find-thing-container.js";

// --- Types ---

interface JsonRpcRequest {
  jsonrpc: string;
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

// --- AuthManager adapter for remote sessions ---

interface AuthManagerInterface {
  getAccessToken(): Promise<string>;
  refreshAccessToken(): Promise<string>;
}

class RemoteAuthManager implements AuthManagerInterface {
  private accessToken: string;
  private readonly refreshToken: string;
  private readonly cognitoDomain: string;
  private readonly clientId: string;
  private onTokenRefreshed?: (token: string, expiresAt: number) => void;

  constructor(
    accessToken: string,
    refreshToken: string,
    cognitoDomain: string,
    clientId: string,
    onTokenRefreshed?: (token: string, expiresAt: number) => void
  ) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.cognitoDomain = cognitoDomain;
    this.clientId = clientId;
    this.onTokenRefreshed = onTokenRefreshed;
  }

  async getAccessToken(): Promise<string> {
    return this.accessToken;
  }

  async refreshAccessToken(): Promise<string> {
    const tokenUrl = `https://${this.cognitoDomain}/oauth2/token`;

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      refresh_token: this.refreshToken,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new ApiClientError("Session expired, please re-authenticate", 401);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.accessToken = data.access_token;
    const expiresAt = Date.now() + data.expires_in * 1000;

    if (this.onTokenRefreshed) {
      this.onTokenRefreshed(data.access_token, expiresAt);
    }

    return data.access_token;
  }
}

// --- Tool definitions (all 13) ---

const toolDefinitions = [
  searchThings.definition,
  getThingsInLocation.definition,
  createThing.definition,
  updateThing.definition,
  moveThing.definition,
  deleteThing.definition,
  listLocations.definition,
  listRooms.definition,
  listCategories.definition,
  getThingsByCategory.definition,
  listContainers.definition,
  getContainerContents.definition,
  findThingContainer.definition,
];

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}>;

// --- Helper functions ---

function extractBearerToken(event: APIGatewayProxyEventV2): string | null {
  const authHeader = event.headers?.authorization ?? event.headers?.Authorization;
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function unauthorized(serverBaseUrl: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 401,
    headers: {
      "WWW-Authenticate": `Bearer resource="${serverBaseUrl}/.well-known/oauth-authorization-server"`,
      "Content-Type": "application/json",
    },
    body: "",
  };
}

function jsonRpcResponse(
  id: string | number | null,
  result: unknown
): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      result,
    }),
  };
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string
): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code, message },
    }),
  };
}

function parseJsonRpcBody(body: string | undefined): JsonRpcRequest | null {
  if (!body) return null;
  try {
    return JSON.parse(body) as JsonRpcRequest;
  } catch {
    return null;
  }
}

function isValidJsonRpc(body: unknown): body is JsonRpcRequest {
  if (typeof body !== "object" || body === null) return false;
  const obj = body as Record<string, unknown>;
  return (
    obj.jsonrpc === "2.0" &&
    typeof obj.method === "string" &&
    (obj.id !== undefined && obj.id !== null)
  );
}

async function resolveInventoryId(
  cognitoAccessToken: string,
  config: RemoteServerConfig
): Promise<string> {
  const url = `${config.apiUrl.replace(/\/+$/, "")}/inventories`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${cognitoAccessToken}`,
    },
  });

  if (!response.ok) {
    throw new ApiClientError(
      "Failed to resolve inventory",
      response.status
    );
  }

  const data = (await response.json()) as {
    success: boolean;
    data?: Array<{ id: string }>;
  };

  if (!data.success || !data.data || data.data.length === 0) {
    throw new ApiClientError("No inventory found for user", 404);
  }

  return data.data[0].id;
}

function buildNameResolver(
  apiClient: ApiClient,
  inventoryId: string,
  nameCache?: SerializedNameCache
): NameResolver {
  const resolver = new NameResolver(apiClient, inventoryId);

  // Pre-populate caches from session data if available
  if (nameCache) {
    if (nameCache.locations) {
      (resolver as unknown as Record<string, unknown>)["locationsCache"] =
        nameCache.locations.map((l) => ({
          id: l.id,
          name: l.name,
          type: "location" as const,
        }));
    }
    if (nameCache.rooms) {
      (resolver as unknown as Record<string, unknown>)["roomsCache"] =
        nameCache.rooms.map((r) => ({
          id: r.id,
          name: r.name,
          type: "room" as const,
          parentName: r.parentName,
        }));
    }
    if (nameCache.categories) {
      (resolver as unknown as Record<string, unknown>)["categoriesCache"] =
        nameCache.categories.map((c) => ({
          id: c.id,
          name: c.name,
          type: "category" as const,
        }));
    }
  }

  return resolver;
}

function serializeNameCache(resolver: NameResolver): SerializedNameCache | undefined {
  const r = resolver as unknown as Record<string, unknown>;
  const locationsCache = r["locationsCache"] as
    | Array<{ id: string; name: string }> | null;
  const roomsCache = r["roomsCache"] as
    | Array<{ id: string; name: string; parentName?: string }> | null;
  const categoriesCache = r["categoriesCache"] as
    | Array<{ id: string; name: string }> | null;

  if (!locationsCache && !roomsCache && !categoriesCache) {
    return undefined;
  }

  const cache: SerializedNameCache = { populatedAt: Date.now() };

  if (locationsCache) {
    cache.locations = locationsCache.map((l) => ({ id: l.id, name: l.name }));
  }
  if (roomsCache) {
    cache.rooms = roomsCache.map((r) => ({
      id: r.id,
      name: r.name,
      parentName: r.parentName,
    }));
  }
  if (categoriesCache) {
    cache.categories = categoriesCache.map((c) => ({ id: c.id, name: c.name }));
  }

  return cache;
}

function createToolHandler(
  toolName: string,
  apiClient: ApiClient,
  nameResolver: NameResolver,
  inventoryId: string
): ToolHandler | null {
  switch (toolName) {
    case searchThings.definition.name:
      return searchThings.createHandler(apiClient, inventoryId);
    case getThingsInLocation.definition.name:
      return getThingsInLocation.createHandler(apiClient, nameResolver, inventoryId);
    case createThing.definition.name:
      return createThing.createHandler(apiClient, nameResolver, inventoryId);
    case updateThing.definition.name:
      return updateThing.createHandler(apiClient, nameResolver, inventoryId);
    case moveThing.definition.name:
      return moveThing.createHandler(apiClient, nameResolver, inventoryId);
    case deleteThing.definition.name:
      return deleteThing.createHandler(apiClient, nameResolver, inventoryId);
    case listLocations.definition.name:
      return listLocations.createHandler(apiClient, nameResolver, inventoryId);
    case listRooms.definition.name:
      return listRooms.createHandler(apiClient, nameResolver, inventoryId);
    case listCategories.definition.name:
      return listCategories.createHandler(apiClient, nameResolver, inventoryId);
    case getThingsByCategory.definition.name:
      return getThingsByCategory.createHandler(apiClient, nameResolver, inventoryId);
    case listContainers.definition.name:
      return listContainers.createHandler(apiClient, nameResolver, inventoryId);
    case getContainerContents.definition.name:
      return getContainerContents.createHandler(apiClient, nameResolver, inventoryId);
    case findThingContainer.definition.name:
      return findThingContainer.createHandler(apiClient, nameResolver, inventoryId);
    default:
      return null;
  }
}

// --- Main handlers ---

export async function handleMcpPost(
  event: APIGatewayProxyEventV2,
  config: RemoteServerConfig,
  _jwksCache: JwksCache
): Promise<APIGatewayProxyResultV2> {
  // 1. Extract and validate Bearer token
  const token = extractBearerToken(event);
  if (!token) return unauthorized(config.serverBaseUrl);

  const jwtValidator = new JwtValidator(config.tokenSigningSecret);
  const payload = await jwtValidator.validateToken(token);
  if (!payload) return unauthorized(config.serverBaseUrl);

  // 2. Parse JSON-RPC request
  const parsed = parseJsonRpcBody(event.body);
  if (!parsed) return jsonRpcError(null, -32700, "Parse error");
  if (!isValidJsonRpc(parsed)) {
    const requestId = (parsed as Record<string, unknown>)?.id;
    const id = typeof requestId === "string" || typeof requestId === "number" ? requestId : null;
    return jsonRpcError(id, -32600, "Invalid Request");
  }

  // 3. Handle 'initialize' — create new session
  if (parsed.method === "initialize") {
    return await handleInitialize(parsed, payload, config);
  }

  // 4. For all other methods, require Mcp-Session-Id
  const sessionId =
    event.headers?.["mcp-session-id"] ?? event.headers?.["Mcp-Session-Id"];
  if (!sessionId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing Mcp-Session-Id header" }),
    };
  }

  // 5. Load session from DynamoDB
  const store = new SessionStore(config.sessionsTableName, config.region);
  const session = await store.getSession(sessionId);
  if (!session) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Session not found" }),
    };
  }

  // 6. Check rate limit
  if (!checkRateLimit(session, config.rateLimitPerMinute)) {
    // Update rate limit timestamps
    const now = Date.now();
    const windowStart = now - 60_000;
    const timestamps = (session.requestTimestamps ?? []).filter(
      (ts) => ts > windowStart
    );
    await store.updateRateLimit(sessionId, timestamps);

    return {
      statusCode: 429,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Rate limit exceeded" }),
    };
  }

  // Record the request timestamp for rate limiting
  const now = Date.now();
  const windowStart = now - 60_000;
  const updatedTimestamps = [
    ...(session.requestTimestamps ?? []).filter((ts) => ts > windowStart),
    now,
  ];
  await store.updateRateLimit(sessionId, updatedTimestamps);

  // 7. Handle tools/list
  if (parsed.method === "tools/list") {
    await store.touchSession(sessionId, config.sessionTimeoutMs);
    return jsonRpcResponse(parsed.id, { tools: toolDefinitions });
  }

  // 8. Handle tools/call
  if (parsed.method === "tools/call") {
    const result = await executeToolCall(
      parsed,
      session,
      config,
      store,
      sessionId
    );
    await store.touchSession(sessionId, config.sessionTimeoutMs);
    return result;
  }

  // 9. Unknown method
  return jsonRpcError(parsed.id, -32601, "Method not found");
}

export async function handleMcpDelete(
  event: APIGatewayProxyEventV2,
  config: RemoteServerConfig,
  _jwksCache: JwksCache
): Promise<APIGatewayProxyResultV2> {
  // Validate Bearer token
  const token = extractBearerToken(event);
  if (!token) return unauthorized(config.serverBaseUrl);

  const jwtValidator = new JwtValidator(config.tokenSigningSecret);
  const payload = await jwtValidator.validateToken(token);
  if (!payload) return unauthorized(config.serverBaseUrl);

  // Get session ID
  const sessionId =
    event.headers?.["mcp-session-id"] ?? event.headers?.["Mcp-Session-Id"];
  if (!sessionId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing Mcp-Session-Id header" }),
    };
  }

  // Delete session
  const store = new SessionStore(config.sessionsTableName, config.region);
  const session = await store.getSession(sessionId);
  if (!session) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Session not found" }),
    };
  }

  await store.deleteSession(sessionId);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "terminated" }),
  };
}

// --- Initialize handler ---

async function handleInitialize(
  request: JsonRpcRequest,
  userPayload: JwtPayload,
  config: RemoteServerConfig
): Promise<APIGatewayProxyResultV2> {
  const store = new SessionStore(config.sessionsTableName, config.region);

  // Check max sessions
  const count = await store.countActiveSessions();
  if (count >= config.maxSessions) {
    return {
      statusCode: 503,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Service at capacity, try again later" }),
    };
  }

  // Generate session ID
  const sessionId = generateSessionId();

  // Resolve user's inventory ID from Backend API
  let inventoryId: string;
  try {
    inventoryId = await resolveInventoryId(
      userPayload.cognitoAccessToken,
      config
    );
  } catch (error) {
    const message =
      error instanceof ApiClientError
        ? error.message
        : "Failed to resolve inventory";
    return jsonRpcError(request.id, -32603, message);
  }

  // Store session in DynamoDB
  const now = Date.now();
  await store.createSession({
    sessionId,
    userId: userPayload.sub,
    email: userPayload.email,
    inventoryId,
    cognitoAccessToken: userPayload.cognitoAccessToken,
    cognitoRefreshToken: userPayload.cognitoRefreshToken,
    cognitoTokenExpiresAt: userPayload.cognitoTokenExpiresAt,
    createdAt: now,
    lastActivityAt: now,
    ttl: Math.floor((now + config.sessionTimeoutMs) / 1000),
  });

  // Return MCP initialize response with session ID header
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "wheresmystuff", version: "1.0.0" },
      },
    }),
  };
}

// --- Tool call execution ---

async function executeToolCall(
  request: JsonRpcRequest,
  session: SessionRecord,
  config: RemoteServerConfig,
  store: SessionStore,
  sessionId: string
): Promise<APIGatewayProxyResultV2> {
  const params = request.params as
    | { name?: string; arguments?: Record<string, unknown> }
    | undefined;

  const toolName = params?.name;
  const toolArgs = params?.arguments ?? {};

  if (!toolName) {
    return jsonRpcError(request.id, -32600, "Missing tool name in params");
  }

  // Track if token was refreshed during this request
  let tokenRefreshed = false;
  let newAccessToken = session.cognitoAccessToken;
  let newExpiresAt = session.cognitoTokenExpiresAt;

  const authManager = new RemoteAuthManager(
    session.cognitoAccessToken,
    session.cognitoRefreshToken,
    config.cognitoDomain,
    config.clientId,
    (token, expiresAt) => {
      tokenRefreshed = true;
      newAccessToken = token;
      newExpiresAt = expiresAt;
    }
  );

  const apiClient = new ApiClient({
    baseUrl: config.apiUrl,
    authManager: authManager as unknown as import("../auth-manager.js").AuthManager,
  });

  const nameResolver = buildNameResolver(
    apiClient,
    session.inventoryId,
    session.nameCache
  );

  // Create the tool handler
  const handler = createToolHandler(
    toolName,
    apiClient,
    nameResolver,
    session.inventoryId
  );

  if (!handler) {
    return jsonRpcError(request.id, -32601, `Unknown tool: ${toolName}`);
  }

  // Execute the tool
  let result: { content: Array<{ type: "text"; text: string }>; isError?: boolean };
  try {
    result = await handler(toolArgs);
  } catch (error) {
    // Map Backend API errors to MCP error responses
    if (error instanceof ApiClientError) {
      const errorMessage = mapApiErrorToMessage(error);
      result = {
        content: [{ type: "text" as const, text: errorMessage }],
        isError: true,
      };
    } else {
      result = {
        content: [{ type: "text" as const, text: "An unexpected error occurred" }],
        isError: true,
      };
    }
  }

  // Persist token refresh if it happened
  if (tokenRefreshed) {
    await store.updateTokens(sessionId, newAccessToken, newExpiresAt);
  }

  // Persist name cache updates
  const updatedCache = serializeNameCache(nameResolver);
  if (updatedCache) {
    await store.updateNameCache(sessionId, updatedCache);
  }

  return jsonRpcResponse(request.id, result);
}

function mapApiErrorToMessage(error: ApiClientError): string {
  switch (error.statusCode) {
    case 401:
      return "Session expired, please re-authenticate";
    case 403:
      return "Access denied to this resource";
    case 404:
      return "Resource not found";
    case 429:
      return "Rate limited by inventory service, please retry later";
    default:
      if (error.statusCode && error.statusCode >= 500) {
        return "Unable to reach the inventory service";
      }
      return error.message || "An unexpected error occurred";
  }
}
