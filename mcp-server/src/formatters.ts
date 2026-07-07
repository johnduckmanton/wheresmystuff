// Response formatting (API data → text)

import type { ResolvedEntity } from "./name-resolver.js";

export interface ThingRecord {
  id: string;
  name: string;
  description?: string;
  locationId?: string;
  roomId?: string;
  categoryId?: string;
  containerId?: string;
  tags?: string[];
  notes?: string;
  condition?: string;
  purchasePrice?: number;
  make?: string;
  model?: string;
  brand?: string;
  inventoryId: string;
}

export interface LocationRecord {
  id: string;
  name: string;
  description?: string;
  type?: string;
}

export interface RoomRecord {
  id: string;
  name: string;
  locationId: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  description?: string;
}

export interface ContainerRecord {
  id: string;
  name: string;
  status: string;
  itemCount: number;
  estimatedValue: number;
  locationId?: string;
  type?: string;
}

/**
 * Formats a list of things into human-readable text.
 * Each thing is displayed on its own line with name, location, room, category, and tags.
 */
export function formatThingsList(
  things: ThingRecord[],
  locations: Map<string, string>,
  rooms: Map<string, string>,
  categories: Map<string, string>
): string {
  if (things.length === 0) {
    return "No things found.";
  }

  const lines = things.map((thing) => {
    const parts: string[] = [thing.name];
    const details: string[] = [];

    if (thing.locationId) {
      const locationName = locations.get(thing.locationId);
      const roomName = thing.roomId ? rooms.get(thing.roomId) : undefined;

      if (locationName && roomName) {
        details.push(`Location: ${locationName} > ${roomName}`);
      } else if (locationName) {
        details.push(`Location: ${locationName}`);
      }
    } else if (thing.roomId) {
      const roomName = rooms.get(thing.roomId);
      if (roomName) {
        details.push(`Location: ${roomName}`);
      }
    }

    if (thing.categoryId) {
      const categoryName = categories.get(thing.categoryId);
      if (categoryName) {
        details.push(`Category: ${categoryName}`);
      }
    }

    if (thing.tags && thing.tags.length > 0) {
      details.push(`Tags: ${thing.tags.join(", ")}`);
    }

    if (details.length > 0) {
      return `• ${parts[0]} — ${details.join(", ")}`;
    }
    return `• ${parts[0]}`;
  });

  return lines.join("\n");
}

/**
 * Formats a list of locations into human-readable text.
 * Each location shows name, description, and type.
 */
export function formatLocationsList(locations: LocationRecord[]): string {
  if (locations.length === 0) {
    return "No locations found.";
  }

  const lines = locations.map((loc) => {
    const details: string[] = [];

    if (loc.description) {
      details.push(loc.description);
    }
    if (loc.type) {
      details.push(`Type: ${loc.type}`);
    }

    if (details.length > 0) {
      return `• ${loc.name} — ${details.join(", ")}`;
    }
    return `• ${loc.name}`;
  });

  return lines.join("\n");
}

/**
 * Formats a list of rooms into human-readable text.
 * Each room shows its name and parent location name.
 */
export function formatRoomsList(
  rooms: RoomRecord[],
  locations: Map<string, string>
): string {
  if (rooms.length === 0) {
    return "No rooms found.";
  }

  const lines = rooms.map((room) => {
    const locationName = locations.get(room.locationId);
    if (locationName) {
      return `• ${room.name} (${locationName})`;
    }
    return `• ${room.name}`;
  });

  return lines.join("\n");
}

/**
 * Formats a list of categories into human-readable text.
 * Each category shows name and description.
 */
export function formatCategoriesList(categories: CategoryRecord[]): string {
  if (categories.length === 0) {
    return "No categories found.";
  }

  const lines = categories.map((cat) => {
    if (cat.description) {
      return `• ${cat.name} — ${cat.description}`;
    }
    return `• ${cat.name}`;
  });

  return lines.join("\n");
}

/**
 * Formats a list of containers into human-readable text.
 * Each container shows name, ID, status, item count, and estimated value.
 */
export function formatContainersList(containers: ContainerRecord[]): string {
  if (containers.length === 0) {
    return "No containers found.";
  }

  const lines = containers.map((container) => {
    const details = [
      `ID: ${container.id}`,
      `Status: ${container.status}`,
      `Items: ${container.itemCount}`,
      `Value: $${container.estimatedValue.toFixed(2)}`,
    ];
    return `• ${container.name} — ${details.join(", ")}`;
  });

  return lines.join("\n");
}

/**
 * Formats container contents including container info and item list.
 */
export function formatContainerContents(
  container: ContainerRecord,
  items: ThingRecord[]
): string {
  const header = [
    `Container: ${container.name}`,
    `Status: ${container.status}`,
    `Items: ${container.itemCount}`,
    `Estimated Value: $${container.estimatedValue.toFixed(2)}`,
  ].join(" | ");

  if (items.length === 0) {
    return `${header}\n\nNo items in this container.`;
  }

  const itemLines = items.map((item) => `  • ${item.name}`);

  return `${header}\n\nContents:\n${itemLines.join("\n")}`;
}

/**
 * Formats resolution candidates for disambiguation.
 * Each candidate shows name, ID, and entity type.
 */
export function formatResolutionCandidates(
  candidates: ResolvedEntity[]
): string {
  if (candidates.length === 0) {
    return "No matches found.";
  }

  const lines = candidates.map((candidate) => {
    const details = [`ID: ${candidate.id}`, `Type: ${candidate.type}`];
    if (candidate.parentName) {
      details.push(`Parent: ${candidate.parentName}`);
    }
    return `• ${candidate.name} — ${details.join(", ")}`;
  });

  return lines.join("\n");
}
