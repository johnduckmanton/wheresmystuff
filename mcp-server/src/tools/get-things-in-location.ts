// get_things_in_location tool handler

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
  name: "get_things_in_location",
  description: "Get things in a specific location or room",
  inputSchema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        maxLength: 200,
        description: "Name of the location or room to look up",
      },
    },
    required: ["name"],
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
      const name = args.name as string;

      // Validate input
      if (!name || name.trim().length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Please provide a location or room name.",
            },
          ],
          isError: true,
        };
      }

      if (name.length > 200) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Name must be 200 characters or less.",
            },
          ],
          isError: true,
        };
      }

      // Resolve both location and room in parallel
      const [locationResult, roomResult] = await Promise.all([
        nameResolver.resolveLocation(name),
        nameResolver.resolveRoom(name),
      ]);

      // Determine if we have an exact match on either
      const locationExact =
        locationResult.status === "exact" ? locationResult.match : undefined;
      const roomExact =
        roomResult.status === "exact" ? roomResult.match : undefined;

      // If exact match on location, query things by locationId
      if (locationExact) {
        return await queryThingsByLocation(
          apiClient,
          inventoryId,
          locationExact.id,
          locationExact.name
        );
      }

      // If exact match on room, query things by roomId
      if (roomExact) {
        return await queryThingsByRoom(
          apiClient,
          inventoryId,
          roomExact.id,
          roomExact.name
        );
      }

      // Combine candidates from both location and room results
      const candidates = [
        ...(locationResult.candidates ?? []),
        ...(roomResult.candidates ?? []),
      ];

      // If we have multiple matches across both, return disambiguation
      if (candidates.length > 0) {
        const capped = candidates.slice(0, 10);
        const formatted = formatResolutionCandidates(capped);
        return {
          content: [
            {
              type: "text" as const,
              text: `Multiple matches found for "${name}". Please clarify which one you mean:\n\n${formatted}`,
            },
          ],
        };
      }

      // No match at all — return not found with no suggestions
      return {
        content: [
          {
            type: "text" as const,
            text: `Could not find a location or room matching "${name}".`,
          },
        ],
        isError: true,
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

async function queryThingsByLocation(
  apiClient: ApiClient,
  inventoryId: string,
  locationId: string,
  locationName: string
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const things = await apiClient.get<ThingRecord[]>("/things", {
    inventoryId,
    locationId,
  });

  if (things.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `The location "${locationName}" exists but is currently empty.`,
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
  const roomsMap = new Map<string, string>(rooms.map((r) => [r.id, r.name]));
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
        text: `Things in "${locationName}":\n\n${formatted}`,
      },
    ],
  };
}

async function queryThingsByRoom(
  apiClient: ApiClient,
  inventoryId: string,
  roomId: string,
  roomName: string
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const things = await apiClient.get<ThingRecord[]>("/things", {
    inventoryId,
    roomId,
  });

  if (things.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `The room "${roomName}" exists but is currently empty.`,
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
  const roomsMap = new Map<string, string>(rooms.map((r) => [r.id, r.name]));
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
        text: `Things in "${roomName}":\n\n${formatted}`,
      },
    ],
  };
}
