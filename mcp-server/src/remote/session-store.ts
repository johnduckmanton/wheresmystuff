// DynamoDB session CRUD operations for per-user session state

import { randomBytes } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

export interface SerializedNameCache {
  locations?: Array<{ id: string; name: string }>;
  rooms?: Array<{ id: string; name: string; parentName?: string }>;
  categories?: Array<{ id: string; name: string }>;
  populatedAt?: number;
}

export interface SessionRecord {
  sessionId: string;
  userId: string;
  email: string;
  inventoryId: string;
  cognitoAccessToken: string;
  cognitoRefreshToken: string;
  cognitoTokenExpiresAt: number;
  nameCache?: SerializedNameCache;
  createdAt: number;
  lastActivityAt: number;
  ttl: number;
  requestTimestamps?: number[];
}

const SK_SESSION = "SESSION";

export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

export class SessionStore {
  private readonly client: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    region: string
  ) {
    const ddbClient = new DynamoDBClient({ region });
    this.client = DynamoDBDocumentClient.from(ddbClient);
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: sessionId, sk: SK_SESSION },
      })
    );

    if (!result.Item) {
      return null;
    }

    return this.itemToSessionRecord(result.Item);
  }

  async createSession(session: SessionRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: session.sessionId,
          sk: SK_SESSION,
          userId: session.userId,
          email: session.email,
          inventoryId: session.inventoryId,
          cognitoAccessToken: session.cognitoAccessToken,
          cognitoRefreshToken: session.cognitoRefreshToken,
          cognitoTokenExpiresAt: session.cognitoTokenExpiresAt,
          nameCache: session.nameCache,
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
          ttl: session.ttl,
          requestTimestamps: session.requestTimestamps,
        },
      })
    );
  }

  async touchSession(sessionId: string, timeoutMs: number): Promise<void> {
    const now = Date.now();
    const ttl = Math.floor((now + timeoutMs) / 1000);

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: sessionId, sk: SK_SESSION },
        UpdateExpression: "SET lastActivityAt = :now, #ttl = :ttl",
        ExpressionAttributeNames: { "#ttl": "ttl" },
        ExpressionAttributeValues: { ":now": now, ":ttl": ttl },
      })
    );
  }

  async updateTokens(
    sessionId: string,
    accessToken: string,
    expiresAt: number
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: sessionId, sk: SK_SESSION },
        UpdateExpression:
          "SET cognitoAccessToken = :token, cognitoTokenExpiresAt = :exp",
        ExpressionAttributeValues: {
          ":token": accessToken,
          ":exp": expiresAt,
        },
      })
    );
  }

  async updateNameCache(
    sessionId: string,
    cache: SerializedNameCache
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: sessionId, sk: SK_SESSION },
        UpdateExpression: "SET nameCache = :cache",
        ExpressionAttributeValues: { ":cache": cache },
      })
    );
  }

  async updateRateLimit(
    sessionId: string,
    timestamps: number[]
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: sessionId, sk: SK_SESSION },
        UpdateExpression: "SET requestTimestamps = :ts",
        ExpressionAttributeValues: { ":ts": timestamps },
      })
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { pk: sessionId, sk: SK_SESSION },
      })
    );
  }

  async countActiveSessions(): Promise<number> {
    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "sk = :sk",
        ExpressionAttributeValues: { ":sk": SK_SESSION },
        Select: "COUNT",
      })
    );

    return result.Count ?? 0;
  }

  private itemToSessionRecord(
    item: Record<string, unknown>
  ): SessionRecord {
    return {
      sessionId: item.pk as string,
      userId: item.userId as string,
      email: item.email as string,
      inventoryId: item.inventoryId as string,
      cognitoAccessToken: item.cognitoAccessToken as string,
      cognitoRefreshToken: item.cognitoRefreshToken as string,
      cognitoTokenExpiresAt: item.cognitoTokenExpiresAt as number,
      nameCache: item.nameCache as SerializedNameCache | undefined,
      createdAt: item.createdAt as number,
      lastActivityAt: item.lastActivityAt as number,
      ttl: item.ttl as number,
      requestTimestamps: item.requestTimestamps as number[] | undefined,
    };
  }
}
