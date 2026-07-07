// list_rooms tool handler

import type { ApiClient } from "../api-client.js";
import type { NameResolver } from "../name-resolver.js";
import {
  formatRoomsList,
  formatResolutionCandidates,
  type RoomRecord,
  type LocationRecord,
} from "../formatters.js";

type ToolHandler = (
  args: Record<string, unknown>
) => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>;

export const definition = {
  name: "list_rooms",
  description: "List rooms, optionally filtered by location",
  inputSchema: {
    type: "object" as const,
    properties: {
      location: {
        type: "string",
        description: "Optional location name to filter rooms by",
      },
    },
    required: [],
  },
};

export function createHandler(
  apiClient: ApiClient,
  nameResolver: NameResolver,
  inventoryId: string
): ToolHandler {
  return async (args: Record<string, unknown>) => {
    try {
      const locationName = args.location as string | undefined;

      let locationId: string | undefined;

      // If location name provided, resolve it
      if (locationName) {
        const resolution = await nameResolver.resolveLocation(locationName);

        if (resolution.status === "not_found") {
          return {
            content: [
              {
                type: "text",
                text: `Could not find location matching '${locationName}'.`,
              },
            ],
            isError: true,
          };
        }

        if (resolution.status === "multiple" && resolution.candidates) {
          const candidatesList = formatResolutionCandidates(resolution.candidates);
          return {
            content: [
              {
                type: "text",
                text: `Multiple locations match '${locationName}'. Please be more specific:\n\n${candidatesList}`,
              },
            ],
            isError: true,
          };
        }

        locationId = resolution.match!.id;
      }

      // Build params for rooms request
      const params: Record<string, string> = { inventoryId };
      if (locationId) {
        params.locationId = locationId;
      }

      // Fetch rooms
      const rooms = await apiClient.get<RoomRecord[]>("/rooms", params);

      // Fetch locations for parent name mapping
      const locations = await apiClient.get<LocationRecord[]>("/locations", {
        inventoryId,
      });
      const locationsMap = new Map(locations.map((loc) => [loc.id, loc.name]));

      const text = formatRoomsList(rooms, locationsMap);

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
