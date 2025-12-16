const fc = require('fast-check');

// Mock DynamoDB client to avoid actual database calls during testing
const mockSend = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend }))
  },
  GetCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'GetCommand' } })),
  PutCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'PutCommand' } })),
  UpdateCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'UpdateCommand' } }))
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn()
}));

// Import after mocking
const { checkRateLimit, recordRequest, getRateLimitStatus } = require('../services/rateLimitService');

describe('Rate Limiting Property Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockSend.mockResolvedValue({ Item: null });
  });

  /**
   * Feature: security-enhancements, Property 16: Request tracking increments counter
   * 
   * Property 16: Request tracking increments counter
   * For any API request made by a user to an endpoint, the request counter for that 
   * user-endpoint-window combination should increment by one.
   * Validates: Requirements 4.1
   */
  test('Property 16: Request tracking increments counter', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random user ID (UUID format)
        fc.uuid(),
        // Generate random endpoint
        fc.constantFrom(
          'GET /things',
          'POST /things', 
          'PUT /things',
          'DELETE /things',
          'GET /locations',
          'POST /locations',
          'GET /photos'
        ),
        // Generate initial counter value (0-99 to stay under limit)
        fc.integer({ min: 0, max: 99 }),
        
        async (userId, endpoint, initialCount) => {
          const now = Math.floor(Date.now() / 1000);
          const windowStart = Math.floor(now / 60) * 60; // 60 second windows
          
          // Track the database calls
          const updateCalls = [];
          const putCalls = [];
          
          mockSend.mockReset();
          mockSend.mockImplementation((command) => {
            if (command.constructor && command.constructor.name === 'UpdateCommand') {
              updateCalls.push(command.input);
              
              if (initialCount > 0) {
                // Simulate successful update for existing item
                return Promise.resolve({});
              } else {
                // Simulate failure for non-existent item (DynamoDB would throw error)
                return Promise.reject(new Error('ValidationException: The provided expression refers to an attribute that does not exist in the item'));
              }
            }
            
            if (command.constructor && command.constructor.name === 'PutCommand') {
              putCalls.push(command.input);
              return Promise.resolve({});
            }
            
            return Promise.resolve({});
          });

          // Act: Record a request
          await recordRequest(userId, endpoint);

          if (initialCount > 0) {
            // Assert: Should use UpdateCommand to increment existing counter
            expect(updateCalls).toHaveLength(1);
            expect(putCalls).toHaveLength(0);
            
            const updateCall = updateCalls[0];
            expect(updateCall.Key.pk).toBe(`RATELIMIT#${userId}#${endpoint}`);
            expect(updateCall.Key.sk).toBe(windowStart.toString());
            expect(updateCall.UpdateExpression).toContain('ADD #count :inc');
            expect(updateCall.ExpressionAttributeValues[':inc']).toBe(1);
          } else {
            // Assert: Should try UpdateCommand first, then use PutCommand to create new counter
            expect(updateCalls).toHaveLength(1);
            expect(putCalls).toHaveLength(1);
            
            const updateCall = updateCalls[0];
            expect(updateCall.Key.pk).toBe(`RATELIMIT#${userId}#${endpoint}`);
            expect(updateCall.Key.sk).toBe(windowStart.toString());
            
            const putCall = putCalls[0];
            expect(putCall.Item.pk).toBe(`RATELIMIT#${userId}#${endpoint}`);
            expect(putCall.Item.sk).toBe(windowStart.toString());
            expect(putCall.Item.count).toBe(1);
            expect(putCall.Item.userId).toBe(userId);
            expect(putCall.Item.endpoint).toBe(endpoint);
            expect(putCall.Item.windowStart).toBe(windowStart);
            expect(putCall.Item.expiresAt).toBe(windowStart + 120);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: security-enhancements, Property 17: Window expiry resets counter
   * 
   * Property 17: Window expiry resets counter
   * For any rate limit counter, after the time window expires, the counter should be 
   * reset to zero for new requests.
   * Validates: Requirements 4.4
   */
  test('Property 17: Window expiry resets counter', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random user ID (UUID format)
        fc.uuid(),
        // Generate random endpoint
        fc.constantFrom(
          'GET /things',
          'POST /things', 
          'PUT /things',
          'DELETE /things',
          'GET /locations',
          'POST /locations',
          'GET /photos'
        ),
        // Generate counter value from previous window (1-100)
        fc.integer({ min: 1, max: 100 }),
        
        async (userId, endpoint, previousCount) => {
          // Simulate time progression - current time is in a new window
          const previousWindowStart = Math.floor(Date.now() / 1000 / 60) * 60 - 60; // Previous minute
          const currentWindowStart = previousWindowStart + 60; // Current minute
          
          // Track the database calls
          const updateCalls = [];
          const putCalls = [];
          
          mockSend.mockReset();
          mockSend.mockImplementation((command) => {
            if (command.constructor && command.constructor.name === 'GetCommand') {
              const key = command.input.Key;
              
              // Check if querying for current window (should not exist)
              if (key.sk === currentWindowStart.toString()) {
                return Promise.resolve({ Item: null });
              }
              
              // Check if querying for previous window (should exist with previousCount)
              if (key.sk === previousWindowStart.toString()) {
                return Promise.resolve({
                  Item: {
                    pk: `RATELIMIT#${userId}#${endpoint}`,
                    sk: previousWindowStart.toString(),
                    count: previousCount,
                    userId: userId,
                    endpoint: endpoint,
                    windowStart: previousWindowStart,
                    expiresAt: previousWindowStart + 120
                  }
                });
              }
              
              return Promise.resolve({ Item: null });
            }
            
            if (command.constructor && command.constructor.name === 'UpdateCommand') {
              updateCalls.push(command.input);
              
              // Check if trying to update current window (should fail - doesn't exist)
              if (command.input.Key.sk === currentWindowStart.toString()) {
                return Promise.reject(new Error('ValidationException: The provided expression refers to an attribute that does not exist in the item'));
              }
              
              return Promise.resolve({});
            }
            
            if (command.constructor && command.constructor.name === 'PutCommand') {
              putCalls.push(command.input);
              return Promise.resolve({});
            }
            
            return Promise.resolve({});
          });

          // Mock Date.now to return time in the current window
          const originalDateNow = Date.now;
          Date.now = jest.fn(() => currentWindowStart * 1000);

          try {
            // Act: Check rate limit for current window
            const rateLimitResult = await checkRateLimit(userId, endpoint);
            
            // Assert: Should show full limit available (counter reset for new window)
            expect(rateLimitResult.allowed).toBe(true);
            expect(rateLimitResult.remaining).toBe(100); // Full limit available
            expect(rateLimitResult.resetTime).toBe(currentWindowStart + 60);

            // Act: Record a request in the new window
            await recordRequest(userId, endpoint);

            // Assert: Should create new counter starting at 1 (not continuing from previous window)
            expect(updateCalls).toHaveLength(1); // Tries update first
            expect(putCalls).toHaveLength(1); // Then creates new item
            
            const putCall = putCalls[0];
            expect(putCall.Item.pk).toBe(`RATELIMIT#${userId}#${endpoint}`);
            expect(putCall.Item.sk).toBe(currentWindowStart.toString());
            expect(putCall.Item.count).toBe(1); // Starts fresh, not previousCount + 1
            expect(putCall.Item.windowStart).toBe(currentWindowStart);
            
          } finally {
            // Restore original Date.now
            Date.now = originalDateNow;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: security-enhancements, Property 18: Rate limit violations are logged
   * 
   * Property 18: Rate limit violations are logged
   * For any user exceeding the rate limit, an audit log entry should be created with 
   * the user identifier, endpoint, and timestamp.
   * Validates: Requirements 4.5
   */
  test('Property 18: Rate limit violations are logged', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random user ID (UUID format)
        fc.uuid(),
        // Generate random endpoint
        fc.constantFrom(
          'GET /things',
          'POST /things', 
          'PUT /things',
          'DELETE /things',
          'GET /locations',
          'POST /locations',
          'GET /photos'
        ),
        // Generate IP address
        fc.ipV4(),
        // Generate user agent
        fc.string({ minLength: 10, maxLength: 100 }),
        
        async (userId, endpoint, ipAddress, userAgent) => {
          const { withRateLimit } = require('../middleware/rateLimit');
          
          // Track the database calls for audit logging
          const auditLogCalls = [];
          
          mockSend.mockReset();
          mockSend.mockImplementation((command) => {
            if (command.constructor && command.constructor.name === 'GetCommand') {
              // Return rate limit counter at maximum (100 requests)
              return Promise.resolve({
                Item: {
                  pk: `RATELIMIT#${userId}#${endpoint}`,
                  sk: Math.floor(Date.now() / 1000 / 60) * 60,
                  count: 100, // At rate limit
                  userId: userId,
                  endpoint: endpoint,
                  windowStart: Math.floor(Date.now() / 1000 / 60) * 60,
                  expiresAt: Math.floor(Date.now() / 1000 / 60) * 60 + 120
                }
              });
            }
            
            if (command.constructor && command.constructor.name === 'PutCommand') {
              // Check if this is an audit log entry
              if (command.input.Item.pk && command.input.Item.pk.startsWith('AUDITLOG#')) {
                auditLogCalls.push(command.input.Item);
              }
              return Promise.resolve({});
            }
            
            return Promise.resolve({});
          });

          // Create a mock handler that will be wrapped with rate limiting
          const mockHandler = jest.fn().mockResolvedValue({
            statusCode: 200,
            body: JSON.stringify({ message: 'success' }),
            headers: {}
          });

          // Create wrapped handler
          const wrappedHandler = withRateLimit(mockHandler);

          // Create mock event
          const mockEvent = {
            requestContext: {
              authorizer: {
                claims: {
                  sub: userId
                }
              },
              http: {
                sourceIp: ipAddress
              }
            },
            httpMethod: endpoint.split(' ')[0],
            resource: endpoint.split(' ')[1],
            headers: {
              'user-agent': userAgent
            }
          };

          // Act: Call the wrapped handler (should trigger rate limit)
          const response = await wrappedHandler(mockEvent, {});

          // Assert: Should return 429 status (rate limited)
          expect(response.statusCode).toBe(429);
          expect(JSON.parse(response.body).error).toBe('Rate limit exceeded');

          // Assert: Should have logged the rate limit violation
          expect(auditLogCalls).toHaveLength(1);
          
          const logEntry = auditLogCalls[0];
          expect(logEntry.eventType).toBe('rate_limit');
          expect(logEntry.userId).toBe(userId);
          expect(logEntry.action).toBe('rate_limit_exceeded');
          expect(logEntry.resource).toBe(endpoint);
          expect(logEntry.success).toBe(false);
          expect(logEntry.ipAddress).toBe(ipAddress);
          expect(logEntry.userAgent).toBe(userAgent);
          expect(logEntry.details.endpoint).toBe(endpoint);
          expect(logEntry.details.userId).toBe(userId);
          expect(logEntry.details.violationType).toBe('rate_limit_exceeded');
          expect(logEntry.timestamp).toBeDefined();
          expect(logEntry.id).toBeDefined();
          
          // Verify the log entry has proper structure for audit trail
          expect(logEntry.pk).toMatch(/^AUDITLOG#\d{4}-\d{2}-\d{2}$/);
          expect(logEntry.sk).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z#[a-f0-9-]{36}$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});