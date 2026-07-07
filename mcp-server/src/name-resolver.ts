// Name resolution with caching for entity lookups

import type { ApiClient } from "./api-client.js";

export interface ResolvedEntity {
  id: string;
  name: string;
  type: "location" | "room" | "category" | "container" | "thing";
  parentName?: string;
}

export interface ResolutionResult {
  status: "exact" | "multiple" | "not_found";
  match?: ResolvedEntity;
  candidates?: ResolvedEntity[];
}

interface LocationRecord {
  id: string;
  name: string;
  description?: string;
  type?: string;
}

interface RoomRecord {
  id: string;
  name: string;
  locationId: string;
}

interface CategoryRecord {
  id: string;
  name: string;
  description?: string;
}

interface ContainerRecord {
  id: string;
  name: string;
  status: string;
  itemCount: number;
  estimatedValue: number;
  locationId?: string;
  type?: string;
}

interface ThingRecord {
  id: string;
  name: string;
  description?: string;
  locationId?: string;
  roomId?: string;
  categoryId?: string;
  containerId?: string;
  tags?: string[];
  inventoryId: string;
}

export class NameResolver {
  private readonly apiClient: ApiClient;
  private readonly inventoryId: string;

  private locationsCache: ResolvedEntity[] | null = null;
  private roomsCache: ResolvedEntity[] | null = null;
  private categoriesCache: ResolvedEntity[] | null = null;

  constructor(apiClient: ApiClient, inventoryId: string) {
    this.apiClient = apiClient;
    this.inventoryId = inventoryId;
  }

  async resolveLocation(name: string): Promise<ResolutionResult> {
    const entities = await this.getLocations();
    return this.resolve(name, entities);
  }

  async resolveRoom(name: string): Promise<ResolutionResult> {
    const entities = await this.getRooms();
    return this.resolve(name, entities);
  }

  async resolveCategory(name: string): Promise<ResolutionResult> {
    const entities = await this.getCategories();
    return this.resolve(name, entities);
  }

  async resolveContainer(name: string): Promise<ResolutionResult> {
    const entities = await this.fetchContainers();
    return this.resolve(name, entities);
  }

  async resolveThing(name: string): Promise<ResolutionResult> {
    const entities = await this.fetchThings(name);
    return this.resolve(name, entities);
  }

  invalidateCache(): void {
    this.locationsCache = null;
    this.roomsCache = null;
    this.categoriesCache = null;
  }

  private resolve(name: string, entities: ResolvedEntity[]): ResolutionResult {
    const lower = name.toLowerCase();

    // 1. Case-insensitive exact match
    const exactMatch = entities.find(
      (e) => e.name.toLowerCase() === lower
    );
    if (exactMatch) {
      return { status: "exact", match: exactMatch };
    }

    // 2. Case-insensitive substring match
    const substringMatches = entities.filter((e) =>
      e.name.toLowerCase().includes(lower)
    );

    if (substringMatches.length === 0) {
      return { status: "not_found" };
    }

    if (substringMatches.length === 1) {
      return { status: "exact", match: substringMatches[0] };
    }

    // 3. Sort: prefix matches first, then substring
    const sorted = substringMatches.sort((a, b) => {
      const aIsPrefix = a.name.toLowerCase().startsWith(lower);
      const bIsPrefix = b.name.toLowerCase().startsWith(lower);
      if (aIsPrefix && !bIsPrefix) return -1;
      if (!aIsPrefix && bIsPrefix) return 1;
      return a.name.localeCompare(b.name);
    });

    const candidates = sorted.slice(0, 10);
    return { status: "multiple", candidates };
  }

  private async getLocations(): Promise<ResolvedEntity[]> {
    if (this.locationsCache) {
      return this.locationsCache;
    }

    try {
      const records = await this.apiClient.get<LocationRecord[]>("/locations", {
        inventoryId: this.inventoryId,
      });

      this.locationsCache = records.map((r) => ({
        id: r.id,
        name: r.name,
        type: "location" as const,
      }));
    } catch {
      // If API unreachable, cache stays empty and retries next request
      this.locationsCache = null;
      return [];
    }

    return this.locationsCache;
  }

  private async getRooms(): Promise<ResolvedEntity[]> {
    if (this.roomsCache) {
      return this.roomsCache;
    }

    try {
      const records = await this.apiClient.get<RoomRecord[]>("/rooms", {
        inventoryId: this.inventoryId,
      });

      // To populate parentName, we need locations
      const locations = await this.getLocations();
      const locationMap = new Map(locations.map((l) => [l.id, l.name]));

      this.roomsCache = records.map((r) => ({
        id: r.id,
        name: r.name,
        type: "room" as const,
        parentName: locationMap.get(r.locationId),
      }));
    } catch {
      this.roomsCache = null;
      return [];
    }

    return this.roomsCache;
  }

  private async getCategories(): Promise<ResolvedEntity[]> {
    if (this.categoriesCache) {
      return this.categoriesCache;
    }

    try {
      const records = await this.apiClient.get<CategoryRecord[]>(
        "/categories",
        { inventoryId: this.inventoryId }
      );

      this.categoriesCache = records.map((r) => ({
        id: r.id,
        name: r.name,
        type: "category" as const,
      }));
    } catch {
      this.categoriesCache = null;
      return [];
    }

    return this.categoriesCache;
  }

  private async fetchContainers(): Promise<ResolvedEntity[]> {
    // Containers are always fetched fresh (no cache)
    try {
      const records = await this.apiClient.get<ContainerRecord[]>(
        "/containers",
        { inventoryId: this.inventoryId }
      );

      return records.map((r) => ({
        id: r.id,
        name: r.name,
        type: "container" as const,
      }));
    } catch {
      return [];
    }
  }

  private async fetchThings(name: string): Promise<ResolvedEntity[]> {
    // Things are always fetched fresh with search parameter
    try {
      const records = await this.apiClient.get<ThingRecord[]>("/things", {
        inventoryId: this.inventoryId,
        search: name,
      });

      return records.map((r) => ({
        id: r.id,
        name: r.name,
        type: "thing" as const,
      }));
    } catch {
      return [];
    }
  }
}
