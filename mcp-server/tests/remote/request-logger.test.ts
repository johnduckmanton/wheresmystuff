import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { logRequest, logSessionEvent, logError } from "../../src/remote/request-logger.js";

function createMockEvent(overrides?: Partial<APIGatewayProxyEventV2>): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: "/mcp",
    rawQueryString: "",
    headers: {
      "content-type": "application/json",
      ...overrides?.headers,
    },
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "example.execute-api.us-east-1.amazonaws.com",
      domainPrefix: "example",
      http: {
        method: "POST",
        path: "/mcp",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test-agent",
        ...overrides?.requestContext?.http,
      },
      requestId: "req-abc-123",
      routeKey: "$default",
      stage: "$default",
      time: "01/Jan/2024:00:00:00 +0000",
      timeEpoch: 1704067200000,
      ...overrides?.requestContext,
    } as APIGatewayProxyEventV2["requestContext"],
    body: overrides?.body ?? undefined,
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe("request-logger", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("logRequest", () => {
    it("logs structured JSON with required fields", () => {
      const event = createMockEvent();
      logRequest(event, 200, 42);

      expect(consoleSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);

      expect(output.level).toBe("info");
      expect(output.type).toBe("request");
      expect(output.method).toBe("POST");
      expect(output.path).toBe("/mcp");
      expect(output.statusCode).toBe(200);
      expect(output.durationMs).toBe(42);
      expect(output.requestId).toBe("req-abc-123");
    });

    it("includes ISO 8601 timestamp", () => {
      const event = createMockEvent();
      logRequest(event, 200, 10);

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      // Validate ISO 8601 format
      expect(new Date(output.timestamp).toISOString()).toBe(output.timestamp);
    });

    it("includes sessionId when mcp-session-id header is present", () => {
      const event = createMockEvent({
        headers: { "mcp-session-id": "session-xyz-456" },
      });
      logRequest(event, 200, 15);

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.sessionId).toBe("session-xyz-456");
    });

    it("omits sessionId when mcp-session-id header is absent", () => {
      const event = createMockEvent();
      logRequest(event, 404, 5);

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.sessionId).toBeUndefined();
    });

    it("logs correct method and path from event", () => {
      const event = createMockEvent();
      event.rawPath = "/health";
      event.requestContext.http.method = "GET";
      logRequest(event, 200, 2);

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.method).toBe("GET");
      expect(output.path).toBe("/health");
    });

    it("never includes request body in the log", () => {
      const event = createMockEvent({
        body: JSON.stringify({ secret: "password123", token: "sensitive-token-value" }),
      });
      logRequest(event, 200, 10);

      const raw = consoleSpy.mock.calls[0][0] as string;
      expect(raw).not.toContain("password123");
      expect(raw).not.toContain("secret");
      expect(raw).not.toContain("sensitive-token-value");
    });

    it("never includes authorization headers in the log", () => {
      const event = createMockEvent({
        headers: {
          authorization: "Bearer super-secret-token-xyz",
        },
      });
      logRequest(event, 200, 10);

      const raw = consoleSpy.mock.calls[0][0] as string;
      expect(raw).not.toContain("super-secret-token-xyz");
      expect(raw).not.toContain("authorization");
      expect(raw).not.toContain("Bearer");
    });
  });

  describe("logSessionEvent", () => {
    it("logs session creation event", () => {
      logSessionEvent("created", "session-abc", "user-123");

      expect(consoleSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);

      expect(output.level).toBe("info");
      expect(output.type).toBe("session");
      expect(output.eventType).toBe("created");
      expect(output.sessionId).toBe("session-abc");
      expect(output.userId).toBe("user-123");
    });

    it("logs session expiry event", () => {
      logSessionEvent("expired", "session-def", "user-456");

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.eventType).toBe("expired");
      expect(output.sessionId).toBe("session-def");
      expect(output.userId).toBe("user-456");
    });

    it("logs session termination event", () => {
      logSessionEvent("terminated", "session-ghi", "user-789");

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.eventType).toBe("terminated");
    });

    it("includes ISO 8601 timestamp", () => {
      logSessionEvent("created", "session-abc", "user-123");

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(new Date(output.timestamp).toISOString()).toBe(output.timestamp);
    });
  });

  describe("logError", () => {
    it("logs error message and stack trace", () => {
      const error = new Error("Something went wrong");
      logError(error);

      expect(consoleSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);

      expect(output.level).toBe("error");
      expect(output.type).toBe("error");
      expect(output.message).toBe("Something went wrong");
      expect(output.stack).toContain("Something went wrong");
    });

    it("handles non-Error objects", () => {
      logError("string error");

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.message).toBe("string error");
      expect(output.stack).toBeUndefined();
    });

    it("includes request context when event is provided", () => {
      const event = createMockEvent({
        rawPath: "/mcp",
        requestContext: {
          http: { method: "POST" },
          requestId: "req-error-456",
        } as APIGatewayProxyEventV2["requestContext"],
      });
      const error = new Error("Failure");
      logError(error, event);

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.requestId).toBe("req-error-456");
      expect(output.method).toBe("POST");
      expect(output.path).toBe("/mcp");
    });

    it("NEVER logs authorization tokens from event headers", () => {
      const event = createMockEvent({
        headers: {
          authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.secret-token-value",
          "x-api-key": "api-key-12345",
        },
      });
      const error = new Error("Auth failure");
      logError(error, event);

      const raw = consoleSpy.mock.calls[0][0] as string;
      expect(raw).not.toContain("eyJhbGciOiJIUzI1NiJ9");
      expect(raw).not.toContain("secret-token-value");
      expect(raw).not.toContain("Bearer");
      expect(raw).not.toContain("api-key-12345");
      expect(raw).not.toContain("authorization");
    });

    it("NEVER logs request body from event", () => {
      const event = createMockEvent({
        body: JSON.stringify({
          access_token: "secret-access-token",
          refresh_token: "secret-refresh-token",
          password: "user-password",
        }),
      });
      const error = new Error("Processing failed");
      logError(error, event);

      const raw = consoleSpy.mock.calls[0][0] as string;
      expect(raw).not.toContain("secret-access-token");
      expect(raw).not.toContain("secret-refresh-token");
      expect(raw).not.toContain("user-password");
      expect(raw).not.toContain("body");
    });

    it("includes ISO 8601 timestamp", () => {
      logError(new Error("test"));

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(new Date(output.timestamp).toISOString()).toBe(output.timestamp);
    });

    it("does not include event fields when event is not provided", () => {
      logError(new Error("no event"));

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.requestId).toBeUndefined();
      expect(output.method).toBeUndefined();
      expect(output.path).toBeUndefined();
    });
  });
});
