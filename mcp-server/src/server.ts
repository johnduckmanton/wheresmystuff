// MCP server setup, tool registration

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import type { ApiClient } from "./api-client.js";
import type { NameResolver } from "./name-resolver.js";

import * as searchThings from "./tools/search-things.js";
import * as getThingsInLocation from "./tools/get-things-in-location.js";
import * as createThing from "./tools/create-thing.js";
import * as updateThing from "./tools/update-thing.js";
import * as moveThing from "./tools/move-thing.js";
import * as deleteThing from "./tools/delete-thing.js";
import * as listLocations from "./tools/list-locations.js";
import * as listRooms from "./tools/list-rooms.js";
import * as listCategories from "./tools/list-categories.js";
import * as getThingsByCategory from "./tools/get-things-by-category.js";
import * as listContainers from "./tools/list-containers.js";
import * as getContainerContents from "./tools/get-container-contents.js";
import * as findThingContainer from "./tools/find-thing-container.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}>;

export function createServer(
  apiClient: ApiClient,
  nameResolver: NameResolver,
  inventoryId: string
): Server {
  const server = new Server(
    { name: "wheresmystuff", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // Collect all tool definitions
  const toolDefinitions = [
    searchThings.definition,
    getThingsInLocation.definition,
    createThing.definition,
    updateThing.definition,
    moveThing.definition,
    deleteThing.definition,
    listLocations.definition,
    listRooms.definition,
    listCategories.definition,
    getThingsByCategory.definition,
    listContainers.definition,
    getContainerContents.definition,
    findThingContainer.definition,
  ];

  // Create handler map keyed by tool name
  const handlers = new Map<string, ToolHandler>();

  // search_things only needs apiClient and inventoryId (no nameResolver)
  handlers.set(
    searchThings.definition.name,
    searchThings.createHandler(apiClient, inventoryId)
  );

  // All other tools need apiClient, nameResolver, and inventoryId
  handlers.set(
    getThingsInLocation.definition.name,
    getThingsInLocation.createHandler(apiClient, nameResolver, inventoryId)
  );
  handlers.set(
    createThing.definition.name,
    createThing.createHandler(apiClient, nameResolver, inventoryId)
  );
  handlers.set(
    updateThing.definition.name,
    updateThing.createHandler(apiClient, nameResolver, inventoryId)
  );
  handlers.set(
    moveThing.definition.name,
    moveThing.createHandler(apiClient, nameResolver, inventoryId)
  );
  handlers.set(
    deleteThing.definition.name,
    deleteThing.createHandler(apiClient, nameResolver, inventoryId)
  );
  handlers.set(
    listLocations.definition.name,
    listLocations.createHandler(apiClient, nameResolver, inventoryId)
  );
  handlers.set(
    listRooms.definition.name,
    listRooms.createHandler(apiClient, nameResolver, inventoryId)
  );
  handlers.set(
    listCategories.definition.name,
    listCategories.createHandler(apiClient, nameResolver, inventoryId)
  );
  handlers.set(
    getThingsByCategory.definition.name,
    getThingsByCategory.createHandler(apiClient, nameResolver, inventoryId)
  );
  handlers.set(
    listContainers.definition.name,
    listContainers.createHandler(apiClient, nameResolver, inventoryId)
  );
  handlers.set(
    getContainerContents.definition.name,
    getContainerContents.createHandler(apiClient, nameResolver, inventoryId)
  );
  handlers.set(
    findThingContainer.definition.name,
    findThingContainer.createHandler(apiClient, nameResolver, inventoryId)
  );

  // Register the tools/list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  // Register the tools/call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = handlers.get(name);
    if (!handler) {
      return {
        content: [
          { type: "text" as const, text: `Unknown tool: ${name}` },
        ],
        isError: true,
      };
    }

    return handler(args ?? {});
  });

  return server;
}
