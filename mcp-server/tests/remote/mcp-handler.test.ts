import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { RemoteServerConfig } from "../../src/remote/remote-config.js";
import type { JwksCache } from "../../src/remote/jwks-cache.js";
import { JwtValidator } from "../../src/remote/jwt-validator.js";

const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock fetch for inventory resolution
const originalFetch = global.fetch;

function createConfig(overrides: Partial<RemoteServerConfig> = {}): RemoteServerConfig {
  return {
    apiUrl: "https://api.example.com",
    userPoolId: "us-east-1_testpool",
    clientId: "test-client-id",
    region: "us-east-1",
    allowedOrigins: [],
    sessionTimeoutMs: 1800000,
    maxSessions: 1000,
    rateLimitPerMinute: 100,
    maxPayloadBytes: 1048576,
    cognitoDomain: "auth.example.com",
    serverBaseUrl: "https://mcp.example.com",
    tokenSigningSecret: "super-secret-key-at-least-32-characters-long",
    sessionsTableName: "test-sessions",
    ...overrides,
  };
}

function createMockJwksCache(): JwksCache {
  return {} as JwksCache;
}

function createEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "POST /mcp",
    rawPath: "/mcp",
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "mcp.example.com",
      domainPrefix: "mcp",
      http: {
        method: "POST",
        path: "/mcp",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "req-123",
      routeKey: "POST /mcp",
      stage: "$default",
      time: "2024-01-01T00:00:00Z",
      timeEpoch: 1704067200000,
    },
    isBase64Encoded: false,
    ...overrides,
  } as APIGatewayProxyEventV2;
}

async function createValidToken(config: RemoteServerConfig): Promise<string> {
  const validator = new JwtValidator(config.tokenSigningSecret);
  return validator.signToken({
    sub: "user-123",
    email: "test@example.com",
    cognitoAccessToken: "cognito-access-token-abc",
    cognitoRefreshToken: "cognito-refresh-token-xyz",
    cognitoTokenExpiresAt: Date.now() + 3600000,
  });
}

describe("MCP Handler", () => {
  let config: RemoteServerConfig;
  let jwksCache: JwksCache;

  beforeEach(() => {
    ddbMock.reset();
    config = createConfig();
    jwksCache = createMockJwksCache();
    global.fetch = originalFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  describe("handleMcpPost", () => {
    it("returns 401 with WWW-Authenticate header when no token provided", async () => {
      const { handleMcpPost } = await import("../../src/remote/mcp-handler.js");
      const event = createEvent({
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
      });

      const result = await handleMcpPost(event, config, jwksCache);

      expect(result.statusCode).toBe(401);
      expect(result.headers).toHaveProperty("WWW-Authenticate");
      expect((result.headers as Record<string, string>)["WWW-Authenticate"]).toContain(
        "/.well-known/oauth-authorization-server"
      );
    });

    it("returns 401 when token is invalid", async () => {
      const { handleMcpPost } = await import("../../src/remote/mcp-handler.js");
      const event = createEvent({
        headers: { authorization: "Bearer invalid-token" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
      });

      const result = await handleMcpPost(event, config, jwksCache);

      expect(result.statusCode).toBe(401);
    });

    it("returns -32700 for invalid JSON body", async () => {
      const { handleMcpPost } = await import("../../src/remote/mcp-handler.js");
      const token = await createValidToken(config);
      const event = createEvent({
        headers: { authorization: `Bearer ${token}` },
        body: "not valid json{{{",
      });

      const result = await handleMcpPost(event, config, jwksCache);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe(-32700);
      expect(body.error.message).toBe("Parse error");
      expect(body.id).toBeNull();
    });

    it("returns -32600 for invalid JSON-RPC structure (missing method)", async () => {
      const { handleMcpPost } = await import("../../src/remote/mcp-handler.js");
      const token = await createValidToken(config);
      const event = createEvent({
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1 }),
      });

      const result = await handleMcpPost(event, config, jwksCache);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe(-32600);
      expect(body.error.message).toBe("Invalid Request");
    });

    it("returns -32600 for invalid JSON-RPC structure (missing id)", async () => {
      const { handleMcpPost } = await import("../../src/remote/mcp-handler.js");
      const token = await createValidToken(config);
      const event = createEvent({
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ jsonrpc: "2.0", method: "initialize" }),
      });

      const result = await handleMcpPost(event, config, jwksCache);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe(-32600);
    });

    it("returns -32601 for unknown methods", async () => {
      const { handleMcpPost } = await import("../../src/remote/mcp-handler.js");
      const token = await createValidToken(config);
      const event = createEvent({
        headers: {
          authorization: `Bearer ${token}`,
          "mcp-session-id": "session-abc123",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "unknown/method" }),
      });

      // Mock session exists
      ddbMock.on(GetCommand).resolves({
        Item: {
          pk: "session-abc123",
          sk: "SESSION",
          userId: "user-123",
          email: "test@example.com",
          inventoryId: "inv-123",
          cognitoAccessToken: "token-abc",
          cognitoRefreshToken: "refresh-abc",
          cognitoTokenExpiresAt: Date.now() + 3600000,
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
          ttl: Math.floor(Date.now() / 1000) + 1800,
          requestTimestamps: [],
        },
      });
      ddbMock.on(UpdateCommand).resolves({});

      const result = await handleMcpPost(event, config, jwksCache);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe(-32601);
      expect(body.error.message).toBe("Method not found");
    });

    describe("initialize", () => {
      it("creates a session and returns MCP init response with session ID header", async () => {
        const { handleMcpPost } = await import("../../src/remote/mcp-handler.js");
        const token = await createValidToken(config);

        // Mock fetch for inventory resolution
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [{ id: "inv-456" }] }),
        }) as unknown as typeof fetch;

        // Mock DynamoDB - count sessions
        ddbMock.on(ScanCommand).resolves({ Count: 5 });
        ddbMock.on(PutCommand).resolves({});

        const event = createEvent({
          headers: { authorization: `Bearer ${token}` },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
        });

        const result = await handleMcpPost(event, config, jwksCache);

        expect(result.statusCode).toBe(200);
        expect(result.headers).toHaveProperty("Mcp-Session-Id");

        const sessionId = (result.headers as Record<string, string>)["Mcp-Session-Id"];
        expect(sessionId).toMatch(/^[a-f0-9]{64}$/);

        const body = JSON.parse(result.body as string);
        expect(body.jsonrpc).toBe("2.0");
        expect(body.id).toBe(1);
        expect(body.result.serverInfo.name).toBe("wheresmystuff");
        expect(body.result.serverInfo.version).toBe("1.0.0");
        expect(body.result.protocolVersion).toBe("2025-03-26");
        expect(body.result.capabilities.tools).toEqual({});
      });

      it("returns 503 when max sessions reached", async () => {
        const { handleMcpPost } = await import("../../src/remote/mcp-handler.js");
        const token = await createValidToken(config);

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [{ id: "inv-456" }] }),
        }) as unknown as typeof fetch;

        ddbMock.on(ScanCommand).resolves({ Count: 1000 });

        const event = createEvent({
          headers: { authorization: `Bearer ${token}` },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
        });

        const result = await handleMcpPost(event, config, jwksCache);

        expect(result.statusCode).toBe(503);
      });
    });

    describe("tools/list", () => {
      it("returns all 13 tool definitions", async () => {
        const { handleMcpPost } = await import("../../src/remote/mcp-handler.js");
        const token = await createValidToken(config);

        ddbMock.on(GetCommand).resolves({
          Item: {
            pk: "session-abc123",
            sk: "SESSION",
            userId: "user-123",
            email: "test@example.com",
            inventoryId: "inv-123",
            cognitoAccessToken: "token-abc",
            cognitoRefreshToken: "refresh-abc",
            cognitoTokenExpiresAt: Date.now() + 3600000,
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
            ttl: Math.floor(Date.now() / 1000) + 1800,
            requestTimestamps: [],
          },
        });
        ddbMock.on(UpdateCommand).resolves({});

        const event = createEvent({
          headers: {
            authorization: `Bearer ${token}`,
            "mcp-session-id": "session-abc123",
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
        });

        const result = await handleMcpPost(event, config, jwksCache);

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body as string);
        expect(body.jsonrpc).toBe("2.0");
        expect(body.id).toBe(2);
        expect(body.result.tools).toHaveLength(13);

        const toolNames = body.result.tools.map((t: { name: string }) => t.name);
        expect(toolNames).toContain("search_things");
        expect(toolNames).toContain("create_thing");
        expect(toolNames).toContain("list_locations");
        expect(toolNames).toContain("find_thing_container");
      });
    });

    describe("tools/call", () => {
      it("executes a tool and returns result", async () => {
        const { handleMcpPost } = await import("../../src/remote/mcp-handler.js");
        const token = await createValidToken(config);

        ddbMock.on(GetCommand).resolves({
          Item: {
            pk: "session-abc123",
            sk: "SESSION",
            userId: "user-123",
            email: "test@example.com",
            inventoryId: "inv-123",
            cognitoAccessToken: "cognito-token",
            cognitoRefreshToken: "refresh-token",
            cognitoTokenExpiresAt: Date.now() + 3600000,
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
            ttl: Math.floor(Date.now() / 1000) + 1800,
            requestTimestamps: [],
          },
        });
        ddbMock.on(UpdateCommand).resolves({});

        // Mock the backend API calls that list_locations makes
        global.fetch = vi.fn().mockImplementation((url: string) => {
          if (typeof url === "string" && url.includes("/locations")) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers(),
              json: () => Promise.resolve({
                success: true,
                data: [
                  { id: "loc-1", name: "Home", description: "My house" },
                  { id: "loc-2", name: "Office", description: "Work place" },
                ],
              }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: () => Promise.resolve({ success: true, data: [] }),
          });
        }) as unknown as typeof fetch;

        const event = createEvent({
          headers: {
            authorization: `Bearer ${token}`,
            "mcp-session-id": "session-abc123",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "list_locations", arguments: {} },
          }),
        });

        const result = await handleMcpPost(event, config, jwksCache);

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body as string);
        expect(body.jsonrpc).toBe("2.0");
        expect(body.id).toBe(3);
        expect(body.result).toBeDefined();
        expect(body.result.content).toBeDefined();
        expect(Array.isArray(body.result.content)).toBe(true);
      });

      it("returns -32601 for unknown tool name", async () => {
        const { handleMcpPost } = await import("../../src/remote/mcp-handler.js");
        const token = await createValidToken(config);

        ddbMock.on(GetCommand).resolves({
          Item: {
            pk: "session-abc123",
            sk: "SESSION",
            userId: "user-123",
            email: "test@example.com",
            inventoryId: "inv-123",
            cognitoAccessToken: "cognito-token",
            cognitoRefreshToken: "refresh-token",
            cognitoTokenExpiresAt: Date.now() + 3600000,
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
            ttl: Math.floor(Date.now() / 1000) + 1800,
            requestTimestamps: [],
          },
        });
        ddbMock.on(UpdateCommand).resolves({});

        const event = createEvent({
          headers: {
            authorization: `Bearer ${token}`,
            "mcp-session-id": "session-abc123",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 4,
            method: "tools/call",
            params: { name: "nonexistent_tool", arguments: {} },
          }),
        });

        const result = await handleMcpPost(event, config, jwksCache);

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body as string);
        expect(body.error.code).toBe(-32601);
        expect(body.error.message).toContain("Unknown tool");
      });
    });

    describe("session validation", () => {
      it("returns 400 when session ID is missing for non-initialize methods", async () => {
        const { handleMcpPost } = await import("../../src/remote/mcp-handler.js");
        const token = await createValidToken(config);

        const event = createEvent({
          headers: { authorization: `Bearer ${token}` },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        });

        const result = await handleMcpPost(event, config, jwksCache);

        expect(result.statusCode).toBe(400);
      });

      it("returns 404 when session not found in DynamoDB", async () => {
        const { handleMcpPost } = await import("../../src/remote/mcp-handler.js");
        const token = await createValidToken(config);

        ddbMock.on(GetCommand).resolves({ Item: undefined });

        const event = createEvent({
          headers: {
            authorization: `Bearer ${token}`,
            "mcp-session-id": "nonexistent-session",
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        });

        const result = await handleMcpPost(event, config, jwksCache);

        expect(result.statusCode).toBe(404);
      });
    });
  });

  describe("handleMcpDelete", () => {
    it("deletes session and returns 200", async () => {
      const { handleMcpDelete } = await import("../../src/remote/mcp-handler.js");
      const token = await createValidToken(config);

      ddbMock.on(GetCommand).resolves({
        Item: {
          pk: "session-to-delete",
          sk: "SESSION",
          userId: "user-123",
          email: "test@example.com",
          inventoryId: "inv-123",
          cognitoAccessToken: "token",
          cognitoRefreshToken: "refresh",
          cognitoTokenExpiresAt: Date.now() + 3600000,
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
          ttl: Math.floor(Date.now() / 1000) + 1800,
        },
      });
      ddbMock.on(DeleteCommand).resolves({});

      const event = createEvent({
        headers: {
          authorization: `Bearer ${token}`,
          "mcp-session-id": "session-to-delete",
        },
      });

      const result = await handleMcpDelete(event, config, jwksCache);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body as string);
      expect(body.status).toBe("terminated");
    });

    it("returns 401 when no auth token provided", async () => {
      const { handleMcpDelete } = await import("../../src/remote/mcp-handler.js");
      const event = createEvent({
        headers: { "mcp-session-id": "session-abc" },
      });

      const result = await handleMcpDelete(event, config, jwksCache);

      expect(result.statusCode).toBe(401);
    });

    it("returns 404 when session not found", async () => {
      const { handleMcpDelete } = await import("../../src/remote/mcp-handler.js");
      const token = await createValidToken(config);

      ddbMock.on(GetCommand).resolves({ Item: undefined });

      const event = createEvent({
        headers: {
          authorization: `Bearer ${token}`,
          "mcp-session-id": "nonexistent-session",
        },
      });

      const result = await handleMcpDelete(event, config, jwksCache);

      expect(result.statusCode).toBe(404);
    });
  });
});
