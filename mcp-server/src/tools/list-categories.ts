// list_categories tool handler

import type { ApiClient } from "../api-client.js";
import type { NameResolver } from "../name-resolver.js";
import {
  formatCategoriesList,
  type CategoryRecord,
} from "../formatters.js";

type ToolHandler = (
  args: Record<string, unknown>
) => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>;

export const definition = {
  name: "list_categories",
  description: "List all categories",
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
      const categories = await apiClient.get<CategoryRecord[]>("/categories", {
        inventoryId,
      });

      const text = formatCategoriesList(categories);

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
