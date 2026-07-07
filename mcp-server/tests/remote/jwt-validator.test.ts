import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { JwtValidator } from "../../src/remote/jwt-validator.js";
import type { JwtPayload } from "../../src/remote/jwt-validator.js";

const TEST_SECRET = "test-signing-secret-at-least-32-chars-long";

function makePayload(): Omit<JwtPayload, "iat" | "exp"> {
  return {
    sub: "user-123",
    email: "user@example.com",
    cognitoAccessToken: "cognito-access-token-abc",
    cognitoRefreshToken: "cognito-refresh-token-xyz",
    cognitoTokenExpiresAt: Date.now() + 3600000,
  };
}

describe("JwtValidator", () => {
  describe("signToken", () => {
    it("produces a valid JWT string with three dot-separated parts", async () => {
      const validator = new JwtValidator(TEST_SECRET);
      const token = await validator.signToken(makePayload());

      expect(token.split(".")).toHaveLength(3);
    });

    it("includes iat and exp claims in the signed token", async () => {
      const validator = new JwtValidator(TEST_SECRET);
      const token = await validator.signToken(makePayload());

      const decoded = await validator.validateToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.iat).toBeTypeOf("number");
      expect(decoded!.exp).toBeTypeOf("number");
      expect(decoded!.exp).toBeGreaterThan(decoded!.iat);
    });

    it("sets exp to 24 hours after iat", async () => {
      const validator = new JwtValidator(TEST_SECRET);
      const token = await validator.signToken(makePayload());

      const decoded = await validator.validateToken(token);
      expect(decoded!.exp - decoded!.iat).toBe(24 * 60 * 60);
    });

    it("preserves all payload fields in the signed token", async () => {
      const validator = new JwtValidator(TEST_SECRET);
      const payload = makePayload();
      const token = await validator.signToken(payload);

      const decoded = await validator.validateToken(token);
      expect(decoded!.sub).toBe(payload.sub);
      expect(decoded!.email).toBe(payload.email);
      expect(decoded!.cognitoAccessToken).toBe(payload.cognitoAccessToken);
      expect(decoded!.cognitoRefreshToken).toBe(payload.cognitoRefreshToken);
      expect(decoded!.cognitoTokenExpiresAt).toBe(payload.cognitoTokenExpiresAt);
    });
  });

  describe("validateToken", () => {
    it("returns the decoded payload for a valid token", async () => {
      const validator = new JwtValidator(TEST_SECRET);
      const payload = makePayload();
      const token = await validator.signToken(payload);

      const decoded = await validator.validateToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded!.sub).toBe("user-123");
      expect(decoded!.email).toBe("user@example.com");
    });

    it("returns null for a token signed with a different secret", async () => {
      const validator1 = new JwtValidator(TEST_SECRET);
      const validator2 = new JwtValidator("different-secret-entirely-different");

      const token = await validator1.signToken(makePayload());
      const result = await validator2.validateToken(token);

      expect(result).toBeNull();
    });

    it("returns null for an expired token", async () => {
      const validator = new JwtValidator(TEST_SECRET);
      const secret = new TextEncoder().encode(TEST_SECRET);

      // Manually create an expired token
      const payload = makePayload();
      const pastTime = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago
      const token = await new SignJWT({ ...payload } as unknown as Record<string, unknown>)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(pastTime)
        .setExpirationTime(pastTime + 3600) // expired 1 hour ago
        .sign(secret);

      const result = await validator.validateToken(token);
      expect(result).toBeNull();
    });

    it("returns null for a malformed token string", async () => {
      const validator = new JwtValidator(TEST_SECRET);

      expect(await validator.validateToken("not-a-jwt")).toBeNull();
      expect(await validator.validateToken("")).toBeNull();
      expect(await validator.validateToken("a.b.c")).toBeNull();
    });

    it("returns null for a token missing required claims", async () => {
      const validator = new JwtValidator(TEST_SECRET);
      const secret = new TextEncoder().encode(TEST_SECRET);

      // Token with missing fields
      const incompletePayload = { sub: "user-123" };
      const token = await new SignJWT(incompletePayload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(secret);

      const result = await validator.validateToken(token);
      expect(result).toBeNull();
    });

    it("returns null for a token using a different algorithm", async () => {
      const validator = new JwtValidator(TEST_SECRET);

      // Try to pass a token that doesn't match HS256 (tampered header)
      const token = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyLTEyMyJ9.";
      const result = await validator.validateToken(token);
      expect(result).toBeNull();
    });
  });
});
