// AuthManager unit tests
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("keytar", () => ({
  default: {
    getPassword: vi.fn(),
    setPassword: vi.fn(),
    deletePassword: vi.fn(),
  },
}));

vi.mock("open", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

import keytar from "keytar";
import { AuthManager } from "../src/auth-manager.js";

const mockedKeytar = vi.mocked(keytar);

describe("AuthManager", () => {
  const defaultOptions = {
    clientId: "test-client-123",
    cognitoDomain: "wheresmystuff.auth.eu-west-1.amazoncognito.com",
    region: "eu-west-1",
  };

  const mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockProcessExit.mockClear();
  });

  describe("constructor", () => {
    it("should create an instance with required options", () => {
      const manager = new AuthManager(defaultOptions);
      expect(manager).toBeInstanceOf(AuthManager);
    });

    it("should accept optional loginTimeoutMs", () => {
      const manager = new AuthManager({
        ...defaultOptions,
        loginTimeoutMs: 60000,
      });
      expect(manager).toBeInstanceOf(AuthManager);
    });
  });

  describe("Keychain operations", () => {
    const SERVICE_NAME = "wheresmystuff-mcp-test-client-123";
    const ACCOUNT = "refresh-token";

    let manager: AuthManager;

    beforeEach(() => {
      manager = new AuthManager(defaultOptions);
    });

    describe("getStoredRefreshToken", () => {
      it("should return the stored token when one exists", async () => {
        mockedKeytar.getPassword.mockResolvedValue("stored-refresh-token");

        // Access private method via type casting for testing
        const result = await (manager as any).getStoredRefreshToken();

        expect(mockedKeytar.getPassword).toHaveBeenCalledWith(
          SERVICE_NAME,
          ACCOUNT
        );
        expect(result).toBe("stored-refresh-token");
      });

      it("should return null when no token is stored", async () => {
        mockedKeytar.getPassword.mockResolvedValue(null);

        const result = await (manager as any).getStoredRefreshToken();

        expect(mockedKeytar.getPassword).toHaveBeenCalledWith(
          SERVICE_NAME,
          ACCOUNT
        );
        expect(result).toBeNull();
      });
    });

    describe("storeRefreshToken", () => {
      it("should store the token in keychain with correct service and account", async () => {
        mockedKeytar.setPassword.mockResolvedValue();

        await (manager as any).storeRefreshToken("new-refresh-token");

        expect(mockedKeytar.setPassword).toHaveBeenCalledWith(
          SERVICE_NAME,
          ACCOUNT,
          "new-refresh-token"
        );
      });
    });

    describe("deleteStoredRefreshToken", () => {
      it("should delete the token from keychain", async () => {
        mockedKeytar.deletePassword.mockResolvedValue(true);

        await (manager as any).deleteStoredRefreshToken();

        expect(mockedKeytar.deletePassword).toHaveBeenCalledWith(
          SERVICE_NAME,
          ACCOUNT
        );
      });
    });

    describe("service name pattern", () => {
      it("should use wheresmystuff-mcp-{clientId} as service name", async () => {
        const customManager = new AuthManager({
          ...defaultOptions,
          clientId: "another-client-456",
        });
        mockedKeytar.getPassword.mockResolvedValue(null);

        await (customManager as any).getStoredRefreshToken();

        expect(mockedKeytar.getPassword).toHaveBeenCalledWith(
          "wheresmystuff-mcp-another-client-456",
          ACCOUNT
        );
      });
    });
  });

  describe("getAccessToken", () => {
    let manager: AuthManager;

    beforeEach(() => {
      manager = new AuthManager({ ...defaultOptions, loginTimeoutMs: 500 });
    });

    it("should return cached token when still valid", async () => {
      // Set up a cached token that expires far in the future
      (manager as any).currentTokens = {
        accessToken: "cached-access-token",
        idToken: "cached-id-token",
        refreshToken: "cached-refresh-token",
        expiresAt: Date.now() + 600_000, // 10 minutes from now
      };

      const token = await manager.getAccessToken();
      expect(token).toBe("cached-access-token");
      // Should not touch keytar since cache is valid
      expect(mockedKeytar.getPassword).not.toHaveBeenCalled();
    });

    it("should attempt refresh when no cached token exists", async () => {
      mockedKeytar.getPassword.mockResolvedValue(null);

      // With no refresh token and short timeout, it will attempt browser login and timeout
      await expect(manager.getAccessToken()).rejects.toThrow("Login timeout");
    });
  });

  describe("refreshAccessToken", () => {
    let manager: AuthManager;

    beforeEach(() => {
      manager = new AuthManager({ ...defaultOptions, loginTimeoutMs: 500 });
    });

    it("should fall back to browser login when no refresh token stored", async () => {
      mockedKeytar.getPassword.mockResolvedValue(null);

      // With no refresh token and short timeout, it will attempt browser login and timeout
      await expect(manager.refreshAccessToken()).rejects.toThrow(
        "Login timeout"
      );
    });
  });
});
