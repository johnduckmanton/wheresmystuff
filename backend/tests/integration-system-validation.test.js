/**
 * System Integration Tests for Moving & Storage System
 * Tests complete system integration across all components
 */

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/s3-request-presigner');

// Mock services
const mockDocClient = {
  send: jest.fn()
};

const mockS3Client = {
  send: jest.fn()
};

// Mock rate limiting service to allow all requests in tests
jest.mock('../services/rateLimitService', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 100,
    resetTime: Date.now() + 60000
  }),
  recordRequest: jest.fn().mockResolvedValue(true),
  getRateLimitStatus: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 100,
    resetTime: Date.now() + 60000
  })
}));

// Mock authentication middleware
jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn().mockImplementation((event) => {
    // Set user from the test event
    if (event.requestContext?.authorizer?.claims) {
      event.user = {
        userId: event.requestContext.authorizer.claims.sub,
        inventoryId: event.requestContext.authorizer.claims['custom:inventory_id']
      };
    }
    return Promise.resolve();
  })
}));

// Mock inventory access service
jest.mock('../services/dynamodb', () => ({
  hasInventoryAccess: jest.fn().mockResolvedValue(true),
  getUserInventories: jest.fn().mockResolvedValue([
    { id: 'inventory-456', name: 'Test Inventory' }
  ])
}));

// Mock audit log service
jest.mock('../services/auditLogService', () => ({
  logDataAccess: jest.fn().mockResolvedValue(true),
  logContainerOperation: jest.fn().mockResolvedValue(true),
  logBulkOperation: jest.fn().mockResolvedValue(true),
  logProjectOperation: jest.fn().mockResolvedValue(true)
}));

// Mock the AWS SDK modules
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client } = require('@aws-sdk/client-s3');

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDocClient)
  },
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn(),
  QueryCommand: jest.fn(),
  ScanCommand: jest.fn(),
  BatchWriteCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => mockS3Client),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({}))
}));

// Import handlers (simulating API Gateway integration)
const containerHandler = require('../handlers/containers');
const packingHandler = require('../handlers/packing');
const qrCodeHandler = require('../handlers/qrCode');
const projectHandler = require('../handlers/projects');
const reportHandler = require('../handlers/reports');

describe('System Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock implementations
    DynamoDBDocumentClient.from.mockReturnValue(mockDocClient);
    S3Client.mockImplementation(() => mockS3Client);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
    // Clear any pending promises
    return new Promise(resolve => setImmediate(resolve));
  });

  afterAll(() => {
    // Force cleanup of any remaining handles
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  // Helper function to create proper HTTP API v2 events
  const createTestEvent = (method, path, body = null, pathParameters = null, queryStringParameters = null, userId = 'user-123', inventoryId = 'inventory-456') => {
    return {
      requestContext: {
        http: {
          method: method,
          path: path,
          sourceIp: '127.0.0.1'
        },
        authorizer: {
          claims: {
            sub: userId,
            'custom:inventory_id': inventoryId
          }
        }
      },
      headers: {
        'user-agent': 'test-agent',
        'content-type': 'application/json'
      },
      pathParameters: pathParameters,
      queryStringParameters: queryStringParameters,
      body: body ? JSON.stringify(body) : null,
      user: {
        userId: userId,
        inventoryId: inventoryId
      },
      httpMethod: method // Add for backward compatibility
    };
  };

  describe('Complete Moving Workflow Integration', () => {
    test('should handle complete workflow: create project -> create containers -> pack items -> generate reports', async () => {
      const userId = 'user-123';
      const inventoryId = 'inventory-456';
      
      // Step 1: Create moving project
      const projectEvent = createTestEvent('POST', '/projects', {
        name: 'Office Move',
        description: 'Moving office to new location',
        startDate: '2024-01-01T00:00:00Z',
        targetDate: '2024-01-15T00:00:00Z',
        sourceLocation: 'old-office',
        destinationLocation: 'new-office'
      }, null, null, userId, inventoryId);

      const mockProject = {
        id: 'project-123',
        name: 'Office Move',
        status: 'planning',
        containerCount: 0,
        itemCount: 0,
        completionPercentage: 0
      };

      mockDocClient.send.mockResolvedValueOnce({
        Item: mockProject
      });

      const projectResponse = await projectHandler.handler(projectEvent);
      
      // Debug: Log the response if it's not 201
      if (projectResponse.statusCode !== 201) {
        console.log('Project creation failed:', projectResponse);
      }
      
      expect(projectResponse.statusCode).toBe(201);
      const createdProject = JSON.parse(projectResponse.body);
      expect(createdProject.name).toBe('Office Move');

      // Step 2: Create containers for the project
      const containerEvents = [
        createTestEvent('POST', '/containers', {
          name: 'Office Supplies Box',
          type: 'box',
          size: 'large',
          projectId: 'project-123',
          locationId: 'old-office'
        }, null, null, userId, inventoryId),
        createTestEvent('POST', '/containers', {
          name: 'Electronics Box',
          type: 'box',
          size: 'medium',
          projectId: 'project-123',
          locationId: 'old-office',
          handlingFlags: ['fragile', 'valuable']
        }, null, null, userId, inventoryId)
      ];

      const mockContainers = [
        {
          id: 'container-1',
          name: 'Office Supplies Box',
          type: 'box',
          qrCode: 'CONT_container-1_1703000000000_abcd1234',
          status: 'empty',
          projectId: 'project-123'
        },
        {
          id: 'container-2',
          name: 'Electronics Box',
          type: 'box',
          qrCode: 'CONT_container-2_1703000000000_efgh5678',
          status: 'empty',
          projectId: 'project-123',
          handlingFlags: ['fragile', 'valuable']
        }
      ];

      mockDocClient.send
        .mockResolvedValueOnce({ Item: mockContainers[0] })
        .mockResolvedValueOnce({ Item: mockContainers[1] });

      const containerResponses = await Promise.all(
        containerEvents.map(event => containerHandler.handler(event))
      );

      containerResponses.forEach((response, index) => {
        expect(response.statusCode).toBe(201);
        const container = JSON.parse(response.body);
        expect(container.projectId).toBe('project-123');
        expect(container.qrCode).toMatch(/^CONT_/);
      });

      // Step 3: Pack items into containers
      const mockItems = [
        { id: 'item-1', name: 'Stapler', categoryName: 'Office Supplies', value: 15 },
        { id: 'item-2', name: 'Pens', categoryName: 'Office Supplies', value: 10 },
        { id: 'item-3', name: 'Laptop', categoryName: 'Electronics', value: 1200 },
        { id: 'item-4', name: 'Monitor', categoryName: 'Electronics', value: 300 }
      ];

      const packingEvents = [
        createTestEvent('POST', '/containers/container-1/items', {
          itemIds: ['item-1', 'item-2']
        }, { id: 'container-1' }, null, userId, inventoryId),
        createTestEvent('POST', '/containers/container-2/items', {
          itemIds: ['item-3', 'item-4']
        }, { id: 'container-2' }, null, userId, inventoryId)
      ];

      // Mock packing operations
      mockDocClient.send
        .mockResolvedValueOnce({ Items: [mockItems[0], mockItems[1]] }) // Get items for container-1
        .mockResolvedValueOnce({ Item: mockContainers[0] }) // Get container-1
        .mockResolvedValueOnce({}) // Update container-1
        .mockResolvedValueOnce({}) // Update items
        .mockResolvedValueOnce({}) // Audit log
        .mockResolvedValueOnce({ Items: [mockItems[2], mockItems[3]] }) // Get items for container-2
        .mockResolvedValueOnce({ Item: mockContainers[1] }) // Get container-2
        .mockResolvedValueOnce({}) // Update container-2
        .mockResolvedValueOnce({}) // Update items
        .mockResolvedValueOnce({}); // Audit log

      const packingResponses = await Promise.all(
        packingEvents.map(event => packingHandler.handler(event))
      );

      packingResponses.forEach(response => {
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.success).toBe(true);
        expect(result.itemsAdded).toBe(2);
      });

      // Step 4: Generate QR codes for containers
      const qrCodeEvents = mockContainers.map(container => 
        createTestEvent('POST', `/containers/${container.id}/qr-code/generate`, {
          size: 'medium'
        }, { id: container.id }, null, userId, inventoryId)
      );

      mockS3Client.send
        .mockResolvedValueOnce({ Location: 'https://s3.amazonaws.com/bucket/qr-1.png' })
        .mockResolvedValueOnce({ Location: 'https://s3.amazonaws.com/bucket/qr-2.png' });

      const qrCodeResponses = await Promise.all(
        qrCodeEvents.map(event => qrCodeHandler.handler(event))
      );

      qrCodeResponses.forEach(response => {
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.imageUrl).toContain('s3.amazonaws.com');
      });

      // Step 5: Move containers to new location
      const moveEvent = createTestEvent('POST', '/containers/bulk-move', {
        containerIds: ['container-1', 'container-2'],
        newLocationId: 'new-office'
      }, null, null, userId, inventoryId);

      // Mock bulk move operation
      mockDocClient.send
        .mockResolvedValueOnce({ Items: mockContainers }) // Get containers
        .mockResolvedValueOnce({ Items: mockItems }) // Get all items
        .mockResolvedValueOnce({}) // Update containers
        .mockResolvedValueOnce({}) // Update items
        .mockResolvedValueOnce({}); // Audit log

      const moveResponse = await containerHandler.handler(moveEvent);
      
      expect(moveResponse.statusCode).toBe(200);
      const moveResult = JSON.parse(moveResponse.body);
      expect(moveResult.success).toBe(true);
      expect(moveResult.containersUpdated).toBe(2);
      expect(moveResult.itemsUpdated).toBe(4);

      // Step 6: Generate project report
      const reportEvent = createTestEvent('GET', '/reports/project/project-123', null, 
        { id: 'project-123' }, 
        { format: 'json', template: 'moving' }, 
        userId, inventoryId
      );

      // Mock report generation
      const updatedProject = {
        ...mockProject,
        containerCount: 2,
        itemCount: 4,
        completionPercentage: 100
      };

      const packedContainers = mockContainers.map(container => ({
        ...container,
        status: 'packed',
        itemCount: 2,
        locationId: 'new-office'
      }));

      mockDocClient.send
        .mockResolvedValueOnce({ Item: updatedProject }) // Get project
        .mockResolvedValueOnce({ Items: packedContainers }); // Get project containers

      const reportResponse = await reportHandler.handler(reportEvent);
      
      expect(reportResponse.statusCode).toBe(200);
      const report = JSON.parse(reportResponse.body);
      expect(report.project.name).toBe('Office Move');
      expect(report.summary.totalContainers).toBe(2);
      expect(report.summary.completionPercentage).toBe(100);
      expect(report.containers).toHaveLength(2);
    });
  });

  describe('QR Code Scanning Integration', () => {
    test('should handle complete QR scanning workflow with container lookup', async () => {
      const userId = 'user-123';
      const inventoryId = 'inventory-456';
      const qrCode = 'CONT_container-789_1703000000000_scan1234';

      // Step 1: Scan QR code
      const scanEvent = createTestEvent('POST', '/qr-codes/scan', {
        qrCodeData: qrCode
      }, null, null, userId, inventoryId);

      const mockContainer = {
        id: 'container-789',
        name: 'Scanned Container',
        type: 'box',
        qrCode: qrCode,
        status: 'packed',
        itemCount: 3
      };

      // Mock QR code lookup
      mockDocClient.send
        .mockResolvedValueOnce({ Items: [{ containerId: 'container-789' }] }) // QR lookup
        .mockResolvedValueOnce({ Item: mockContainer }); // Get container

      const scanResponse = await qrCodeHandler.handler(scanEvent);
      
      expect(scanResponse.statusCode).toBe(200);
      const scanResult = JSON.parse(scanResponse.body);
      expect(scanResult.success).toBe(true);
      expect(scanResult.containerId).toBe('container-789');
      expect(scanResult.container.name).toBe('Scanned Container');

      // Step 2: Get container contents
      const contentsEvent = createTestEvent('GET', '/containers/container-789/contents', null,
        { id: 'container-789' }, null, userId, inventoryId
      );

      const mockContents = [
        { id: 'item-1', name: 'Item 1', value: 50 },
        { id: 'item-2', name: 'Item 2', value: 75 },
        { id: 'item-3', name: 'Item 3', value: 25 }
      ];

      mockDocClient.send.mockResolvedValueOnce({
        Items: mockContents
      });

      const contentsResponse = await packingHandler.handler(contentsEvent);
      
      expect(contentsResponse.statusCode).toBe(200);
      const contents = JSON.parse(contentsResponse.body);
      expect(contents.items).toHaveLength(3);
      expect(contents.totalValue).toBe(150);

      // Step 3: Record scan history
      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Item: expect.objectContaining({
              type: 'qr_scan',
              success: true,
              containerId: 'container-789',
              method: 'camera'
            })
          })
        })
      );
    });
  });

  describe('Data Consistency and Validation', () => {
    test('should maintain data consistency across container and item operations', async () => {
      const userId = 'user-123';
      const inventoryId = 'inventory-456';

      // Test scenario: Add items to container, then remove some, then move container
      const containerId = 'container-consistency-test';
      const mockContainer = {
        id: containerId,
        name: 'Consistency Test Container',
        itemCount: 0,
        estimatedValue: 0,
        locationId: 'location-1'
      };

      const mockItems = [
        { id: 'item-1', name: 'Item 1', value: 100, containerId: null },
        { id: 'item-2', name: 'Item 2', value: 200, containerId: null },
        { id: 'item-3', name: 'Item 3', value: 150, containerId: null }
      ];

      // Step 1: Add items to container
      const addItemsEvent = createTestEvent('POST', `/containers/${containerId}/items`, {
        itemIds: ['item-1', 'item-2', 'item-3']
      }, { id: containerId }, null, userId, inventoryId);

      mockDocClient.send
        .mockResolvedValueOnce({ Items: mockItems }) // Get items
        .mockResolvedValueOnce({ Item: mockContainer }) // Get container
        .mockResolvedValueOnce({}) // Update container
        .mockResolvedValueOnce({}) // Update items
        .mockResolvedValueOnce({}); // Audit log

      const addResponse = await packingHandler.handler(addItemsEvent);
      expect(addResponse.statusCode).toBe(200);

      // Verify container update was called with correct values
      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            UpdateExpression: expect.stringContaining('itemCount'),
            ExpressionAttributeValues: expect.objectContaining({
              ':itemCount': 3,
              ':estimatedValue': 450
            })
          })
        })
      );

      // Step 2: Remove one item
      const removeItemEvent = createTestEvent('DELETE', `/containers/${containerId}/items/item-2`, null,
        { id: containerId, itemId: 'item-2' }, null, userId, inventoryId
      );

      const updatedContainer = {
        ...mockContainer,
        itemCount: 3,
        estimatedValue: 450
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Item: { ...mockItems[1], containerId } }) // Get item
        .mockResolvedValueOnce({ Item: updatedContainer }) // Get container
        .mockResolvedValueOnce({}) // Update container
        .mockResolvedValueOnce({}) // Update item
        .mockResolvedValueOnce({}); // Audit log

      const removeResponse = await packingHandler.handler(removeItemEvent);
      expect(removeResponse.statusCode).toBe(200);

      // Verify container values were decremented correctly
      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            UpdateExpression: expect.stringContaining('itemCount'),
            ExpressionAttributeValues: expect.objectContaining({
              ':itemCount': 2,
              ':estimatedValue': 250
            })
          })
        })
      );

      // Step 3: Move container and verify item locations are updated
      const moveEvent = createTestEvent('POST', `/containers/${containerId}/move`, {
        newLocationId: 'location-2'
      }, { id: containerId }, null, userId, inventoryId);

      const finalContainer = {
        ...updatedContainer,
        itemCount: 2,
        estimatedValue: 250
      };

      const remainingItems = [
        { ...mockItems[0], containerId },
        { ...mockItems[2], containerId }
      ];

      mockDocClient.send
        .mockResolvedValueOnce({ Item: finalContainer }) // Get container
        .mockResolvedValueOnce({ Items: remainingItems }) // Get container items
        .mockResolvedValueOnce({}) // Update container location
        .mockResolvedValueOnce({}) // Update item locations
        .mockResolvedValueOnce({}); // Audit log

      const moveResponse = await containerHandler.handler(moveEvent);
      expect(moveResponse.statusCode).toBe(200);

      // Verify all items in container were moved
      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            RequestItems: expect.objectContaining({
              [process.env.DYNAMODB_TABLE]: expect.arrayContaining([
                expect.objectContaining({
                  PutRequest: expect.objectContaining({
                    Item: expect.objectContaining({
                      locationId: 'location-2'
                    })
                  })
                })
              ])
            })
          })
        })
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle partial failures in bulk operations', async () => {
      const userId = 'user-123';
      const inventoryId = 'inventory-456';

      // Test bulk container move with some containers failing
      const bulkMoveEvent = createTestEvent('POST', '/containers/bulk-move', {
        containerIds: ['container-1', 'container-2', 'container-3'],
        newLocationId: 'new-location'
      }, null, null, userId, inventoryId);

      const mockContainers = [
        { id: 'container-1', name: 'Container 1', itemCount: 5 },
        { id: 'container-2', name: 'Container 2', itemCount: 3 },
        // container-3 is missing (simulating not found error)
      ];

      mockDocClient.send
        .mockResolvedValueOnce({ Items: mockContainers }) // Get containers (only 2 found)
        .mockResolvedValueOnce({ Items: [] }) // No items found
        .mockResolvedValueOnce({}) // Update containers
        .mockResolvedValueOnce({}) // Update items
        .mockResolvedValueOnce({}); // Audit log

      const response = await containerHandler.handler(bulkMoveEvent);
      
      expect(response.statusCode).toBe(207); // Partial success
      const result = JSON.parse(response.body);
      expect(result.success).toBe(false);
      expect(result.containersUpdated).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].containerId).toBe('container-3');
      expect(result.errors[0].error).toBe('Container not found');
    });

    test('should handle database transaction failures', async () => {
      const userId = 'user-123';
      const inventoryId = 'inventory-456';

      const packingEvent = createTestEvent('POST', '/containers/container-123/items', {
        itemIds: ['item-1', 'item-2']
      }, { id: 'container-123' }, null, userId, inventoryId);

      // Mock database failure
      mockDocClient.send
        .mockResolvedValueOnce({ Items: [{ id: 'item-1' }, { id: 'item-2' }] }) // Get items
        .mockResolvedValueOnce({ Item: { id: 'container-123' } }) // Get container
        .mockRejectedValueOnce(new Error('ConditionalCheckFailedException')); // Update fails

      const response = await packingHandler.handler(packingEvent);
      
      expect(response.statusCode).toBe(409); // Conflict
      const result = JSON.parse(response.body);
      expect(result.error).toBe('CONCURRENT_MODIFICATION');
      expect(result.message).toContain('modified by another operation');
    });
  });

  describe('Performance and Scalability Validation', () => {
    test('should handle large batch operations within time limits', async () => {
      const userId = 'user-123';
      const inventoryId = 'inventory-456';

      // Test batch QR code generation for 50 containers
      const containerIds = Array.from({ length: 50 }, (_, i) => `container-${i}`);
      
      const batchQREvent = createTestEvent('POST', '/qr-codes/batch', {
        containerIds,
        size: 'medium'
      }, null, null, userId, inventoryId);

      const mockContainers = containerIds.map(id => ({
        id,
        name: `Container ${id}`,
        qrCode: `CONT_${id}_1703000000000_batch123`
      }));

      // Mock successful batch generation
      mockDocClient.send.mockResolvedValueOnce({ Items: mockContainers });
      
      // Mock S3 uploads (simulate parallel processing)
      const s3Promises = containerIds.map(() => 
        Promise.resolve({ Location: 'https://s3.amazonaws.com/bucket/qr.png' })
      );
      mockS3Client.send.mockImplementation(() => s3Promises.shift());

      const startTime = Date.now();
      const response = await qrCodeHandler.handler(batchQREvent);
      const endTime = Date.now();
      
      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.success).toBe(true);
      expect(result.generated).toBe(50);
      
      // Should complete within reasonable time (5 seconds for 50 QR codes)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    test('should handle concurrent operations without data corruption', async () => {
      const userId = 'user-123';
      const inventoryId = 'inventory-456';
      const containerId = 'container-concurrent-test';

      // Simulate concurrent packing operations
      const concurrentEvents = Array.from({ length: 5 }, (_, i) => 
        createTestEvent('POST', `/containers/${containerId}/items`, {
          itemIds: [`item-${i}`]
        }, { id: containerId }, null, userId, inventoryId)
      );

      const mockContainer = {
        id: containerId,
        itemCount: 0,
        estimatedValue: 0
      };

      // Mock responses for concurrent operations
      mockDocClient.send
        .mockResolvedValue({ Items: [{ id: 'item-0', value: 10 }] })
        .mockResolvedValue({ Item: mockContainer })
        .mockResolvedValue({}); // Some operations succeed, others may fail due to concurrency

      const responses = await Promise.allSettled(
        concurrentEvents.map(event => packingHandler.handler(event))
      );

      // At least one operation should succeed
      const successfulOps = responses.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode === 200
      );
      expect(successfulOps.length).toBeGreaterThan(0);

      // Failed operations should have appropriate error codes
      const failedOps = responses.filter(r => 
        r.status === 'fulfilled' && r.value.statusCode !== 200
      );
      failedOps.forEach(op => {
        expect([409, 400, 500]).toContain(op.value.statusCode);
      });
    });
  });

  describe('Security and Access Control Validation', () => {
    test('should enforce inventory access controls', async () => {
      const userId = 'user-123';
      const unauthorizedInventoryId = 'inventory-unauthorized';

      const containerEvent = createTestEvent('GET', '/containers/container-123', null,
        { id: 'container-123' }, null, userId, unauthorizedInventoryId
      );

      // Mock access denied
      mockDocClient.send.mockResolvedValueOnce({ Item: null });

      const response = await containerHandler.handler(containerEvent);
      
      expect(response.statusCode).toBe(404);
      const result = JSON.parse(response.body);
      expect(result.error).toBe('CONTAINER_NOT_FOUND');
    });

    test('should validate QR code authenticity', async () => {
      const userId = 'user-123';
      const inventoryId = 'inventory-456';

      // Test with tampered QR code
      const tamperedQRCode = 'CONT_container-123_9999999999999_tampered';

      const scanEvent = createTestEvent('POST', '/qr-codes/scan', {
        qrCodeData: tamperedQRCode
      }, null, null, userId, inventoryId);

      const response = await qrCodeHandler.handler(scanEvent);
      
      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.body);
      expect(result.error).toBe('INVALID_QR_CODE');
      expect(result.message).toContain('Invalid or expired QR code');
    });
  });
});