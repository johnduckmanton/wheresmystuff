// list_containers tool handler

import type { ApiClient } from "../api-client.js";
import type { NameResolver } from "../name-resolver.js";
import {
  formatContainersList,
  type ContainerRecord,
} from "../formatters.js";

export const definition = {
  name: "list_containers",
  description: "List all containers in the inventory",
  inputSchema: {
    type: "object" as const,
    properties: {},
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
  return async (_args: Record<string, unknown>) => {
    try {
      const containers = await apiClient.get<ContainerRecord[]>(
        "/containers",
        { inventoryId }
      );

      const formattedResult = formatContainersList(containers);

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
