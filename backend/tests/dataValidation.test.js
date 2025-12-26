// Mock DynamoDB client to avoid actual database calls during testing
const mockSend = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend }))
  },
  QueryCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'QueryCommand' } })),
  UpdateCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'UpdateCommand' } })),
  BatchWriteCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'BatchWriteCommand' } }))
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn()
}));

// Mock audit logging
jest.mock('../services/auditLogService', () => ({
  logDataValidation: jest.fn()
}));

const dataValidationService = require('../services/dataValidationService');
const { logDataValidation } = require('../services/auditLogService');

describe('Data Validation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  describe('validateContainerItemConsistency', () => {
    test('should detect orphaned items', async () => {
      // Mock containers response
      const mockContainers = [
        { id: 'container1', name: 'Box 1', itemCount: 2 },
        { id: 'container2', name: 'Box 2', itemCount: 1 }
      ];
      
      // Mock items response with orphaned item
      const mockItems = [
        { id: 'item1', name: 'Item 1', containerId: 'container1' },
        { id: 'item2', name: 'Item 2', containerId: 'container1' },
        { id: 'item3', name: 'Item 3', containerId: 'container2' },
        { id: 'item4', name: 'Item 4', containerId: 'nonexistent-container' } // Orphaned
      ];
      
      mockSend
        .mockResolvedValueOnce({ Items: mockContainers }) // Containers query
        .mockResolvedValueOnce({ Items: mockItems }); // Items query
      
      const result = await dataValidationService.validateContainerItemConsistency('inv1', 'user1');
      
      expect(result.totalInconsistencies).toBe(1);
      expect(result.inconsistencies[0].type).toBe('orphaned_items');
      expect(result.inconsistencies[0].count).toBe(1);
      expect(result.inconsistencies[0].items[0].id).toBe('item4');
      expect(logDataValidation).toHaveBeenCalledWith('user1', 'validate_consistency', 'inv1', expect.any(Object));
    });

    test('should detect container count mismatches', async () => {
      const mockContainers = [
        { id: 'container1', name: 'Box 1', itemCount: 5 }, // Wrong count
        { id: 'container2', name: 'Box 2', itemCount: 1 }  // Correct count
      ];
      
      const mockItems = [
        { id: 'item1', name: 'Item 1', containerId: 'container1' },
        { id: 'item2', name: 'Item 2', containerId: 'container1' },
        { id: 'item3', name: 'Item 3', containerId: 'container2' }
      ];
      
      mockSend
        .mockResolvedValueOnce({ Items: mockContainers })
        .mockResolvedValueOnce({ Items: mockItems });
      
      const result = await dataValidationService.validateContainerItemConsistency('inv1', 'user1');
      
      expect(result.totalInconsistencies).toBe(1);
      expect(result.inconsistencies[0].type).toBe('container_count_mismatch');
      expect(result.inconsistencies[0].containers[0].containerId).toBe('container1');
      expect(result.inconsistencies[0].containers[0].recordedCount).toBe(5);
      expect(result.inconsistencies[0].containers[0].actualCount).toBe(2);
    });

    test('should detect location inconsistencies', async () => {
      const mockContainers = [
        { id: 'container1', name: 'Box 1', itemCount: 2, locationId: 'location1' }
      ];
      
      const mockItems = [
        { id: 'item1', name: 'Item 1', containerId: 'container1', locationId: 'location1' }, // Correct
        { id: 'item2', name: 'Item 2', containerId: 'container1', locationId: 'location2' }  // Wrong location
      ];
      
      mockSend
        .mockResolvedValueOnce({ Items: mockContainers })
        .mockResolvedValueOnce({ Items: mockItems });
      
      const result = await dataValidationService.validateContainerItemConsistency('inv1', 'user1');
      
      expect(result.totalInconsistencies).toBe(1);
      expect(result.inconsistencies[0].type).toBe('location_inconsistency');
      expect(result.inconsistencies[0].containers[0].containerId).toBe('container1');
      expect(result.inconsistencies[0].containers[0].items).toHaveLength(1);
      expect(result.inconsistencies[0].containers[0].items[0].id).toBe('item2');
    });

    test('should return no inconsistencies for valid data', async () => {
      const mockContainers = [
        { id: 'container1', name: 'Box 1', itemCount: 2, locationId: 'location1' }
      ];
      
      const mockItems = [
        { id: 'item1', name: 'Item 1', containerId: 'container1', locationId: 'location1' },
        { id: 'item2', name: 'Item 2', containerId: 'container1', locationId: 'location1' }
      ];
      
      mockSend
        .mockResolvedValueOnce({ Items: mockContainers })
        .mockResolvedValueOnce({ Items: mockItems });
      
      const result = await dataValidationService.validateContainerItemConsistency('inv1', 'user1');
      
      expect(result.totalInconsistencies).toBe(0);
      expect(result.inconsistencies).toHaveLength(0);
    });
  });

  describe('correctOrphanedItems', () => {
    test('should correct orphaned items successfully', async () => {
      mockSend.mockResolvedValue({});
      
      const result = await dataValidationService.correctOrphanedItems(
        'inv1',
        ['item1', 'item2'],
        'user1'
      );
      
      expect(result.correctedItemsCount).toBe(2);
      expect(result.correctedItems).toEqual(['item1', 'item2']);
      expect(result.errors).toHaveLength(0);
      expect(mockSend).toHaveBeenCalled();
      expect(logDataValidation).toHaveBeenCalledWith('user1', 'correct_orphaned_items', 'inv1', expect.any(Object));
    });

    test('should handle empty item list', async () => {
      await expect(
        dataValidationService.correctOrphanedItems('inv1', [], 'user1')
      ).rejects.toThrow('No items specified for correction');
    });

    test('should process items in batches', async () => {
      const itemIds = Array.from({ length: 30 }, (_, i) => `item${i + 1}`);
      mockSend.mockResolvedValue({});
      
      const result = await dataValidationService.correctOrphanedItems('inv1', itemIds, 'user1');
      
      expect(result.correctedItemsCount).toBe(30);
      expect(mockSend).toHaveBeenCalledTimes(2); // 25 + 5 items = 2 batches
    });
  });

  describe('correctContainerCounts', () => {
    test('should correct container counts successfully', async () => {
      mockSend
        .mockResolvedValueOnce({ Count: 3 }) // Item count query
        .mockResolvedValueOnce({}); // Update container
      
      const result = await dataValidationService.correctContainerCounts(
        'inv1',
        ['container1'],
        'user1'
      );
      
      expect(result.correctedContainersCount).toBe(1);
      expect(result.correctedContainers[0].containerId).toBe('container1');
      expect(result.correctedContainers[0].correctedCount).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(logDataValidation).toHaveBeenCalledWith('user1', 'correct_container_counts', 'inv1', expect.any(Object));
    });

    test('should handle errors for individual containers', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('Container not found'))
        .mockResolvedValueOnce({ Count: 2 })
        .mockResolvedValueOnce({});
      
      const result = await dataValidationService.correctContainerCounts(
        'inv1',
        ['container1', 'container2'],
        'user1'
      );
      
      expect(result.correctedContainersCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].containerId).toBe('container1');
      expect(result.errors[0].error).toBe('Container not found');
    });
  });

  describe('correctLocationInconsistencies', () => {
    test('should correct location inconsistencies successfully', async () => {
      const mockContainer = {
        id: 'container1',
        name: 'Box 1',
        locationId: 'location1'
      };
      
      const mockItems = [
        { id: 'item1', name: 'Item 1', locationId: 'location2' },
        { id: 'item2', name: 'Item 2', locationId: 'location3' }
      ];
      
      mockSend
        .mockResolvedValueOnce({ Items: [mockContainer] }) // Container query
        .mockResolvedValueOnce({ Items: mockItems }) // Items query
        .mockResolvedValueOnce({}); // Batch update
      
      const result = await dataValidationService.correctLocationInconsistencies(
        'inv1',
        ['container1'],
        'user1'
      );
      
      expect(result.correctedItemsCount).toBe(2);
      expect(result.correctedItems[0].newLocation).toBe('location1');
      expect(result.errors).toHaveLength(0);
      expect(logDataValidation).toHaveBeenCalledWith('user1', 'correct_location_inconsistencies', 'inv1', expect.any(Object));
    });

    test('should handle container not found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] }); // No container found
      
      const result = await dataValidationService.correctLocationInconsistencies(
        'inv1',
        ['nonexistent-container'],
        'user1'
      );
      
      expect(result.correctedItemsCount).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].containerId).toBe('nonexistent-container');
      expect(result.errors[0].error).toBe('Container not found');
    });
  });
});