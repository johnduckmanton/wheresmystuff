const fc = require('fast-check');

// Mock DynamoDB client to avoid actual database calls during testing
const mockSend = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend }))
  },
  PutCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'PutCommand' } }))
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn()
}));

const auditLogService = require('../services/auditLogService');

describe('Audit Logging Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  describe('Property-Based Tests', () => {
    // **Feature: security-enhancements, Property 19: Authentication attempts are logged**
    // **Validates: Requirements 5.1**
    test('Property 19: Authentication attempts are logged', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.boolean(), // success
        fc.string({ minLength: 1, maxLength: 50 }), // ipAddress
        fc.string({ minLength: 1, maxLength: 100 }), // userAgent
        async (userId, success, ipAddress, userAgent) => {
          // Clear previous calls
          mockSend.mockClear();
          
          // Call the logAuth function
          await auditLogService.logAuth(userId, success, ipAddress, userAgent);
          
          // Verify that DynamoDB was called
          expect(mockSend).toHaveBeenCalledTimes(1);
          
          // Get the call arguments
          const call = mockSend.mock.calls[0][0];
          expect(call.constructor.name).toBe('PutCommand');
          
          // Verify the log entry structure
          const logEntry = call.input.Item;
          expect(logEntry.eventType).toBe('auth');
          expect(logEntry.userId).toBe(userId);
          expect(logEntry.success).toBe(success);
          expect(logEntry.ipAddress).toBe(ipAddress);
          expect(logEntry.userAgent).toBe(userAgent);
          expect(logEntry.action).toBe(success ? 'login_success' : 'login_failure');
          expect(logEntry.resource).toBe('authentication');
          expect(logEntry.timestamp).toBeDefined();
          expect(logEntry.id).toBeDefined();
          expect(logEntry.pk).toMatch(/^AUDITLOG#\d{4}-\d{2}-\d{2}$/);
          expect(logEntry.sk).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z#/);
          expect(logEntry.hmac).toBeDefined();
          expect(typeof logEntry.hmac).toBe('string');
          expect(logEntry.hmac.length).toBe(64); // SHA256 hex string length
        }
      ), { numRuns: 100 });
    });

    // **Feature: security-enhancements, Property 20: Write operations are logged**
    // **Validates: Requirements 5.2**
    test('Property 20: Write operations are logged', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.constantFrom('create', 'update', 'delete'), // action
        fc.constantFrom('things', 'locations', 'rooms', 'categories', 'people'), // entityType
        fc.string({ minLength: 1, maxLength: 50 }), // entityId
        fc.string({ minLength: 1, maxLength: 50 }), // inventoryId
        async (userId, action, entityType, entityId, inventoryId) => {
          // Clear previous calls
          mockSend.mockClear();
          
          // Call the logDataAccess function
          await auditLogService.logDataAccess(userId, action, entityType, entityId, inventoryId);
          
          // Verify that DynamoDB was called
          expect(mockSend).toHaveBeenCalledTimes(1);
          
          // Get the call arguments
          const call = mockSend.mock.calls[0][0];
          expect(call.constructor.name).toBe('PutCommand');
          
          // Verify the log entry structure
          const logEntry = call.input.Item;
          expect(logEntry.eventType).toBe('data_access');
          expect(logEntry.userId).toBe(userId);
          expect(logEntry.action).toBe(action);
          expect(logEntry.resource).toBe(`${entityType}#${entityId}`);
          expect(logEntry.success).toBe(true);
          expect(logEntry.details.entityType).toBe(entityType);
          expect(logEntry.details.entityId).toBe(entityId);
          expect(logEntry.details.inventoryId).toBe(inventoryId);
          expect(logEntry.details.action).toBe(action);
          expect(logEntry.timestamp).toBeDefined();
          expect(logEntry.id).toBeDefined();
          expect(logEntry.pk).toMatch(/^AUDITLOG#\d{4}-\d{2}-\d{2}$/);
          expect(logEntry.sk).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z#/);
          expect(logEntry.hmac).toBeDefined();
          expect(typeof logEntry.hmac).toBe('string');
          expect(logEntry.hmac.length).toBe(64); // SHA256 hex string length
        }
      ), { numRuns: 100 });
    });

    // **Feature: security-enhancements, Property 21: Authorization failures are logged**
    // **Validates: Requirements 5.3**
    test('Property 21: Authorization failures are logged', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.constantFrom('access_inventory', 'create', 'update', 'delete', 'read'), // action
        fc.string({ minLength: 1, maxLength: 100 }), // resource
        fc.string({ minLength: 1, maxLength: 200 }), // reason
        async (userId, action, resource, reason) => {
          // Clear previous calls
          mockSend.mockClear();
          
          // Call the logAuthzFailure function
          await auditLogService.logAuthzFailure(userId, action, resource, reason);
          
          // Verify that DynamoDB was called
          expect(mockSend).toHaveBeenCalledTimes(1);
          
          // Get the call arguments
          const call = mockSend.mock.calls[0][0];
          expect(call.constructor.name).toBe('PutCommand');
          
          // Verify the log entry structure
          const logEntry = call.input.Item;
          expect(logEntry.eventType).toBe('authz_failure');
          expect(logEntry.userId).toBe(userId);
          expect(logEntry.action).toBe(action);
          expect(logEntry.resource).toBe(resource);
          expect(logEntry.success).toBe(false);
          expect(logEntry.details.reason).toBe(reason);
          expect(logEntry.details.attemptedAction).toBe(action);
          expect(logEntry.details.targetResource).toBe(resource);
          expect(logEntry.timestamp).toBeDefined();
          expect(logEntry.id).toBeDefined();
          expect(logEntry.pk).toMatch(/^AUDITLOG#\d{4}-\d{2}-\d{2}$/);
          expect(logEntry.sk).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z#/);
          expect(logEntry.hmac).toBeDefined();
          expect(typeof logEntry.hmac).toBe('string');
          expect(logEntry.hmac.length).toBe(64); // SHA256 hex string length
        }
      ), { numRuns: 100 });
    });

    // **Feature: security-enhancements, Property 22: Audit logs have integrity protection**
    // **Validates: Requirements 5.5**
    test('Property 22: Audit logs have integrity protection', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.boolean(), // success
        fc.string({ minLength: 1, maxLength: 50 }), // ipAddress
        fc.string({ minLength: 1, maxLength: 100 }), // userAgent
        async (userId, success, ipAddress, userAgent) => {
          // Clear previous calls
          mockSend.mockClear();
          
          // Call the logAuth function to create a log entry
          await auditLogService.logAuth(userId, success, ipAddress, userAgent);
          
          // Get the created log entry
          const call = mockSend.mock.calls[0][0];
          const logEntry = call.input.Item;
          
          // Verify HMAC exists
          expect(logEntry.hmac).toBeDefined();
          expect(typeof logEntry.hmac).toBe('string');
          expect(logEntry.hmac.length).toBe(64); // SHA256 hex string length
          
          // Verify HMAC can be validated
          const isValid = auditLogService.verifyHMAC(logEntry);
          expect(isValid).toBe(true);
          
          // Verify that tampering with the log entry invalidates the HMAC
          const tamperedEntry = { ...logEntry };
          tamperedEntry.userId = 'tampered-user-id';
          
          const isTamperedValid = auditLogService.verifyHMAC(tamperedEntry);
          expect(isTamperedValid).toBe(false);
        }
      ), { numRuns: 100 });
    });
  });
});