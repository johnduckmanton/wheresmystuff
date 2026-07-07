// create_thing tool handler

import type { ApiClient } from "../api-client.js";
import type { NameResolver } from "../name-resolver.js";
import { formatResolutionCandidates, type ThingRecord } from "../formatters.js";

export const definition = {
  name: "create_thing",
  description: "Add a new thing to the inventory",
  inputSchema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: 255,
        description: "Name of the thing to create",
      },
      location: {
        type: "string",
        description: "Name of the location to assign the thing to",
      },
      room: {
        type: "string",
        description: "Name of the room to assign the thing to",
      },
      category: {
        type: "string",
        description: "Name of the category to assign the thing to",
      },
      description: {
        type: "string",
        maxLength: 1000,
        description: "Description of the thing",
      },
      tags: {
        type: "array",
        items: {
          type: "string",
          maxLength: 50,
          pattern: "^[a-zA-Z0-9_-]+$",
        },
        maxItems: 20,
        description:
          "Tags for the thing (max 20, each alphanumeric with hyphens/underscores, max 50 chars)",
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
      const location = args.location as string | undefined;
      const room = args.room as string | undefined;
      const category = args.category as string | undefined;
      const description = args.description as string | undefined;
      const tags = args.tags as string[] | undefined;

      // Validate name
      if (!name || name.trim().length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Please provide a name for the thing.",
            },
          ],
          isError: true,
        };
      }

      if (name.length > 255) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Name must be 255 characters or less.",
            },
          ],
          isError: true,
        };
      }

      // Validate description
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

      // Validate tags
      if (tags) {
        if (tags.length > 20) {
          return {
            content: [
              {
                type: "text" as const,
                text: "A maximum of 20 tags is allowed.",
              },
            ],
            isError: true,
          };
        }

        const tagPattern = /^[a-zA-Z0-9_-]+$/;
        for (const tag of tags) {
          if (tag.length > 50) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Tag "${tag}" exceeds the maximum length of 50 characters.`,
                },
              ],
              isError: true,
            };
          }
          if (!tagPattern.test(tag)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Tag "${tag}" contains invalid characters. Tags must be alphanumeric with hyphens and underscores only.`,
                },
              ],
              isError: true,
            };
          }
        }
      }

      // Resolve location name to ID
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

      // Resolve room name to ID
      let roomId: string | undefined;

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
      }

      // Resolve category name to ID
      let categoryId: string | undefined;

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
      }

      // Build POST body
      const body: Record<string, unknown> = {
        name: name.trim(),
        inventoryId,
      };

      if (locationId) body.locationId = locationId;
      if (roomId) body.roomId = roomId;
      if (categoryId) body.categoryId = categoryId;
      if (description) body.description = description;
      if (tags && tags.length > 0) body.tags = tags;

      // POST to /things
      const created = await apiClient.post<ThingRecord>("/things", body);

      // Build confirmation message
      const confirmParts = [`Created "${created.name}" (ID: ${created.id})`];
      if (locationName) {
        confirmParts.push(`Location: ${locationName}`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: confirmParts.join("\n"),
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
