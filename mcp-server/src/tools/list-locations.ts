// list_locations tool handler

import type { ApiClient } from "../api-client.js";
import type { NameResolver } from "../name-resolver.js";
import {
  formatLocationsList,
  type LocationRecord,
} from "../formatters.js";

type ToolHandler = (
  args: Record<string, unknown>
) => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>;

export const definition = {
  name: "list_locations",
  description: "List all locations in the inventory",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export function createHandler(
  apiClient: ApiClient,
  _nameResolver: NameResolver,
  inventoryId: string
): ToolHandler {
  return async (_args: Record<string, unknown>) => {
    try {
      const locations = await apiClient.get<LocationRecord[]>("/locations", {
        inventoryId,
      });

      const text = formatLocationsList(locations);

      return {
        content: [{ type: "text", text }],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred";
      return {
        content: [{ type: "text", text: message }],
        isError: true,
      };
    }
  };
}
