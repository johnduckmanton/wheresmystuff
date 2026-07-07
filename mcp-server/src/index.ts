#!/usr/bin/env node
// Entry point, server initialization

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { AuthManager } from "./auth-manager.js";
import { ApiClient } from "./api-client.js";
import { NameResolver } from "./name-resolver.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  // 1. Load config (exits on failure via loadConfig's own process.exit)
  const config = loadConfig();

  // 2. Initialize AuthManager with config values
  const authManager = new AuthManager({
    clientId: config.clientId,
    cognitoDomain: config.cognitoDomain,
    region: config.region,
  });

  // 3. Get initial access token (triggers browser login if needed)
  process.stderr.write("Authenticating...\n");
  await authManager.getAccessToken();

  // 4. Initialize ApiClient with config.apiUrl and authManager
  const apiClient = new ApiClient({
    baseUrl: config.apiUrl,
    authManager,
  });

  // 5. Initialize NameResolver with apiClient and config.inventoryId
  const nameResolver = new NameResolver(apiClient, config.inventoryId);

  // 6. Create MCP server
  const server = createServer(apiClient, nameResolver, config.inventoryId);

  // 7. Connect stdio transport — only MCP protocol goes to stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write("WheresMyStuff MCP server started\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Fatal: ${message}\n`);
  process.exit(1);
});
