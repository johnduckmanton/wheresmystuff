// NameResolver unit tests
import { describe, it, expect } from "vitest";
import { NameResolver } from "../src/name-resolver.js";

describe("NameResolver", () => {
  it("should be instantiable", () => {
    const mockApiClient = {
      get: async () => ({ success: true, data: [] }),
      post: async () => ({ success: true, data: {} }),
      put: async () => ({ success: true, data: {} }),
      delete: async () => ({ success: true, data: {} }),
    };
    const resolver = new NameResolver(mockApiClient as any, "test-inventory-id");
    expect(resolver).toBeInstanceOf(NameResolver);
  });
});
