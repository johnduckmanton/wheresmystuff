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
  QueryCommand: jest.fn(),
  PutCommand: jest.fn(),
  TransactWriteCommand: jest.fn(),
  BatchWriteCommand: jest.fn()
}));

// Mock dependencies
jest.mock('../services/dynamodb', () => ({
  hasInventoryAccess: jest.fn()
}));

jest.mock('../services/auditLogService', () => ({
  logMigrationOperation: jest.fn(),
  logDataAccess: jest.fn()
}));

jest.mock('../services/containerService', () => ({
  createContainer: jest.fn(),
  getContainer: jest.fn()
}));

const dataMigrationService = require('../services/dataMigrationService');
const { hasInventoryAccess } = require('../services/dynamodb');
const { logMigrationOperation } = require('../services/auditLogService');
const containerService = require('../services/containerService');

describe('DataMigrationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('migrateInventoryToContainerSupport', () => {
    it('should require inventory access', async () => {
      hasInventoryAccess.mockResolvedValue(false);

      await expect(
        dataMigrationService.migrateInventoryToContainerSupport(
          'test-inventory-id',
          'test-user-id'
        )
      ).rejects.toThrow('Access denied to inventory');

      expect(hasInventoryAccess).toHaveBeenCalledWith('test-user-id', 'test-inventory-id');
    });

    it('should handle empty inventory', async () => {
      hasInventoryAccess.mockResolvedValue(true);

      // Mock DynamoDB response with no items
      mockDocClient.send.mockResolvedValue({ Items: [] });

      const result = await dataMigrationService.migrateInventoryToContainerSupport(
        'test-inventory-id',
        'test-user-id'
      );

      expect(result.summary.totalItems).toBe(0);
      expect(result.summary.containersCreated).toBe(0);
      expect(result.summary.itemsAssigned).toBe(0);
    });

    it('should handle items that already have containers', async () => {
      hasInventoryAccess.mockResolvedValue(true);

      // Mock DynamoDB response with items that already have containers
      mockDocClient.send.mockResolvedValue({
        Items: [
          {
            sk: 'item-1',
            data: {
              name: 'Test Item 1',
              containerId: 'existing-container-id'
            }
          }
        ]
      });

      const result = await dataMigrationService.migrateInventoryToContainerSupport(
        'test-inventory-id',
        'test-user-id'
      );

      expect(result.summary.totalItems).toBe(1);
      expect(result.summary.containersCreated).toBe(0);
      expect(result.summary.itemsAssigned).toBe(0);
      expect(result.summary.message).toBe('No items need migration - all items already have container assignments');
    });

    it('should create containers for unpacked items', async () => {
      hasInventoryAccess.mockResolvedValue(true);

      // Mock DynamoDB response with unpacked items
      mockDocClient.send.mockResolvedValue({
        Items: [
          {
            sk: 'item-1',
            data: {
              name: 'Test Item 1',
              locationId: 'location-1',
              value: 100
            }
          },
          {
            sk: 'item-2',
            data: {
              name: 'Test Item 2',
              locationId: 'location-1',
              value: 200
            }
          }
        ]
      });

      // Mock container service
      containerService.createContainer.mockResolvedValue({
        id: 'new-container-id',
        name: 'Location location-1 Container',
        locationId: 'location-1'
      });

      containerService.getContainer.mockResolvedValue({
        id: 'new-container-id',
        locationId: 'location-1'
      });

      const result = await dataMigrationService.migrateInventoryToContainerSupport(
        'test-inventory-id',
        'test-user-id',
        { dryRun: false }
      );

      expect(result.summary.totalItems).toBe(2);
      expect(result.summary.containersCreated).toBe(1);
      expect(result.summary.itemsAssigned).toBe(2);
      expect(containerService.createContainer).toHaveBeenCalledTimes(1);
      expect(logMigrationOperation).toHaveBeenCalledWith(
        'test-user-id',
        'inventory_container_migration',
        'test-inventory-id',
        expect.objectContaining({
          totalItems: 2,
          itemsProcessed: 2,
          containersCreated: 1,
          itemsAssigned: 2
        })
      );
    });

    it('should handle dry run mode', async () => {
      hasInventoryAccess.mockResolvedValue(true);

      // Mock DynamoDB response with unpacked items
      mockDocClient.send.mockResolvedValue({
        Items: [
          {
            sk: 'item-1',
            data: {
              name: 'Test Item 1',
              locationId: 'location-1',
              value: 100
            }
          }
        ]
      });

      const result = await dataMigrationService.migrateInventoryToContainerSupport(
        'test-inventory-id',
        'test-user-id',
        { dryRun: true }
      );

      expect(result.dryRun).toBe(true);
      expect(result.summary.totalItems).toBe(1);
      expect(result.summary.containersCreated).toBe(1);
      expect(result.summary.itemsAssigned).toBe(1);
      expect(containerService.createContainer).not.toHaveBeenCalled();
      expect(logMigrationOperation).not.toHaveBeenCalled();
    });
  });

  describe('bulkCreateContainers', () => {
    it('should require inventory access', async () => {
      hasInventoryAccess.mockResolvedValue(false);

      await expect(
        dataMigrationService.bulkCreateContainers(
          'test-inventory-id',
          [{ name: 'Test Container' }],
          'test-user-id'
        )
      ).rejects.toThrow('Access denied to inventory');
    });

    it('should validate container specifications', async () => {
      hasInventoryAccess.mockResolvedValue(true);

      const result = await dataMigrationService.bulkCreateContainers(
        'test-inventory-id',
        [
          { name: 'Valid Container', type: 'box' },
          { name: '', type: 'invalid' }, // Invalid spec
          { name: 'Another Valid Container' }
        ],
        'test-user-id'
      );

      expect(result.summary.total).toBe(3);
      expect(result.summary.failed).toBe(1);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toContain('Validation failed');
    });

    it('should reject too many containers', async () => {
      hasInventoryAccess.mockResolvedValue(true);

      const manySpecs = Array(101).fill({ name: 'Test Container' });

      await expect(
        dataMigrationService.bulkCreateContainers(
          'test-inventory-id',
          manySpecs,
          'test-user-id'
        )
      ).rejects.toThrow('Cannot create more than 100 containers at once');
    });

    it('should reject empty specifications', async () => {
      hasInventoryAccess.mockResolvedValue(true);

      await expect(
        dataMigrationService.bulkCreateContainers(
          'test-inventory-id',
          [],
          'test-user-id'
        )
      ).rejects.toThrow('Container specifications must be a non-empty array');
    });
  });
});