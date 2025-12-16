const fc = require('fast-check');
const { getSecurityHeaders, addSecurityHeaders, withSecurityHeaders } = require('../middleware/securityHeaders');
const { success, error } = require('../utils/response');

describe('Security Headers Property Tests', () => {
  /**
   * Feature: security-enhancements, Property 23: All responses include security headers
   * 
   * Property 23: All responses include security headers
   * For any HTTP response, the response should include all required security headers: 
   * Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, 
   * Strict-Transport-Security, and X-XSS-Protection with correct values.
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
   */
  test('Property 23: All responses include security headers', async () => {
    await fc.assert(
      fc.property(
        // Generate various response scenarios
        fc.oneof(
          // Success responses with different data types
          fc.record({
            type: fc.constant('success'),
            data: fc.oneof(
              fc.string(),
              fc.integer(),
              fc.object(),
              fc.array(fc.string()),
              fc.constant(null),
              fc.constant(undefined)
            ),
            statusCode: fc.oneof(fc.constant(200), fc.constant(201), fc.constant(204))
          }),
          
          // Error responses with different status codes and messages
          fc.record({
            type: fc.constant('error'),
            message: fc.string({ minLength: 1, maxLength: 200 }),
            statusCode: fc.oneof(
              fc.constant(400), fc.constant(401), fc.constant(403), 
              fc.constant(404), fc.constant(429), fc.constant(500)
            )
          }),
          
          // Custom response objects
          fc.record({
            type: fc.constant('custom'),
            statusCode: fc.integer({ min: 200, max: 599 }),
            headers: fc.option(fc.dictionary(fc.string(), fc.string()), { nil: {} }),
            body: fc.string()
          })
        ),
        
        (responseSpec) => {
          let response;
          
          // Generate response based on type
          if (responseSpec.type === 'success') {
            response = success(responseSpec.data, responseSpec.statusCode);
          } else if (responseSpec.type === 'error') {
            response = error(responseSpec.message, responseSpec.statusCode);
          } else {
            // Custom response
            response = {
              statusCode: responseSpec.statusCode,
              headers: responseSpec.headers || {},
              body: responseSpec.body
            };
          }
          
          // Act: Add security headers (this should happen automatically via response utils,
          // but we test the addSecurityHeaders function directly as well)
          const responseWithHeaders = addSecurityHeaders(response);
          
          // Assert: Response should have all required security headers
          expect(responseWithHeaders).toBeDefined();
          expect(responseWithHeaders.headers).toBeDefined();
          
          // Assert: Content-Security-Policy header (Requirement 6.1)
          expect(responseWithHeaders.headers['Content-Security-Policy']).toBeDefined();
          expect(responseWithHeaders.headers['Content-Security-Policy']).toContain("default-src 'self'");
          expect(responseWithHeaders.headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
          
          // Assert: X-Content-Type-Options header (Requirement 6.2)
          expect(responseWithHeaders.headers['X-Content-Type-Options']).toBe('nosniff');
          
          // Assert: X-Frame-Options header (Requirement 6.3)
          expect(responseWithHeaders.headers['X-Frame-Options']).toBe('DENY');
          
          // Assert: Strict-Transport-Security header (Requirement 6.4)
          expect(responseWithHeaders.headers['Strict-Transport-Security']).toBeDefined();
          expect(responseWithHeaders.headers['Strict-Transport-Security']).toContain('max-age=31536000');
          expect(responseWithHeaders.headers['Strict-Transport-Security']).toContain('includeSubDomains');
          expect(responseWithHeaders.headers['Strict-Transport-Security']).toContain('preload');
          
          // Assert: X-XSS-Protection header (Requirement 6.5)
          expect(responseWithHeaders.headers['X-XSS-Protection']).toBe('1; mode=block');
          
          // Assert: Original response properties should be preserved
          expect(responseWithHeaders.statusCode).toBe(response.statusCode);
          expect(responseWithHeaders.body).toBe(response.body);
          
          // Assert: Original headers should be preserved (if any)
          if (response.headers) {
            Object.keys(response.headers).forEach(key => {
              if (!key.startsWith('Content-Security-Policy') && 
                  !key.startsWith('X-Content-Type-Options') &&
                  !key.startsWith('X-Frame-Options') &&
                  !key.startsWith('Strict-Transport-Security') &&
                  !key.startsWith('X-XSS-Protection')) {
                expect(responseWithHeaders.headers[key]).toBe(response.headers[key]);
              }
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Test that security headers are automatically included in success/error responses
  test('Success and error responses automatically include security headers', async () => {
    await fc.assert(
      fc.property(
        fc.oneof(
          // Success response data
          fc.record({
            type: fc.constant('success'),
            data: fc.oneof(fc.string(), fc.object(), fc.array(fc.string())),
            statusCode: fc.option(fc.integer({ min: 200, max: 299 }), { nil: 200 })
          }),
          
          // Error response data
          fc.record({
            type: fc.constant('error'),
            message: fc.string({ minLength: 1, maxLength: 100 }),
            statusCode: fc.option(fc.integer({ min: 400, max: 599 }), { nil: 400 })
          })
        ),
        
        (responseData) => {
          let response;
          
          // Generate response using utility functions
          if (responseData.type === 'success') {
            response = success(responseData.data, responseData.statusCode);
          } else {
            response = error(responseData.message, responseData.statusCode);
          }
          
          // Assert: All security headers should be present automatically
          expect(response.headers['Content-Security-Policy']).toBeDefined();
          expect(response.headers['X-Content-Type-Options']).toBe('nosniff');
          expect(response.headers['X-Frame-Options']).toBe('DENY');
          expect(response.headers['Strict-Transport-Security']).toContain('max-age=31536000');
          expect(response.headers['X-XSS-Protection']).toBe('1; mode=block');
          
          // Assert: Content-Type should be set by the handler
          expect(response.headers['Content-Type']).toBe('application/json');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Test the withSecurityHeaders middleware wrapper
  test('withSecurityHeaders middleware adds headers to handler responses', async () => {
    // Test a few specific cases manually first
    const testCases = [
      { statusCode: 200, body: '', headers: {} },
      { statusCode: 404, body: 'Not found', headers: { 'Custom-Header': 'value' } },
      { statusCode: 500, body: JSON.stringify({ error: 'Server error' }), headers: {} }
    ];
    
    for (const testCase of testCases) {
      const mockHandler = async (event, context) => {
        return {
          statusCode: testCase.statusCode,
          body: testCase.body,
          headers: testCase.headers || {}
        };
      };
      
      const wrappedHandler = withSecurityHeaders(mockHandler);
      const result = await wrappedHandler({}, {});
      
      // Assert: All security headers should be present
      expect(result.headers['Content-Security-Policy']).toBeDefined();
      expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(result.headers['X-Frame-Options']).toBe('DENY');
      expect(result.headers['Strict-Transport-Security']).toContain('max-age=31536000');
      expect(result.headers['X-XSS-Protection']).toBe('1; mode=block');
      
      // Assert: Original response properties should be preserved
      expect(result.statusCode).toBe(testCase.statusCode);
      expect(result.body).toBe(testCase.body);
      
      // Assert: Original headers should be preserved
      if (testCase.headers) {
        Object.keys(testCase.headers).forEach(key => {
          expect(result.headers[key]).toBe(testCase.headers[key]);
        });
      }
    }
  });

  // Test that getSecurityHeaders returns consistent headers
  test('getSecurityHeaders returns consistent security headers', () => {
    const headers1 = getSecurityHeaders();
    const headers2 = getSecurityHeaders();
    
    // Assert: Headers should be consistent across calls
    expect(headers1).toEqual(headers2);
    
    // Assert: All required headers should be present
    expect(headers1['Content-Security-Policy']).toBeDefined();
    expect(headers1['X-Content-Type-Options']).toBe('nosniff');
    expect(headers1['X-Frame-Options']).toBe('DENY');
    expect(headers1['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(headers1['X-XSS-Protection']).toBe('1; mode=block');
    
    // Assert: Headers should be strings
    Object.values(headers1).forEach(value => {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });
  });

  // Test edge cases
  test('addSecurityHeaders handles edge cases', () => {
    // Test with null response
    expect(addSecurityHeaders(null)).toBeNull();
    
    // Test with undefined response
    expect(addSecurityHeaders(undefined)).toBeUndefined();
    
    // Test with response without headers
    const responseWithoutHeaders = { statusCode: 200, body: 'test' };
    const result = addSecurityHeaders(responseWithoutHeaders);
    expect(result.headers).toBeDefined();
    expect(result.headers['Content-Security-Policy']).toBeDefined();
    
    // Test with response with existing headers
    const responseWithHeaders = {
      statusCode: 200,
      body: 'test',
      headers: { 'Custom-Header': 'custom-value' }
    };
    const result2 = addSecurityHeaders(responseWithHeaders);
    expect(result2.headers['Custom-Header']).toBe('custom-value');
    expect(result2.headers['Content-Security-Policy']).toBeDefined();
  });
});