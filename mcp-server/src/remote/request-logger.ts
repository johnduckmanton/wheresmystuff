// Structured JSON logging to stdout (picked up by CloudWatch Logs)
// NEVER logs tokens, request bodies, or other sensitive data

import type { APIGatewayProxyEventV2 } from "aws-lambda";

export interface RequestLogEntry {
  timestamp: string;           // ISO 8601
  level: "info" | "error";
  type: "request";
  method: string;              // HTTP method
  path: string;                // Request path
  sessionId?: string;          // Mcp-Session-Id if present
  statusCode: number;
  durationMs: number;
  requestId?: string;          // Lambda request ID
}

export interface SessionLogEntry {
  timestamp: string;
  level: "info";
  type: "session";
  eventType: "created" | "expired" | "terminated";
  sessionId: string;
  userId: string;
}

export interface ErrorLogEntry {
  timestamp: string;
  level: "error";
  type: "error";
  message: string;
  stack?: string;
  requestId?: string;
  method?: string;
  path?: string;
}

/**
 * Log a completed HTTP request in structured JSON format.
 * Includes timestamp, method, path, session ID, status code, duration, and request ID.
 */
export function logRequest(
  event: APIGatewayProxyEventV2,
  statusCode: number,
  durationMs: number
): void {
  const entry: RequestLogEntry = {
    timestamp: new Date().toISOString(),
    level: "info",
    type: "request",
    method: event.requestContext.http.method,
    path: event.rawPath,
    statusCode,
    durationMs,
    requestId: event.requestContext.requestId,
  };

  const sessionId = event.headers?.["mcp-session-id"];
  if (sessionId) {
    entry.sessionId = sessionId;
  }

  console.log(JSON.stringify(entry));
}

/**
 * Log session lifecycle events (creation, expiry, termination).
 */
export function logSessionEvent(
  eventType: "created" | "expired" | "terminated",
  sessionId: string,
  userId: string
): void {
  const entry: SessionLogEntry = {
    timestamp: new Date().toISOString(),
    level: "info",
    type: "session",
    eventType,
    sessionId,
    userId,
  };

  console.log(JSON.stringify(entry));
}

/**
 * Log an error with stack trace. NEVER logs tokens or request bodies.
 * Sanitizes the event to exclude authorization headers and body.
 */
export function logError(
  error: unknown,
  event?: APIGatewayProxyEventV2
): void {
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: "error",
    type: "error",
    message: error instanceof Error ? error.message : String(error),
  };

  if (error instanceof Error && error.stack) {
    entry.stack = error.stack;
  }

  if (event) {
    entry.requestId = event.requestContext.requestId;
    entry.method = event.requestContext.http.method;
    entry.path = event.rawPath;
  }

  console.log(JSON.stringify(entry));
}
