// Mock DynamoDB before requiring the service
const mockDocClient = {
  send: jest.fn()
};

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn()
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDocClient)
  },
  GetCommand: jest.fn(),
  QueryCommand: jest.fn(),
  PutCommand: jest.fn(),
  TransactWriteCommand: jest.fn()
}));

// Mock dependencies
jest.mock('../services/dynamodb', () => ({
  hasInventoryAccess: jest.fn()
}));

jest.mock('../services/auditLogService', () => ({
  logSyncOperation: jest.fn(),
  logDataAccess: jest.fn()
}));

const dataSynchronizationService = require('../services/dataSynchronizationService');
const { hasInventoryAccess } = require('../services/dynamodb');
const { logSyncOperation, logDataAccess } = require('../services/auditLogService');

describe('DataSynchronizationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectConcurrentUpdateConflict', () => {
    it('should return null when no conflict exists', async () => {
      // Mock DynamoDB response
      mockDocClient.send.mockResolvedValue({
        Item: {
          updatedAt: '2023-01-01T00:00:00.000Z'
        }
      });

      const result = await dataSynchronizationService.detectConcurrentUpdateConflict(
        'item',
        'test-item-id',
        'test-inventory-id',
        '2023-01-01T00:00:00.000Z'
      );

      expect(result).toBeNull();
    });

    it('should return conflict when versions differ', async () => {
      // Mock DynamoDB response
      mockDocClient.send.mockResolvedValue({
        Item: {
          updatedAt: '2023-01-02T00:00:00.000Z'
        }
      });

      const result = await dataSynchronizationService.detectConcurrentUpdateConflict(
        'item',
        'test-item-id',
        'test-inventory-id',
        '2023-01-01T00:00:00.000Z'
      );

      expect(result).toEqual({
        type: 'concurrent_update',
        entityType: 'item',
        entityId: 'test-item-id',
        expectedVersion: '2023-01-01T00:00:00.000Z',
        currentVersion: '2023-01-02T00:00:00.000Z',
        message: 'item test-item-id was modified by another user'
      });
    });

    it('should return entity not found when item does not exist', async () => {
      // Mock DynamoDB response
      mockDocClient.send.mockResolvedValue({});

      const result = await dataSynchronizationService.detectConcurrentUpdateConflict(
        'item',
        'test-item-id',
        'test-inventory-id',
        '2023-01-01T00:00:00.000Z'
      );

      expect(result).toEqual({
        type: 'entity_not_found',
        entityType: 'item',
        entityId: 'test-item-id',
        message: 'item test-item-id not found'
      });
    });

    it('should throw error for unsupported entity type', async () => {
      await expect(
        dataSynchronizationService.detectConcurrentUpdateConflict(
          'unsupported',
          'test-id',
          'test-inventory-id',
          '2023-01-01T00:00:00.000Z'
        )
      ).rejects.toThrow('Unsupported entity type: unsupported');
    });
  });

  describe('validateDataConsistency', () => {
    it('should require inventory access', async () => {
      hasInventoryAccess.mockResolvedValue(false);

      await expect(
        dataSynchronizationService.validateDataConsistency('test-inventory-id', 'test-user-id')
      ).rejects.toThrow('Access denied to inventory');

      expect(hasInventoryAccess).toHaveBeenCalledWith('test-user-id', 'test-inventory-id');
    });

    it('should validate data consistency successfully', async () => {
      hasInventoryAccess.mockResolvedValue(true);

      // Mock DynamoDB responses
      mockDocClient.send
        .mockResolvedValueOnce({ Items: [] }) // containers query
        .mockResolvedValueOnce({ Items: [] }); // items query

      const result = await dataSynchronizationService.validateDataConsistency(
        'test-inventory-id',
        'test-user-id'
      );

      expect(result).toEqual({
        isConsistent: true,
        inconsistencies: [],
        summary: {
          totalItems: 0,
          totalContainers: 0,
          inconsistencyCount: 0,
          highSeverity: 0,
          mediumSeverity: 0,
          lowSeverity: 0
        }
      });

      expect(logDataAccess).toHaveBeenCalledWith(
        'test-user-id',
        'validate',
        'data_consistency',
        'test-inventory-id',
        'test-inventory-id'
      );
    });
  });
});