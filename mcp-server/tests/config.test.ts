import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const VALID_ENV = {
    WHERESMYSTUFF_API_URL: "https://api.example.com",
    WHERESMYSTUFF_USER_POOL_ID: "eu-west-1_abc123",
    WHERESMYSTUFF_CLIENT_ID: "client-id-123",
    WHERESMYSTUFF_COGNITO_DOMAIN: "wheresmystuff.auth.eu-west-1.amazoncognito.com",
    WHERESMYSTUFF_INVENTORY_ID: "inv-456",
    WHERESMYSTUFF_REGION: "eu-west-1",
  };

  let originalEnv: NodeJS.ProcessEnv;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("returns a valid ServerConfig when all env vars are set", () => {
    Object.assign(process.env, VALID_ENV);

    const config = loadConfig();

    expect(config).toEqual({
      apiUrl: "https://api.example.com",
      userPoolId: "eu-west-1_abc123",
      clientId: "client-id-123",
      cognitoDomain: "wheresmystuff.auth.eu-west-1.amazoncognito.com",
      inventoryId: "inv-456",
      region: "eu-west-1",
    });
  });

  it("exits with non-zero code when a variable is missing", () => {
    Object.assign(process.env, VALID_ENV);
    delete process.env.WHERESMYSTUFF_API_URL;

    expect(() => loadConfig()).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("logs the missing variable name to stderr", () => {
    Object.assign(process.env, VALID_ENV);
    delete process.env.WHERESMYSTUFF_REGION;

    expect(() => loadConfig()).toThrow("process.exit called");
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("WHERESMYSTUFF_REGION")
    );
  });

  it("exits when a variable is set to an empty string", () => {
    Object.assign(process.env, VALID_ENV);
    process.env.WHERESMYSTUFF_CLIENT_ID = "";

    expect(() => loadConfig()).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("WHERESMYSTUFF_CLIENT_ID")
    );
  });

  it("exits when a variable is only whitespace", () => {
    Object.assign(process.env, VALID_ENV);
    process.env.WHERESMYSTUFF_INVENTORY_ID = "   ";

    expect(() => loadConfig()).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("WHERESMYSTUFF_INVENTORY_ID")
    );
  });

  it("reports all missing variables at once", () => {
    // Clear all required env vars
    delete process.env.WHERESMYSTUFF_API_URL;
    delete process.env.WHERESMYSTUFF_USER_POOL_ID;
    delete process.env.WHERESMYSTUFF_CLIENT_ID;
    delete process.env.WHERESMYSTUFF_COGNITO_DOMAIN;
    delete process.env.WHERESMYSTUFF_INVENTORY_ID;
    delete process.env.WHERESMYSTUFF_REGION;

    expect(() => loadConfig()).toThrow("process.exit called");
    const errorMessage = stderrSpy.mock.calls[0][0] as string;
    expect(errorMessage).toContain("WHERESMYSTUFF_API_URL");
    expect(errorMessage).toContain("WHERESMYSTUFF_USER_POOL_ID");
    expect(errorMessage).toContain("WHERESMYSTUFF_CLIENT_ID");
    expect(errorMessage).toContain("WHERESMYSTUFF_COGNITO_DOMAIN");
    expect(errorMessage).toContain("WHERESMYSTUFF_INVENTORY_ID");
    expect(errorMessage).toContain("WHERESMYSTUFF_REGION");
  });
});
