import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { RemoteServerConfig } from "../../src/remote/remote-config.js";
import {
  handleOAuthMetadata,
  handleAuthorize,
  handleCallback,
  handleTokenExchange,
} from "../../src/remote/oauth-proxy.js";

const ddbMock = mockClient(DynamoDBDocumentClient);

const TEST_CONFIG: RemoteServerConfig = {
  apiUrl: "https://api.example.com",
  userPoolId: "us-east-1_TestPool",
  clientId: "test-client-id",
  region: "us-east-1",
  allowedOrigins: [],
  sessionTimeoutMs: 1800000,
  maxSessions: 1000,
  rateLimitPerMinute: 100,
  maxPayloadBytes: 1048576,
  cognitoDomain: "auth.example.com",
  serverBaseUrl: "https://mcp.example.com",
  tokenSigningSecret: "test-signing-secret-at-least-32-chars-long",
  sessionsTableName: "mcp-sessions-test",
};

function makeEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: "/",
    rawQueryString: "",
    headers: {},
    isBase64Encoded: false,
    requestContext: {
      accountId: "123456789",
      apiId: "api-id",
      domainName: "api.example.com",
      domainPrefix: "api",
      http: { method: "GET", path: "/", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
      requestId: "req-1",
      routeKey: "$default",
      stage: "$default",
      time: "01/Jan/2024:00:00:00 +0000",
      timeEpoch: Date.now(),
    },
    ...overrides,
  } as APIGatewayProxyEventV2;
}

beforeEach(() => {
  ddbMock.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleOAuthMetadata", () => {
  it("returns correct OAuth metadata structure", () => {
    const result = handleOAuthMetadata(TEST_CONFIG);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.issuer).toBe("https://mcp.example.com");
    expect(body.authorization_endpoint).toBe("https://mcp.example.com/authorize");
    expect(body.token_endpoint).toBe("https://mcp.example.com/token");
    expect(body.response_types_supported).toEqual(["code"]);
    expect(body.grant_types_supported).toEqual(["authorization_code", "refresh_token"]);
    expect(body.code_challenge_methods_supported).toEqual(["S256"]);
    expect(body.token_endpoint_auth_methods_supported).toEqual(["none"]);
  });

  it("sets Content-Type to application/json", () => {
    const result = handleOAuthMetadata(TEST_CONFIG);
    expect(result.headers).toHaveProperty("Content-Type", "application/json");
  });
});

describe("handleAuthorize", () => {
  it("stores pending auth state in DynamoDB with correct keys", async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = makeEvent({
      queryStringParameters: {
        redirect_uri: "http://localhost:8080/callback",
        state: "client-state-123",
      },
    });

    await handleAuthorize(event, TEST_CONFIG);

    const putCalls = ddbMock.commandCalls(PutCommand);
    expect(putCalls).toHaveLength(1);

    const item = putCalls[0]!.args[0].input.Item!;
    expect(item["pk"]).toMatch(/^OAUTH#[a-f0-9]{64}$/);
    expect(item["sk"]).toBe("OAUTH_STATE");
    expect(item["clientRedirectUri"]).toBe("http://localhost:8080/callback");
    expect(item["clientState"]).toBe("client-state-123");
    expect(item["ttl"]).toBeTypeOf("number");
  });

  it("returns a 302 redirect to Cognito Hosted UI", async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = makeEvent({
      queryStringParameters: {
        redirect_uri: "http://localhost:8080/callback",
        state: "client-state",
      },
    });

    const result = await handleAuthorize(event, TEST_CONFIG);

    expect(result.statusCode).toBe(302);
    const location = (result.headers as Record<string, string>)["Location"];
    expect(location).toContain("https://auth.example.com/oauth2/authorize");
    expect(location).toContain("response_type=code");
    expect(location).toContain("client_id=test-client-id");
    expect(location).toContain("redirect_uri=");
    expect(location).toContain("scope=openid+email+profile");
    // State parameter should be a 64-char hex string
    const stateMatch = location.match(/state=([a-f0-9]{64})/);
    expect(stateMatch).not.toBeNull();
  });

  it("sets TTL to approximately 10 minutes from now", async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = makeEvent({ queryStringParameters: {} });
    const beforeTime = Math.floor(Date.now() / 1000);

    await handleAuthorize(event, TEST_CONFIG);

    const putCalls = ddbMock.commandCalls(PutCommand);
    const ttl = putCalls[0]!.args[0].input.Item!["ttl"] as number;
    // TTL should be ~10 minutes in the future (in seconds)
    expect(ttl).toBeGreaterThanOrEqual(beforeTime + 590);
    expect(ttl).toBeLessThanOrEqual(beforeTime + 610);
  });
});

describe("handleCallback", () => {
  it("returns 400 when code or state is missing", async () => {
    const event = makeEvent({ queryStringParameters: {} });
    const result = await handleCallback(event, TEST_CONFIG);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body as string);
    expect(body.error).toContain("Missing");
  });

  it("returns 400 when state is not found in DynamoDB", async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    const event = makeEvent({
      queryStringParameters: { code: "cognito-code", state: "unknown-state" },
    });

    const result = await handleCallback(event, TEST_CONFIG);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body as string);
    expect(body.error).toContain("Invalid or expired");
  });

  it("exchanges code with Cognito and redirects with server code", async () => {
    // Mock DynamoDB: state exists
    ddbMock.on(GetCommand).resolves({
      Item: {
        pk: "OAUTH#state123",
        sk: "OAUTH_STATE",
        clientRedirectUri: "http://localhost:8080/callback",
        clientState: "original-state",
        createdAt: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 600,
      },
    });
    ddbMock.on(DeleteCommand).resolves({});
    ddbMock.on(PutCommand).resolves({});

    // Mock Cognito token exchange
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "cognito-access-123",
        refresh_token: "cognito-refresh-456",
        id_token: "header.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoiZm9vQGJhci5jb20ifQ.sig",
        expires_in: 3600,
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const event = makeEvent({
      queryStringParameters: { code: "cognito-code-abc", state: "state123" },
    });

    const result = await handleCallback(event, TEST_CONFIG);

    expect(result.statusCode).toBe(302);
    const location = (result.headers as Record<string, string>)["Location"];
    expect(location).toContain("http://localhost:8080/callback");
    expect(location).toMatch(/code=[a-f0-9]{64}/);
    expect(location).toContain("state=original-state");

    // Verify Cognito token exchange was called
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://auth.example.com/oauth2/token");
    expect(options.method).toBe("POST");
  });

  it("stores code → tokens mapping in DynamoDB with 5-min TTL", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: {
        pk: "OAUTH#stateXYZ",
        sk: "OAUTH_STATE",
        clientRedirectUri: "http://localhost/cb",
        clientState: "",
        createdAt: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 600,
      },
    });
    ddbMock.on(DeleteCommand).resolves({});
    ddbMock.on(PutCommand).resolves({});

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "at",
        refresh_token: "rt",
        id_token: "h.eyJzdWIiOiJ1MSIsImVtYWlsIjoiYUBiLmNvbSJ9.s",
        expires_in: 3600,
      }),
    }));

    const event = makeEvent({
      queryStringParameters: { code: "code1", state: "stateXYZ" },
    });

    const beforeTime = Math.floor(Date.now() / 1000);
    await handleCallback(event, TEST_CONFIG);

    const putCalls = ddbMock.commandCalls(PutCommand);
    expect(putCalls).toHaveLength(1);

    const item = putCalls[0]!.args[0].input.Item!;
    expect(item["pk"]).toMatch(/^CODE#[a-f0-9]{64}$/);
    expect(item["sk"]).toBe("AUTH_CODE");
    expect(item["cognitoAccessToken"]).toBe("at");
    expect(item["cognitoRefreshToken"]).toBe("rt");
    // TTL should be approximately 5 minutes in the future
    const ttl = item["ttl"] as number;
    expect(ttl).toBeGreaterThanOrEqual(beforeTime + 290);
    expect(ttl).toBeLessThanOrEqual(beforeTime + 310);
  });

  it("returns 502 when Cognito token exchange fails", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: {
        pk: "OAUTH#state1",
        sk: "OAUTH_STATE",
        clientRedirectUri: "http://localhost/cb",
        createdAt: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 600,
      },
    });
    ddbMock.on(DeleteCommand).resolves({});

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    const event = makeEvent({
      queryStringParameters: { code: "bad-code", state: "state1" },
    });

    const result = await handleCallback(event, TEST_CONFIG);
    expect(result.statusCode).toBe(502);
  });
});

describe("handleTokenExchange", () => {
  it("returns 400 when code is missing", async () => {
    const event = makeEvent({
      body: "grant_type=authorization_code",
      isBase64Encoded: false,
    });

    const result = await handleTokenExchange(event, TEST_CONFIG);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body as string);
    expect(body.error).toBe("invalid_request");
  });

  it("returns 400 when grant_type is not authorization_code", async () => {
    const event = makeEvent({
      body: "code=abc123&grant_type=client_credentials",
      isBase64Encoded: false,
    });

    const result = await handleTokenExchange(event, TEST_CONFIG);
    expect(result.statusCode).toBe(400);
  });

  it("returns 400 when code is not found in DynamoDB", async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    const event = makeEvent({
      body: "code=invalid-code&grant_type=authorization_code",
      isBase64Encoded: false,
    });

    const result = await handleTokenExchange(event, TEST_CONFIG);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body as string);
    expect(body.error).toBe("invalid_grant");
  });

  it("returns a signed JWT access token for a valid code", async () => {
    // Create a valid base64url-encoded ID token payload
    const idPayload = Buffer.from(JSON.stringify({ sub: "user-456", email: "test@example.com" })).toString("base64url");
    const mockIdToken = `header.${idPayload}.signature`;

    ddbMock.on(GetCommand).resolves({
      Item: {
        pk: "CODE#valid-code",
        sk: "AUTH_CODE",
        cognitoAccessToken: "cognito-at",
        cognitoRefreshToken: "cognito-rt",
        cognitoIdToken: mockIdToken,
        cognitoTokenExpiresAt: Date.now() + 3600000,
        clientRedirectUri: "http://localhost/cb",
        ttl: Math.floor(Date.now() / 1000) + 300,
      },
    });
    ddbMock.on(DeleteCommand).resolves({});

    const event = makeEvent({
      body: "code=valid-code&grant_type=authorization_code",
      isBase64Encoded: false,
    });

    const result = await handleTokenExchange(event, TEST_CONFIG);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.token_type).toBe("Bearer");
    expect(body.access_token).toBeTypeOf("string");
    // The access token should be a valid JWT (3 parts)
    expect(body.access_token.split(".")).toHaveLength(3);
  });

  it("handles base64-encoded body correctly", async () => {
    const idPayload = Buffer.from(JSON.stringify({ sub: "user-789", email: "b64@test.com" })).toString("base64url");
    const mockIdToken = `h.${idPayload}.s`;

    ddbMock.on(GetCommand).resolves({
      Item: {
        pk: "CODE#b64code",
        sk: "AUTH_CODE",
        cognitoAccessToken: "at",
        cognitoRefreshToken: "rt",
        cognitoIdToken: mockIdToken,
        cognitoTokenExpiresAt: Date.now() + 3600000,
        clientRedirectUri: "http://localhost/cb",
        ttl: Math.floor(Date.now() / 1000) + 300,
      },
    });
    ddbMock.on(DeleteCommand).resolves({});

    const rawBody = "code=b64code&grant_type=authorization_code";
    const event = makeEvent({
      body: Buffer.from(rawBody).toString("base64"),
      isBase64Encoded: true,
    });

    const result = await handleTokenExchange(event, TEST_CONFIG);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.access_token).toBeTypeOf("string");
  });

  it("deletes the code record after successful exchange", async () => {
    const idPayload = Buffer.from(JSON.stringify({ sub: "u1", email: "e@e.com" })).toString("base64url");
    const mockIdToken = `h.${idPayload}.s`;

    ddbMock.on(GetCommand).resolves({
      Item: {
        pk: "CODE#deleteme",
        sk: "AUTH_CODE",
        cognitoAccessToken: "at",
        cognitoRefreshToken: "rt",
        cognitoIdToken: mockIdToken,
        cognitoTokenExpiresAt: Date.now() + 3600000,
        clientRedirectUri: "http://localhost/cb",
        ttl: Math.floor(Date.now() / 1000) + 300,
      },
    });
    ddbMock.on(DeleteCommand).resolves({});

    const event = makeEvent({
      body: "code=deleteme&grant_type=authorization_code",
      isBase64Encoded: false,
    });

    await handleTokenExchange(event, TEST_CONFIG);

    const deleteCalls = ddbMock.commandCalls(DeleteCommand);
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0]!.args[0].input.Key).toEqual({
      pk: "CODE#deleteme",
      sk: "AUTH_CODE",
    });
  });
});
