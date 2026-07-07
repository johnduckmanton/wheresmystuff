import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import nock from "nock";
import { JwksCache, resetJwksCache } from "../../src/remote/jwks-cache.js";

const USER_POOL_ID = "us-east-1_TestPool1";
const REGION = "us-east-1";
const CLIENT_ID = "test-client-id-abc123";
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;
const JWKS_PATH = `/${USER_POOL_ID}/.well-known/jwks.json`;

describe("JwksCache", () => {
  let privateKey: CryptoKey;
  let jwksResponse: { keys: object[] };

  beforeEach(async () => {
    resetJwksCache();
    nock.cleanAll();

    // Generate a key pair for signing test tokens
    const keyPair = await generateKeyPair("RS256");
    privateKey = keyPair.privateKey;

    const publicJwk = await exportJWK(keyPair.publicKey);
    publicJwk.kid = "test-key-id";
    publicJwk.alg = "RS256";
    publicJwk.use = "sig";

    jwksResponse = { keys: [publicJwk] };
  });

  afterEach(() => {
    nock.cleanAll();
    resetJwksCache();
  });

  function mockJwksEndpoint(times = 1) {
    return nock(`https://cognito-idp.${REGION}.amazonaws.com`)
      .get(JWKS_PATH)
      .times(times)
      .reply(200, jwksResponse);
  }

  async function createValidToken(overrides: Record<string, unknown> = {}) {
    const builder = new SignJWT({ ...overrides })
      .setProtectedHeader({ alg: "RS256", kid: "test-key-id" })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setExpirationTime("1h")
      .setIssuedAt();

    return builder.sign(privateKey);
  }

  it("validates a correctly signed token with matching issuer and audience", async () => {
    mockJwksEndpoint();
    const cache = new JwksCache(USER_POOL_ID, REGION, CLIENT_ID);
    const token = await createValidToken({ sub: "user-123" });

    const payload = await cache.validateCognitoToken(token);

    expect(payload.sub).toBe("user-123");
    expect(payload.iss).toBe(ISSUER);
    expect(payload.aud).toBe(CLIENT_ID);
  });

  it("rejects an expired token", async () => {
    mockJwksEndpoint();
    const cache = new JwksCache(USER_POOL_ID, REGION, CLIENT_ID);

    const token = new SignJWT({ sub: "user-123" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key-id" })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setExpirationTime("-1h") // Already expired
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200);

    const signedToken = await token.sign(privateKey);

    await expect(cache.validateCognitoToken(signedToken)).rejects.toThrow();
  });

  it("rejects a token with wrong audience", async () => {
    mockJwksEndpoint();
    const cache = new JwksCache(USER_POOL_ID, REGION, CLIENT_ID);

    const token = new SignJWT({ sub: "user-123" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key-id" })
      .setIssuer(ISSUER)
      .setAudience("wrong-client-id")
      .setExpirationTime("1h")
      .setIssuedAt();

    const signedToken = await token.sign(privateKey);

    await expect(cache.validateCognitoToken(signedToken)).rejects.toThrow();
  });

  it("rejects a token with wrong issuer", async () => {
    mockJwksEndpoint();
    const cache = new JwksCache(USER_POOL_ID, REGION, CLIENT_ID);

    const token = new SignJWT({ sub: "user-123" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key-id" })
      .setIssuer("https://cognito-idp.us-east-1.amazonaws.com/wrong-pool")
      .setAudience(CLIENT_ID)
      .setExpirationTime("1h")
      .setIssuedAt();

    const signedToken = await token.sign(privateKey);

    await expect(cache.validateCognitoToken(signedToken)).rejects.toThrow();
  });

  it("rejects a token signed with a different key", async () => {
    mockJwksEndpoint();
    const cache = new JwksCache(USER_POOL_ID, REGION, CLIENT_ID);

    // Generate a different key pair
    const otherKeyPair = await generateKeyPair("RS256");

    const token = new SignJWT({ sub: "user-123" })
      .setProtectedHeader({ alg: "RS256", kid: "different-key" })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setExpirationTime("1h")
      .setIssuedAt();

    const signedToken = await token.sign(otherKeyPair.privateKey);

    await expect(cache.validateCognitoToken(signedToken)).rejects.toThrow();
  });

  it("caches the JWKS verifier across multiple calls", async () => {
    const scope = mockJwksEndpoint(1);
    const cache = new JwksCache(USER_POOL_ID, REGION, CLIENT_ID);

    const token1 = await createValidToken({ sub: "user-1" });
    const token2 = await createValidToken({ sub: "user-2" });

    await cache.validateCognitoToken(token1);
    await cache.validateCognitoToken(token2);

    // nock was set to allow only 1 call — if it fetched again it would throw
    expect(scope.isDone()).toBe(true);
  });

  it("caches JWKS at module level across instances with same URL", async () => {
    const scope = mockJwksEndpoint(1);

    const cache1 = new JwksCache(USER_POOL_ID, REGION, CLIENT_ID);
    const token1 = await createValidToken({ sub: "user-1" });
    await cache1.validateCognitoToken(token1);

    // Create a new instance with same config — should reuse the module-level cache
    const cache2 = new JwksCache(USER_POOL_ID, REGION, CLIENT_ID);
    const token2 = await createValidToken({ sub: "user-2" });
    await cache2.validateCognitoToken(token2);

    expect(scope.isDone()).toBe(true);
  });

  it("builds the correct JWKS URL from userPoolId and region", async () => {
    const scope = nock("https://cognito-idp.eu-west-1.amazonaws.com")
      .get("/eu-west-1_CustomPool/.well-known/jwks.json")
      .reply(200, jwksResponse);

    const cache = new JwksCache("eu-west-1_CustomPool", "eu-west-1", CLIENT_ID);
    const token = await createValidToken({ sub: "user-123" });

    // This will fail because issuer doesn't match, but verifies the JWKS URL was hit
    // Let's create a token matching the new issuer
    const customToken = new SignJWT({ sub: "user-123" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key-id" })
      .setIssuer("https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_CustomPool")
      .setAudience(CLIENT_ID)
      .setExpirationTime("1h")
      .setIssuedAt();

    const signedToken = await customToken.sign(privateKey);
    await cache.validateCognitoToken(signedToken);

    expect(scope.isDone()).toBe(true);
  });
});
