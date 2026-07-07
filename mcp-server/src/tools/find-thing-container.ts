// find_thing_container tool handler

import type { ApiClient } from "../api-client.js";
import type { NameResolver } from "../name-resolver.js";
import {
  formatResolutionCandidates,
  type ThingRecord,
  type ContainerRecord,
} from "../formatters.js";

export const definition = {
  name: "find_thing_container",
  description: "Find which container holds a thing",
  inputSchema: {
    type: "object" as const,
    properties: {
      thing: {
        type: "string",
        description: "Thing name or ID",
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
      const thingInput = args.thing as string;

      // Resolve the thing name/ID
      const resolution = await nameResolver.resolveThing(thingInput);

      if (resolution.status === "not_found") {
        return {
          content: [
            {
              type: "text" as const,
              text: `Thing not found in the inventory matching '${thingInput}'.`,
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
              text: `Multiple things match '${thingInput}'. Please be more specific:\n${candidateList}`,
            },
          ],
        };
      }

      const thingId = resolution.match!.id;
      const thingName = resolution.match!.name;

      // Fetch the full thing record to check containerId
      const thing = await apiClient.get<ThingRecord>(`/things/${thingId}`, {
        inventoryId,
      });

      if (!thing.containerId) {
        return {
          content: [
            {
              type: "text" as const,
              text: `'${thingName}' exists but is not packed in any container.`,
            },
          ],
        };
      }

      // Fetch the container details
      const container = await apiClient.get<ContainerRecord>(
        `/containers/${thing.containerId}`,
        { inventoryId }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `'${thingName}' is in container '${container.name}' (ID: ${container.id}, Status: ${container.status})`,
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
