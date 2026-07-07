import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

// Mock dependencies before importing handler
vi.mock("../../src/remote/remote-config.js", () => ({
  loadRemoteConfig: vi.fn(() => ({
    apiUrl: "https://api.example.com",
    userPoolId: "us-east-1_abc123",
    clientId: "client-id",
    region: "us-east-1",
    allowedOrigins: [],
    sessionTimeoutMs: 1800000,
    maxSessions: 1000,
    rateLimitPerMinute: 100,
    maxPayloadBytes: 1048576,
    cognitoDomain: "auth.example.com",
    serverBaseUrl: "https://mcp.example.com",
    tokenSigningSecret: "secret",
    sessionsTableName: "mcp-sessions",
  })),
}));

vi.mock("../../src/remote/jwks-cache.js", () => ({
  JwksCache: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../src/remote/security-middleware.js", () => ({
  validateSecurity: vi.fn(() => null),
}));

vi.mock("../../src/remote/oauth-proxy.js", () => ({
  handleOAuthMetadata: vi.fn(() => ({
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issuer: "https://mcp.example.com" }),
  })),
  handleAuthorize: vi.fn(async () => ({
    statusCode: 302,
    headers: { Location: "https://auth.example.com/login" },
    body: "",
  })),
  handleCallback: vi.fn(async () => ({
    statusCode: 302,
    headers: { Location: "https://client.example.com/callback?code=abc" },
    body: "",
  })),
  handleTokenExchange: vi.fn(async () => ({
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: "jwt-token", token_type: "Bearer" }),
  })),
}));

vi.mock("../../src/remote/mcp-handler.js", () => ({
  handleMcpPost: vi.fn(async () => ({
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }),
  })),
  handleMcpDelete: vi.fn(async () => ({
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "terminated" }),
  })),
}));

vi.mock("../../src/remote/request-logger.js", () => ({
  logRequest: vi.fn(),
  logError: vi.fn(),
}));

import { handler } from "../../src/remote/lambda-handler.js";
import { validateSecurity } from "../../src/remote/security-middleware.js";
import { handleOAuthMetadata, handleAuthorize, handleCallback, handleTokenExchange } from "../../src/remote/oauth-proxy.js";
import { handleMcpPost, handleMcpDelete } from "../../src/remote/mcp-handler.js";
import { logRequest, logError } from "../../src/remote/request-logger.js";

function makeEvent(method: string, path: string, overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "api.example.com",
      domainPrefix: "api",
      http: { method, path, protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
      requestId: "req-1",
      routeKey: `${method} ${path}`,
      stage: "$default",
      time: "01/Jan/2024:00:00:00 +0000",
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
    ...overrides,
  } as APIGatewayProxyEventV2;
}

describe("lambda-handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("health endpoint", () => {
    it("returns 200 with status ok for GET /health", async () => {
      const event = makeEvent("GET", "/health");
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body as string);
      expect(body.status).toBe("ok");
    });

    it("includes Content-Type application/json header", async () => {
      const event = makeEvent("GET", "/health");
      const result = await handler(event);

      expect(result.headers).toHaveProperty("Content-Type", "application/json");
    });
  });

  describe("routing", () => {
    it("routes GET /.well-known/oauth-authorization-server to handleOAuthMetadata", async () => {
      const event = makeEvent("GET", "/.well-known/oauth-authorization-server");
      await handler(event);

      expect(handleOAuthMetadata).toHaveBeenCalled();
    });

    it("routes GET /authorize to handleAuthorize", async () => {
      const event = makeEvent("GET", "/authorize");
      await handler(event);

      expect(handleAuthorize).toHaveBeenCalledWith(event, expect.any(Object));
    });

    it("routes GET /callback to handleCallback", async () => {
      const event = makeEvent("GET", "/callback");
      await handler(event);

      expect(handleCallback).toHaveBeenCalledWith(event, expect.any(Object));
    });

    it("routes POST /token to handleTokenExchange", async () => {
      const event = makeEvent("POST", "/token");
      await handler(event);

      expect(handleTokenExchange).toHaveBeenCalledWith(event, expect.any(Object));
    });

    it("routes POST /mcp to handleMcpPost", async () => {
      const event = makeEvent("POST", "/mcp");
      await handler(event);

      expect(handleMcpPost).toHaveBeenCalledWith(event, expect.any(Object), expect.any(Object));
    });

    it("routes DELETE /mcp to handleMcpDelete", async () => {
      const event = makeEvent("DELETE", "/mcp");
      await handler(event);

      expect(handleMcpDelete).toHaveBeenCalledWith(event, expect.any(Object), expect.any(Object));
    });
  });

  describe("404 for unknown routes", () => {
    it("returns 404 for unknown path", async () => {
      const event = makeEvent("GET", "/unknown");
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      expect(result.body).toBe("Not found");
    });

    it("returns 404 for valid path with wrong method", async () => {
      const event = makeEvent("POST", "/health");
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
    });

    it("returns 404 for GET /mcp (only POST and DELETE allowed)", async () => {
      const event = makeEvent("GET", "/mcp");
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
    });
  });

  describe("security headers", () => {
    it("adds X-Content-Type-Options: nosniff to all responses", async () => {
      const event = makeEvent("GET", "/health");
      const result = await handler(event);

      expect(result.headers).toHaveProperty("X-Content-Type-Options", "nosniff");
    });

    it("adds X-Frame-Options: DENY to all responses", async () => {
      const event = makeEvent("GET", "/health");
      const result = await handler(event);

      expect(result.headers).toHaveProperty("X-Frame-Options", "DENY");
    });

    it("adds Cache-Control: no-store to all responses", async () => {
      const event = makeEvent("GET", "/health");
      const result = await handler(event);

      expect(result.headers).toHaveProperty("Cache-Control", "no-store");
    });

    it("adds security headers to 404 responses", async () => {
      const event = makeEvent("GET", "/unknown");
      const result = await handler(event);

      expect(result.headers).toHaveProperty("X-Content-Type-Options", "nosniff");
      expect(result.headers).toHaveProperty("X-Frame-Options", "DENY");
      expect(result.headers).toHaveProperty("Cache-Control", "no-store");
    });

    it("adds security headers to security middleware rejection responses", async () => {
      vi.mocked(validateSecurity).mockReturnValueOnce({
        statusCode: 403,
        headers: { "Content-Type": "text/plain" },
        body: "Forbidden",
      });

      const event = makeEvent("POST", "/mcp");
      const result = await handler(event);

      expect(result.statusCode).toBe(403);
      expect(result.headers).toHaveProperty("X-Content-Type-Options", "nosniff");
      expect(result.headers).toHaveProperty("X-Frame-Options", "DENY");
      expect(result.headers).toHaveProperty("Cache-Control", "no-store");
    });
  });

  describe("security middleware", () => {
    it("applies security middleware before routing", async () => {
      vi.mocked(validateSecurity).mockReturnValueOnce({
        statusCode: 413,
        headers: { "Content-Type": "text/plain" },
        body: "Payload too large",
      });

      const event = makeEvent("POST", "/mcp");
      const result = await handler(event);

      expect(result.statusCode).toBe(413);
      expect(handleMcpPost).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("returns 500 with generic message on unhandled exception", async () => {
      vi.mocked(handleMcpPost).mockRejectedValueOnce(new Error("Unexpected failure"));

      const event = makeEvent("POST", "/mcp");
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body as string);
      expect(body.error).toBe("Internal server error");
    });

    it("logs error on unhandled exception", async () => {
      const error = new Error("Unexpected failure");
      vi.mocked(handleMcpPost).mockRejectedValueOnce(error);

      const event = makeEvent("POST", "/mcp");
      await handler(event);

      expect(logError).toHaveBeenCalledWith(error, event);
    });

    it("includes security headers in 500 error response", async () => {
      vi.mocked(handleMcpPost).mockRejectedValueOnce(new Error("fail"));

      const event = makeEvent("POST", "/mcp");
      const result = await handler(event);

      expect(result.headers).toHaveProperty("X-Content-Type-Options", "nosniff");
      expect(result.headers).toHaveProperty("X-Frame-Options", "DENY");
      expect(result.headers).toHaveProperty("Cache-Control", "no-store");
    });
  });

  describe("request logging", () => {
    it("calls logRequest for every successful response", async () => {
      const event = makeEvent("GET", "/health");
      await handler(event);

      expect(logRequest).toHaveBeenCalledWith(event, 200, expect.any(Number));
    });

    it("calls logRequest for 404 responses", async () => {
      const event = makeEvent("GET", "/unknown");
      await handler(event);

      expect(logRequest).toHaveBeenCalledWith(event, 404, expect.any(Number));
    });

    it("calls logRequest for error responses", async () => {
      vi.mocked(handleMcpPost).mockRejectedValueOnce(new Error("fail"));

      const event = makeEvent("POST", "/mcp");
      await handler(event);

      expect(logRequest).toHaveBeenCalledWith(event, 500, expect.any(Number));
    });

    it("calls logRequest for security middleware rejections", async () => {
      vi.mocked(validateSecurity).mockReturnValueOnce({
        statusCode: 403,
        headers: { "Content-Type": "text/plain" },
        body: "Forbidden",
      });

      const event = makeEvent("POST", "/mcp");
      await handler(event);

      expect(logRequest).toHaveBeenCalledWith(event, 403, expect.any(Number));
    });
  });
});
