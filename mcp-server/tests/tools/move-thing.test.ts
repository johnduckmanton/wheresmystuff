// move_thing tool handler unit tests

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { ApiClient } from "../../src/api-client.js";
import { NameResolver } from "../../src/name-resolver.js";
import { createHandler, definition } from "../../src/tools/move-thing.js";

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

describe("move_thing tool", () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("definition", () => {
    it("has correct name and required fields", () => {
      expect(definition.name).toBe("move_thing");
      expect(definition.inputSchema.required).toEqual([
        "thing",
        "destination",
      ]);
      expect(definition.inputSchema.properties.thing).toBeDefined();
      expect(definition.inputSchema.properties.destination).toBeDefined();
    });
  });

  describe("input validation", () => {
    it("returns error when thing is empty", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      const result = await handler({ thing: "", destination: "Garage" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "Please provide the name or ID of the thing to move"
      );
    });

    it("returns error when destination is empty", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      const result = await handler({ thing: "Drill", destination: "" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "Please provide a destination location or room name"
      );
    });
  });

  describe("thing resolution", () => {
    it("returns not found when thing does not exist", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      // Mock thing search returning empty
      nock(BASE_URL)
        .get("/things")
        .query({ inventoryId: INVENTORY_ID, search: "NonExistent" })
        .reply(200, { success: true, data: [] });

      const result = await handler({
        thing: "NonExistent",
        destination: "Garage",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Could not find a thing matching "NonExistent"'
      );
    });

    it("returns disambiguation when multiple things match", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      // Mock thing search returning multiple
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

      const result = await handler({ thing: "Drill", destination: "Garage" });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Multiple things match");
      expect(result.content[0].text).toContain("Drill Press");
      expect(result.content[0].text).toContain("Drill Bits");
    });
  });

  describe("move to room", () => {
    it("sets roomId and parent locationId when destination is a room", async () => {
      const apiClient = createApiClient();
      const nameResolver = new NameResolver(apiClient, INVENTORY_ID);
      const handler = createHandler(apiClient, nameResolver, INVENTORY_ID);

      // Mock thing resolution - exact match
      nock(BASE_URL)
        .get("/things")
        .query({ inventoryId: INVENTORY_ID, search: "Bike" })
        .reply(200, {
          success: true,
          data: [{ id: "thing-1", name: "Bike" }],
        });

      // Mock room resolution - first for resolveRoom (cache)
      nock(BASE_URL)
        .get("/rooms")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [
            { id: "room-1", name: "Basement", locationId: "loc-1" },
            { id: "room-2", name: "Garage", locationId: "loc-1" },
          ],
        });

      // Mock locations for room parent resolution (getRooms needs getLocations)
      nock(BASE_URL)
        .get("/locations")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [{ id: "loc-1", name: "Home" }],
        });

      // Mock fetching rooms again for parent locationId lookup
      nock(BASE_URL)
        .get("/rooms")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [
            { id: "room-1", name: "Basement", locationId: "loc-1" },
            { id: "room-2", name: "Garage", locationId: "loc-1" },
          ],
        });

      // Mock fetching existing thing
      nock(BASE_URL)
        .get("/things/thing-1")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Bike",
            locationId: "loc-1",
            roomId: "room-2",
            inventoryId: INVENTORY_ID,
          },
        });

      // Mock fetching locations and rooms for previous location display
      nock(BASE_URL)
        .get("/locations")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [{ id: "loc-1", name: "Home" }],
        });

      nock(BASE_URL)
        .get("/rooms")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [
            { id: "room-1", name: "Basement", locationId: "loc-1" },
            { id: "room-2", name: "Garage", locationId: "loc-1" },
          ],
        });

      // Mock PUT to update the thing
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
            locationId: "loc-1",
            roomId: "room-1",
            inventoryId: INVENTORY_ID,
          },
        });

      const result = await handler({
        thing: "Bike",
        destination: "Basement",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Moved "Bike"');
      expect(result.content[0].text).toContain("Home > Garage");
      expect(result.content[0].text).toContain("Basement");
      expect(putBody.roomId).toBe("room-1");
      expect(putBody.locationId).toBe("loc-1");
    });
  });

  describe("move to location", () => {
    it("sets locationId and clears roomId when destination is a location", async () => {
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

      // Mock room resolution - no match for "Storage Unit"
      nock(BASE_URL)
        .get("/rooms")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [
            { id: "room-1", name: "Basement", locationId: "loc-1" },
          ],
        });

      // Mock locations for room parent name resolution
      nock(BASE_URL)
        .get("/locations")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [
            { id: "loc-1", name: "Home" },
            { id: "loc-2", name: "Storage Unit" },
          ],
        });

      // Mock fetching existing thing
      nock(BASE_URL)
        .get("/things/thing-1")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: {
            id: "thing-1",
            name: "Bike",
            locationId: "loc-1",
            roomId: "room-1",
            inventoryId: INVENTORY_ID,
          },
        });

      // Mock fetching locations and rooms for previous location display
      nock(BASE_URL)
        .get("/locations")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [
            { id: "loc-1", name: "Home" },
            { id: "loc-2", name: "Storage Unit" },
          ],
        });

      nock(BASE_URL)
        .get("/rooms")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [
            { id: "room-1", name: "Basement", locationId: "loc-1" },
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
            name: "Bike",
            locationId: "loc-2",
            roomId: null,
            inventoryId: INVENTORY_ID,
          },
        });

      const result = await handler({
        thing: "Bike",
        destination: "Storage Unit",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Moved "Bike"');
      expect(result.content[0].text).toContain("Home > Basement");
      expect(result.content[0].text).toContain("Storage Unit");
      expect(putBody.locationId).toBe("loc-2");
      expect(putBody.roomId).toBeNull();
    });
  });

  describe("destination resolution failures", () => {
    it("returns not found when destination matches neither room nor location", async () => {
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

      // Mock room resolution - no match
      nock(BASE_URL)
        .get("/rooms")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, { success: true, data: [] });

      // Mock locations for getRooms parentName resolution
      nock(BASE_URL)
        .get("/locations")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, { success: true, data: [] });

      const result = await handler({
        thing: "Bike",
        destination: "Mars",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Could not find a location or room matching "Mars"'
      );
    });

    it("returns disambiguation when destination matches multiple", async () => {
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

      // Mock room resolution - multiple rooms match "Main"
      nock(BASE_URL)
        .get("/rooms")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [
            { id: "room-1", name: "Main Bedroom", locationId: "loc-1" },
            { id: "room-2", name: "Main Bathroom", locationId: "loc-1" },
          ],
        });

      // Mock locations for room parent name
      nock(BASE_URL)
        .get("/locations")
        .query({ inventoryId: INVENTORY_ID })
        .reply(200, {
          success: true,
          data: [{ id: "loc-1", name: "Home" }],
        });

      const result = await handler({
        thing: "Bike",
        destination: "Main",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Multiple destinations match");
      expect(result.content[0].text).toContain("Main Bedroom");
      expect(result.content[0].text).toContain("Main Bathroom");
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
        destination: "Garage",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBeDefined();
    });
  });
});
