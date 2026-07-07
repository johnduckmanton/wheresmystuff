// update_thing tool handler unit tests

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { ApiClient } from "../../src/api-client.js";
import { NameResolver } from "../../src/name-resolver.js";
import { createHandler, definition } from "../../src/tools/update-thing.js";

const BASE_URL = "http://localhost:4000";
const INVENTORY_ID = "inv-test-123";

function createMockAuthManager() {
  return {
    getAccessToken: vi.fn().mockResolvedValue("test-token"),
    refreshAccessToken: vi.fn().mockResolvedValue("refreshed-token"),
  };
}

function createApiClient() {
  return new ApiClient({
    baseUrl: BASE_URL,
    authManager: createMockAuthManager() as any,
    timeout: 5000,
    maxRetries: 0,
    retryDelay: 10,
  });
}

describe("update_thing tool", () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("definition", () => {
    it("has correct name and required fields", () => {
      expect(definition.name).toBe("update_thing");
      expect(definition.inputSchema.required).toEqual(["thing"]);
      expect(definition.inputSchema.properties.thing).toBeDefined();
      expect(definition.inputSchema.properties.location).toBeDefined();
      expect(definition.inputSchema.properties.room).toBeDefined();
      expect(definition.inputSchema.properties.category).toBeDefined();
      expect(definition.inputSchema.properties.description).toBeDefined();
      expect(definition.inputSchema.properties.tags).toBeDefined();
      expect(definition.inputSchema.properties.notes).toBeDefined();
      expect(definition.inputSchema.properties.condition).toBeDefined();
      expect(definition.inputSchema.properties.value).toBeDefined();
      expect(definition.inputSchema.properties.make).toBeDefined();
      expect(definition.inputSchema.properties.model).toBeDefined();
      expect(definition.inputSchema.properties.brand).toBeDefined();
    });
  });

  describe("input validation", () => {
    it("returns error when thing is empty", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      const result = await handler({ thing: "" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "Please provide the name or ID of the thing to update"
      );
    });

    it("returns error when description exceeds 1000 characters", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      const result = await handler({
        thing: "Drill",
        description: "x".repeat(1001),
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "Description must be 1000 characters or less"
      );
    });
  });

  describe("thing resolution", () => {
    it("returns not found when thing does not exist", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      nock(BASE_URL)
        .get("/things")
        .query({ inventoryId: INVENTORY_ID, search: "NonExistent" })
        .reply(200, { success: true, data: [] });

      const result = await handler({
        thing: "NonExistent",
        description: "Updated",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Could not find thing matching "NonExistent"'
      );
    });

    it("returns disambiguation when multiple things match", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      nock(BASE_URL)
        .get("/things")
        .query({ inventoryId: INVENTORY_ID, search: "Drill" })
        .reply(200, {
          success: true,
          data: [
            { id: "t1", name: "Drill Press" },
            { id: "t2", name: "Drill Bits" },
          ],
        });

      const result = await handler({
        thing: "Drill",
        description: "Updated",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Multiple things match");
      expect(result.content[0].text).toContain("Drill Press");
      expect(result.content[0].text).toContain("Drill Bits");
    });
  });

  describe("updating fields", () => {
    it("updates description and reports change", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      // Mock thing resolution
      nock(BASE_URL)
        .get("/things")
        .query({ inventoryId: INVENTORY_ID, search: "Bike" })
        .reply(200, {
          success: true,
          data: [{ id: "thing-1", name: "Bike" }],
        });

      // Mock GET existing thing
      nock(BASE_URL)
        .get("/things/thing-1")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Bike",
            description: "Old description",
            inventoryId: INVENTORY_ID,
          },
        });

      // Mock PUT
      let putBody: any;
      nock(BASE_URL)
        .put("/things/thing-1", (body) => {
          putBody = body;
          return true;
        })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Bike",
            description: "New description",
            inventoryId: INVENTORY_ID,
          },
        });

      const result = await handler({
        thing: "Bike",
        description: "New description",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Updated "Bike"');
      expect(result.content[0].text).toContain("description");
      expect(result.content[0].text).toContain("Old description");
      expect(result.content[0].text).toContain("New description");
      expect(putBody.description).toBe("New description");
      expect(putBody.name).toBe("Bike");
    });

    it("resolves location name to ID and updates", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      // Mock thing resolution
      nock(BASE_URL)
        .get("/things")
        .query({ inventoryId: INVENTORY_ID, search: "Drill" })
        .reply(200, {
          success: true,
          data: [{ id: "thing-1", name: "Drill" }],
        });

      // Mock GET existing thing
      nock(BASE_URL)
        .get("/things/thing-1")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Drill",
            locationId: "loc-old",
            inventoryId: INVENTORY_ID,
          },
        });

      // Mock location resolution
      nock(BASE_URL)
        .get("/locations")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [
            { id: "loc-1", name: "Garage" },
            { id: "loc-old", name: "Basement" },
          ],
        });

      // Mock PUT
      let putBody: any;
      nock(BASE_URL)
        .put("/things/thing-1", (body) => {
          putBody = body;
          return true;
        })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Drill",
            locationId: "loc-1",
            inventoryId: INVENTORY_ID,
          },
        });

      const result = await handler({
        thing: "Drill",
        location: "Garage",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Updated "Drill"');
      expect(result.content[0].text).toContain("location");
      expect(result.content[0].text).toContain("Garage");
      expect(putBody.locationId).toBe("loc-1");
    });

    it("resolves room and category names and updates multiple fields", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      // Mock thing resolution
      nock(BASE_URL)
        .get("/things")
        .query({ inventoryId: INVENTORY_ID, search: "Lamp" })
        .reply(200, {
          success: true,
          data: [{ id: "thing-1", name: "Lamp" }],
        });

      // Mock GET existing thing
      nock(BASE_URL)
        .get("/things/thing-1")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Lamp",
            inventoryId: INVENTORY_ID,
          },
        });

      // Mock room resolution
      nock(BASE_URL)
        .get("/rooms")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [{ id: "room-1", name: "Living Room", locationId: "loc-1" }],
        });

      // Mock locations for room parent name
      nock(BASE_URL)
        .get("/locations")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [{ id: "loc-1", name: "Home" }],
        });

      // Mock category resolution (uses the location cache already populated)
      nock(BASE_URL)
        .get("/categories")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [{ id: "cat-1", name: "Furniture" }],
        });

      // Mock PUT
      let putBody: any;
      nock(BASE_URL)
        .put("/things/thing-1", (body) => {
          putBody = body;
          return true;
        })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Lamp",
            roomId: "room-1",
            categoryId: "cat-1",
            inventoryId: INVENTORY_ID,
          },
        });

      const result = await handler({
        thing: "Lamp",
        room: "Living Room",
        category: "Furniture",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Updated "Lamp"');
      expect(result.content[0].text).toContain("room");
      expect(result.content[0].text).toContain("Living Room");
      expect(result.content[0].text).toContain("category");
      expect(result.content[0].text).toContain("Furniture");
      expect(putBody.roomId).toBe("room-1");
      expect(putBody.categoryId).toBe("cat-1");
    });

    it("updates value (purchasePrice) field", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      // Mock thing resolution
      nock(BASE_URL)
        .get("/things")
        .query({ inventoryId: INVENTORY_ID, search: "Guitar" })
        .reply(200, {
          success: true,
          data: [{ id: "thing-1", name: "Guitar" }],
        });

      // Mock GET existing thing
      nock(BASE_URL)
        .get("/things/thing-1")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Guitar",
            purchasePrice: 200,
            inventoryId: INVENTORY_ID,
          },
        });

      // Mock PUT
      let putBody: any;
      nock(BASE_URL)
        .put("/things/thing-1", (body) => {
          putBody = body;
          return true;
        })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Guitar",
            purchasePrice: 350,
            inventoryId: INVENTORY_ID,
          },
        });

      const result = await handler({
        thing: "Guitar",
        value: 350,
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Updated "Guitar"');
      expect(result.content[0].text).toContain("value");
      expect(result.content[0].text).toContain("$200");
      expect(result.content[0].text).toContain("$350");
      expect(putBody.purchasePrice).toBe(350);
    });

    it("updates make, model, and brand fields", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      // Mock thing resolution
      nock(BASE_URL)
        .get("/things")
        .query({ inventoryId: INVENTORY_ID, search: "Drill" })
        .reply(200, {
          success: true,
          data: [{ id: "thing-1", name: "Drill" }],
        });

      // Mock GET existing thing
      nock(BASE_URL)
        .get("/things/thing-1")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Drill",
            make: "OldMake",
            inventoryId: INVENTORY_ID,
          },
        });

      // Mock PUT
      let putBody: any;
      nock(BASE_URL)
        .put("/things/thing-1", (body) => {
          putBody = body;
          return true;
        })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Drill",
            make: "DeWalt",
            model: "DCD771",
            brand: "DeWalt Pro",
            inventoryId: INVENTORY_ID,
          },
        });

      const result = await handler({
        thing: "Drill",
        make: "DeWalt",
        model: "DCD771",
        brand: "DeWalt Pro",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Updated "Drill"');
      expect(result.content[0].text).toContain("make");
      expect(result.content[0].text).toContain("OldMake");
      expect(result.content[0].text).toContain("DeWalt");
      expect(result.content[0].text).toContain("model");
      expect(result.content[0].text).toContain("DCD771");
      expect(result.content[0].text).toContain("brand");
      expect(result.content[0].text).toContain("DeWalt Pro");
      expect(putBody.make).toBe("DeWalt");
      expect(putBody.model).toBe("DCD771");
      expect(putBody.brand).toBe("DeWalt Pro");
    });
  });

  describe("no changes provided", () => {
    it("returns error when no update fields are specified", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      // Mock thing resolution
      nock(BASE_URL)
        .get("/things")
        .query({ inventoryId: INVENTORY_ID, search: "Bike" })
        .reply(200, {
          success: true,
          data: [{ id: "thing-1", name: "Bike" }],
        });

      // Mock GET existing thing
      nock(BASE_URL)
        .get("/things/thing-1")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Bike",
            inventoryId: INVENTORY_ID,
          },
        });

      const result = await handler({ thing: "Bike" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "No update fields were provided"
      );
    });
  });

  describe("name resolution failures", () => {
    it("returns error when location cannot be resolved", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      // Mock thing resolution
      nock(BASE_URL)
        .get("/things")
        .query({ inventoryId: INVENTORY_ID, search: "Bike" })
        .reply(200, {
          success: true,
          data: [{ id: "thing-1", name: "Bike" }],
        });

      // Mock GET existing thing
      nock(BASE_URL)
        .get("/things/thing-1")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Bike",
            inventoryId: INVENTORY_ID,
          },
        });

      // Mock location resolution - no match
      nock(BASE_URL)
        .get("/locations")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, { success: true, data: [] });

      const result = await handler({
        thing: "Bike",
        location: "NoSuchPlace",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Could not find location matching "NoSuchPlace"'
      );
    });

    it("returns disambiguation when multiple locations match", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      // Mock thing resolution
      nock(BASE_URL)
        .get("/things")
        .query({ inventoryId: INVENTORY_ID, search: "Bike" })
        .reply(200, {
          success: true,
          data: [{ id: "thing-1", name: "Bike" }],
        });

      // Mock GET existing thing
      nock(BASE_URL)
        .get("/things/thing-1")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Bike",
            inventoryId: INVENTORY_ID,
          },
        });

      // Mock location resolution - multiple matches
      nock(BASE_URL)
        .get("/locations")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [
            { id: "loc-1", name: "Storage A" },
            { id: "loc-2", name: "Storage B" },
          ],
        });

      const result = await handler({
        thing: "Bike",
        location: "Storage",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Multiple locations match");
      expect(result.content[0].text).toContain("Storage A");
      expect(result.content[0].text).toContain("Storage B");
    });
  });

  describe("error handling", () => {
    it("catches API errors and returns isError response", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      // Mock thing search returning 500
      nock(BASE_URL)
        .get("/things")
        .query({ inventoryId: INVENTORY_ID, search: "Bike" })
        .reply(500, "Internal Server Error");

      const result = await handler({
        thing: "Bike",
        description: "Updated",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBeDefined();
    });
  });
});
