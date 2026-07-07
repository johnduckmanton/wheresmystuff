import { describe, it, expect } from "vitest";
import { validateSecurity, checkRateLimit } from "../../src/remote/security-middleware.js";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { RemoteServerConfig } from "../../src/remote/remote-config.js";
import type { SessionRecord } from "../../src/remote/session-store.js";

function makeEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "POST /mcp",
    rawPath: "/mcp",
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "api.example.com",
      domainPrefix: "api",
      http: { method: "POST", path: "/mcp", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
      requestId: "req-1",
      routeKey: "POST /mcp",
      stage: "$default",
      time: "01/Jan/2024:00:00:00 +0000",
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
    ...overrides,
  } as APIGatewayProxyEventV2;
}

function makeConfig(overrides: Partial<RemoteServerConfig> = {}): RemoteServerConfig {
  return {
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
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    sessionId: "abc123",
    userId: "user-1",
    email: "user@example.com",
    inventoryId: "inv-1",
    cognitoAccessToken: "token",
    cognitoRefreshToken: "refresh",
    cognitoTokenExpiresAt: Date.now() + 3600000,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    ttl: Math.floor(Date.now() / 1000) + 1800,
    ...overrides,
  };
}

describe("validateSecurity", () => {
  describe("origin validation", () => {
    it("allows request when allowedOrigins is empty (no restriction)", () => {
      const event = makeEvent({ headers: { origin: "https://evil.com" } });
      const config = makeConfig({ allowedOrigins: [] });

      const result = validateSecurity(event, config);
      expect(result).toBeNull();
    });

    it("allows request when origin is in allowlist", () => {
      const event = makeEvent({ headers: { origin: "https://app.example.com" } });
      const config = makeConfig({ allowedOrigins: ["https://app.example.com", "https://other.com"] });

      const result = validateSecurity(event, config);
      expect(result).toBeNull();
    });

    it("returns 403 when origin is not in allowlist", () => {
      const event = makeEvent({ headers: { origin: "https://evil.com" } });
      const config = makeConfig({ allowedOrigins: ["https://app.example.com"] });

      const result = validateSecurity(event, config);
      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(403);
      expect(result!.body).toBe("Forbidden: origin not allowed");
    });

    it("allows request when no origin header is present (even with allowlist)", () => {
      const event = makeEvent({ headers: {} });
      const config = makeConfig({ allowedOrigins: ["https://app.example.com"] });

      const result = validateSecurity(event, config);
      expect(result).toBeNull();
    });
  });

  describe("payload size validation", () => {
    it("allows request when body is within limit", () => {
      const event = makeEvent({ body: "x".repeat(100) });
      const config = makeConfig({ maxPayloadBytes: 1000 });

      const result = validateSecurity(event, config);
      expect(result).toBeNull();
    });

    it("returns 413 when body exceeds limit", () => {
      const event = makeEvent({ body: "x".repeat(2000) });
      const config = makeConfig({ maxPayloadBytes: 1000 });

      const result = validateSecurity(event, config);
      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(413);
      expect(result!.body).toBe("Payload too large");
    });

    it("allows request when body is exactly at limit", () => {
      const event = makeEvent({ body: "x".repeat(1000) });
      const config = makeConfig({ maxPayloadBytes: 1000 });

      const result = validateSecurity(event, config);
      expect(result).toBeNull();
    });

    it("allows request when body is absent", () => {
      const event = makeEvent({ body: undefined });
      const config = makeConfig({ maxPayloadBytes: 100 });

      const result = validateSecurity(event, config);
      expect(result).toBeNull();
    });
  });

  describe("combined checks", () => {
    it("checks origin before payload size", () => {
      const event = makeEvent({
        headers: { origin: "https://evil.com" },
        body: "x".repeat(2000),
      });
      const config = makeConfig({
        allowedOrigins: ["https://app.example.com"],
        maxPayloadBytes: 1000,
      });

      const result = validateSecurity(event, config);
      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(403);
    });
  });
});

describe("checkRateLimit", () => {
  it("allows request when no previous timestamps exist", () => {
    const session = makeSession({ requestTimestamps: undefined });
    expect(checkRateLimit(session, 100)).toBe(true);
  });

  it("allows request when timestamps are empty", () => {
    const session = makeSession({ requestTimestamps: [] });
    expect(checkRateLimit(session, 100)).toBe(true);
  });

  it("allows request when under the limit", () => {
    const now = Date.now();
    const timestamps = Array.from({ length: 5 }, (_, i) => now - i * 1000);
    const session = makeSession({ requestTimestamps: timestamps });

    expect(checkRateLimit(session, 100)).toBe(true);
  });

  it("blocks request when at the limit", () => {
    const now = Date.now();
    const timestamps = Array.from({ length: 100 }, (_, i) => now - i * 500);
    const session = makeSession({ requestTimestamps: timestamps });

    expect(checkRateLimit(session, 100)).toBe(false);
  });

  it("blocks request when over the limit", () => {
    const now = Date.now();
    const timestamps = Array.from({ length: 150 }, (_, i) => now - i * 300);
    const session = makeSession({ requestTimestamps: timestamps });

    expect(checkRateLimit(session, 100)).toBe(false);
  });

  it("ignores timestamps older than 60 seconds", () => {
    const now = Date.now();
    // 50 timestamps within the window, 60 older than 60s
    const recentTimestamps = Array.from({ length: 50 }, (_, i) => now - i * 1000);
    const oldTimestamps = Array.from({ length: 60 }, (_, i) => now - 70_000 - i * 1000);
    const session = makeSession({ requestTimestamps: [...recentTimestamps, ...oldTimestamps] });

    expect(checkRateLimit(session, 100)).toBe(true);
  });

  it("blocks when recent timestamps alone exceed limit", () => {
    const now = Date.now();
    // 100 timestamps all within the last 60 seconds
    const timestamps = Array.from({ length: 100 }, (_, i) => now - i * 500);
    // Plus some old ones that should be ignored
    const oldTimestamps = Array.from({ length: 50 }, (_, i) => now - 120_000 - i * 1000);
    const session = makeSession({ requestTimestamps: [...timestamps, ...oldTimestamps] });

    expect(checkRateLimit(session, 100)).toBe(false);
  });

  it("uses maxPerMinute of 1 correctly", () => {
    const now = Date.now();
    const session = makeSession({ requestTimestamps: [now - 1000] });
    expect(checkRateLimit(session, 1)).toBe(false);
  });
});
