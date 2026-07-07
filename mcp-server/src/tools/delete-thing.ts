// delete_thing tool handler

import type { ApiClient } from "../api-client.js";
import type { NameResolver } from "../name-resolver.js";
import { formatResolutionCandidates } from "../formatters.js";

export const definition = {
  name: "delete_thing",
  description: "Remove a thing from the inventory",
  inputSchema: {
    type: "object" as const,
    properties: {
      thing: {
        type: "string",
        description: "Name or ID of the thing to delete",
      },
    },
    required: ["thing"],
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
      const thing = args.thing as string;

      // Validate input
      if (!thing || thing.trim().length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Please provide the name or ID of the thing to delete.",
            },
          ],
          isError: true,
        };
      }

      // Resolve thing name/ID
      const resolution = await nameResolver.resolveThing(thing);

      if (resolution.status === "not_found") {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not find a thing matching "${thing}".`,
            },
          ],
          isError: true,
        };
      }

      if (resolution.status === "multiple" && resolution.candidates) {
        const candidateList = formatResolutionCandidates(
          resolution.candidates
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Multiple things match "${thing}". Please clarify which one you mean:\n\n${candidateList}`,
            },
          ],
        };
      }

      const thingId = resolution.match!.id;
      const thingName = resolution.match!.name;

      // DELETE the thing
      await apiClient.delete(`/things/${thingId}`, { inventoryId });

      return {
        content: [
          {
            type: "text" as const,
            text: `Deleted "${thingName}" (ID: ${thingId}).`,
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
