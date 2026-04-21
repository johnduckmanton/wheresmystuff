/**
 * Preservation Property Tests - Development Logging, Error Handling Unchanged
 * 
 * These tests capture the CURRENT behavior of the unfixed code to ensure
 * the fix does not introduce regressions. They MUST PASS on unfixed code.
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

describe('Preservation Property 4: Development Logging Unchanged', () => {
  /**
   * **Validates: Requirements 3.1, 3.5**
   * 
   * When isDevelopmentMode is true, the request interceptor calls console.log
   * with debug info. On unfixed code, console.log is called unconditionally.
   * This test verifies the logging code exists and works (must be preserved after fix).
   */

  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('request interceptor calls console.log with debug data for all HTTP methods (property test, 10 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('get', 'post', 'put', 'delete'),
        async (method) => {
          vi.resetModules();

          // Use a mutable object so we can change isDevelopmentMode after module load
          const devConfig = {
            isDevelopmentMode: false,
            logDevelopmentInfo: vi.fn(),
          };

          vi.doMock('../config/development', () => devConfig);

          vi.doMock('aws-amplify/auth', () => ({
            fetchAuthSession: vi.fn().mockResolvedValue({
              tokens: {
                accessToken: { toString: () => 'mock-access-token-test' },
                idToken: { toString: () => 'mock-id-token-test' },
              }
            }),
            signOut: vi.fn().mockResolvedValue(undefined),
          }));

          let requestInterceptor: any;

          const mockAxiosInstance = {
            get: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
            post: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
            put: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
            delete: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
            defaults: { baseURL: 'https://api.example.com' },
            interceptors: {
              request: {
                use: vi.fn((successHandler: any) => {
                  requestInterceptor = successHandler;
                })
              },
              response: { use: vi.fn() },
            },
          };

          vi.doMock('axios', () => ({
            default: {
              create: vi.fn(() => mockAxiosInstance),
            },
          }));

          consoleSpy.mockClear();

          await import('../services/api');

          // The interceptor should have been registered
          expect(requestInterceptor).toBeDefined();

          // Now switch to development mode before triggering the interceptor
          // This simulates the preservation requirement: when isDevelopmentMode is true,
          // debug logging should still work after the fix
          devConfig.isDevelopmentMode = true;

          // Trigger the interceptor with a mock config
          const mockConfig = {
            url: '/things',
            method: method,
            baseURL: 'https://api.example.com',
            headers: {},
          };

          await requestInterceptor(mockConfig);

          // After the fix, when isDevelopmentMode is true, console.log IS called.
          // This verifies the logging code exists and produces output in dev mode.
          const logCalls = consoleSpy.mock.calls;
          const debugLogCalls = logCalls.filter(call => {
            const msg = String(call[0] || '');
            return msg.includes('Request Interceptor Debug') ||
                   msg.includes('Auth Session') ||
                   msg.includes('Token') ||
                   msg.includes('Authorization header set') ||
                   msg.includes('Final headers');
          });

          // Preservation: debug logging code exists and produces output
          expect(debugLogCalls.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('post() method calls console.log with debug data (property test, 10 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          id: fc.string({ minLength: 1, maxLength: 36 }),
        }),
        async (payload) => {
          vi.resetModules();

          // Use a mutable object so we can change isDevelopmentMode after module load
          const devConfig = {
            isDevelopmentMode: false,
            logDevelopmentInfo: vi.fn(),
          };

          vi.doMock('../config/development', () => devConfig);

          vi.doMock('aws-amplify/auth', () => ({
            fetchAuthSession: vi.fn().mockResolvedValue({
              tokens: {
                accessToken: { toString: () => 'mock-token' },
              }
            }),
            signOut: vi.fn().mockResolvedValue(undefined),
          }));

          const mockPost = vi.fn().mockResolvedValue({
            data: { success: true, data: { id: payload.id, name: payload.name } },
            status: 200,
            headers: { 'content-type': 'application/json' }
          });

          const mockAxiosInstance = {
            get: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
            post: mockPost,
            put: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
            delete: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
            defaults: { baseURL: 'https://api.example.com' },
            interceptors: {
              request: { use: vi.fn() },
              response: { use: vi.fn() },
            },
          };

          vi.doMock('axios', () => ({
            default: {
              create: vi.fn(() => mockAxiosInstance),
            },
          }));

          consoleSpy.mockClear();

          const { default: apiClient } = await import('../services/api');

          // Now switch to development mode before calling post()
          // This simulates the preservation requirement: when isDevelopmentMode is true,
          // post() debug logging should still work after the fix
          devConfig.isDevelopmentMode = true;

          try {
            await (apiClient as any).createThing({
              id: payload.id,
              name: payload.name,
              inventoryId: 'inv-1',
              tags: [],
              photos: [],
              dateAdded: new Date().toISOString(),
            });
          } catch {
            // Ignore errors - we're testing logging behavior
          }

          // After the fix, when isDevelopmentMode is true, post() calls console.log
          const logCalls = consoleSpy.mock.calls;
          const postDebugCalls = logCalls.filter(call => {
            const msg = String(call[0] || '');
            return msg.includes('API Client POST Debug') ||
                   msg.includes('HTTP POST successful');
          });

          // Preservation: post() debug logging code exists and produces output
          expect(postDebugCalls.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Preservation Property 5: Error Logging and Auth Flow Unchanged', () => {
  /**
   * **Validates: Requirements 3.2, 3.3**
   * 
   * When a request fails with a network error, console.error is called regardless of environment.
   * When a 401 response is received, the interceptor logs the auth failure, calls signOut(),
   * and triggers authErrorCallback.
   */

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('console.error is called for network errors regardless of environment (property test, 10 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('Network Error', 'ECONNREFUSED', 'timeout', 'ENOTFOUND'),
        async (errorMessage) => {
          vi.resetModules();

          vi.doMock('../config/development', () => ({
            isDevelopmentMode: false,
            logDevelopmentInfo: vi.fn(),
          }));

          vi.doMock('aws-amplify/auth', () => ({
            fetchAuthSession: vi.fn().mockResolvedValue({
              tokens: { accessToken: { toString: () => 'token' } }
            }),
            signOut: vi.fn().mockResolvedValue(undefined),
          }));

          let responseInterceptorError: any;

          const mockAxiosInstance = {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            defaults: { baseURL: 'https://api.example.com' },
            interceptors: {
              request: { use: vi.fn() },
              response: {
                use: vi.fn((_successHandler: any, errorHandler: any) => {
                  responseInterceptorError = errorHandler;
                })
              },
            },
          };

          vi.doMock('axios', () => ({
            default: {
              create: vi.fn(() => mockAxiosInstance),
            },
          }));

          consoleErrorSpy.mockClear();

          await import('../services/api');

          expect(responseInterceptorError).toBeDefined();

          // Simulate a network error (no response, has request)
          const networkError = {
            request: { url: '/test' },
            response: undefined,
            message: errorMessage,
          };

          try {
            await responseInterceptorError(networkError);
          } catch {
            // Expected to reject
          }

          // console.error should be called for network errors in ALL environments
          expect(consoleErrorSpy).toHaveBeenCalled();
          const errorCalls = consoleErrorSpy.mock.calls.flat().map(String);
          const hasNetworkError = errorCalls.some(msg =>
            msg.includes('Network Error') || msg.includes('No response received')
          );
          expect(hasNetworkError).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('401 response triggers signOut and logs auth failure (property test, 10 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(401),
        async (status) => {
          vi.resetModules();

          const mockSignOut = vi.fn().mockResolvedValue(undefined);

          vi.doMock('../config/development', () => ({
            isDevelopmentMode: false,
            logDevelopmentInfo: vi.fn(),
          }));

          vi.doMock('aws-amplify/auth', () => ({
            fetchAuthSession: vi.fn().mockResolvedValue({
              tokens: { accessToken: { toString: () => 'token' } }
            }),
            signOut: mockSignOut,
          }));

          let responseInterceptorError: any;

          const mockAxiosInstance = {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            defaults: { baseURL: 'https://api.example.com' },
            interceptors: {
              request: { use: vi.fn() },
              response: {
                use: vi.fn((_successHandler: any, errorHandler: any) => {
                  responseInterceptorError = errorHandler;
                })
              },
            },
          };

          vi.doMock('axios', () => ({
            default: {
              create: vi.fn(() => mockAxiosInstance),
            },
          }));

          consoleErrorSpy.mockClear();

          const apiModule = await import('../services/api');
          const apiClient = apiModule.default;

          // Set up auth error callback
          const authCallback = vi.fn();
          if (apiClient && typeof (apiClient as any).setAuthErrorCallback === 'function') {
            (apiClient as any).setAuthErrorCallback(authCallback);
          }

          expect(responseInterceptorError).toBeDefined();

          // Simulate a 401 response
          const error401 = {
            response: {
              status: status,
              data: { error: 'Unauthorized', message: 'Session expired' },
            },
            request: { url: '/test' },
            message: 'Request failed with status code 401',
          };

          try {
            await responseInterceptorError(error401);
          } catch {
            // Expected to reject
          }

          // console.error should be called for 401
          expect(consoleErrorSpy).toHaveBeenCalled();
          const errorCalls = consoleErrorSpy.mock.calls.flat().map(String);
          const hasAuthError = errorCalls.some(msg =>
            msg.includes('Authentication failed') || msg.includes('API Error')
          );
          expect(hasAuthError).toBe(true);

          // signOut should be called for 401
          expect(mockSignOut).toHaveBeenCalled();

          // authErrorCallback should be triggered
          expect(authCallback).toHaveBeenCalled();
        }
      ),
      { numRuns: 10 }
    );
  });
});
