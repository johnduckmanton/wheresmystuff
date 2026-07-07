// Formatters unit tests

import { describe, it, expect } from "vitest";
import {
  formatThingsList,
  formatLocationsList,
  formatRoomsList,
  formatCategoriesList,
  formatContainersList,
  formatContainerContents,
  formatResolutionCandidates,
} from "../src/formatters.js";
import type {
  ThingRecord,
  LocationRecord,
  RoomRecord,
  CategoryRecord,
  ContainerRecord,
} from "../src/formatters.js";
import type { ResolvedEntity } from "../src/name-resolver.js";

describe("formatThingsList", () => {
  it("returns 'No things found.' for empty list", () => {
    const result = formatThingsList([], new Map(), new Map(), new Map());
    expect(result).toBe("No things found.");
  });

  it("formats a thing with location, category, and tags", () => {
    const things: ThingRecord[] = [
      {
        id: "t1",
        name: "Drill",
        locationId: "loc1",
        categoryId: "cat1",
        tags: ["power-tools", "diy"],
        inventoryId: "inv1",
      },
    ];
    const locations = new Map([["loc1", "Garage"]]);
    const rooms = new Map();
    const categories = new Map([["cat1", "Tools"]]);

    const result = formatThingsList(things, locations, rooms, categories);
    expect(result).toBe(
      "• Drill — Location: Garage, Category: Tools, Tags: power-tools, diy"
    );
  });

  it("formats a thing with location and room", () => {
    const things: ThingRecord[] = [
      {
        id: "t2",
        name: "Camping Stove",
        locationId: "loc1",
        roomId: "room1",
        categoryId: "cat2",
        tags: ["camping"],
        inventoryId: "inv1",
      },
    ];
    const locations = new Map([["loc1", "Basement"]]);
    const rooms = new Map([["room1", "Storage Room"]]);
    const categories = new Map([["cat2", "Outdoor"]]);

    const result = formatThingsList(things, locations, rooms, categories);
    expect(result).toBe(
      "• Camping Stove — Location: Basement > Storage Room, Category: Outdoor, Tags: camping"
    );
  });

  it("formats a thing with only a name (no optional fields)", () => {
    const things: ThingRecord[] = [
      { id: "t3", name: "Mystery Item", inventoryId: "inv1" },
    ];
    const result = formatThingsList(things, new Map(), new Map(), new Map());
    expect(result).toBe("• Mystery Item");
  });

  it("formats multiple things", () => {
    const things: ThingRecord[] = [
      { id: "t1", name: "Drill", locationId: "loc1", inventoryId: "inv1" },
      { id: "t2", name: "Hammer", locationId: "loc1", inventoryId: "inv1" },
    ];
    const locations = new Map([["loc1", "Garage"]]);

    const result = formatThingsList(things, locations, new Map(), new Map());
    expect(result).toContain("• Drill — Location: Garage");
    expect(result).toContain("• Hammer — Location: Garage");
    expect(result.split("\n")).toHaveLength(2);
  });
});

describe("formatLocationsList", () => {
  it("returns 'No locations found.' for empty list", () => {
    expect(formatLocationsList([])).toBe("No locations found.");
  });

  it("formats locations with description and type", () => {
    const locations: LocationRecord[] = [
      { id: "l1", name: "Home", description: "Main residence", type: "house" },
      { id: "l2", name: "Storage Unit", type: "storage" },
    ];

    const result = formatLocationsList(locations);
    expect(result).toContain("• Home — Main residence, Type: house");
    expect(result).toContain("• Storage Unit — Type: storage");
  });

  it("formats a location with no description or type", () => {
    const locations: LocationRecord[] = [{ id: "l1", name: "Office" }];
    expect(formatLocationsList(locations)).toBe("• Office");
  });
});

describe("formatRoomsList", () => {
  it("returns 'No rooms found.' for empty list", () => {
    expect(formatRoomsList([], new Map())).toBe("No rooms found.");
  });

  it("formats rooms with parent location name", () => {
    const rooms: RoomRecord[] = [
      { id: "r1", name: "Garage", locationId: "loc1" },
      { id: "r2", name: "Kitchen", locationId: "loc1" },
    ];
    const locations = new Map([["loc1", "Home"]]);

    const result = formatRoomsList(rooms, locations);
    expect(result).toContain("• Garage (Home)");
    expect(result).toContain("• Kitchen (Home)");
  });

  it("formats a room when parent location is not found", () => {
    const rooms: RoomRecord[] = [
      { id: "r1", name: "Garage", locationId: "unknown" },
    ];
    const result = formatRoomsList(rooms, new Map());
    expect(result).toBe("• Garage");
  });
});

describe("formatCategoriesList", () => {
  it("returns 'No categories found.' for empty list", () => {
    expect(formatCategoriesList([])).toBe("No categories found.");
  });

  it("formats categories with descriptions", () => {
    const categories: CategoryRecord[] = [
      { id: "c1", name: "Tools", description: "Hand and power tools" },
      { id: "c2", name: "Electronics" },
    ];

    const result = formatCategoriesList(categories);
    expect(result).toContain("• Tools — Hand and power tools");
    expect(result).toContain("• Electronics");
  });
});

describe("formatContainersList", () => {
  it("returns 'No containers found.' for empty list", () => {
    expect(formatContainersList([])).toBe("No containers found.");
  });

  it("formats containers with all details", () => {
    const containers: ContainerRecord[] = [
      {
        id: "c1",
        name: "Moving Box A",
        status: "packed",
        itemCount: 12,
        estimatedValue: 450.0,
      },
      {
        id: "c2",
        name: "Storage Bin",
        status: "open",
        itemCount: 3,
        estimatedValue: 75.5,
      },
    ];

    const result = formatContainersList(containers);
    expect(result).toContain(
      "• Moving Box A — ID: c1, Status: packed, Items: 12, Value: $450.00"
    );
    expect(result).toContain(
      "• Storage Bin — ID: c2, Status: open, Items: 3, Value: $75.50"
    );
  });
});

describe("formatContainerContents", () => {
  it("formats container with items", () => {
    const container: ContainerRecord = {
      id: "c1",
      name: "Box A",
      status: "packed",
      itemCount: 2,
      estimatedValue: 100.0,
    };
    const items: ThingRecord[] = [
      { id: "t1", name: "Drill", inventoryId: "inv1" },
      { id: "t2", name: "Screwdriver Set", inventoryId: "inv1" },
    ];

    const result = formatContainerContents(container, items);
    expect(result).toContain("Container: Box A");
    expect(result).toContain("Status: packed");
    expect(result).toContain("Items: 2");
    expect(result).toContain("Estimated Value: $100.00");
    expect(result).toContain("Contents:");
    expect(result).toContain("  • Drill");
    expect(result).toContain("  • Screwdriver Set");
  });

  it("formats container with no items", () => {
    const container: ContainerRecord = {
      id: "c1",
      name: "Empty Box",
      status: "open",
      itemCount: 0,
      estimatedValue: 0,
    };

    const result = formatContainerContents(container, []);
    expect(result).toContain("Container: Empty Box");
    expect(result).toContain("No items in this container.");
  });
});

describe("formatResolutionCandidates", () => {
  it("returns 'No matches found.' for empty list", () => {
    expect(formatResolutionCandidates([])).toBe("No matches found.");
  });

  it("formats candidates with name, ID, and type", () => {
    const candidates: ResolvedEntity[] = [
      { id: "loc1", name: "Garage", type: "location" },
      { id: "room1", name: "Garage Workshop", type: "room", parentName: "Home" },
    ];

    const result = formatResolutionCandidates(candidates);
    expect(result).toContain("• Garage — ID: loc1, Type: location");
    expect(result).toContain(
      "• Garage Workshop — ID: room1, Type: room, Parent: Home"
    );
  });
});
