// Environment variable loading and validation

export interface ServerConfig {
  apiUrl: string;           // WHERESMYSTUFF_API_URL
  userPoolId: string;       // WHERESMYSTUFF_USER_POOL_ID
  clientId: string;         // WHERESMYSTUFF_CLIENT_ID
  cognitoDomain: string;    // WHERESMYSTUFF_COGNITO_DOMAIN
  inventoryId: string;      // WHERESMYSTUFF_INVENTORY_ID
  region: string;           // WHERESMYSTUFF_REGION
}

const REQUIRED_ENV_VARS = [
  { envVar: "WHERESMYSTUFF_API_URL", configKey: "apiUrl" },
  { envVar: "WHERESMYSTUFF_USER_POOL_ID", configKey: "userPoolId" },
  { envVar: "WHERESMYSTUFF_CLIENT_ID", configKey: "clientId" },
  { envVar: "WHERESMYSTUFF_COGNITO_DOMAIN", configKey: "cognitoDomain" },
  { envVar: "WHERESMYSTUFF_INVENTORY_ID", configKey: "inventoryId" },
  { envVar: "WHERESMYSTUFF_REGION", configKey: "region" },
] as const;

export function loadConfig(): ServerConfig {
  const missing: string[] = [];
  const config: Record<string, string> = {};

  for (const { envVar, configKey } of REQUIRED_ENV_VARS) {
    const value = process.env[envVar];
    if (!value || value.trim() === "") {
      missing.push(envVar);
    } else {
      config[configKey] = value;
    }
  }

  if (missing.length > 0) {
    process.stderr.write(
      `Error: Missing required environment variable(s): ${missing.join(", ")}\n`
    );
    process.exit(1);
  }

  return config as unknown as ServerConfig;
}
