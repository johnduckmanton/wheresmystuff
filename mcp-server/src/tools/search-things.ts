// search_things tool handler

import type { ApiClient } from "../api-client.js";
import {
  formatThingsList,
  type ThingRecord,
  type LocationRecord,
  type RoomRecord,
  type CategoryRecord,
} from "../formatters.js";

export const definition = {
  name: "search_things",
  description: "Search things by name or tags in the inventory",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        maxLength: 200,
        description: "Text search query",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        maxItems: 10,
        description: "Filter by tags",
      },
    },
  },
};

export type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}>;

export function createHandler(
  apiClient: ApiClient,
  inventoryId: string
): ToolHandler {
  return async (args: Record<string, unknown>) => {
    try {
      const query = args.query as string | undefined;
      const tags = args.tags as string[] | undefined;

      // Build params for GET /things
      const params: Record<string, string> = { inventoryId };

      if (query) {
        params.search = query;
      }

      if (tags && tags.length > 0) {
        params.tags = tags.join(",");
      }

      // Fetch things matching the search criteria
      const things = await apiClient.get<ThingRecord[]>("/things", params);

      // Fetch locations, rooms, and categories for name resolution in formatting
      const [locations, rooms, categories] = await Promise.all([
        apiClient.get<LocationRecord[]>("/locations", { inventoryId }),
        apiClient.get<RoomRecord[]>("/rooms", { inventoryId }),
        apiClient.get<CategoryRecord[]>("/categories", { inventoryId }),
      ]);

      // Build lookup maps
      const locationsMap = new Map<string, string>(
        locations.map((l) => [l.id, l.name])
      );
      const roomsMap = new Map<string, string>(
        rooms.map((r) => [r.id, r.name])
      );
      const categoriesMap = new Map<string, string>(
        categories.map((c) => [c.id, c.name])
      );

      // Format results
      const formattedResult = formatThingsList(
        things,
        locationsMap,
        roomsMap,
        categoriesMap
      );

      return {
        content: [{ type: "text" as const, text: formattedResult }],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred";
      return {
        content: [{ type: "text" as const, text: message }],
        isError: true,
      };
    }
  };
}
