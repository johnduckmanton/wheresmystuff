/**
 * Bug Condition Exploration Tests - Frontend Production Debug Logging
 * 
 * These tests verify the EXPECTED behavior (no console.log in production).
 * On UNFIXED code, they will FAIL because console.log IS called unconditionally.
 * Failure confirms the bug exists.
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock aws-amplify/auth before importing the module
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      accessToken: {
        toString: () => 'mock-access-token-eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test'
      },
      idToken: {
        toString: () => 'mock-id-token-eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test'
      }
    }
  }),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

// Mock axios
vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { success: true, data: { uploadUrl: 'https://s3.example.com/upload', key: 'photos/test.jpg' } } }),
    put: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    defaults: { baseURL: 'https://api.example.com' },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

describe('Bug Condition Exploration: Production Debug Logging Suppressed', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let requestInterceptor: any;
  let axiosMock: any;

  beforeEach(async () => {
    // Reset modules to get fresh imports
    vi.resetModules();

    // Mock isDevelopmentMode as false (production mode)
    vi.doMock('../config/development', () => ({
      isDevelopmentMode: false,
      logDevelopmentInfo: vi.fn(),
    }));

    // Re-mock axios for fresh instance
    const mockAxiosInstance = {
      get: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
      post: vi.fn().mockResolvedValue({ 
        data: { success: true, data: { uploadUrl: 'https://s3.example.com/upload', key: 'photos/test.jpg' } } 
      }),
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

    // Spy on console.log
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Import the module fresh
    await import('../services/api');
    axiosMock = (await import('axios')).default;

    // Get the ApiClient class - the module exports a singleton, 
    // but since isDevelopmentMode is false, it should create an ApiClient
    // We need to capture the request interceptor that was registered
    const createMock = axiosMock.create;
    if (createMock.mock && createMock.mock.results.length > 0) {
      const instance = createMock.mock.results[0].value;
      if (instance.interceptors.request.use.mock.calls.length > 0) {
        requestInterceptor = instance.interceptors.request.use.mock.calls[0][0];
      }
    }
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.resetModules();
  });

  it('Property 1.1: Request interceptor should NOT call console.log in production mode', async () => {
    /**
     * **Validates: Requirements 2.1**
     * 
     * Bug Condition: When isDevelopmentMode is false (production), the request
     * interceptor should NOT log auth tokens, session objects, or debug info.
     * 
     * On UNFIXED code: This test FAILS because console.log IS called unconditionally.
     */
    if (!requestInterceptor) {
      // If we couldn't capture the interceptor, skip gracefully
      expect.fail('Could not capture request interceptor - module may not have loaded correctly');
      return;
    }

    // Trigger the request interceptor with a mock config
    const mockConfig = {
      url: '/things',
      method: 'get',
      baseURL: 'https://api.example.com',
      headers: {},
    };

    consoleSpy.mockClear();
    await requestInterceptor(mockConfig);

    // In production mode, console.log should NOT be called with debug data
    const logCalls = consoleSpy.mock.calls;
    const debugLogCalls = logCalls.filter(call => {
      const msg = String(call[0] || '');
      return msg.includes('Request Interceptor Debug') ||
             msg.includes('Auth Session') ||
             msg.includes('Token preview') ||
             msg.includes('Token available') ||
             msg.includes('Token length') ||
             msg.includes('Session tokens') ||
             msg.includes('Access Token object') ||
             msg.includes('ID Token object') ||
             msg.includes('Final headers') ||
             msg.includes('Authorization header set') ||
             msg.includes('Using access token') ||
             msg.includes('Using ID token');
    });

    expect(debugLogCalls).toHaveLength(0);
  });

  it('Property 1.2: post() method should NOT call console.log in production mode', async () => {
    /**
     * **Validates: Requirements 2.2**
     * 
     * Bug Condition: When isDevelopmentMode is false (production), the post()
     * method should NOT log request URL, data, response status, headers, or data.
     * 
     * On UNFIXED code: This test FAILS because console.log IS called unconditionally.
     */
    // We need to test the post method directly
    // Re-import to get the actual client behavior
    vi.resetModules();
    
    vi.doMock('../config/development', () => ({
      isDevelopmentMode: false,
      logDevelopmentInfo: vi.fn(),
    }));

    // Create a more complete axios mock that captures post behavior
    const mockPost = vi.fn().mockResolvedValue({ 
      data: { success: true, data: { id: 'test-123' } },
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

    // Call a method that uses post() internally
    try {
      await apiClient.createThing({
        id: 'test-1',
        name: 'Test Item',
        inventoryId: 'inv-1',
        tags: [],
        photos: [],
      } as any);
    } catch {
      // Ignore errors - we're testing logging behavior
    }

    // In production mode, console.log should NOT be called with POST debug data
    const logCalls = consoleSpy.mock.calls;
    const postDebugCalls = logCalls.filter(call => {
      const msg = String(call[0] || '');
      return msg.includes('API Client POST Debug') ||
             msg.includes('HTTP POST successful') ||
             (msg.includes('- URL:') && !msg.includes('Error')) ||
             (msg.includes('- Data:') && !msg.includes('Error')) ||
             (msg.includes('- Status:') && !msg.includes('Error')) ||
             (msg.includes('- Headers:') && !msg.includes('Error'));
    });

    expect(postDebugCalls).toHaveLength(0);
  });

  it('Property 1.3: generateUploadUrl() should NOT call console.log in production mode', async () => {
    /**
     * **Validates: Requirements 2.3**
     * 
     * Bug Condition: When isDevelopmentMode is false (production), generateUploadUrl()
     * should NOT log parameter values or request data.
     * 
     * On UNFIXED code: This test FAILS because console.log IS called unconditionally.
     */
    vi.resetModules();
    
    vi.doMock('../config/development', () => ({
      isDevelopmentMode: false,
      logDevelopmentInfo: vi.fn(),
    }));

    const mockAxiosInstance = {
      get: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
      post: vi.fn().mockResolvedValue({ 
        data: { success: true, data: { uploadUrl: 'https://s3.example.com/upload', key: 'photos/test.jpg' } } 
      }),
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

    try {
      await apiClient.generateUploadUrl('photo.jpg', 'image/jpeg', 'inv-123', 'entity-456');
    } catch {
      // Ignore errors
    }

    const logCalls = consoleSpy.mock.calls;
    const uploadDebugCalls = logCalls.filter(call => {
      const msg = String(call[0] || '');
      return msg.includes('generateUploadUrl Debug') ||
             msg.includes('- fileName:') ||
             msg.includes('- contentType:') ||
             msg.includes('- inventoryId:') ||
             msg.includes('- entityId:') ||
             msg.includes('Making POST request to /upload');
    });

    expect(uploadDebugCalls).toHaveLength(0);
  });

  it('Property 1.4: generateDocumentUploadUrl() should NOT call console.log in production mode', async () => {
    /**
     * **Validates: Requirements 2.3**
     * 
     * Bug Condition: When isDevelopmentMode is false (production), generateDocumentUploadUrl()
     * should NOT log parameter values or request data.
     * 
     * On UNFIXED code: This test FAILS because console.log IS called unconditionally.
     */
    vi.resetModules();
    
    vi.doMock('../config/development', () => ({
      isDevelopmentMode: false,
      logDevelopmentInfo: vi.fn(),
    }));

    const mockAxiosInstance = {
      get: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
      post: vi.fn().mockResolvedValue({ 
        data: { success: true, data: { uploadUrl: 'https://s3.example.com/upload', key: 'docs/receipt.pdf' } } 
      }),
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

    try {
      await apiClient.generateDocumentUploadUrl('receipt.pdf', 'application/pdf', 'inv-123', 'entity-456', 'receipt');
    } catch {
      // Ignore errors
    }

    const logCalls = consoleSpy.mock.calls;
    const docDebugCalls = logCalls.filter(call => {
      const msg = String(call[0] || '');
      return msg.includes('generateDocumentUploadUrl Debug') ||
             msg.includes('- fileName:') ||
             msg.includes('- contentType:') ||
             msg.includes('- documentType:') ||
             msg.includes('Making POST request to /document/upload');
    });

    expect(docDebugCalls).toHaveLength(0);
  });

  it('Property 1.5: generateQRCode() should NOT call console.log in production mode', async () => {
    /**
     * **Validates: Requirements 2.4**
     * 
     * Bug Condition: When isDevelopmentMode is false (production), generateQRCode()
     * should NOT log container IDs, inventory IDs, or API config.
     * 
     * On UNFIXED code: This test FAILS because console.log IS called unconditionally.
     */
    vi.resetModules();
    
    vi.doMock('../config/development', () => ({
      isDevelopmentMode: false,
      logDevelopmentInfo: vi.fn(),
    }));

    const mockAxiosInstance = {
      get: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
      post: vi.fn().mockResolvedValue({ 
        data: { success: true, data: { qrCodeId: 'qr-1', s3Key: 'qr/test.png', downloadUrl: 'https://example.com/qr.png' } } 
      }),
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

    try {
      await apiClient.generateQRCode('container-123', 'inv-456', 'medium');
    } catch {
      // Ignore errors
    }

    const logCalls = consoleSpy.mock.calls;
    const qrDebugCalls = logCalls.filter(call => {
      const msg = String(call[0] || '');
      return msg.includes('generateQRCode Debug') ||
             msg.includes('- Container ID:') ||
             msg.includes('- Inventory ID:') ||
             msg.includes('- Size:') ||
             msg.includes('- Base URL:') ||
             msg.includes('QR Code API call successful');
    });

    expect(qrDebugCalls).toHaveLength(0);
  });

  it('Property 1.6: uploadPhoto() should NOT call console.log in production mode', async () => {
    /**
     * **Validates: Requirements 2.4**
     * 
     * Bug Condition: When isDevelopmentMode is false (production), uploadPhoto()
     * should NOT log file metadata, IDs, or API configuration.
     * 
     * On UNFIXED code: This test FAILS because console.log IS called unconditionally.
     */
    vi.resetModules();
    
    vi.doMock('../config/development', () => ({
      isDevelopmentMode: false,
      logDevelopmentInfo: vi.fn(),
    }));

    const mockAxiosInstance = {
      get: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
      post: vi.fn().mockResolvedValue({ 
        data: { success: true, data: { uploadUrl: 'https://s3.example.com/upload', key: 'photos/test.jpg' } } 
      }),
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

    // Mock global fetch for the S3 upload
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    consoleSpy.mockClear();
    
    const { default: apiClient } = await import('../services/api');

    const mockFile = new File(['test content'], 'photo.jpg', { type: 'image/jpeg' });

    try {
      await apiClient.uploadPhoto(mockFile, 'inv-123', 'entity-456');
    } catch {
      // Ignore errors
    }

    const logCalls = consoleSpy.mock.calls;
    const photoDebugCalls = logCalls.filter(call => {
      const msg = String(call[0] || '');
      return msg.includes('uploadPhoto Debug') ||
             msg.includes('- file:') ||
             msg.includes('- inventoryId:') ||
             msg.includes('- entityId:') ||
             msg.includes('- inventoryId type:') ||
             msg.includes('- entityId type:') ||
             msg.includes('- inventoryId truthy:') ||
             msg.includes('- entityId truthy:');
    });

    expect(photoDebugCalls).toHaveLength(0);
  });
});
