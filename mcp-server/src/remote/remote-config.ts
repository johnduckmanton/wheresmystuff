// Lambda environment variable loading and validation for the remote MCP server

export interface RemoteServerConfig {
  apiUrl: string;                  // WHERESMYSTUFF_API_URL
  userPoolId: string;              // WHERESMYSTUFF_USER_POOL_ID
  clientId: string;                // WHERESMYSTUFF_CLIENT_ID
  region: string;                  // WHERESMYSTUFF_REGION
  allowedOrigins: string[];        // ALLOWED_ORIGINS (comma-separated, optional)
  sessionTimeoutMs: number;        // SESSION_TIMEOUT_MS (default: 1800000 = 30 min)
  maxSessions: number;             // MAX_SESSIONS (default: 1000)
  rateLimitPerMinute: number;      // RATE_LIMIT_PER_MINUTE (default: 100)
  maxPayloadBytes: number;         // MAX_PAYLOAD_BYTES (default: 1048576 = 1MB)
  cognitoDomain: string;           // WHERESMYSTUFF_COGNITO_DOMAIN
  serverBaseUrl: string;           // Derived at runtime from API Gateway event context
  tokenSigningSecret: string;      // TOKEN_SIGNING_SECRET (from Secrets Manager or env)
  sessionsTableName: string;       // SESSIONS_TABLE_NAME (DynamoDB table)
}

export function loadRemoteConfig(serverBaseUrl?: string): RemoteServerConfig {
  const required = [
    'WHERESMYSTUFF_API_URL',
    'WHERESMYSTUFF_USER_POOL_ID',
    'WHERESMYSTUFF_CLIENT_ID',
    'WHERESMYSTUFF_REGION',
    'WHERESMYSTUFF_COGNITO_DOMAIN',
    'TOKEN_SIGNING_SECRET',
    'SESSIONS_TABLE_NAME',
  ] as const;

  const missing = required.filter(
    (name) => !process.env[name] || process.env[name]!.trim() === ''
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  const originsRaw = process.env['ALLOWED_ORIGINS']?.trim() ?? '';
  const allowedOrigins = originsRaw
    ? originsRaw.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  return {
    apiUrl: process.env['WHERESMYSTUFF_API_URL']!,
    userPoolId: process.env['WHERESMYSTUFF_USER_POOL_ID']!,
    clientId: process.env['WHERESMYSTUFF_CLIENT_ID']!,
    region: process.env['WHERESMYSTUFF_REGION']!,
    cognitoDomain: process.env['WHERESMYSTUFF_COGNITO_DOMAIN']!,
    serverBaseUrl: serverBaseUrl ?? process.env['SERVER_BASE_URL'] ?? '',
    tokenSigningSecret: process.env['TOKEN_SIGNING_SECRET']!,
    sessionsTableName: process.env['SESSIONS_TABLE_NAME']!,
    allowedOrigins,
    sessionTimeoutMs: parseIntEnv('SESSION_TIMEOUT_MS', 1800000),
    maxSessions: parseIntEnv('MAX_SESSIONS', 1000),
    rateLimitPerMinute: parseIntEnv('RATE_LIMIT_PER_MINUTE', 100),
    maxPayloadBytes: parseIntEnv('MAX_PAYLOAD_BYTES', 1048576),
  };
}

function parseIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}
