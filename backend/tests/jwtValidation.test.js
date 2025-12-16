const fc = require('fast-check');
const jwt = require('jsonwebtoken');
const { verifyToken, authenticate } = require('../middleware/auth');
const auditLogService = require('../services/auditLogService');

// Mock dependencies
jest.mock('../services/auditLogService', () => ({
  logAuth: jest.fn().mockResolvedValue()
}));
jest.mock('jwks-rsa');

describe('JWT Validation Property-Based Tests', () => {
  let originalEnv;
  
  beforeAll(() => {
    originalEnv = process.env;
    process.env.AWS_REGION = 'us-east-1';
    process.env.USER_POOL_ID = 'us-east-1_testpool';
    process.env.USER_POOL_CLIENT_ID = 'test-client-id';
  });
  
  afterAll(() => {
    process.env = originalEnv;
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation
    auditLogService.logAuth.mockClear();
    auditLogService.logAuth.mockResolvedValue();
  });

  describe('Property 27: JWT validation checks all claims', () => {
    test('should validate issuer claim', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          sub: fc.string({ minLength: 1 }),
          email: fc.emailAddress(),
          iat: fc.integer({ min: 1000000000, max: 2000000000 }),
          exp: fc.integer({ min: 2000000001, max: 3000000000 }),
          iss: fc.string({ minLength: 1 })
        }),
        async (tokenPayload) => {
          // Create a token with invalid issuer
          const invalidIssuer = `https://invalid-issuer.com/${process.env.USER_POOL_ID}`;
          const tokenWithInvalidIssuer = { ...tokenPayload, iss: invalidIssuer };
          
          // Mock jwt.verify to simulate issuer validation failure
          const originalJwtVerify = jwt.verify;
          jwt.verify = jest.fn((token, getKey, options, callback) => {
            const error = new Error('jwt issuer invalid. expected: https://cognito-idp.us-east-1.amazonaws.com/us-east-1_testpool');
            error.name = 'JsonWebTokenError';
            callback(error);
          });
          
          try {
            await verifyToken('Bearer test-token');
            // Should not reach here
            expect(false).toBe(true);
          } catch (error) {
            expect(error.message).toBe('Invalid token issuer');
          }
          
          jwt.verify = originalJwtVerify;
        }
      ), { numRuns: 100 });
    });

    test('should validate audience claim when client ID is provided', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          sub: fc.string({ minLength: 1 }),
          email: fc.emailAddress(),
          iat: fc.integer({ min: 1000000000, max: 2000000000 }),
          exp: fc.integer({ min: 2000000001, max: 3000000000 }),
          aud: fc.string({ minLength: 1 })
        }),
        async (tokenPayload) => {
          // Mock jwt.verify to simulate audience validation failure
          const originalJwtVerify = jwt.verify;
          jwt.verify = jest.fn((token, getKey, options, callback) => {
            const error = new Error('jwt audience invalid. expected: test-client-id');
            error.name = 'JsonWebTokenError';
            callback(error);
          });
          
          try {
            await verifyToken('Bearer test-token');
            // Should not reach here
            expect(false).toBe(true);
          } catch (error) {
            expect(error.message).toBe('Invalid token audience');
          }
          
          jwt.verify = originalJwtVerify;
        }
      ), { numRuns: 100 });
    });

    test('should validate expiration claim', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          sub: fc.string({ minLength: 1 }),
          email: fc.emailAddress(),
          iat: fc.integer({ min: 1000000000, max: 1500000000 }),
          exp: fc.integer({ min: 1000000000, max: 1500000000 }) // Expired token
        }),
        async (tokenPayload) => {
          // Mock jwt.verify to simulate expiration validation failure
          const originalJwtVerify = jwt.verify;
          jwt.verify = jest.fn((token, getKey, options, callback) => {
            const error = new Error('jwt expired');
            error.name = 'TokenExpiredError';
            callback(error);
          });
          
          try {
            await verifyToken('Bearer test-token');
            // Should not reach here
            expect(false).toBe(true);
          } catch (error) {
            expect(error.message).toBe('Token expired');
          }
          
          jwt.verify = originalJwtVerify;
        }
      ), { numRuns: 100 });
    });

    test('should validate required claims are present', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          iat: fc.integer({ min: 1000000000, max: 2000000000 }),
          exp: fc.integer({ min: 2000000001, max: 3000000000 })
          // Missing 'sub' claim
        }),
        async (tokenPayload) => {
          // Mock jwt.verify to return decoded token without required claims
          const originalJwtVerify = jwt.verify;
          jwt.verify = jest.fn((token, getKey, options, callback) => {
            callback(null, tokenPayload);
          });
          
          try {
            await verifyToken('Bearer test-token');
            // Should not reach here
            expect(false).toBe(true);
          } catch (error) {
            expect(error.message).toBe('Missing subject claim');
          }
          
          jwt.verify = originalJwtVerify;
        }
      ), { numRuns: 100 });
    });

    test('should validate token type when present', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          sub: fc.string({ minLength: 1 }),
          email: fc.emailAddress(),
          iat: fc.integer({ min: 1000000000, max: 2000000000 }),
          exp: fc.integer({ min: 2000000001, max: 3000000000 }),
          token_use: fc.constantFrom('refresh', 'invalid_type')
        }),
        async (tokenPayload) => {
          // Mock jwt.verify to return decoded token with invalid token type
          const originalJwtVerify = jwt.verify;
          jwt.verify = jest.fn((token, getKey, options, callback) => {
            callback(null, tokenPayload);
          });
          
          try {
            await verifyToken('Bearer test-token');
            // Should not reach here if token_use is invalid
            if (tokenPayload.token_use !== 'access' && tokenPayload.token_use !== 'id') {
              expect(false).toBe(true);
            }
          } catch (error) {
            if (tokenPayload.token_use !== 'access' && tokenPayload.token_use !== 'id') {
              expect(error.message).toBe('Invalid token type');
            }
          }
          
          jwt.verify = originalJwtVerify;
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 28: JWT validation failures are logged', () => {
    test('should log missing token failures correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async ({ ipAddress, userAgent }) => {
          const event = {
            headers: {},
            requestContext: {
              identity: { sourceIp: ipAddress }
            }
          };
          event.headers['User-Agent'] = userAgent;
          
          try {
            await authenticate(event);
            expect(false).toBe(true); // Should not reach here
          } catch (error) {
            expect(error.statusCode).toBe(401);
            expect(error.message).toBe('Unauthorized');
            
            // Verify audit logging was called with failure details
            expect(auditLogService.logAuth).toHaveBeenCalledWith(
              'unknown',
              false,
              ipAddress,
              userAgent,
              expect.objectContaining({
                failureReason: 'missing_token',
                errorMessage: 'No authorization header'
              })
            );
          }
        }
      ), { numRuns: 100 });
    });

    test('should log token expired failures correctly', async () => {
      const originalJwtVerify = jwt.verify;
      
      try {
        await fc.assert(fc.asyncProperty(
          fc.record({
            ipAddress: fc.ipV4(),
            userAgent: fc.string({ minLength: 1, maxLength: 100 })
          }),
          async ({ ipAddress, userAgent }) => {
            const event = {
              headers: {
                Authorization: 'Bearer expired-token'
              },
              requestContext: {
                identity: { sourceIp: ipAddress }
              }
            };
            event.headers['User-Agent'] = userAgent;
            
            jwt.verify = jest.fn((token, getKey, options, callback) => {
              const error = new Error('jwt expired');
              error.name = 'TokenExpiredError';
              callback(error);
            });
            
            try {
              await authenticate(event);
              expect(false).toBe(true); // Should not reach here
            } catch (error) {
              expect(error.statusCode).toBe(401);
              expect(error.message).toBe('Unauthorized');
              
              // Verify audit logging was called with failure details
              expect(auditLogService.logAuth).toHaveBeenCalledWith(
                'unknown',
                false,
                ipAddress,
                userAgent,
                expect.objectContaining({
                  failureReason: 'token_expired',
                  errorMessage: 'Token expired'
                })
              );
            }
          }
        ), { numRuns: 100 });
      } finally {
        jwt.verify = originalJwtVerify;
      }
    });

    test('should log missing claims failures correctly', async () => {
      const originalJwtVerify = jwt.verify;
      
      try {
        await fc.assert(fc.asyncProperty(
          fc.record({
            ipAddress: fc.ipV4(),
            userAgent: fc.string({ minLength: 1, maxLength: 100 })
          }),
          async ({ ipAddress, userAgent }) => {
            const event = {
              headers: {
                Authorization: 'Bearer missing-claims-token'
              },
              requestContext: {
                identity: { sourceIp: ipAddress }
              }
            };
            event.headers['User-Agent'] = userAgent;
            
            jwt.verify = jest.fn((token, getKey, options, callback) => {
              callback(null, { email: 'test@example.com' }); // Missing sub claim
            });
            
            try {
              await authenticate(event);
              expect(false).toBe(true); // Should not reach here
            } catch (error) {
              expect(error.statusCode).toBe(401);
              expect(error.message).toBe('Unauthorized');
              
              // Verify audit logging was called with failure details
              expect(auditLogService.logAuth).toHaveBeenCalledWith(
                'unknown',
                false,
                ipAddress,
                userAgent,
                expect.objectContaining({
                  failureReason: 'missing_claims',
                  errorMessage: 'Missing subject claim'
                })
              );
            }
          }
        ), { numRuns: 100 });
      } finally {
        jwt.verify = originalJwtVerify;
      }
    });

    test('should log successful authentication without failure details', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1 }),
          email: fc.emailAddress(),
          username: fc.string({ minLength: 1 }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 1, maxLength: 100 })
        }),
        async ({ userId, email, username, ipAddress, userAgent }) => {
          const event = {
            headers: {
              Authorization: 'Bearer valid-token'
            },
            requestContext: {
              identity: { sourceIp: ipAddress }
            }
          };
          event.headers['User-Agent'] = userAgent;
          
          // Mock successful JWT verification
          jwt.verify = jest.fn((token, getKey, options, callback) => {
            callback(null, {
              sub: userId,
              email: email,
              'cognito:username': username,
              iat: Math.floor(Date.now() / 1000) - 3600,
              exp: Math.floor(Date.now() / 1000) + 3600,
              token_use: 'access'
            });
          });
          
          const result = await authenticate(event);
          
          expect(result.user).toEqual({
            userId,
            email,
            username
          });
          
          // Verify successful authentication was logged
          expect(auditLogService.logAuth).toHaveBeenCalledWith(
            userId,
            true,
            ipAddress,
            userAgent
          );
          
          // Verify no additional failure details were passed
          const logCall = auditLogService.logAuth.mock.calls[0];
          expect(logCall).toHaveLength(4); // No 5th parameter for success cases
        }
      ), { numRuns: 100 });
    });
  });
});