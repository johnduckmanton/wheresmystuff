// Cognito JWKS fetch and in-memory cache for JWT signature verification
// Cached at module level to persist across warm Lambda invocations

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

// Module-level JWKS verifier cache — persists across warm Lambda invocations
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJwksUrl: string | null = null;

export class JwksCache {
  private readonly jwksUrl: string;
  private readonly expectedAudience: string;
  private readonly expectedIssuer: string;

  constructor(
    private readonly userPoolId: string,
    private readonly region: string,
    clientId: string
  ) {
    this.jwksUrl = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    this.expectedIssuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    this.expectedAudience = clientId;
  }

  /**
   * Validate a Cognito JWT token by verifying:
   * - Signature against the Cognito JWKS endpoint
   * - Audience matches the configured client ID
   * - Issuer matches the Cognito user pool URL
   * - Token has not expired
   */
  async validateCognitoToken(token: string): Promise<JWTPayload> {
    const jwks = this.getJwks();

    const { payload } = await jwtVerify(token, jwks, {
      issuer: this.expectedIssuer,
      audience: this.expectedAudience,
    });

    return payload;
  }

  /**
   * Get or create the JWKS verifier.
   * Cached at module level so it survives across warm Lambda invocations.
   * If the JWKS URL changes (different config), a new verifier is created.
   */
  private getJwks(): ReturnType<typeof createRemoteJWKSet> {
    if (cachedJwks && cachedJwksUrl === this.jwksUrl) {
      return cachedJwks;
    }

    cachedJwks = createRemoteJWKSet(new URL(this.jwksUrl));
    cachedJwksUrl = this.jwksUrl;
    return cachedJwks;
  }
}

/**
 * Reset the module-level JWKS cache. Exposed for testing purposes only.
 */
export function resetJwksCache(): void {
  cachedJwks = null;
  cachedJwksUrl = null;
}
