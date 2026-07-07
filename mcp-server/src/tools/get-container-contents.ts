// get_container_contents tool handler

import type { ApiClient } from "../api-client.js";
import type { NameResolver } from "../name-resolver.js";
import {
  formatContainerContents,
  formatResolutionCandidates,
  type ContainerRecord,
  type ThingRecord,
} from "../formatters.js";

export const definition = {
  name: "get_container_contents",
  description: "Get items in a specific container",
  inputSchema: {
    type: "object" as const,
    properties: {
      container: {
        type: "string",
        description: "Container name or ID",
      },
    },
    required: ["container"],
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
      const containerInput = args.container as string;

      // Resolve the container name/ID
      const resolution = await nameResolver.resolveContainer(containerInput);

      if (resolution.status === "not_found") {
        return {
          content: [
            {
              type: "text" as const,
              text: `Container not found matching '${containerInput}'.`,
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
              text: `Multiple containers match '${containerInput}'. Please be more specific:\n${candidateList}`,
            },
          ],
        };
      }

      const containerId = resolution.match!.id;

      // Fetch container details and contents in parallel
      const [container, items] = await Promise.all([
        apiClient.get<ContainerRecord>(`/containers/${containerId}`, {
          inventoryId,
        }),
        apiClient.get<ThingRecord[]>(`/containers/${containerId}/contents`, {
          inventoryId,
        }),
      ]);

      const formattedResult = formatContainerContents(container, items);

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
