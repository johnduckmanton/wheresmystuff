import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadRemoteConfig } from "../../src/remote/remote-config.js";

describe("loadRemoteConfig", () => {
  const VALID_ENV = {
    WHERESMYSTUFF_API_URL: "https://api.example.com",
    WHERESMYSTUFF_USER_POOL_ID: "eu-west-1_abc123",
    WHERESMYSTUFF_CLIENT_ID: "client-id-123",
    WHERESMYSTUFF_REGION: "eu-west-1",
    WHERESMYSTUFF_COGNITO_DOMAIN: "wheresmystuff.auth.eu-west-1.amazoncognito.com",
    SERVER_BASE_URL: "https://abc123.execute-api.eu-west-1.amazonaws.com",
    TOKEN_SIGNING_SECRET: "super-secret-key-for-signing",
    SESSIONS_TABLE_NAME: "mcp-sessions-dev",
  };

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear all env vars that could interfere
    for (const key of Object.keys(VALID_ENV)) {
      delete process.env[key];
    }
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.SESSION_TIMEOUT_MS;
    delete process.env.MAX_SESSIONS;
    delete process.env.RATE_LIMIT_PER_MINUTE;
    delete process.env.MAX_PAYLOAD_BYTES;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns a valid config when all required env vars are set", () => {
    Object.assign(process.env, VALID_ENV);

    const config = loadRemoteConfig();

    expect(config).toEqual({
      apiUrl: "https://api.example.com",
      userPoolId: "eu-west-1_abc123",
      clientId: "client-id-123",
      region: "eu-west-1",
      cognitoDomain: "wheresmystuff.auth.eu-west-1.amazoncognito.com",
      serverBaseUrl: "https://abc123.execute-api.eu-west-1.amazonaws.com",
      tokenSigningSecret: "super-secret-key-for-signing",
      sessionsTableName: "mcp-sessions-dev",
      allowedOrigins: [],
      sessionTimeoutMs: 1800000,
      maxSessions: 1000,
      rateLimitPerMinute: 100,
      maxPayloadBytes: 1048576,
    });
  });

  it("throws when a single required variable is missing", () => {
    Object.assign(process.env, VALID_ENV);
    delete process.env.WHERESMYSTUFF_API_URL;

    expect(() => loadRemoteConfig()).toThrow(
      "Missing required environment variables: WHERESMYSTUFF_API_URL"
    );
  });

  it("throws when a required variable is empty", () => {
    Object.assign(process.env, VALID_ENV);
    process.env.WHERESMYSTUFF_REGION = "";

    expect(() => loadRemoteConfig()).toThrow("WHERESMYSTUFF_REGION");
  });

  it("throws when a required variable is only whitespace", () => {
    Object.assign(process.env, VALID_ENV);
    process.env.TOKEN_SIGNING_SECRET = "   ";

    expect(() => loadRemoteConfig()).toThrow("TOKEN_SIGNING_SECRET");
  });

  it("identifies all missing variables in one error message", () => {
    // Don't set any required vars
    expect(() => loadRemoteConfig()).toThrow(
      "Missing required environment variables: WHERESMYSTUFF_API_URL, WHERESMYSTUFF_USER_POOL_ID, WHERESMYSTUFF_CLIENT_ID, WHERESMYSTUFF_REGION, WHERESMYSTUFF_COGNITO_DOMAIN, TOKEN_SIGNING_SECRET, SESSIONS_TABLE_NAME"
    );
  });

  it("parses ALLOWED_ORIGINS as comma-separated list", () => {
    Object.assign(process.env, VALID_ENV);
    process.env.ALLOWED_ORIGINS = "https://example.com, https://other.com";

    const config = loadRemoteConfig();

    expect(config.allowedOrigins).toEqual([
      "https://example.com",
      "https://other.com",
    ]);
  });

  it("returns empty array when ALLOWED_ORIGINS is not set", () => {
    Object.assign(process.env, VALID_ENV);

    const config = loadRemoteConfig();

    expect(config.allowedOrigins).toEqual([]);
  });

  it("filters empty entries from ALLOWED_ORIGINS", () => {
    Object.assign(process.env, VALID_ENV);
    process.env.ALLOWED_ORIGINS = "https://example.com,,, https://other.com,";

    const config = loadRemoteConfig();

    expect(config.allowedOrigins).toEqual([
      "https://example.com",
      "https://other.com",
    ]);
  });

  it("uses default for SESSION_TIMEOUT_MS when not set", () => {
    Object.assign(process.env, VALID_ENV);

    const config = loadRemoteConfig();

    expect(config.sessionTimeoutMs).toBe(1800000);
  });

  it("parses SESSION_TIMEOUT_MS from env", () => {
    Object.assign(process.env, VALID_ENV);
    process.env.SESSION_TIMEOUT_MS = "900000";

    const config = loadRemoteConfig();

    expect(config.sessionTimeoutMs).toBe(900000);
  });

  it("uses default for MAX_SESSIONS when not set", () => {
    Object.assign(process.env, VALID_ENV);

    const config = loadRemoteConfig();

    expect(config.maxSessions).toBe(1000);
  });

  it("parses MAX_SESSIONS from env", () => {
    Object.assign(process.env, VALID_ENV);
    process.env.MAX_SESSIONS = "500";

    const config = loadRemoteConfig();

    expect(config.maxSessions).toBe(500);
  });

  it("uses default for RATE_LIMIT_PER_MINUTE when not set", () => {
    Object.assign(process.env, VALID_ENV);

    const config = loadRemoteConfig();

    expect(config.rateLimitPerMinute).toBe(100);
  });

  it("parses RATE_LIMIT_PER_MINUTE from env", () => {
    Object.assign(process.env, VALID_ENV);
    process.env.RATE_LIMIT_PER_MINUTE = "60";

    const config = loadRemoteConfig();

    expect(config.rateLimitPerMinute).toBe(60);
  });

  it("uses default for MAX_PAYLOAD_BYTES when not set", () => {
    Object.assign(process.env, VALID_ENV);

    const config = loadRemoteConfig();

    expect(config.maxPayloadBytes).toBe(1048576);
  });

  it("parses MAX_PAYLOAD_BYTES from env", () => {
    Object.assign(process.env, VALID_ENV);
    process.env.MAX_PAYLOAD_BYTES = "524288";

    const config = loadRemoteConfig();

    expect(config.maxPayloadBytes).toBe(524288);
  });

  it("falls back to default when an optional numeric var is not a valid number", () => {
    Object.assign(process.env, VALID_ENV);
    process.env.SESSION_TIMEOUT_MS = "not-a-number";

    const config = loadRemoteConfig();

    expect(config.sessionTimeoutMs).toBe(1800000);
  });
});
