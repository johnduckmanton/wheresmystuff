// Mock services
jest.mock('../services/auditLogService');
jest.mock('../services/dataValidationService');
jest.mock('../services/dynamodb');

const auditLogsHandler = require('../handlers/auditLogs');
const { queryAuditLogs } = require('../services/auditLogService');
const dataValidationService = require('../services/dataValidationService');
const { hasInventoryAccess } = require('../services/dynamodb');

describe('Audit Logs Handler', () => {
  const mockEvent = {
    pathParameters: { inventoryId: 'inv1' },
    requestContext: {
      authorizer: {
        claims: { sub: 'user1' }
      }
    },
    queryStringParameters: null,
    body: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hasInventoryAccess.mockResolvedValue(true);
  });

  describe('getAuditLogs', () => {
    test('should return audit logs successfully', async () => {
      const mockLogs = [
        {
          id: '123',
          timestamp: '2024-01-01T10:00:00.000Z',
          eventType: 'container_operation',
          action: 'create',
          userId: 'user1'
        }
      ];
      
      queryAuditLogs.mockResolvedValue(mockLogs);
      
      const result = await auditLogsHandler.getAuditLogs(mockEvent);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.logs).toEqual(mockLogs);
      expect(body.data.count).toBe(1);
      expect(queryAuditLogs).toHaveBeenCalledWith('inv1', expect.any(Object));
    });

    test('should handle query parameters', async () => {
      const eventWithQuery = {
        ...mockEvent,
        queryStringParameters: {
          eventType: 'container_operation',
          action: 'create',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          limit: '25'
        }
      };
      
      queryAuditLogs.mockResolvedValue([]);
      
      const result = await auditLogsHandler.getAuditLogs(eventWithQuery);
      
      expect(result.statusCode).toBe(200);
      expect(queryAuditLogs).toHaveBeenCalledWith('inv1', {
        eventType: 'container_operation',
        action: 'create',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        limit: 25,
        userId: undefined
      });
    });

    test('should validate date format', async () => {
      const eventWithInvalidDate = {
        ...mockEvent,
        queryStringParameters: {
          startDate: 'invalid-date'
        }
      };
      
      const result = await auditLogsHandler.getAuditLogs(eventWithInvalidDate);
      
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Start date must be in YYYY-MM-DD format');
    });

    test('should validate limit parameter', async () => {
      const eventWithInvalidLimit = {
        ...mockEvent,
        queryStringParameters: {
          limit: '150'
        }
      };
      
      const result = await auditLogsHandler.getAuditLogs(eventWithInvalidLimit);
      
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Limit must be between 1 and 100');
    });

    test('should deny access for unauthorized users', async () => {
      hasInventoryAccess.mockResolvedValue(false);
      
      const result = await auditLogsHandler.getAuditLogs(mockEvent);
      
      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Access denied to inventory');
    });

    test('should handle service errors', async () => {
      queryAuditLogs.mockRejectedValue(new Error('Database error'));
      
      const result = await auditLogsHandler.getAuditLogs(mockEvent);
      
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to retrieve audit logs');
    });
  });

  describe('validateDataConsistency', () => {
    test('should validate data consistency successfully', async () => {
      const mockValidationResult = {
        inventoryId: 'inv1',
        totalInconsistencies: 2,
        inconsistencies: [
          { type: 'orphaned_items', count: 1 },
          { type: 'container_count_mismatch', count: 1 }
        ]
      };
      
      dataValidationService.validateContainerItemConsistency.mockResolvedValue(mockValidationResult);
      
      const result = await auditLogsHandler.validateDataConsistency(mockEvent);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockValidationResult);
      expect(dataValidationService.validateContainerItemConsistency).toHaveBeenCalledWith('inv1', 'user1');
    });

    test('should deny access for unauthorized users', async () => {
      hasInventoryAccess.mockResolvedValue(false);
      
      const result = await auditLogsHandler.validateDataConsistency(mockEvent);
      
      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Access denied to inventory');
    });

    test('should handle validation errors', async () => {
      dataValidationService.validateContainerItemConsistency.mockRejectedValue(new Error('Validation failed'));
      
      const result = await auditLogsHandler.validateDataConsistency(mockEvent);
      
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to validate data consistency');
    });
  });

  describe('correctOrphanedItems', () => {
    test('should correct orphaned items successfully', async () => {
      const eventWithBody = {
        ...mockEvent,
        body: JSON.stringify({
          itemIds: ['item1', 'item2', 'item3']
        })
      };
      
      const mockCorrectionResult = {
        inventoryId: 'inv1',
        correctedItemsCount: 3,
        correctedItems: ['item1', 'item2', 'item3'],
        errors: []
      };
      
      dataValidationService.correctOrphanedItems.mockResolvedValue(mockCorrectionResult);
      
      const result = await auditLogsHandler.correctOrphanedItems(eventWithBody);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockCorrectionResult);
      expect(dataValidationService.correctOrphanedItems).toHaveBeenCalledWith('inv1', ['item1', 'item2', 'item3'], 'user1');
    });

    test('should validate request body', async () => {
      const eventWithInvalidBody = {
        ...mockEvent,
        body: JSON.stringify({
          itemIds: [] // Empty array should fail validation
        })
      };
      
      const result = await auditLogsHandler.correctOrphanedItems(eventWithInvalidBody);
      
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Validation failed');
    });

    test('should handle correction errors', async () => {
      const eventWithBody = {
        ...mockEvent,
        body: JSON.stringify({
          itemIds: ['item1']
        })
      };
      
      dataValidationService.correctOrphanedItems.mockRejectedValue(new Error('Correction failed'));
      
      const result = await auditLogsHandler.correctOrphanedItems(eventWithBody);
      
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to correct orphaned items');
    });
  });

  describe('correctContainerCounts', () => {
    test('should correct container counts successfully', async () => {
      const eventWithBody = {
        ...mockEvent,
        body: JSON.stringify({
          containerIds: ['container1', 'container2']
        })
      };
      
      const mockCorrectionResult = {
        inventoryId: 'inv1',
        correctedContainersCount: 2,
        correctedContainers: [
          { containerId: 'container1', correctedCount: 5 },
          { containerId: 'container2', correctedCount: 3 }
        ],
        errors: []
      };
      
      dataValidationService.correctContainerCounts.mockResolvedValue(mockCorrectionResult);
      
      const result = await auditLogsHandler.correctContainerCounts(eventWithBody);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockCorrectionResult);
      expect(dataValidationService.correctContainerCounts).toHaveBeenCalledWith('inv1', ['container1', 'container2'], 'user1');
    });
  });

  describe('correctLocationInconsistencies', () => {
    test('should correct location inconsistencies successfully', async () => {
      const eventWithBody = {
        ...mockEvent,
        body: JSON.stringify({
          containerIds: ['container1']
        })
      };
      
      const mockCorrectionResult = {
        inventoryId: 'inv1',
        correctedItemsCount: 2,
        correctedItems: [
          { itemId: 'item1', containerId: 'container1', oldLocation: 'loc1', newLocation: 'loc2' }
        ],
        errors: []
      };
      
      dataValidationService.correctLocationInconsistencies.mockResolvedValue(mockCorrectionResult);
      
      const result = await auditLogsHandler.correctLocationInconsistencies(eventWithBody);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockCorrectionResult);
      expect(dataValidationService.correctLocationInconsistencies).toHaveBeenCalledWith('inv1', ['container1'], 'user1');
    });
  });
});