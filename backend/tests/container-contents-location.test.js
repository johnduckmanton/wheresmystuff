/**
 * Tests for container contents with location and room information
 * Task 7.1 - QR Code Container Assignment Feature
 */

// Mock dependencies first
jest.mock('../services/dynamodb');
jest.mock('../services/auditLogService');
jest.mock('../services/cacheService');

const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockSend
    }))
  },
  QueryCommand: jest.fn(),
  PutCommand: jest.fn(),
  GetCommand: jest.fn()
}));

const containerService = require('../services/containerService');
const { hasInventoryAccess } = require('../services/dynamodb');

describe('ContainerService - getContainerContents with location and room', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasInventoryAccess.mockResolvedValue(true);
    mockSend.mockClear();
  });

  test('should include location information when container has locationId', async () => {
    const mockContainer = {
      id: 'container-123',
      name: 'Test Container',
      locationId: 'location-456',
      contentsSummary: 'Electronics and cables',
      inventoryId: 'inv-123'
    };

    const mockLocation = {
      name: 'Garage',
      type: 'Storage',
      address: '123 Main St'
    };

    const mockItems = [
      { id: 'item-1', name: 'Laptop', quantity: 1, category: 'Electronics' },
      { id: 'item-2', name: 'Mouse', quantity: 2, category: 'Electronics' }
    ];

    // Mock the getContainer call (uses GetCommand, returns Item not Items)
    mockSend
      .mockResolvedValueOnce({
        Item: {
          pk: 'INVENTORY#inv-123#CONTAINERS',
          sk: 'container-123',
          ...mockContainer
        }
      })
      // Mock the items query
      .mockResolvedValueOnce({
        Items: mockItems.map(item => ({
          sk: item.id,
          data: item
        }))
      })
      // Mock the location query
      .mockResolvedValueOnce({
        Items: [{
          data: mockLocation
        }]
      });

    const result = await containerService.getContainerContents(
      'container-123',
      'inv-123',
      'user-123'
    );

    expect(result).toHaveProperty('container');
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('itemCount', 2);
    expect(result).toHaveProperty('location');
    expect(result.location).toEqual({
      name: 'Garage',
      type: 'Storage',
      address: '123 Main St'
    });
    expect(result).toHaveProperty('room', null);
  });

  test('should include room information when items have roomId', async () => {
    const mockContainer = {
      id: 'container-123',
      name: 'Test Container',
      contentsSummary: 'Office supplies',
      inventoryId: 'inv-123'
    };

    const mockRoom = {
      name: 'Office',
      floor: '2nd Floor'
    };

    const mockItems = [
      { id: 'item-1', name: 'Stapler', quantity: 1, category: 'Office', roomId: 'room-789' },
      { id: 'item-2', name: 'Paper', quantity: 5, category: 'Office' }
    ];

    // Mock the getContainer call
    mockSend
      .mockResolvedValueOnce({
        Item: {
          pk: 'INVENTORY#inv-123#CONTAINERS',
          sk: 'container-123',
          ...mockContainer
        }
      })
      // Mock the items query
      .mockResolvedValueOnce({
        Items: mockItems.map(item => ({
          sk: item.id,
          data: item
        }))
      })
      // Mock the room query
      .mockResolvedValueOnce({
        Items: [{
          data: mockRoom
        }]
      });

    const result = await containerService.getContainerContents(
      'container-123',
      'inv-123',
      'user-123'
    );

    expect(result).toHaveProperty('room');
    expect(result.room).toEqual({
      name: 'Office',
      floor: '2nd Floor'
    });
  });

  test('should return null for location when container has no locationId', async () => {
    const mockContainer = {
      id: 'container-123',
      name: 'Test Container',
      contentsSummary: 'Misc items',
      inventoryId: 'inv-123'
    };

    const mockItems = [
      { id: 'item-1', name: 'Item', quantity: 1, category: 'Misc' }
    ];

    // Mock the getContainer call
    mockSend
      .mockResolvedValueOnce({
        Item: {
          pk: 'INVENTORY#inv-123#CONTAINERS',
          sk: 'container-123',
          ...mockContainer
        }
      })
      // Mock the items query
      .mockResolvedValueOnce({
        Items: mockItems.map(item => ({
          sk: item.id,
          data: item
        }))
      });

    const result = await containerService.getContainerContents(
      'container-123',
      'inv-123',
      'user-123'
    );

    expect(result.location).toBeNull();
    expect(result.room).toBeNull();
  });

  test('should include contentsSummary in container object', async () => {
    const mockContainer = {
      id: 'container-123',
      name: 'Test Container',
      contentsSummary: 'Kitchen utensils and cookware',
      inventoryId: 'inv-123'
    };

    const mockItems = [];

    // Mock the getContainer call
    mockSend
      .mockResolvedValueOnce({
        Item: {
          pk: 'INVENTORY#inv-123#CONTAINERS',
          sk: 'container-123',
          ...mockContainer
        }
      })
      // Mock the items query
      .mockResolvedValueOnce({
        Items: []
      });

    const result = await containerService.getContainerContents(
      'container-123',
      'inv-123',
      'user-123'
    );

    expect(result.container.contentsSummary).toBe('Kitchen utensils and cookware');
  });

  test('should handle empty container correctly', async () => {
    const mockContainer = {
      id: 'container-123',
      name: 'Empty Container',
      contentsSummary: '',
      inventoryId: 'inv-123'
    };

    // Mock the getContainer call
    mockSend
      .mockResolvedValueOnce({
        Item: {
          pk: 'INVENTORY#inv-123#CONTAINERS',
          sk: 'container-123',
          ...mockContainer
        }
      })
      // Mock the items query
      .mockResolvedValueOnce({
        Items: []
      });

    const result = await containerService.getContainerContents(
      'container-123',
      'inv-123',
      'user-123'
    );

    expect(result.items).toEqual([]);
    expect(result.itemCount).toBe(0);
    expect(result.location).toBeNull();
    expect(result.room).toBeNull();
  });
});
