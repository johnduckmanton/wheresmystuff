// HTTP client for Backend API

import type { AuthManager } from "./auth-manager.js";

export interface ApiClientOptions {
  baseUrl: string;
  authManager: AuthManager;
  timeout?: number; // Default: 30000ms
  maxRetries?: number; // Default: 2
  retryDelay?: number; // Default: 2000ms
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly authManager: AuthManager;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.authManager = options.authManager;
    this.timeout = options.timeout ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelay = options.retryDelay ?? 2_000;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = this.buildUrl(path, params);
    return this.executeWithRetry<T>(url, { method: "GET" });
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.executeWithRetry<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.executeWithRetry<T>(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async delete<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = this.buildUrl(path, params);
    return this.executeWithRetry<T>(url, { method: "DELETE" });
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private async executeWithRetry<T>(
    url: string,
    init: RequestInit
  ): Promise<T> {
    let lastError: Error | undefined;
    let hasAttempted401Refresh = false;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        await this.delay(this.retryDelay);
      }

      try {
        const token = await this.authManager.getAccessToken();
        const response = await this.fetchWithTimeout(url, {
          ...init,
          headers: {
            ...init.headers,
            Authorization: `Bearer ${token}`,
          },
        });

        // Handle 401 — attempt token refresh once
        if (response.status === 401 && !hasAttempted401Refresh) {
          hasAttempted401Refresh = true;
          try {
            const newToken = await this.authManager.refreshAccessToken();
            const retryResponse = await this.fetchWithTimeout(url, {
              ...init,
              headers: {
                ...init.headers,
                Authorization: `Bearer ${newToken}`,
              },
            });
            return await this.handleResponse<T>(retryResponse);
          } catch {
            throw new ApiClientError(
              "Session expired, please re-authenticate",
              401
            );
          }
        }

        // Handle 401 after refresh already attempted
        if (response.status === 401) {
          throw new ApiClientError(
            "Session expired, please re-authenticate",
            401
          );
        }

        // Handle retryable 5xx errors
        if (response.status >= 500) {
          lastError = new ApiClientError(
            "Server communication problem",
            response.status
          );
          if (attempt < this.maxRetries) {
            continue;
          }
          throw lastError;
        }

        // Handle non-retryable client errors
        return await this.handleResponse<T>(response);
      } catch (error) {
        // Re-throw ApiClientError instances that are non-retryable
        if (error instanceof ApiClientError && !this.isRetryableError(error)) {
          throw error;
        }

        // Retryable network/timeout errors
        if (this.isRetryableNetworkError(error)) {
          lastError =
            error instanceof Error ? error : new Error(String(error));
          if (attempt < this.maxRetries) {
            continue;
          }
          throw new ApiClientError("Server communication problem");
        }

        // Non-retryable errors — throw immediately
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(String(error));
      }
    }

    // Should not reach here, but safety net
    throw lastError ?? new ApiClientError("Server communication problem");
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    // Map specific error status codes
    switch (response.status) {
      case 401:
        throw new ApiClientError(
          "Session expired, please re-authenticate",
          401
        );
      case 403:
        throw new ApiClientError("Access denied to this resource", 403);
      case 404:
        throw new ApiClientError("Resource not found", 404);
      case 429: {
        const retryAfter = response.headers.get("Retry-After");
        const seconds = retryAfter ? parseInt(retryAfter, 10) : 60;
        const retrySeconds = isNaN(seconds) ? 60 : seconds;
        throw new ApiClientError(
          `Rate limited, retry after ${retrySeconds}s`,
          429
        );
      }
      default:
        break;
    }

    if (response.status >= 500) {
      throw new ApiClientError("Server communication problem", response.status);
    }

    if (!response.ok) {
      throw new ApiClientError(
        `Operation failed (status ${response.status})`,
        response.status
      );
    }

    // Unwrap API response envelope
    const json = (await response.json()) as ApiResponse<T>;

    if (!json.success) {
      throw new ApiClientError(json.error ?? "Operation failed");
    }

    return json.data as T;
  }

  private isRetryableError(error: ApiClientError): boolean {
    return error.statusCode !== undefined && error.statusCode >= 500;
  }

  private isRetryableNetworkError(error: unknown): boolean {
    if (error instanceof ApiClientError) {
      return this.isRetryableError(error);
    }

    if (error instanceof TypeError) {
      // fetch throws TypeError for network errors (connection refused, DNS failure)
      return true;
    }

    if (error instanceof Error) {
      // AbortError from timeout
      if (error.name === "AbortError") {
        return true;
      }
      // Connection errors
      const msg = error.message.toLowerCase();
      if (
        msg.includes("econnrefused") ||
        msg.includes("enotfound") ||
        msg.includes("etimedout") ||
        msg.includes("network") ||
        msg.includes("fetch failed")
      ) {
        return true;
      }
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
