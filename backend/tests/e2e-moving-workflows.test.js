/**
 * End-to-End Tests for Moving & Storage System Workflows
 * Tests complete workflows from container creation to reporting
 */

// Mock AWS SDK and dependencies
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

// Mock the AWS SDK modules
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

// Import services after mocking
const ContainerService = require('../services/containerService');
const PackingService = require('../services/packingService');
const QRCodeService = require('../services/qrCodeService');
const ReportService = require('../services/reportService');
const MovingProjectService = require('../services/movingProjectService');

describe('End-to-End Moving & Storage Workflows', () => {
  let containerService;
  let packingService;
  let qrCodeService;
  let reportService;
  let projectService;

  const mockUserId = 'user-123';
  const mockInventoryId = 'inventory-456';
  const mockLocationId = 'location-789';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Services exported as singletons (instances)
    containerService = ContainerService;
    packingService = PackingService;
    reportService = ReportService;
    projectService = MovingProjectService;
    
    // Services exported as classes
    qrCodeService = new QRCodeService();

    // Setup default successful responses
    mockDocClient.send.mockResolvedValue({
      Item: {},
      Items: [],
      Count: 0
    });

    mockS3Client.send.mockResolvedValue({
      Location: 'https://s3.amazonaws.com/bucket/key'
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Complete Packing Workflow', () => {
    test('should complete full packing workflow: create container -> add items -> generate QR -> scan', async () => {
      // Step 1: Create a new container
      const containerData = {
        name: 'Kitchen Box 1',
        type: 'box',
        size: 'medium',
        description: 'Kitchen items for move',
        locationId: mockLocationId
      };

      // Mock container creation
      const mockContainerId = 'container-123';
      const mockContainer = {
        id: mockContainerId,
        ...containerData,
        qrCode: 'CONT_container-123_1703000000000_abcd1234',
        status: 'empty',
        itemCount: 0,
        estimatedValue: 0,
        createdAt: '2024-01-01T00:00:00Z'
      };

      mockDocClient.send.mockResolvedValueOnce({
        Item: mockContainer
      });

      const createdContainer = await containerService.createContainer(
        mockInventoryId,
        containerData,
        mockUserId
      );

      expect(createdContainer.id).toBe(mockContainerId);
      expect(createdContainer.name).toBe('Kitchen Box 1');
      expect(createdContainer.qrCode).toMatch(/^CONT_/);

      // Step 2: Add items to container
      const mockItems = [
        { id: 'item-1', name: 'Plates', value: 50, categoryName: 'Kitchen' },
        { id: 'item-2', name: 'Cups', value: 30, categoryName: 'Kitchen' },
        { id: 'item-3', name: 'Utensils', value: 20, categoryName: 'Kitchen' }
      ];

      // Mock items query and update operations
      mockDocClient.send
        .mockResolvedValueOnce({ Items: mockItems }) // Get items
        .mockResolvedValueOnce({ Item: mockContainer }) // Get container
        .mockResolvedValueOnce({}) // Update container
        .mockResolvedValueOnce({}) // Update items
        .mockResolvedValueOnce({}); // Audit log

      const packingResult = await packingService.addItemsToContainer(
        mockContainerId,
        ['item-1', 'item-2', 'item-3'],
        mockUserId,
        mockInventoryId
      );

      expect(packingResult.success).toBe(true);
      expect(packingResult.itemsAdded).toBe(3);

      // Step 3: Generate QR code
      const qrCodeResult = await qrCodeService.generateQRCode(
        mockContainerId,
        'medium'
      );

      expect(qrCodeResult.qrCodeId).toMatch(/^CONT_/);
      expect(qrCodeResult.imageUrl).toBeDefined();

      // Step 4: Scan QR code
      const scanResult = qrCodeService.scanQRCode(mockContainer.qrCode);

      expect(scanResult.success).toBe(true);
      expect(scanResult.containerId).toBe(mockContainerId);

      // Step 5: Get container contents after packing
      mockDocClient.send.mockResolvedValueOnce({
        Items: mockItems.map(item => ({
          ...item,
          containerId: mockContainerId
        }))
      });

      const contents = await packingService.getContainerContents(
        mockContainerId,
        mockUserId,
        mockInventoryId
      );

      expect(contents.items).toHaveLength(3);
      expect(contents.totalValue).toBe(100);
    });

    test('should handle packing workflow with capacity validation', async () => {
      const mockContainerId = 'container-456';
      const mockContainer = {
        id: mockContainerId,
        name: 'Small Box',
        type: 'box',
        size: 'small',
        status: 'packing',
        itemCount: 8, // Near capacity
        maxCapacity: 10
      };

      // Mock capacity validation
      mockDocClient.send
        .mockResolvedValueOnce({ Item: mockContainer })
        .mockResolvedValueOnce({ Items: Array(5).fill({ id: 'item' }) }); // 5 new items

      const validationResult = await packingService.validateContainerCapacity(
        mockContainerId,
        ['item-1', 'item-2', 'item-3', 'item-4', 'item-5'],
        mockUserId,
        mockInventoryId
      );

      expect(validationResult.valid).toBe(false);
      expect(validationResult.reason).toContain('capacity');
      expect(validationResult.currentCount).toBe(8);
      expect(validationResult.attemptedCount).toBe(5);
    });
  });

  describe('Complete Moving Project Workflow', () => {
    test('should complete moving project workflow: create project -> assign containers -> track progress', async () => {
      // Step 1: Create moving project
      const projectData = {
        name: 'Kitchen Move',
        description: 'Moving kitchen items to new house',
        startDate: '2024-01-01T00:00:00Z',
        targetDate: '2024-01-15T00:00:00Z',
        sourceLocation: 'old-house',
        destinationLocation: 'new-house'
      };

      const mockProjectId = 'project-123';
      const mockProject = {
        id: mockProjectId,
        ...projectData,
        status: 'planning',
        containerCount: 0,
        itemCount: 0,
        completionPercentage: 0
      };

      mockDocClient.send.mockResolvedValueOnce({
        Item: mockProject
      });

      const createdProject = await projectService.createProject(
        mockInventoryId,
        projectData,
        mockUserId
      );

      expect(createdProject.id).toBe(mockProjectId);
      expect(createdProject.name).toBe('Kitchen Move');

      // Step 2: Assign containers to project
      const containerIds = ['container-1', 'container-2', 'container-3'];
      const mockContainers = containerIds.map(id => ({
        id,
        name: `Container ${id}`,
        itemCount: 5,
        status: 'packed'
      }));

      mockDocClient.send
        .mockResolvedValueOnce({ Items: mockContainers }) // Get containers
        .mockResolvedValueOnce({}) // Update project assignment
        .mockResolvedValueOnce({}); // Update containers

      const assignmentResult = await projectService.assignContainersToProject(
        mockProjectId,
        containerIds,
        mockUserId,
        mockInventoryId
      );

      expect(assignmentResult.success).toBe(true);
      expect(assignmentResult.containersAssigned).toBe(3);

      // Step 3: Track project progress
      mockDocClient.send
        .mockResolvedValueOnce({ Item: mockProject }) // Get project
        .mockResolvedValueOnce({ Items: mockContainers }); // Get project containers

      const progress = await projectService.getProjectProgress(
        mockProjectId,
        mockUserId,
        mockInventoryId
      );

      expect(progress.totalContainers).toBe(3);
      expect(progress.packedContainers).toBe(3);
      expect(progress.totalItems).toBe(15);
      expect(progress.completionPercentage).toBe(100);
    });

    test('should handle project status transitions', async () => {
      const mockProjectId = 'project-456';
      const mockProject = {
        id: mockProjectId,
        status: 'planning',
        containerCount: 2
      };

      // Test transition from planning to active
      mockDocClient.send
        .mockResolvedValueOnce({ Item: mockProject })
        .mockResolvedValueOnce({});

      const updateResult = await projectService.updateProject(
        mockProjectId,
        { status: 'active' },
        mockUserId,
        mockInventoryId
      );

      expect(updateResult.success).toBe(true);

      // Test invalid transition (completed to planning)
      mockProject.status = 'completed';
      mockDocClient.send.mockResolvedValueOnce({ Item: mockProject });

      await expect(
        projectService.updateProject(
          mockProjectId,
          { status: 'planning' },
          mockUserId,
          mockInventoryId
        )
      ).rejects.toThrow('Invalid status transition');
    });
  });

  describe('QR Code Generation and Scanning Flow', () => {
    test('should complete QR code workflow: generate -> print -> scan -> lookup', async () => {
      const mockContainerId = 'container-789';
      const mockContainer = {
        id: mockContainerId,
        name: 'Living Room Box',
        type: 'box',
        qrCode: 'CONT_container-789_1703000000000_efgh5678'
      };

      // Step 1: Generate QR code image
      const qrCodeBuffer = Buffer.from('fake-qr-image-data');
      mockS3Client.send.mockResolvedValueOnce({
        Location: 'https://s3.amazonaws.com/bucket/qr-codes/container-789.png'
      });

      const qrResult = await qrCodeService.generateQRCode(
        mockContainerId,
        'large'
      );

      expect(qrResult.imageUrl).toContain('s3.amazonaws.com');
      expect(qrResult.qrCodeId).toMatch(/^CONT_/);

      // Step 2: Generate printable label
      const labelService = require('../services/labelService');
      const labelBuffer = await labelService.generateLabel(mockContainer, 'medium');

      expect(Buffer.isBuffer(labelBuffer)).toBe(true);
      expect(labelBuffer.length).toBeGreaterThan(0);

      // Step 3: Scan QR code
      const scanResult = qrCodeService.scanQRCode(mockContainer.qrCode);

      expect(scanResult.success).toBe(true);
      expect(scanResult.containerId).toBe(mockContainerId);

      // Step 4: Lookup container by QR code
      mockDocClient.send.mockResolvedValueOnce({
        Items: [{ containerId: mockContainerId }]
      });

      const lookupResult = await qrCodeService.lookupContainerByQRCode(
        mockContainer.qrCode,
        mockUserId,
        mockInventoryId
      );

      expect(lookupResult.containerId).toBe(mockContainerId);
    });

    test('should handle batch QR code generation', async () => {
      const containerIds = ['container-1', 'container-2', 'container-3'];
      const mockContainers = containerIds.map(id => ({
        id,
        name: `Container ${id}`,
        qrCode: `CONT_${id}_1703000000000_batch123`
      }));

      // Mock batch generation
      mockDocClient.send.mockResolvedValueOnce({
        Items: mockContainers
      });

      mockS3Client.send
        .mockResolvedValueOnce({ Location: 'url1' })
        .mockResolvedValueOnce({ Location: 'url2' })
        .mockResolvedValueOnce({ Location: 'url3' });

      const batchResult = await qrCodeService.generateBatchQRCodes(
        containerIds,
        'medium',
        mockUserId,
        mockInventoryId
      );

      expect(batchResult.success).toBe(true);
      expect(batchResult.generated).toBe(3);
      expect(batchResult.qrCodes).toHaveLength(3);
    });
  });

  describe('Report Generation and Export Flow', () => {
    test('should complete report workflow: generate -> customize -> export', async () => {
      const mockLocationId = 'location-123';
      const mockContainers = [
        {
          sk: 'container-1',
          data: {
            name: 'Kitchen Box 1',
            type: 'box',
            status: 'packed',
            handlingFlags: ['fragile'],
            createdAt: '2024-01-01T00:00:00Z'
          }
        },
        {
          sk: 'container-2',
          data: {
            name: 'Kitchen Box 2',
            type: 'box',
            status: 'packed',
            handlingFlags: ['heavy'],
            createdAt: '2024-01-01T00:00:00Z'
          }
        }
      ];

      const mockItems = [
        {
          sk: 'item-1',
          data: {
            name: 'Plates',
            categoryName: 'Kitchen',
            value: '50.00',
            quantity: 8
          }
        },
        {
          sk: 'item-2',
          data: {
            name: 'Pots',
            categoryName: 'Kitchen',
            value: '100.00',
            quantity: 3
          }
        }
      ];

      const mockLocation = [{
        data: {
          name: 'Storage Unit A',
          description: 'Main storage facility'
        }
      }];

      // Mock database queries for report generation
      mockDocClient.send
        .mockResolvedValueOnce({ items: mockContainers }) // containers
        .mockResolvedValueOnce({ items: [mockItems[0]] }) // items for container-1
        .mockResolvedValueOnce({ items: [mockItems[1]] }) // items for container-2
        .mockResolvedValueOnce({ items: mockLocation }); // location

      // Step 1: Generate location report
      const report = await reportService.generateLocationReport(
        mockLocationId,
        mockInventoryId,
        mockUserId,
        {}
      );

      expect(report.location.name).toBe('Storage Unit A');
      expect(report.summary.totalContainers).toBe(2);
      expect(report.summary.totalItems).toBe(2);
      expect(report.summary.totalValue).toBe(150);

      // Step 2: Apply custom template (moving template)
      const movingReport = reportService.generateCustomTemplate(report, 'moving');

      expect(movingReport.containers[0].container.handlingFlags).toEqual(['fragile']);
      expect(movingReport.containers[1].container.handlingFlags).toEqual(['heavy']);

      // Step 3: Export to CSV
      const csvExport = reportService.exportToCSV(report, 'location');

      expect(csvExport).toContain('Container Name,Container Type');
      expect(csvExport).toContain('"Kitchen Box 1","box"');
      expect(csvExport).toContain('"Kitchen Box 2","box"');
      expect(csvExport).toContain('"Plates","Kitchen"');
      expect(csvExport).toContain('"Pots","Kitchen"');

      // Step 4: Export to PDF (mock)
      const pdfExport = reportService.exportToPDF(report, 'location');

      expect(pdfExport).toBeDefined();
      expect(pdfExport.format).toBe('pdf');
    });

    test('should generate project progress report', async () => {
      const mockProjectId = 'project-456';
      const mockProject = {
        id: mockProjectId,
        name: 'Office Move',
        status: 'active',
        startDate: '2024-01-01T00:00:00Z',
        targetDate: '2024-01-15T00:00:00Z'
      };

      const mockProjectContainers = [
        { id: 'container-1', status: 'packed', itemCount: 10 },
        { id: 'container-2', status: 'packing', itemCount: 5 },
        { id: 'container-3', status: 'empty', itemCount: 0 }
      ];

      mockDocClient.send
        .mockResolvedValueOnce({ Item: mockProject })
        .mockResolvedValueOnce({ Items: mockProjectContainers });

      const projectReport = await reportService.generateProjectReport(
        mockProjectId,
        mockUserId,
        mockInventoryId,
        {}
      );

      expect(projectReport.project.name).toBe('Office Move');
      expect(projectReport.summary.totalContainers).toBe(3);
      expect(projectReport.summary.packedContainers).toBe(1);
      expect(projectReport.summary.packingContainers).toBe(1);
      expect(projectReport.summary.emptyContainers).toBe(1);
      expect(projectReport.summary.completionPercentage).toBe(33.33);
    });
  });

  describe('Container Location Management Flow', () => {
    test('should complete bulk container move workflow', async () => {
      const containerIds = ['container-1', 'container-2', 'container-3'];
      const newLocationId = 'new-location-456';
      
      const mockContainers = containerIds.map(id => ({
        id,
        name: `Container ${id}`,
        locationId: 'old-location-123',
        itemCount: 5
      }));

      const mockItems = Array.from({ length: 15 }, (_, i) => ({
        id: `item-${i + 1}`,
        containerId: containerIds[Math.floor(i / 5)],
        locationId: 'old-location-123'
      }));

      // Mock database operations for bulk move
      mockDocClient.send
        .mockResolvedValueOnce({ Items: mockContainers }) // Get containers
        .mockResolvedValueOnce({ Items: mockItems }) // Get all items
        .mockResolvedValueOnce({}) // Update containers
        .mockResolvedValueOnce({}) // Update items
        .mockResolvedValueOnce({}); // Audit log

      const moveResult = await containerService.bulkMoveContainers(
        containerIds,
        newLocationId,
        mockUserId,
        mockInventoryId
      );

      expect(moveResult.success).toBe(true);
      expect(moveResult.containersUpdated).toBe(3);
      expect(moveResult.itemsUpdated).toBe(15);

      // Verify audit trail
      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Item: expect.objectContaining({
              action: 'BULK_CONTAINER_MOVE',
              details: expect.objectContaining({
                containerIds,
                newLocationId,
                containersUpdated: 3,
                itemsUpdated: 15
              })
            })
          })
        })
      );
    });

    test('should handle container move with item synchronization', async () => {
      const mockContainerId = 'container-789';
      const mockContainer = {
        id: mockContainerId,
        name: 'Test Container',
        locationId: 'old-location',
        itemCount: 3
      };

      const mockItems = [
        { id: 'item-1', containerId: mockContainerId, locationId: 'old-location' },
        { id: 'item-2', containerId: mockContainerId, locationId: 'old-location' },
        { id: 'item-3', containerId: mockContainerId, locationId: 'old-location' }
      ];

      mockDocClient.send
        .mockResolvedValueOnce({ Item: mockContainer })
        .mockResolvedValueOnce({ Items: mockItems })
        .mockResolvedValueOnce({}) // Update container
        .mockResolvedValueOnce({}) // Update items
        .mockResolvedValueOnce({}); // Audit log

      const moveResult = await containerService.moveContainer(
        mockContainerId,
        'new-location',
        mockUserId,
        mockInventoryId
      );

      expect(moveResult.success).toBe(true);
      expect(moveResult.itemsUpdated).toBe(3);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle container not found error', async () => {
      mockDocClient.send.mockResolvedValueOnce({ Item: null });

      await expect(
        containerService.getContainer('nonexistent-container', mockUserId, mockInventoryId)
      ).rejects.toThrow('Container not found');
    });

    test('should handle invalid QR code scanning', async () => {
      const invalidQRCodes = [
        'invalid-format',
        'WRONG_prefix_123_abc',
        'CONT_test_future_123', // future timestamp
        'CONT_test_old_123' // very old timestamp
      ];

      invalidQRCodes.forEach(qrCode => {
        const result = qrCodeService.scanQRCode(qrCode);
        expect(result.success).toBe(false);
        expect(result.error).toBe('INVALID_QR_CODE');
      });
    });

    test('should handle packing items already in another container', async () => {
      const mockItems = [
        { id: 'item-1', containerId: 'other-container' },
        { id: 'item-2', containerId: null }
      ];

      mockDocClient.send
        .mockResolvedValueOnce({ Items: mockItems })
        .mockResolvedValueOnce({ Item: { id: 'container-123' } });

      await expect(
        packingService.addItemsToContainer(
          'container-123',
          ['item-1', 'item-2'],
          mockUserId,
          mockInventoryId
        )
      ).rejects.toThrow('already packed');
    });

    test('should handle report generation with no data', async () => {
      mockDocClient.send
        .mockResolvedValueOnce({ items: [] }) // No containers
        .mockResolvedValueOnce({ items: [{ data: { name: 'Empty Location' } }] }); // Location

      const report = await reportService.generateLocationReport(
        'empty-location',
        mockInventoryId,
        mockUserId,
        {}
      );

      expect(report.summary.totalContainers).toBe(0);
      expect(report.summary.totalItems).toBe(0);
      expect(report.summary.totalValue).toBe(0);
      expect(report.containers).toHaveLength(0);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large batch operations efficiently', async () => {
      const largeContainerList = Array.from({ length: 50 }, (_, i) => ({
        id: `container-${i}`,
        name: `Container ${i}`,
        itemCount: 10
      }));

      const startTime = Date.now();

      mockDocClient.send.mockResolvedValue({ Items: largeContainerList });

      const result = await containerService.listContainers(
        mockInventoryId,
        mockUserId,
        { limit: 50 }
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result.containers).toHaveLength(50);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle concurrent packing operations', async () => {
      const mockContainer = { id: 'container-123', itemCount: 0 };
      const mockItems = [
        { id: 'item-1' }, { id: 'item-2' }, { id: 'item-3' }
      ];

      mockDocClient.send
        .mockResolvedValue({ Items: mockItems })
        .mockResolvedValue({ Item: mockContainer })
        .mockResolvedValue({});

      // Simulate concurrent packing operations
      const packingPromises = [
        packingService.addItemsToContainer('container-123', ['item-1'], mockUserId, mockInventoryId),
        packingService.addItemsToContainer('container-123', ['item-2'], mockUserId, mockInventoryId),
        packingService.addItemsToContainer('container-123', ['item-3'], mockUserId, mockInventoryId)
      ];

      const results = await Promise.allSettled(packingPromises);

      // At least one should succeed (optimistic concurrency)
      const successfulOperations = results.filter(r => r.status === 'fulfilled');
      expect(successfulOperations.length).toBeGreaterThan(0);
    });
  });
});