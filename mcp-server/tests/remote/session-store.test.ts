import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { SessionStore, generateSessionId, SessionRecord } from "../../src/remote/session-store.js";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe("SessionStore", () => {
  const TABLE_NAME = "test-sessions";
  const REGION = "us-east-1";
  let store: SessionStore;

  const sampleSession: SessionRecord = {
    sessionId: "abc123def456",
    userId: "user-sub-001",
    email: "test@example.com",
    inventoryId: "inv-001",
    cognitoAccessToken: "access-token-xyz",
    cognitoRefreshToken: "refresh-token-xyz",
    cognitoTokenExpiresAt: 1700000000000,
    createdAt: 1699999000000,
    lastActivityAt: 1699999500000,
    ttl: 1700001300,
    requestTimestamps: [1699999500000],
  };

  beforeEach(() => {
    ddbMock.reset();
    store = new SessionStore(TABLE_NAME, REGION);
  });

  describe("getSession", () => {
    it("returns the session record when found", async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          pk: sampleSession.sessionId,
          sk: "SESSION",
          userId: sampleSession.userId,
          email: sampleSession.email,
          inventoryId: sampleSession.inventoryId,
          cognitoAccessToken: sampleSession.cognitoAccessToken,
          cognitoRefreshToken: sampleSession.cognitoRefreshToken,
          cognitoTokenExpiresAt: sampleSession.cognitoTokenExpiresAt,
          createdAt: sampleSession.createdAt,
          lastActivityAt: sampleSession.lastActivityAt,
          ttl: sampleSession.ttl,
          requestTimestamps: sampleSession.requestTimestamps,
        },
      });

      const result = await store.getSession(sampleSession.sessionId);

      expect(result).toEqual(sampleSession);

      const call = ddbMock.commandCalls(GetCommand)[0];
      expect(call.args[0].input).toEqual({
        TableName: TABLE_NAME,
        Key: { pk: sampleSession.sessionId, sk: "SESSION" },
      });
    });

    it("returns null when session is not found", async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      const result = await store.getSession("nonexistent-id");

      expect(result).toBeNull();
    });

    it("includes nameCache when present in the item", async () => {
      const nameCache = {
        locations: [{ id: "loc-1", name: "Home" }],
        rooms: [{ id: "room-1", name: "Kitchen", parentName: "Home" }],
        categories: [{ id: "cat-1", name: "Electronics" }],
        populatedAt: 1699999000000,
      };

      ddbMock.on(GetCommand).resolves({
        Item: {
          pk: "session-with-cache",
          sk: "SESSION",
          userId: "user-1",
          email: "user@test.com",
          inventoryId: "inv-1",
          cognitoAccessToken: "token",
          cognitoRefreshToken: "refresh",
          cognitoTokenExpiresAt: 1700000000000,
          nameCache,
          createdAt: 1699999000000,
          lastActivityAt: 1699999000000,
          ttl: 1700001000,
        },
      });

      const result = await store.getSession("session-with-cache");

      expect(result?.nameCache).toEqual(nameCache);
    });
  });

  describe("createSession", () => {
    it("writes the full session record to DynamoDB", async () => {
      ddbMock.on(PutCommand).resolves({});

      await store.createSession(sampleSession);

      const call = ddbMock.commandCalls(PutCommand)[0];
      expect(call.args[0].input).toEqual({
        TableName: TABLE_NAME,
        Item: {
          pk: sampleSession.sessionId,
          sk: "SESSION",
          userId: sampleSession.userId,
          email: sampleSession.email,
          inventoryId: sampleSession.inventoryId,
          cognitoAccessToken: sampleSession.cognitoAccessToken,
          cognitoRefreshToken: sampleSession.cognitoRefreshToken,
          cognitoTokenExpiresAt: sampleSession.cognitoTokenExpiresAt,
          nameCache: undefined,
          createdAt: sampleSession.createdAt,
          lastActivityAt: sampleSession.lastActivityAt,
          ttl: sampleSession.ttl,
          requestTimestamps: sampleSession.requestTimestamps,
        },
      });
    });
  });

  describe("touchSession", () => {
    it("updates lastActivityAt and ttl", async () => {
      ddbMock.on(UpdateCommand).resolves({});

      const timeoutMs = 1800000; // 30 minutes
      const beforeCall = Date.now();
      await store.touchSession("session-id", timeoutMs);
      const afterCall = Date.now();

      const call = ddbMock.commandCalls(UpdateCommand)[0];
      const input = call.args[0].input;
      expect(input.TableName).toBe(TABLE_NAME);
      expect(input.Key).toEqual({ pk: "session-id", sk: "SESSION" });
      expect(input.UpdateExpression).toBe(
        "SET lastActivityAt = :now, #ttl = :ttl"
      );
      expect(input.ExpressionAttributeNames).toEqual({ "#ttl": "ttl" });

      const now = input.ExpressionAttributeValues![":now"] as number;
      const ttl = input.ExpressionAttributeValues![":ttl"] as number;

      expect(now).toBeGreaterThanOrEqual(beforeCall);
      expect(now).toBeLessThanOrEqual(afterCall);
      expect(ttl).toBe(Math.floor((now + timeoutMs) / 1000));
    });
  });

  describe("updateTokens", () => {
    it("updates access token and expiry", async () => {
      ddbMock.on(UpdateCommand).resolves({});

      await store.updateTokens("session-id", "new-access-token", 1700005000000);

      const call = ddbMock.commandCalls(UpdateCommand)[0];
      const input = call.args[0].input;
      expect(input.TableName).toBe(TABLE_NAME);
      expect(input.Key).toEqual({ pk: "session-id", sk: "SESSION" });
      expect(input.UpdateExpression).toBe(
        "SET cognitoAccessToken = :token, cognitoTokenExpiresAt = :exp"
      );
      expect(input.ExpressionAttributeValues).toEqual({
        ":token": "new-access-token",
        ":exp": 1700005000000,
      });
    });
  });

  describe("updateNameCache", () => {
    it("updates the nameCache field", async () => {
      ddbMock.on(UpdateCommand).resolves({});

      const cache = {
        locations: [{ id: "loc-1", name: "Office" }],
        rooms: [{ id: "room-1", name: "Desk Area" }],
        categories: [{ id: "cat-1", name: "Tools" }],
        populatedAt: Date.now(),
      };

      await store.updateNameCache("session-id", cache);

      const call = ddbMock.commandCalls(UpdateCommand)[0];
      const input = call.args[0].input;
      expect(input.TableName).toBe(TABLE_NAME);
      expect(input.Key).toEqual({ pk: "session-id", sk: "SESSION" });
      expect(input.UpdateExpression).toBe("SET nameCache = :cache");
      expect(input.ExpressionAttributeValues).toEqual({ ":cache": cache });
    });
  });

  describe("updateRateLimit", () => {
    it("updates requestTimestamps field", async () => {
      ddbMock.on(UpdateCommand).resolves({});

      const timestamps = [1699999000000, 1699999001000, 1699999002000];

      await store.updateRateLimit("session-id", timestamps);

      const call = ddbMock.commandCalls(UpdateCommand)[0];
      const input = call.args[0].input;
      expect(input.TableName).toBe(TABLE_NAME);
      expect(input.Key).toEqual({ pk: "session-id", sk: "SESSION" });
      expect(input.UpdateExpression).toBe("SET requestTimestamps = :ts");
      expect(input.ExpressionAttributeValues).toEqual({ ":ts": timestamps });
    });
  });

  describe("deleteSession", () => {
    it("deletes the session by pk and sk", async () => {
      ddbMock.on(DeleteCommand).resolves({});

      await store.deleteSession("session-id");

      const call = ddbMock.commandCalls(DeleteCommand)[0];
      expect(call.args[0].input).toEqual({
        TableName: TABLE_NAME,
        Key: { pk: "session-id", sk: "SESSION" },
      });
    });
  });

  describe("countActiveSessions", () => {
    it("returns the count from scan", async () => {
      ddbMock.on(ScanCommand).resolves({ Count: 42 });

      const count = await store.countActiveSessions();

      expect(count).toBe(42);

      const call = ddbMock.commandCalls(ScanCommand)[0];
      expect(call.args[0].input).toEqual({
        TableName: TABLE_NAME,
        FilterExpression: "sk = :sk",
        ExpressionAttributeValues: { ":sk": "SESSION" },
        Select: "COUNT",
      });
    });

    it("returns 0 when Count is undefined", async () => {
      ddbMock.on(ScanCommand).resolves({ Count: undefined });

      const count = await store.countActiveSessions();

      expect(count).toBe(0);
    });
  });
});

describe("generateSessionId", () => {
  it("returns a 64-character hex string", () => {
    const id = generateSessionId();

    expect(id).toHaveLength(64);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique IDs on each call", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()));

    expect(ids.size).toBe(100);
  });
});
