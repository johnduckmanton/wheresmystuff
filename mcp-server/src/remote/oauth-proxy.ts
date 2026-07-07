// MCP OAuth flow — delegates authentication to Cognito Hosted UI

import { randomBytes } from "node:crypto";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { RemoteServerConfig } from "./remote-config.js";
import { JwtValidator } from "./jwt-validator.js";

// DynamoDB sort key constants for OAuth records
const SK_OAUTH_STATE = "OAUTH_STATE";
const SK_AUTH_CODE = "AUTH_CODE";

// TTL durations
const OAUTH_STATE_TTL_SECONDS = 10 * 60; // 10 minutes
const AUTH_CODE_TTL_SECONDS = 5 * 60;    // 5 minutes

/**
 * Creates a DynamoDB DocumentClient for OAuth operations.
 */
function getDDBClient(region: string): DynamoDBDocumentClient {
  const ddbClient = new DynamoDBClient({ region });
  return DynamoDBDocumentClient.from(ddbClient);
}

/**
 * GET /.well-known/oauth-authorization-server
 * Returns OAuth metadata for MCP client discovery.
 */
export function handleOAuthMetadata(
  config: RemoteServerConfig
): APIGatewayProxyResultV2 {
  const baseUrl = config.serverBaseUrl;

  const metadata = {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  };
}

/**
 * GET /authorize
 * Generates a cryptographically secure state parameter, stores pending auth
 * state in DynamoDB, and redirects to the Cognito Hosted UI.
 */
export async function handleAuthorize(
  event: APIGatewayProxyEventV2,
  config: RemoteServerConfig
): Promise<APIGatewayProxyResultV2> {
  const params = event.queryStringParameters ?? {};
  const clientRedirectUri = params["redirect_uri"] ?? "";
  const clientState = params["state"] ?? "";

  // Generate cryptographically secure state
  const state = randomBytes(32).toString("hex");
  const now = Date.now();
  const ttl = Math.floor(now / 1000) + OAUTH_STATE_TTL_SECONDS;

  // Store pending auth state in DynamoDB
  const client = getDDBClient(config.region);
  await client.send(
    new PutCommand({
      TableName: config.sessionsTableName,
      Item: {
        pk: `OAUTH#${state}`,
        sk: SK_OAUTH_STATE,
        clientRedirectUri,
        clientState,
        createdAt: now,
        ttl,
      },
    })
  );

  // Redirect to Cognito Hosted UI
  const cognitoAuthorizeUrl =
    `https://${config.cognitoDomain}/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${config.clientId}` +
    `&redirect_uri=${encodeURIComponent(`${config.serverBaseUrl}/callback`)}` +
    `&state=${state}` +
    `&scope=openid+email+profile`;

  return {
    statusCode: 302,
    headers: { Location: cognitoAuthorizeUrl },
    body: "",
  };
}

/**
 * GET /callback
 * Cognito redirects here after user authentication. Exchanges the Cognito
 * authorization code for tokens, generates a server authorization code,
 * and redirects back to the client.
 */
export async function handleCallback(
  event: APIGatewayProxyEventV2,
  config: RemoteServerConfig
): Promise<APIGatewayProxyResultV2> {
  const params = event.queryStringParameters ?? {};
  const cognitoCode = params["code"];
  const state = params["state"];

  if (!cognitoCode || !state) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing code or state parameter" }),
    };
  }

  const client = getDDBClient(config.region);

  // Retrieve pending auth state from DynamoDB
  const stateResult = await client.send(
    new GetCommand({
      TableName: config.sessionsTableName,
      Key: { pk: `OAUTH#${state}`, sk: SK_OAUTH_STATE },
    })
  );

  if (!stateResult.Item) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid or expired state parameter" }),
    };
  }

  const clientRedirectUri = stateResult.Item["clientRedirectUri"] as string;
  const clientState = stateResult.Item["clientState"] as string | undefined;

  // Clean up the used state record
  await client.send(
    new DeleteCommand({
      TableName: config.sessionsTableName,
      Key: { pk: `OAUTH#${state}`, sk: SK_OAUTH_STATE },
    })
  );

  // Exchange Cognito authorization code for tokens
  const tokenEndpoint = `https://${config.cognitoDomain}/oauth2/token`;
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code: cognitoCode,
    redirect_uri: `${config.serverBaseUrl}/callback`,
    client_id: config.clientId,
  });

  const tokenResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });

  if (!tokenResponse.ok) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to exchange authorization code" }),
    };
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token: string;
    id_token: string;
    expires_in: number;
  };

  // Generate server authorization code
  const serverCode = randomBytes(32).toString("hex");
  const now = Date.now();
  const codeTtl = Math.floor(now / 1000) + AUTH_CODE_TTL_SECONDS;

  // Store code → tokens mapping in DynamoDB
  await client.send(
    new PutCommand({
      TableName: config.sessionsTableName,
      Item: {
        pk: `CODE#${serverCode}`,
        sk: SK_AUTH_CODE,
        cognitoAccessToken: tokenData.access_token,
        cognitoRefreshToken: tokenData.refresh_token,
        cognitoIdToken: tokenData.id_token,
        cognitoTokenExpiresAt: now + tokenData.expires_in * 1000,
        clientRedirectUri,
        ttl: codeTtl,
      },
    })
  );

  // Redirect to client callback with server code
  const redirectUrl = new URL(clientRedirectUri);
  redirectUrl.searchParams.set("code", serverCode);
  if (clientState) {
    redirectUrl.searchParams.set("state", clientState);
  }

  return {
    statusCode: 302,
    headers: { Location: redirectUrl.toString() },
    body: "",
  };
}

/**
 * POST /token
 * Client exchanges the server-issued authorization code for a JWT access token.
 * Body is application/x-www-form-urlencoded with `code` and `redirect_uri`.
 */
export async function handleTokenExchange(
  event: APIGatewayProxyEventV2,
  config: RemoteServerConfig
): Promise<APIGatewayProxyResultV2> {
  // Parse application/x-www-form-urlencoded body
  const body = event.body ?? "";
  const params = new URLSearchParams(
    event.isBase64Encoded
      ? Buffer.from(body, "base64").toString("utf-8")
      : body
  );

  const code = params.get("code");
  const grantType = params.get("grant_type");

  if (!code || grantType !== "authorization_code") {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "invalid_request", error_description: "Missing code or invalid grant_type" }),
    };
  }

  const client = getDDBClient(config.region);

  // Retrieve code → tokens mapping from DynamoDB
  const codeResult = await client.send(
    new GetCommand({
      TableName: config.sessionsTableName,
      Key: { pk: `CODE#${code}`, sk: SK_AUTH_CODE },
    })
  );

  if (!codeResult.Item) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid or expired authorization code" }),
    };
  }

  const codeRecord = codeResult.Item;

  // Clean up the used code record
  await client.send(
    new DeleteCommand({
      TableName: config.sessionsTableName,
      Key: { pk: `CODE#${code}`, sk: SK_AUTH_CODE },
    })
  );

  // Decode the Cognito ID token to extract user claims (sub, email)
  const idTokenParts = (codeRecord["cognitoIdToken"] as string).split(".");
  if (idTokenParts.length !== 3) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "server_error", error_description: "Invalid ID token format" }),
    };
  }

  const idPayload = JSON.parse(
    Buffer.from(idTokenParts[1]!, "base64url").toString("utf-8")
  ) as { sub: string; email: string };

  // Sign server-issued JWT with embedded Cognito tokens
  const jwtValidator = new JwtValidator(config.tokenSigningSecret);
  const accessToken = await jwtValidator.signToken({
    sub: idPayload.sub,
    email: idPayload.email,
    cognitoAccessToken: codeRecord["cognitoAccessToken"] as string,
    cognitoRefreshToken: codeRecord["cognitoRefreshToken"] as string,
    cognitoTokenExpiresAt: codeRecord["cognitoTokenExpiresAt"] as number,
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: accessToken,
      token_type: "Bearer",
    }),
  };
}
