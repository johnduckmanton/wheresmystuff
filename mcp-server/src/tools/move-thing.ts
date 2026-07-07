// move_thing tool handler

import type { ApiClient } from "../api-client.js";
import type { NameResolver } from "../name-resolver.js";
import {
  formatResolutionCandidates,
  type ThingRecord,
  type RoomRecord,
} from "../formatters.js";

export const definition = {
  name: "move_thing",
  description: "Move a thing to a different location or room",
  inputSchema: {
    type: "object" as const,
    properties: {
      thing: {
        type: "string",
        description: "Name or ID of the thing to move",
      },
      destination: {
        type: "string",
        description: "Name of the destination location or room",
      },
    },
    required: ["thing", "destination"],
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
      const destination = args.destination as string;

      // Validate inputs
      if (!thing || thing.trim().length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Please provide the name or ID of the thing to move.",
            },
          ],
          isError: true,
        };
      }

      if (!destination || destination.trim().length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Please provide a destination location or room name.",
            },
          ],
          isError: true,
        };
      }

      // Resolve thing name to ID
      const thingResult = await nameResolver.resolveThing(thing);

      if (thingResult.status === "not_found") {
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

      if (thingResult.status === "multiple") {
        const formatted = formatResolutionCandidates(
          thingResult.candidates ?? []
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Multiple things match "${thing}". Please clarify which one you mean:\n\n${formatted}`,
            },
          ],
        };
      }

      const thingId = thingResult.match!.id;
      const thingName = thingResult.match!.name;

      // Resolve destination: try room first, then location
      const roomResult = await nameResolver.resolveRoom(destination);

      let newLocationId: string | undefined;
      let newRoomId: string | null | undefined;
      let destinationName: string;

      if (roomResult.status === "exact") {
        // Destination is a room — set roomId and derive parent locationId
        newRoomId = roomResult.match!.id;
        destinationName = roomResult.match!.name;

        // Fetch rooms from API to get the parent locationId
        const rooms = await apiClient.get<RoomRecord[]>("/rooms", {
          inventoryId,
        });
        const matchedRoom = rooms.find((r) => r.id === newRoomId);

        if (matchedRoom) {
          newLocationId = matchedRoom.locationId;
        } else {
          // Fallback: resolve parentName via location resolver
          const parentName = roomResult.match!.parentName;
          if (parentName) {
            const parentResult = await nameResolver.resolveLocation(parentName);
            if (parentResult.status === "exact") {
              newLocationId = parentResult.match!.id;
            }
          }
        }
      } else {
        // Room didn't match exactly — try location
        const locationResult = await nameResolver.resolveLocation(destination);

        if (locationResult.status === "exact") {
          // Destination is a location — set locationId, clear roomId
          newLocationId = locationResult.match!.id;
          newRoomId = null;
          destinationName = locationResult.match!.name;
        } else if (
          locationResult.status === "multiple" ||
          roomResult.status === "multiple"
        ) {
          // Combine candidates from both for disambiguation
          const candidates = [
            ...(roomResult.candidates ?? []),
            ...(locationResult.candidates ?? []),
          ].slice(0, 10);
          const formatted = formatResolutionCandidates(candidates);
          return {
            content: [
              {
                type: "text" as const,
                text: `Multiple destinations match "${destination}". Please clarify which one you mean:\n\n${formatted}`,
              },
            ],
          };
        } else {
          // Neither room nor location found
          return {
            content: [
              {
                type: "text" as const,
                text: `Could not find a location or room matching "${destination}".`,
              },
            ],
            isError: true,
          };
        }
      }

      // Fetch existing thing to get previous location info
      const existingThing = await apiClient.get<ThingRecord>(
        `/things/${thingId}`,
        { inventoryId }
      );

      // Build previous location description
      let previousLocation = "unknown";
      if (existingThing.locationId || existingThing.roomId) {
        const [locations, rooms] = await Promise.all([
          apiClient.get<Array<{ id: string; name: string }>>("/locations", {
            inventoryId,
          }),
          apiClient.get<RoomRecord[]>("/rooms", { inventoryId }),
        ]);

        const parts: string[] = [];
        if (existingThing.locationId) {
          const prevLoc = locations.find(
            (l) => l.id === existingThing.locationId
          );
          if (prevLoc) parts.push(prevLoc.name);
        }
        if (existingThing.roomId) {
          const prevRoom = rooms.find((r) => r.id === existingThing.roomId);
          if (prevRoom) parts.push(prevRoom.name);
        }
        if (parts.length > 0) {
          previousLocation = parts.join(" > ");
        }
      }

      // Build PUT body with updated location fields
      const updateBody: Record<string, unknown> = {
        ...existingThing,
      };

      if (newLocationId !== undefined) {
        updateBody.locationId = newLocationId;
      }

      if (newRoomId === null) {
        // Moving to a location (not room) — clear roomId
        updateBody.roomId = null;
      } else if (newRoomId !== undefined) {
        updateBody.roomId = newRoomId;
      }

      // PUT to /things/{id}
      await apiClient.put<ThingRecord>(`/things/${thingId}`, updateBody);

      // Return confirmation
      return {
        content: [
          {
            type: "text" as const,
            text: `Moved "${thingName}" from ${previousLocation} to ${destinationName!}.`,
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
