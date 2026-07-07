// OAuth flow, token refresh, Keychain storage

import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import keytar from "keytar";

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp when access token expires
}

export interface AuthManagerOptions {
  clientId: string;
  cognitoDomain: string; // Full domain, e.g., wheresmystuff.auth.eu-west-1.amazoncognito.com
  region: string;
  loginTimeoutMs?: number; // Default: 120000 (2 minutes)
}

const KEYCHAIN_ACCOUNT = "refresh-token";

export class BrowserLoginRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserLoginRequiredError";
  }
}

export class AuthManager {
  private readonly clientId: string;
  private readonly cognitoDomain: string;
  private readonly region: string;
  private readonly loginTimeoutMs: number;
  private readonly serviceName: string;
  private currentTokens: AuthTokens | null = null;

  constructor(options: AuthManagerOptions) {
    this.clientId = options.clientId;
    this.cognitoDomain = options.cognitoDomain;
    this.region = options.region;
    this.loginTimeoutMs = options.loginTimeoutMs ?? 120000;
    this.serviceName = `wheresmystuff-mcp-${this.clientId}`;
  }

  // --- Keychain operations ---

  private async getStoredRefreshToken(): Promise<string | null> {
    const token = await keytar.getPassword(this.serviceName, KEYCHAIN_ACCOUNT);
    return token;
  }

  private async storeRefreshToken(token: string): Promise<void> {
    await keytar.setPassword(this.serviceName, KEYCHAIN_ACCOUNT, token);
  }

  private async deleteStoredRefreshToken(): Promise<void> {
    await keytar.deletePassword(this.serviceName, KEYCHAIN_ACCOUNT);
  }

  // --- Main entry points ---

  /**
   * Main entry point — resolves to a valid access token.
   * Tries: 1) cached in-memory token, 2) refresh via Keychain token, 3) browser login
   */
  async getAccessToken(): Promise<string> {
    // 1. Return cached token if still valid (with 60s buffer before expiry)
    if (this.currentTokens && Date.now() < this.currentTokens.expiresAt - 60_000) {
      return this.currentTokens.accessToken;
    }

    // 2. Try refresh via stored Keychain refresh token
    const storedRefreshToken = await this.getStoredRefreshToken();
    if (storedRefreshToken) {
      try {
        const tokens = await this.exchangeRefreshToken(storedRefreshToken);
        this.currentTokens = tokens;
        return tokens.accessToken;
      } catch (err) {
        if (!(err instanceof BrowserLoginRequiredError)) {
          throw err;
        }
        // Fall through to browser login
      }
    }

    // 3. Fall back to browser login
    const tokens = await this.performBrowserLogin();
    this.currentTokens = tokens;
    return tokens.accessToken;
  }

  /**
   * Force a refresh (called by ApiClient on 401 response).
   * Tries refresh token first, falls back to browser login.
   */
  async refreshAccessToken(): Promise<string> {
    // 1. Try to get the stored refresh token from Keychain
    const storedRefreshToken = await this.getStoredRefreshToken();

    if (storedRefreshToken) {
      try {
        // 2. Attempt token refresh
        const tokens = await this.exchangeRefreshToken(storedRefreshToken);
        this.currentTokens = tokens;
        return tokens.accessToken;
      } catch (err) {
        if (!(err instanceof BrowserLoginRequiredError)) {
          throw err;
        }
        // Fall through to browser login
      }
    }

    // 3. No stored token or refresh failed — browser login required
    const tokens = await this.performBrowserLogin();
    this.currentTokens = tokens;
    return tokens.accessToken;
  }

  private async performBrowserLogin(): Promise<AuthTokens> {
    const state = randomBytes(32).toString("hex");

    return new Promise<AuthTokens>((resolve, reject) => {
      const server = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          const url = new URL(req.url ?? "/", `http://localhost`);

          if (url.pathname !== "/callback") {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
            return;
          }

          const returnedState = url.searchParams.get("state");
          const code = url.searchParams.get("code");

          if (returnedState !== state) {
            process.stderr.write(
              "Security warning: OAuth state parameter mismatch. Possible CSRF attack.\n"
            );
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(
              "<html><body><h1>Authentication Error</h1><p>State parameter mismatch. This may indicate a security issue. Please try again.</p></body></html>"
            );
            cleanup();
            reject(new Error("OAuth state parameter mismatch"));
            return;
          }

          if (!code) {
            const error = url.searchParams.get("error") ?? "unknown_error";
            const errorDescription =
              url.searchParams.get("error_description") ?? "No authorization code received";
            process.stderr.write(
              `OAuth error: ${error} - ${errorDescription}\n`
            );
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(
              `<html><body><h1>Authentication Error</h1><p>${errorDescription}</p></body></html>`
            );
            cleanup();
            reject(new Error(`OAuth error: ${error} - ${errorDescription}`));
            return;
          }

          const address = server.address();
          const port =
            typeof address === "object" && address !== null
              ? address.port
              : 0;
          const redirectUri = `http://localhost:${port}/callback`;

          try {
            const tokens = await this.exchangeAuthorizationCode(
              code,
              redirectUri
            );
            await this.storeRefreshToken(tokens.refreshToken);

            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(
              "<html><body><h1>Authentication Successful</h1><p>You can close this window and return to your terminal.</p></body></html>"
            );
            cleanup();
            resolve(tokens);
          } catch (err) {
            process.stderr.write(
              `Token exchange failed: ${err instanceof Error ? err.message : String(err)}\n`
            );
            res.writeHead(500, { "Content-Type": "text/html" });
            res.end(
              "<html><body><h1>Authentication Error</h1><p>Failed to exchange authorization code for tokens.</p></body></html>"
            );
            cleanup();
            reject(err);
          }
        }
      );

      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = undefined;
        }
        server.close();
      };

      server.listen(0, "127.0.0.1", async () => {
        const address = server.address();
        const port =
          typeof address === "object" && address !== null
            ? address.port
            : 0;
        const redirectUri = `http://localhost:${port}/callback`;

        const authorizeUrl =
          `https://${this.cognitoDomain}/oauth2/authorize` +
          `?response_type=code` +
          `&client_id=${encodeURIComponent(this.clientId)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent("openid email profile")}` +
          `&state=${state}`;

        try {
          const { default: open } = await import("open");
          await open(authorizeUrl);
        } catch (err) {
          process.stderr.write(
            `Failed to open browser: ${err instanceof Error ? err.message : String(err)}\n`
          );
          process.stderr.write(
            `Please open the following URL manually:\n${authorizeUrl}\n`
          );
        }

        // Set up login timeout
        timeoutHandle = setTimeout(() => {
          process.stderr.write(
            `Login timeout: No response received within ${this.loginTimeoutMs / 1000} seconds.\n`
          );
          cleanup();
          reject(new Error("Login timeout"));
          process.exit(1);
        }, this.loginTimeoutMs);
      });
    });
  }

  private async exchangeRefreshToken(
    refreshToken: string
  ): Promise<AuthTokens> {
    const tokenUrl = `https://${this.cognitoDomain}/oauth2/token`;

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      refresh_token: refreshToken,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorCode =
        (errorBody as Record<string, unknown>).error ?? "unknown_error";

      if (errorCode === "invalid_grant") {
        await this.deleteStoredRefreshToken();
        throw new BrowserLoginRequiredError(
          "Refresh token is invalid or expired. Browser login required."
        );
      }

      throw new Error(
        `Token refresh failed with status ${response.status}: ${errorCode}`
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      id_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: refreshToken, // Cognito does not return a new refresh token on refresh
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }

  private async exchangeAuthorizationCode(
    code: string,
    redirectUri: string
  ): Promise<AuthTokens> {
    const tokenUrl = `https://${this.cognitoDomain}/oauth2/token`;

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.clientId,
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Token exchange failed with status ${response.status}: ${errorBody}`
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      id_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }
}
