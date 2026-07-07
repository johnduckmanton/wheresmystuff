// ApiClient unit tests

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { ApiClient, ApiClientError } from "../src/api-client.js";

const BASE_URL = "http://localhost:4000";

function createMockAuthManager(options?: { refreshFails?: boolean }) {
  return {
    getAccessToken: vi.fn().mockResolvedValue("test-access-token"),
    refreshAccessToken: options?.refreshFails
      ? vi.fn().mockRejectedValue(new Error("Refresh failed"))
      : vi.fn().mockResolvedValue("refreshed-access-token"),
  };
}

function createClient(
  authManager = createMockAuthManager(),
  opts?: { timeout?: number; maxRetries?: number; retryDelay?: number }
) {
  return new ApiClient({
    baseUrl: BASE_URL,
    authManager: authManager as any,
    timeout: opts?.timeout ?? 5000,
    maxRetries: opts?.maxRetries ?? 2,
    retryDelay: opts?.retryDelay ?? 10, // Short delay for tests
  });
}

describe("ApiClient", () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("HTTP methods", () => {
    it("GET request with params and auth header", async () => {
      const authManager = createMockAuthManager();
      const client = createClient(authManager);

      const scope = nock(BASE_URL)
        .get("/things")
        .query({ inventoryId: "inv-1" })
        .matchHeader("Authorization", "Bearer test-access-token")
        .reply(200, { success: true, data: [{ id: "1", name: "Drill" }] });

      const result = await client.get<{ id: string; name: string }[]>(
        "/things",
        { inventoryId: "inv-1" }
      );

      expect(result).toEqual([{ id: "1", name: "Drill" }]);
      expect(scope.isDone()).toBe(true);
    });

    it("POST request with body and auth header", async () => {
      const authManager = createMockAuthManager();
      const client = createClient(authManager);

      const scope = nock(BASE_URL)
        .post("/things", { name: "Drill", inventoryId: "inv-1" })
        .matchHeader("Authorization", "Bearer test-access-token")
        .matchHeader("Content-Type", "application/json")
        .reply(200, { success: true, data: { id: "1", name: "Drill" } });

      const result = await client.post<{ id: string; name: string }>(
        "/things",
        { name: "Drill", inventoryId: "inv-1" }
      );

      expect(result).toEqual({ id: "1", name: "Drill" });
      expect(scope.isDone()).toBe(true);
    });

    it("PUT request with body and auth header", async () => {
      const authManager = createMockAuthManager();
      const client = createClient(authManager);

      const scope = nock(BASE_URL)
        .put("/things/1", { name: "Updated Drill" })
        .matchHeader("Authorization", "Bearer test-access-token")
        .reply(200, { success: true, data: { id: "1", name: "Updated Drill" } });

      const result = await client.put<{ id: string; name: string }>(
        "/things/1",
        { name: "Updated Drill" }
      );

      expect(result).toEqual({ id: "1", name: "Updated Drill" });
      expect(scope.isDone()).toBe(true);
    });

    it("DELETE request with params and auth header", async () => {
      const authManager = createMockAuthManager();
      const client = createClient(authManager);

      const scope = nock(BASE_URL)
        .delete("/things/1")
        .query({ inventoryId: "inv-1" })
        .matchHeader("Authorization", "Bearer test-access-token")
        .reply(200, { success: true, data: { deleted: true } });

      const result = await client.delete<{ deleted: boolean }>("/things/1", {
        inventoryId: "inv-1",
      });

      expect(result).toEqual({ deleted: true });
      expect(scope.isDone()).toBe(true);
    });
  });

  describe("Response envelope unwrapping", () => {
    it("returns data on success", async () => {
      const client = createClient();

      nock(BASE_URL)
        .get("/items")
        .reply(200, { success: true, data: { items: [1, 2, 3] } });

      const result = await client.get<{ items: number[] }>("/items");
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    it("throws ApiClientError with error message on success:false", async () => {
      const client = createClient();

      nock(BASE_URL)
        .get("/items")
        .reply(200, { success: false, error: "Validation failed" });

      await expect(client.get("/items")).rejects.toThrow(
        new ApiClientError("Validation failed")
      );
    });
  });

  describe("401 handling and token refresh", () => {
    it("refreshes token on 401 and retries once", async () => {
      const authManager = createMockAuthManager();
      const client = createClient(authManager);

      // Rebuild nock for two requests: first 401, then success after refresh
      nock(BASE_URL)
        .get("/things")
        .matchHeader("Authorization", "Bearer test-access-token")
        .reply(401, { success: false, error: "Unauthorized" });

      nock(BASE_URL)
        .get("/things")
        .matchHeader("Authorization", "Bearer refreshed-access-token")
        .reply(200, { success: true, data: [{ id: "1" }] });

      const result = await client.get("/things");

      expect(result).toEqual([{ id: "1" }]);
      expect(authManager.refreshAccessToken).toHaveBeenCalledOnce();
    });

    it("throws session expired when refresh fails", async () => {
      const authManager = createMockAuthManager({ refreshFails: true });
      const client = createClient(authManager);

      nock(BASE_URL).get("/things").reply(401, { success: false });

      await expect(client.get("/things")).rejects.toThrow(
        "Session expired, please re-authenticate"
      );
    });
  });

  describe("Error mapping", () => {
    it("maps 403 to access denied", async () => {
      const client = createClient();

      nock(BASE_URL).get("/secret").reply(403, { success: false });

      await expect(client.get("/secret")).rejects.toThrow(
        "Access denied to this resource"
      );
    });

    it("maps 404 to resource not found", async () => {
      const client = createClient();

      nock(BASE_URL).get("/things/999").reply(404, { success: false });

      await expect(client.get("/things/999")).rejects.toThrow(
        "Resource not found"
      );
    });

    it("maps 429 with Retry-After header", async () => {
      const client = createClient();

      nock(BASE_URL)
        .get("/things")
        .reply(429, { success: false }, { "Retry-After": "30" });

      await expect(client.get("/things")).rejects.toThrow(
        "Rate limited, retry after 30s"
      );
    });

    it("maps 429 without Retry-After header defaults to 60s", async () => {
      const client = createClient();

      nock(BASE_URL).get("/things").reply(429, { success: false });

      await expect(client.get("/things")).rejects.toThrow(
        "Rate limited, retry after 60s"
      );
    });

    it("maps unexpected status codes without body", async () => {
      const client = createClient();

      nock(BASE_URL)
        .get("/things")
        .reply(422, { success: false, error: "sensitive body data" });

      await expect(client.get("/things")).rejects.toThrow(
        "Operation failed (status 422)"
      );
    });

    it("maps 400 without including body", async () => {
      const client = createClient();

      nock(BASE_URL)
        .get("/things")
        .reply(400, { success: false, error: "Bad request details" });

      await expect(client.get("/things")).rejects.toThrow(
        "Operation failed (status 400)"
      );
    });
  });

  describe("Retry logic", () => {
    it("retries on 5xx up to maxRetries times", async () => {
      const client = createClient(createMockAuthManager(), {
        maxRetries: 2,
        retryDelay: 10,
      });

      nock(BASE_URL).get("/things").reply(500, "Server Error");
      nock(BASE_URL).get("/things").reply(502, "Bad Gateway");
      nock(BASE_URL).get("/things").reply(200, { success: true, data: "ok" });

      const result = await client.get("/things");
      expect(result).toBe("ok");
    });

    it("throws after exhausting retries on 5xx", async () => {
      const client = createClient(createMockAuthManager(), {
        maxRetries: 2,
        retryDelay: 10,
      });

      nock(BASE_URL).get("/things").times(3).reply(503, "Service Unavailable");

      await expect(client.get("/things")).rejects.toThrow(
        "Server communication problem"
      );
    });

    it("does NOT retry on 4xx errors (except 401)", async () => {
      const client = createClient(createMockAuthManager(), {
        maxRetries: 2,
        retryDelay: 10,
      });

      // Only one 403 response set up — if it retried, nock would error
      nock(BASE_URL).get("/things").reply(403, { success: false });

      await expect(client.get("/things")).rejects.toThrow(
        "Access denied to this resource"
      );
    });

    it("retries on connection errors", async () => {
      const client = createClient(createMockAuthManager(), {
        maxRetries: 2,
        retryDelay: 10,
      });

      nock(BASE_URL).get("/things").replyWithError("ECONNREFUSED");
      nock(BASE_URL).get("/things").replyWithError("ECONNREFUSED");
      nock(BASE_URL)
        .get("/things")
        .reply(200, { success: true, data: "recovered" });

      const result = await client.get("/things");
      expect(result).toBe("recovered");
    });

    it("throws server communication problem after exhausting retries on network error", async () => {
      const client = createClient(createMockAuthManager(), {
        maxRetries: 2,
        retryDelay: 10,
      });

      nock(BASE_URL).get("/things").times(3).replyWithError("ECONNREFUSED");

      await expect(client.get("/things")).rejects.toThrow(
        "Server communication problem"
      );
    });
  });

  describe("Timeout", () => {
    it("aborts request after timeout and retries", async () => {
      const client = createClient(createMockAuthManager(), {
        timeout: 50, // 50ms timeout for test speed
        maxRetries: 1,
        retryDelay: 10,
      });

      // First request times out
      nock(BASE_URL).get("/things").delayConnection(200).reply(200, { success: true, data: "late" });
      // Retry succeeds
      nock(BASE_URL).get("/things").reply(200, { success: true, data: "fast" });

      const result = await client.get("/things");
      expect(result).toBe("fast");
    });
  });
});
