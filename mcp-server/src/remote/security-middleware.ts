// Origin validation, rate limiting, and payload size enforcement

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { RemoteServerConfig } from "./remote-config.js";
import type { SessionRecord } from "./session-store.js";

/**
 * Validates origin header and payload size for an incoming request.
 * Returns null if all checks pass, or an error response (403/413).
 */
export function validateSecurity(
  event: APIGatewayProxyEventV2,
  config: RemoteServerConfig
): APIGatewayProxyResultV2 | null {
  // Origin validation: if allowedOrigins is non-empty, verify Origin header is in list
  if (config.allowedOrigins.length > 0) {
    const origin = event.headers?.origin;
    if (origin && !config.allowedOrigins.includes(origin)) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "text/plain" },
        body: "Forbidden: origin not allowed",
      };
    }
  }

  // Payload size: if body length exceeds maxPayloadBytes, return 413
  if (event.body) {
    const bodyLength = Buffer.byteLength(event.body, "utf8");
    if (bodyLength > config.maxPayloadBytes) {
      return {
        statusCode: 413,
        headers: { "Content-Type": "text/plain" },
        body: "Payload too large",
      };
    }
  }

  return null;
}

/**
 * Checks whether a request is within the rate limit using a sliding window.
 * Returns true if the request is allowed, false if rate limited.
 */
export function checkRateLimit(
  session: SessionRecord,
  maxPerMinute: number
): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;

  // Filter timestamps to only those within the last 60 seconds
  const recentTimestamps = (session.requestTimestamps ?? []).filter(
    (ts) => ts > windowStart
  );

  // If count of recent requests >= max, rate limited
  return recentTimestamps.length < maxPerMinute;
}
