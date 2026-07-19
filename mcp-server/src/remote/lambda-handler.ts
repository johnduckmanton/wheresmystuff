// Lambda entry point — routes API Gateway HTTP API v2 events to the appropriate handler

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { loadRemoteConfig, type RemoteServerConfig } from "./remote-config.js";
import { JwksCache } from "./jwks-cache.js";
import { validateSecurity } from "./security-middleware.js";
import {
  handleOAuthMetadata,
  handleAuthorize,
  handleCallback,
  handleTokenExchange,
  handleClientRegistration,
} from "./oauth-proxy.js";
import { handleMcpPost, handleMcpDelete } from "./mcp-handler.js";
import { logRequest, logError } from "./request-logger.js";

// Module-level singletons (persist across warm Lambda invocations)
let config: RemoteServerConfig | null = null;
let jwksCache: JwksCache | null = null;

/**
 * Security headers added to ALL responses (including errors).
 */
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
} as const;

/**
 * Adds security headers to a structured response object.
 */
function addSecurityHeaders(
  response: APIGatewayProxyStructuredResultV2
): APIGatewayProxyStructuredResultV2 {
  response.headers = { ...response.headers, ...SECURITY_HEADERS };
  return response;
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const startTime = Date.now();

  try {
    // Derive server base URL from the event's request context (avoids CloudFormation circular dependency)
    const serverBaseUrl = `https://${event.requestContext.domainName}`;

    // Initialize config + JWKS cache on cold start (or update serverBaseUrl)
    if (!config) {
      config = loadRemoteConfig(serverBaseUrl);
    } else {
      config.serverBaseUrl = serverBaseUrl;
    }
    if (!jwksCache) jwksCache = new JwksCache(config.userPoolId, config.region, config.clientId);

    // Parse route from API Gateway event
    const method = event.requestContext.http.method;
    const path = event.rawPath;

    // Apply security middleware (origin, payload size) before routing
    const securityResult = validateSecurity(event, config);
    if (securityResult) {
      const structured = securityResult as APIGatewayProxyStructuredResultV2;
      addSecurityHeaders(structured);
      logRequest(event, structured.statusCode ?? 200, Date.now() - startTime);
      return structured;
    }

    // Route to handler
    let response: APIGatewayProxyStructuredResultV2;

    switch (true) {
      case path === "/health" && method === "GET":
        response = {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ok" }),
        };
        break;

      case path === "/.well-known/oauth-authorization-server" && method === "GET":
        response = handleOAuthMetadata(config) as APIGatewayProxyStructuredResultV2;
        break;

      case path === "/authorize" && method === "GET":
        response = (await handleAuthorize(event, config)) as APIGatewayProxyStructuredResultV2;
        break;

      case path === "/callback" && method === "GET":
        response = (await handleCallback(event, config)) as APIGatewayProxyStructuredResultV2;
        break;

      case path === "/token" && method === "POST":
        response = (await handleTokenExchange(event, config)) as APIGatewayProxyStructuredResultV2;
        break;

      case path === "/register" && method === "POST":
        response = handleClientRegistration(event, config) as APIGatewayProxyStructuredResultV2;
        break;

      case path === "/mcp" && method === "POST":
        response = (await handleMcpPost(event, config, jwksCache)) as APIGatewayProxyStructuredResultV2;
        break;

      case path === "/mcp" && method === "DELETE":
        response = (await handleMcpDelete(event, config, jwksCache)) as APIGatewayProxyStructuredResultV2;
        break;

      default:
        response = { statusCode: 404, body: "Not found" };
    }

    // Add security headers to ALL responses
    addSecurityHeaders(response);

    logRequest(event, response.statusCode ?? 200, Date.now() - startTime);
    return response;
  } catch (error) {
    logError(error, event);
    const response: APIGatewayProxyStructuredResultV2 = {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...SECURITY_HEADERS },
      body: JSON.stringify({ error: "Internal server error" }),
    };
    logRequest(event, 500, Date.now() - startTime);
    return response;
  }
}
