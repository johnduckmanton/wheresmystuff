// Server-issued JWT signing and validation (HS256)

import { SignJWT, jwtVerify } from "jose";

export interface JwtPayload {
  sub: string;
  email: string;
  cognitoAccessToken: string;
  cognitoRefreshToken: string;
  cognitoTokenExpiresAt: number;
  iat: number;
  exp: number;
}

/** Duration in seconds for token expiration (24 hours). */
const TOKEN_EXPIRATION_SECONDS = 24 * 60 * 60;

export class JwtValidator {
  private readonly secret: Uint8Array;

  constructor(signingSecret: string) {
    this.secret = new TextEncoder().encode(signingSecret);
  }

  /**
   * Signs a new server-issued JWT with iat and exp claims.
   * The payload should not include iat or exp — they are set automatically.
   */
  async signToken(
    payload: Omit<JwtPayload, "iat" | "exp">
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    return new SignJWT({ ...payload } as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + TOKEN_EXPIRATION_SECONDS)
      .sign(this.secret);
  }

  /**
   * Validates a server-issued JWT. Returns the decoded payload if the token
   * is valid (correct signature, not expired), or null otherwise.
   */
  async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ["HS256"],
      });

      // Ensure all required fields are present
      if (
        typeof payload.sub !== "string" ||
        typeof payload.email !== "string" ||
        typeof payload.cognitoAccessToken !== "string" ||
        typeof payload.cognitoRefreshToken !== "string" ||
        typeof payload.cognitoTokenExpiresAt !== "number" ||
        typeof payload.iat !== "number" ||
        typeof payload.exp !== "number"
      ) {
        return null;
      }

      return {
        sub: payload.sub,
        email: payload.email as string,
        cognitoAccessToken: payload.cognitoAccessToken as string,
        cognitoRefreshToken: payload.cognitoRefreshToken as string,
        cognitoTokenExpiresAt: payload.cognitoTokenExpiresAt as number,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch {
      // Any error (expired, wrong signature, malformed) returns null
      return null;
    }
  }
}
