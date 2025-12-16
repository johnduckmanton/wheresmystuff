const fc = require('fast-check');
const { 
  isOriginAllowed, 
  validateCorsForStateChangingRequest, 
  withCorsValidation 
} = require('../middleware/corsValidation');

// Mock dependencies
jest.mock('../services/auditLogService');

describe('CORS Validation Property Tests', () => {
  let mockAuditLogService;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock audit log service
    mockAuditLogService = require('../services/auditLogService');
    mockAuditLogService.logAuthzFailure = jest.fn().mockResolvedValue();
    
    // Set up environment variables for testing
    process.env.ALLOWED_ORIGINS = 'https://example.com,https://app.example.com';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.CLOUDFRONT_DOMAIN;
    delete process.env.NODE_ENV;
  });

  /**
   * Feature: security-enhancements, Property 29: Origin validation for state-changing requests
   * Validates: Requirements 9.1, 9.3
   */
  test('Property 29: Origin validation for state-changing requests', async () => {
    const property = fc.asyncProperty(
      // Generate test data for CORS validation
      fc.record({
        method: fc.oneof(
          fc.constant('POST'),
          fc.constant('PUT'), 
          fc.constant('DELETE'),
          fc.constant('PATCH')
        ),
        origin: fc.oneof(
          // Valid origins
          fc.constant('https://example.com'),
          fc.constant('https://app.example.com'),
          // Invalid origins
          fc.constant('https://malicious.com'),
          fc.constant('http://example.com'), // Wrong protocol
          fc.constant('https://evil.example.com'), // Subdomain attack
          fc.webUrl() // Random URLs
        ),
        hasAuth: fc.boolean(),
        userId: fc.string({ minLength: 1 })
      }),
      async ({ method, origin, hasAuth, userId }) => {
        // Create mock event
        const event = {
          requestContext: {
            http: {
              method: method,
              path: '/test'
            }
          },
          headers: {
            Origin: origin,
            ...(hasAuth ? { Authorization: 'Bearer test-token' } : {})
          },
          user: hasAuth ? { userId } : undefined
        };

        try {
          await validateCorsForStateChangingRequest(event);
          
          // If validation succeeds, the origin must be allowed for credentialed requests
          if (hasAuth) {
            const allowedOrigins = ['https://example.com', 'https://app.example.com'];
            expect(allowedOrigins.includes(origin)).toBe(true);
          }
          
          return true;
        } catch (error) {
          // If validation fails, it should be due to CORS policy violation
          if (hasAuth) {
            expect(error.corsError).toBe(true);
            expect(error.statusCode).toBe(403);
            expect(error.message).toContain('CORS policy violation');
            
            // Should log the authorization failure
            expect(mockAuditLogService.logAuthzFailure).toHaveBeenCalledWith(
              userId,
              'cors_validation',
              expect.stringContaining(method),
              expect.stringContaining(origin)
            );
          }
          
          return true;
        }
      }
    );

    await fc.assert(property, { numRuns: 100 });
  });

  test('Property: Origin validation rejects wildcard patterns', () => {
    const property = fc.property(
      fc.oneof(
        fc.constant('*'),
        fc.constant('*.example.com'),
        fc.constant('https://*.com'),
        fc.string().filter(s => s.includes('*'))
      ),
      (origin) => {
        // Wildcard origins should never be allowed
        expect(isOriginAllowed(origin)).toBe(false);
      }
    );

    fc.assert(property, { numRuns: 50 });
  });

  test('Property: Valid origins are consistently allowed', () => {
    const property = fc.property(
      fc.oneof(
        fc.constant('https://example.com'),
        fc.constant('https://app.example.com')
      ),
      (origin) => {
        // Valid origins should always be allowed
        expect(isOriginAllowed(origin)).toBe(true);
      }
    );

    fc.assert(property, { numRuns: 50 });
  });

  test('Property: CORS middleware preserves handler response structure', async () => {
    const property = fc.asyncProperty(
      fc.record({
        statusCode: fc.integer({ min: 200, max: 599 }),
        data: fc.anything(),
        origin: fc.constant('https://example.com') // Use valid origin
      }),
      async ({ statusCode, data, origin }) => {
        // Mock handler that returns a response
        const mockHandler = jest.fn().mockResolvedValue({
          statusCode,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data })
        });

        // Create mock event with valid origin
        const event = {
          requestContext: { http: { method: 'GET' } },
          headers: { Origin: origin }
        };

        const wrappedHandler = withCorsValidation(mockHandler);
        const response = await wrappedHandler(event, {});

        // Response should maintain original structure
        expect(response.statusCode).toBe(statusCode);
        expect(response.body).toBe(JSON.stringify({ data }));
        
        // Should add CORS headers
        expect(response.headers['Access-Control-Allow-Origin']).toBe(origin);
        expect(response.headers['Access-Control-Allow-Credentials']).toBe('true');
        
        // Original handler should be called
        expect(mockHandler).toHaveBeenCalledWith(event, {});
      }
    );

    await fc.assert(property, { numRuns: 50 });
  });

  test('Property: Preflight requests return appropriate CORS headers', () => {
    const property = fc.property(
      fc.record({
        origin: fc.oneof(
          fc.constant('https://example.com'),
          fc.constant('https://app.example.com'),
          fc.constant('https://malicious.com')
        ),
        requestedMethod: fc.oneof(
          fc.constant('GET'),
          fc.constant('POST'),
          fc.constant('PUT'),
          fc.constant('DELETE'),
          fc.constant('INVALID_METHOD')
        )
      }),
      ({ origin, requestedMethod }) => {
        const { handlePreflightRequest } = require('../middleware/corsValidation');
        
        const event = {
          headers: {
            Origin: origin,
            'Access-Control-Request-Method': requestedMethod
          }
        };

        const response = handlePreflightRequest(event);
        
        const allowedOrigins = ['https://example.com', 'https://app.example.com'];
        const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
        
        if (allowedOrigins.includes(origin) && allowedMethods.includes(requestedMethod)) {
          // Should return successful preflight response
          expect(response.statusCode).toBe(200);
          expect(response.headers['Access-Control-Allow-Origin']).toBe(origin);
        } else {
          // Should return CORS error
          expect(response.statusCode).toBe(403);
          expect(JSON.parse(response.body).error).toContain('CORS policy violation');
        }
      }
    );

    fc.assert(property, { numRuns: 100 });
  });

  test('Property: Non-state-changing requests bypass CORS validation', async () => {
    const property = fc.asyncProperty(
      fc.record({
        method: fc.oneof(
          fc.constant('GET'),
          fc.constant('HEAD'),
          fc.constant('OPTIONS')
        ),
        origin: fc.webUrl(), // Any origin
        hasAuth: fc.boolean(),
        userId: fc.string({ minLength: 1 })
      }),
      async ({ method, origin, hasAuth, userId }) => {
        const event = {
          requestContext: {
            http: {
              method: method,
              path: '/test'
            }
          },
          headers: {
            Origin: origin,
            ...(hasAuth ? { Authorization: 'Bearer test-token' } : {})
          },
          user: hasAuth ? { userId } : undefined
        };

        // Non-state-changing requests should not throw CORS errors
        const result = await validateCorsForStateChangingRequest(event);
        expect(result).toBe(event);
        
        // Should not log any authorization failures for CORS
        expect(mockAuditLogService.logAuthzFailure).not.toHaveBeenCalled();
      }
    );

    await fc.assert(property, { numRuns: 50 });
  });
});

describe('CORS Configuration Tests', () => {
  test('Environment variable configuration works correctly', () => {
    const { getAllowedOrigins } = require('../middleware/corsValidation');
    
    // Test with ALLOWED_ORIGINS environment variable
    process.env.ALLOWED_ORIGINS = 'https://test1.com,https://test2.com';
    expect(getAllowedOrigins()).toEqual(['https://test1.com', 'https://test2.com']);
    
    delete process.env.ALLOWED_ORIGINS;
    
    // Test with CLOUDFRONT_DOMAIN fallback
    process.env.CLOUDFRONT_DOMAIN = 'abc123.cloudfront.net';
    expect(getAllowedOrigins()).toEqual(['https://abc123.cloudfront.net']);
    
    delete process.env.CLOUDFRONT_DOMAIN;
    
    // Test development fallback
    process.env.NODE_ENV = 'development';
    expect(getAllowedOrigins()).toEqual(['http://localhost:3000', 'http://localhost:5173']);
    
    delete process.env.NODE_ENV;
    
    // Test empty array for production without configuration
    expect(getAllowedOrigins()).toEqual([]);
  });
});