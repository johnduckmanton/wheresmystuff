// update_thing tool handler

import type { ApiClient } from "../api-client.js";
import type { NameResolver } from "../name-resolver.js";
import { formatResolutionCandidates, type ThingRecord } from "../formatters.js";

export const definition = {
  name: "update_thing",
  description:
    "Update properties of an existing thing in the inventory (location, room, category, description, tags, notes, condition, value, make, model, brand)",
  inputSchema: {
    type: "object" as const,
    properties: {
      thing: {
        type: "string",
        description: "Name or ID of the thing to update",
      },
      location: {
        type: "string",
        description: "New location name to assign the thing to",
      },
      room: {
        type: "string",
        description: "New room name to assign the thing to",
      },
      category: {
        type: "string",
        description: "New category name to assign the thing to",
      },
      description: {
        type: "string",
        maxLength: 1000,
        description: "New description for the thing",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "New tags for the thing",
      },
      notes: {
        type: "string",
        description: "Notes about the thing",
      },
      condition: {
        type: "string",
        description: "Condition of the thing (e.g., new, good, fair, poor)",
      },
      value: {
        type: "number",
        description: "Monetary value of the thing",
      },
      make: {
        type: "string",
        description: "Manufacturer/make of the thing",
      },
      model: {
        type: "string",
        description: "Model name/number of the thing",
      },
      brand: {
        type: "string",
        description: "Brand name of the thing",
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
      const location = args.location as string | undefined;
      const room = args.room as string | undefined;
      const category = args.category as string | undefined;
      const description = args.description as string | undefined;
      const tags = args.tags as string[] | undefined;
      const notes = args.notes as string | undefined;
      const condition = args.condition as string | undefined;
      const value = args.value as number | undefined;
      const make = args.make as string | undefined;
      const model = args.model as string | undefined;
      const brand = args.brand as string | undefined;

      // Validate thing identifier
      if (!thing || thing.trim().length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Please provide the name or ID of the thing to update.",
            },
          ],
          isError: true,
        };
      }

      // Validate description length
      if (description && description.length > 1000) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Description must be 1000 characters or less.",
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
              text: `Could not find thing matching "${thing}".`,
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

      // Fetch existing thing data
      const existing = await apiClient.get<ThingRecord>(
        `/things/${thingId}`,
        { inventoryId }
      );

      // Resolve location name to ID if provided
      let locationId: string | undefined;
      let locationName: string | undefined;

      if (location) {
        const result = await nameResolver.resolveLocation(location);

        if (result.status === "not_found") {
          return {
            content: [
              {
                type: "text" as const,
                text: `Could not find location matching "${location}".`,
              },
            ],
            isError: true,
          };
        }

        if (result.status === "multiple") {
          const formatted = formatResolutionCandidates(
            result.candidates ?? []
          );
          return {
            content: [
              {
                type: "text" as const,
                text: `Multiple locations match "${location}". Please clarify which one you mean:\n\n${formatted}`,
              },
            ],
          };
        }

        locationId = result.match!.id;
        locationName = result.match!.name;
      }

      // Resolve room name to ID if provided
      let roomId: string | undefined;
      let roomName: string | undefined;

      if (room) {
        const result = await nameResolver.resolveRoom(room);

        if (result.status === "not_found") {
          return {
            content: [
              {
                type: "text" as const,
                text: `Could not find room matching "${room}".`,
              },
            ],
            isError: true,
          };
        }

        if (result.status === "multiple") {
          const formatted = formatResolutionCandidates(
            result.candidates ?? []
          );
          return {
            content: [
              {
                type: "text" as const,
                text: `Multiple rooms match "${room}". Please clarify which one you mean:\n\n${formatted}`,
              },
            ],
          };
        }

        roomId = result.match!.id;
        roomName = result.match!.name;
      }

      // Resolve category name to ID if provided
      let categoryId: string | undefined;
      let categoryName: string | undefined;

      if (category) {
        const result = await nameResolver.resolveCategory(category);

        if (result.status === "not_found") {
          return {
            content: [
              {
                type: "text" as const,
                text: `Could not find category matching "${category}".`,
              },
            ],
            isError: true,
          };
        }

        if (result.status === "multiple") {
          const formatted = formatResolutionCandidates(
            result.candidates ?? []
          );
          return {
            content: [
              {
                type: "text" as const,
                text: `Multiple categories match "${category}". Please clarify which one you mean:\n\n${formatted}`,
              },
            ],
          };
        }

        categoryId = result.match!.id;
        categoryName = result.match!.name;
      }

      // Build update payload by merging existing data with new fields
      const updatedBody: Record<string, unknown> = {
        ...existing,
      };

      // Track changes for the confirmation message
      const changes: Array<{ field: string; previous: string; updated: string }> = [];

      if (locationId !== undefined) {
        const prevLocation = existing.locationId ?? "none";
        changes.push({
          field: "location",
          previous: prevLocation,
          updated: locationName!,
        });
        updatedBody.locationId = locationId;
      }

      if (roomId !== undefined) {
        const prevRoom = existing.roomId ?? "none";
        changes.push({
          field: "room",
          previous: prevRoom,
          updated: roomName!,
        });
        updatedBody.roomId = roomId;
      }

      if (categoryId !== undefined) {
        const prevCategory = existing.categoryId ?? "none";
        changes.push({
          field: "category",
          previous: prevCategory,
          updated: categoryName!,
        });
        updatedBody.categoryId = categoryId;
      }

      if (description !== undefined) {
        const prevDescription = existing.description ?? "none";
        changes.push({
          field: "description",
          previous: prevDescription,
          updated: description,
        });
        updatedBody.description = description;
      }

      if (tags !== undefined) {
        const prevTags =
          existing.tags && existing.tags.length > 0
            ? existing.tags.join(", ")
            : "none";
        changes.push({
          field: "tags",
          previous: prevTags,
          updated: tags.length > 0 ? tags.join(", ") : "none",
        });
        updatedBody.tags = tags;
      }

      if (notes !== undefined) {
        const prevNotes = existing.notes ?? "none";
        changes.push({
          field: "notes",
          previous: prevNotes,
          updated: notes,
        });
        updatedBody.notes = notes;
      }

      if (condition !== undefined) {
        const prevCondition = existing.condition ?? "none";
        changes.push({
          field: "condition",
          previous: prevCondition,
          updated: condition,
        });
        updatedBody.condition = condition;
      }

      if (value !== undefined) {
        const prevValue =
          existing.purchasePrice !== undefined
            ? `$${existing.purchasePrice}`
            : "none";
        changes.push({
          field: "value",
          previous: prevValue,
          updated: `$${value}`,
        });
        updatedBody.purchasePrice = value;
      }

      if (make !== undefined) {
        const prevMake = existing.make ?? "none";
        changes.push({
          field: "make",
          previous: prevMake,
          updated: make,
        });
        updatedBody.make = make;
      }

      if (model !== undefined) {
        const prevModel = existing.model ?? "none";
        changes.push({
          field: "model",
          previous: prevModel,
          updated: model,
        });
        updatedBody.model = model;
      }

      if (brand !== undefined) {
        const prevBrand = existing.brand ?? "none";
        changes.push({
          field: "brand",
          previous: prevBrand,
          updated: brand,
        });
        updatedBody.brand = brand;
      }

      // If no changes were specified, inform the user
      if (changes.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No update fields were provided. Please specify at least one field to update (location, room, category, description, tags, notes, condition, value, make, model, or brand).",
            },
          ],
          isError: true,
        };
      }

      // PUT to /things/{id}
      await apiClient.put<ThingRecord>(`/things/${thingId}`, updatedBody);

      // Build confirmation message
      const changeSummary = changes
        .map((c) => `• ${c.field}: "${c.previous}" → "${c.updated}"`)
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Updated "${existing.name}" (ID: ${thingId})\n\nChanges:\n${changeSummary}`,
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
