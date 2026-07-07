// get_things_by_category tool handler

import type { ApiClient } from "../api-client.js";
import type { NameResolver } from "../name-resolver.js";
import {
  formatThingsList,
  formatResolutionCandidates,
  type ThingRecord,
  type LocationRecord,
  type RoomRecord,
  type CategoryRecord,
} from "../formatters.js";

export const definition = {
  name: "get_things_by_category",
  description: "Get things in a specific category",
  inputSchema: {
    type: "object" as const,
    properties: {
      category: {
        type: "string",
        description: "Name of the category to look up",
      },
    },
    required: ["category"],
  },
};

export type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}>;

export function createHandler(
  apiClient: ApiClient,
  nameResolver: NameResolver,
  inventoryId: string
): ToolHandler {
  return async (args: Record<string, unknown>) => {
    try {
      const category = args.category as string;

      // Validate input
      if (!category || category.trim().length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Please provide a category name.",
            },
          ],
          isError: true,
        };
      }

      // Resolve category name to ID
      const result = await nameResolver.resolveCategory(category);

      if (result.status === "not_found") {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not find category matching '${category}'.`,
            },
          ],
          isError: true,
        };
      }

      if (result.status === "multiple") {
        const formatted = formatResolutionCandidates(result.candidates ?? []);
        return {
          content: [
            {
              type: "text" as const,
              text: `Multiple categories match '${category}'. Please clarify which one you mean:\n\n${formatted}`,
            },
          ],
        };
      }

      // Exact match — query things filtered by categoryId
      const categoryId = result.match!.id;
      const categoryName = result.match!.name;

      const things = await apiClient.get<ThingRecord[]>("/things", {
        inventoryId,
        categoryId,
      });

      if (things.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Category '${categoryName}' exists but contains no items.`,
            },
          ],
        };
      }

      // Fetch reference data for formatting
      const [locations, rooms, categories] = await Promise.all([
        apiClient.get<LocationRecord[]>("/locations", { inventoryId }),
        apiClient.get<RoomRecord[]>("/rooms", { inventoryId }),
        apiClient.get<CategoryRecord[]>("/categories", { inventoryId }),
      ]);

      const locationsMap = new Map<string, string>(
        locations.map((l) => [l.id, l.name])
      );
      const roomsMap = new Map<string, string>(
        rooms.map((r) => [r.id, r.name])
      );
      const categoriesMap = new Map<string, string>(
        categories.map((c) => [c.id, c.name])
      );

      const formatted = formatThingsList(
        things,
        locationsMap,
        roomsMap,
        categoriesMap
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Things in category '${categoryName}':\n\n${formatted}`,
          },
        ],
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
