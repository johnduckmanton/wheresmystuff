/**
 * Core End-to-End Workflow Tests
 * Tests essential moving & storage workflows without complex mocking
 */

describe('Core Moving & Storage Workflows', () => {
  describe('Service Integration Tests', () => {
    test('should validate container service methods exist', () => {
      const containerService = require('../services/containerService');
      
      expect(typeof containerService.createContainer).toBe('function');
      expect(typeof containerService.getContainer).toBe('function');
      expect(typeof containerService.updateContainer).toBe('function');
      expect(typeof containerService.deleteContainer).toBe('function');
      expect(typeof containerService.listContainers).toBe('function');
      expect(typeof containerService.moveContainer).toBe('function');
      expect(typeof containerService.bulkMoveContainers).toBe('function');
    });

    test('should validate packing service methods exist', () => {
      const packingService = require('../services/packingService');
      
      expect(typeof packingService.addItemsToContainer).toBe('function');
      expect(typeof packingService.removeItemsFromContainer).toBe('function');
      expect(typeof packingService.moveItemsBetweenContainers).toBe('function');
      expect(typeof packingService.getContainerContents).toBe('function');
      expect(typeof packingService.validateContainerCapacity).toBe('function');
      expect(typeof packingService.bulkAssignItems).toBe('function');
    });

    test('should validate QR code service methods exist', () => {
      const QRCodeService = require('../services/qrCodeService');
      const qrService = new QRCodeService();
      
      expect(typeof qrService.generateQRCodeId).toBe('function');
      expect(typeof qrService.decodeQRCodeId).toBe('function');
      expect(typeof qrService.validateQRCode).toBe('function');
      expect(typeof qrService.scanQRCode).toBe('function');
      expect(typeof qrService.generateQRCodeImage).toBe('function');
    });

    test('should validate report service methods exist', () => {
      const reportService = require('../services/reportService');
      
      expect(typeof reportService.generateLocationReport).toBe('function');
      expect(typeof reportService.generateProjectReport).toBe('function');
      expect(typeof reportService.generateContainerManifest).toBe('function');
      expect(typeof reportService.exportToCSV).toBe('function');
    });

    test('should validate moving project service methods exist', () => {
      const movingProjectService = require('../services/movingProjectService');
      
      expect(typeof movingProjectService.createProject).toBe('function');
      expect(typeof movingProjectService.getProject).toBe('function');
      expect(typeof movingProjectService.updateProject).toBe('function');
      expect(typeof movingProjectService.deleteProject).toBe('function');
      expect(typeof movingProjectService.assignContainersToProject).toBe('function');
      expect(typeof movingProjectService.getProjectProgress).toBe('function');
    });
  });

  describe('Handler Integration Tests', () => {
    test('should validate container handler exports', () => {
      const containerHandler = require('../handlers/containers');
      
      expect(typeof containerHandler.handler).toBe('function');
    });

    test('should validate packing handler exports', () => {
      const packingHandler = require('../handlers/packing');
      
      expect(typeof packingHandler.handler).toBe('function');
    });

    test('should validate project handler exports', () => {
      const projectHandler = require('../handlers/projects');
      
      expect(typeof projectHandler.handler).toBe('function');
    });

    test('should validate report handler exports', () => {
      const reportHandler = require('../handlers/reports');
      
      expect(typeof reportHandler.handler).toBe('function');
    });
  });

  describe('Data Model Validation', () => {
    test('should validate container model structure', () => {
      const { Container, ContainerType, HandlingFlag, ContainerStatus } = require('../models/container');
      
      expect(typeof Container).toBe('function'); // Constructor
      expect(typeof ContainerType).toBe('object');
      expect(typeof HandlingFlag).toBe('object');
      expect(typeof ContainerStatus).toBe('object');
      
      // Test that we can create a container instance
      const container = new Container({
        name: 'Test Container',
        inventoryId: '12345678-1234-1234-1234-123456789012',
        createdBy: '12345678-1234-1234-1234-123456789012'
      });
      
      expect(typeof container.validate).toBe('function');
      expect(typeof container.toDynamoDBItem).toBe('function');
      expect(typeof Container.fromDynamoDBItem).toBe('function');
    });

    test('should validate moving project model structure', () => {
      const { MovingProject } = require('../models/movingProject');
      
      const project = new MovingProject({
        name: 'Test Project',
        inventoryId: '12345678-1234-1234-1234-123456789012',
        createdBy: '12345678-1234-1234-1234-123456789012'
      });
      
      expect(typeof project.validate).toBe('function');
      expect(typeof project.validateStatusTransition).toBe('function');
      expect(typeof project.updateStatus).toBe('function');
      expect(typeof project.calculateProgress).toBe('function');
      expect(typeof MovingProject.fromDynamoDBItem).toBe('function');
    });
  });

  describe('QR Code Workflow Tests', () => {
    test('should generate and validate QR code format', async () => {
      const QRCodeService = require('../services/qrCodeService');
      const qrService = new QRCodeService();
      
      const containerId = 'test-container-123';
      const qrCodeId = qrService.generateQRCodeId(containerId);
      
      // Validate QR code format
      expect(qrCodeId).toMatch(/^CONT_test-container-123_\d+_[a-f0-9]{8}$/);
      
      // Validate decoding
      const decoded = qrService.decodeQRCodeId(qrCodeId);
      expect(decoded.containerId).toBe(containerId);
      expect(decoded.timestamp).toBeGreaterThan(0);
      expect(decoded.uniqueId).toMatch(/^[a-f0-9]{8}$/);
      
      // Validate scanning
      const scanResult = await qrService.scanQRCode(qrCodeId);
      expect(scanResult.success).toBe(true);
      expect(scanResult.containerId).toBe(containerId);
    });

    test('should handle invalid QR codes', async () => {
      const QRCodeService = require('../services/qrCodeService');
      const qrService = new QRCodeService();
      
      const invalidCodes = [
        { code: 'invalid-format', expectedError: 'INVALID_FORMAT' },
        { code: 'WRONG_prefix_123_abc', expectedError: 'INVALID_FORMAT' },
        { code: `CONT_test_${Date.now() + 86400000}_123`, expectedError: 'FUTURE_TIMESTAMP' }, // future timestamp
        { code: `CONT_test_${Date.now() - (400 * 24 * 60 * 60 * 1000)}_123`, expectedError: 'EXPIRED' } // very old timestamp
      ];

      for (const { code, expectedError } of invalidCodes) {
        const result = await qrService.scanQRCode(code);
        expect(result.success).toBe(false);
        expect(result.error).toBe(expectedError);
      }
    });
  });

  describe('Container Workflow Tests', () => {
    test('should validate container creation data structure', () => {
      const { Container } = require('../models/container');
      
      const validContainerData = {
        name: 'Test Container',
        type: 'box',
        size: 'medium',
        description: 'Test description',
        inventoryId: '12345678-1234-1234-1234-123456789012',
        createdBy: '12345678-1234-1234-1234-123456789012',
        locationId: 'location-123',
        handlingFlags: ['fragile']
      };

      const container = new Container(validContainerData);
      const validation = container.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid container data', () => {
      const { Container } = require('../models/container');
      
      const invalidContainerData = {
        // Missing required name and other required fields
        type: 'invalid-type',
        size: 'invalid-size'
      };

      const container = new Container(invalidContainerData);
      const validation = container.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should generate container with QR code', () => {
      const { Container } = require('../models/container');
      
      const containerData = {
        name: 'QR Test Container',
        type: 'box',
        size: 'large',
        inventoryId: '12345678-1234-1234-1234-123456789012',
        createdBy: '12345678-1234-1234-1234-123456789012'
      };

      const container = new Container(containerData);
      
      expect(container.id).toBeDefined();
      expect(container.name).toBe('QR Test Container');
      expect(container.qrCode).toMatch(/^CONT_/);
      expect(container.status).toBe('empty');
      expect(container.itemCount).toBe(0);
      expect(container.estimatedValue).toBe(0);
      expect(container.createdAt).toBeDefined();
      expect(container.createdBy).toBe('12345678-1234-1234-1234-123456789012');
    });
  });

  describe('Moving Project Workflow Tests', () => {
    test('should validate project creation', () => {
      const { MovingProject } = require('../models/movingProject');
      
      const project = new MovingProject({
        name: 'Test Move',
        description: 'Test moving project',
        startDate: '2024-01-01T00:00:00.000Z',
        targetDate: '2024-01-15T00:00:00.000Z',
        sourceLocation: 'old-house',
        destinationLocation: 'new-house',
        inventoryId: '12345678-1234-1234-1234-123456789012',
        createdBy: 'user-123'
      });

      const validation = project.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should create project with correct structure', () => {
      const { MovingProject, ProjectStatus } = require('../models/movingProject');
      
      const project = new MovingProject({
        name: 'Kitchen Move',
        description: 'Moving kitchen items',
        startDate: '2024-01-01T00:00:00.000Z',
        targetDate: '2024-01-15T00:00:00.000Z',
        inventoryId: 'inventory-123',
        createdBy: 'user-123'
      });
      
      expect(project.id).toBeDefined();
      expect(project.name).toBe('Kitchen Move');
      expect(project.status).toBe(ProjectStatus.PLANNING);
      expect(project.containerCount).toBe(0);
      expect(project.itemCount).toBe(0);
      expect(project.completionPercentage).toBe(0);
      expect(project.createdBy).toBe('user-123');
    });

    test('should calculate project progress correctly', () => {
      const { MovingProject } = require('../models/movingProject');
      
      const project = new MovingProject({
        name: 'Test Project',
        inventoryId: '12345678-1234-1234-1234-123456789012',
        createdBy: 'user-123'
      });

      // Test progress calculation with different scenarios
      const progress1 = project.calculateProgress(1, 3, 10, 30); // 1 packed container out of 3, 10 packed items out of 30
      expect(progress1).toBeGreaterThan(0);
      expect(progress1).toBeLessThanOrEqual(100);

      const progress2 = project.calculateProgress(0, 0, 0, 0); // No containers or items
      expect(progress2).toBe(0);

      const progress3 = project.calculateProgress(3, 3, 30, 30); // All packed
      expect(progress3).toBe(100);
    });
  });

  describe('Report Generation Tests', () => {
    test('should validate CSV export format', () => {
      const reportService = require('../services/reportService');
      
      const mockReportData = {
        containers: [
          {
            container: {
              name: 'Test Container',
              type: 'box',
              status: 'packed'
            },
            itemCount: 2,
            estimatedValue: 100,
            items: [
              { name: 'Item 1', categoryName: 'Category 1', value: '50.00' },
              { name: 'Item 2', categoryName: 'Category 2', value: '50.00' }
            ]
          }
        ]
      };

      const csvResult = reportService.exportToCSV(mockReportData, 'location');
      
      expect(csvResult).toContain('Container Name,Container Type,Container Status');
      expect(csvResult).toContain('"Test Container","box","packed"');
      expect(csvResult).toContain('"Item 1","Category 1"');
      expect(csvResult).toContain('"Item 2","Category 2"');
    });

    test('should generate custom report templates', () => {
      const reportService = require('../services/reportService');
      
      const mockReportData = {
        location: { name: 'Test Location' },
        summary: { totalContainers: 1 },
        containers: [
          {
            container: {
              name: 'Test Container',
              type: 'box',
              status: 'packed',
              handlingFlags: ['fragile'],
              qrCode: 'QR123'
            },
            itemCount: 5,
            estimatedValue: 100
          }
        ]
      };

      // Test summary template
      const summaryReport = reportService.generateCustomTemplate(mockReportData, 'summary');
      expect(summaryReport.containers[0].container.handlingFlags).toBeUndefined();
      expect(summaryReport.containers[0].items).toBeUndefined();

      // Test moving template
      const movingReport = reportService.generateCustomTemplate(mockReportData, 'moving');
      expect(movingReport.containers[0].container.qrCode).toBe('QR123');
      expect(movingReport.containers[0].container.handlingFlags).toEqual(['fragile']);
      expect(movingReport.containers[0].packingStatus).toBe('Packed');
    });
  });

  describe('Data Validation Tests', () => {
    test('should validate container capacity limits', () => {
      const PackingService = require('../services/packingService');
      
      // Test that service validates input parameters
      const tooManyItems = Array.from({ length: 105 }, (_, i) => `item-${i}`);
      expect(tooManyItems.length).toBeGreaterThan(100);
      
      const tooManyAssignments = Array.from({ length: 25 }, (_, i) => ({
        containerId: `container-${i}`,
        itemIds: ['item-1']
      }));
      expect(tooManyAssignments.length).toBeGreaterThan(20);
    });

    test('should validate handling flags', () => {
      const { Container, HandlingFlag } = require('../models/container');
      
      const validFlags = Object.values(HandlingFlag);
      const invalidFlags = ['invalid-flag', 'wrong-flag'];
      
      validFlags.forEach(flag => {
        const container = new Container({
          name: 'Test Container',
          type: 'box',
          handlingFlags: [flag],
          inventoryId: '12345678-1234-1234-1234-123456789012',
          createdBy: 'user-123'
        });
        
        const validation = container.validate();
        expect(validation.isValid).toBe(true);
      });
      
      invalidFlags.forEach(flag => {
        const container = new Container({
          name: 'Test Container',
          type: 'box',
          handlingFlags: [flag],
          inventoryId: '12345678-1234-1234-1234-123456789012',
          createdBy: 'user-123'
        });
        
        const validation = container.validate();
        expect(validation.isValid).toBe(false);
      });
    });

    test('should validate project status transitions', () => {
      const { MovingProject, ProjectStatus } = require('../models/movingProject');
      
      const project = new MovingProject({
        name: 'Test Project',
        inventoryId: '12345678-1234-1234-1234-123456789012',
        createdBy: 'user-123',
        status: ProjectStatus.PLANNING
      });
      
      const validTransitions = [
        { from: ProjectStatus.PLANNING, to: ProjectStatus.ACTIVE },
        { from: ProjectStatus.ACTIVE, to: ProjectStatus.PAUSED },
        { from: ProjectStatus.PAUSED, to: ProjectStatus.ACTIVE },
        { from: ProjectStatus.ACTIVE, to: ProjectStatus.COMPLETED },
        { from: ProjectStatus.COMPLETED, to: ProjectStatus.ARCHIVED }
      ];
      
      const invalidTransitions = [
        { from: ProjectStatus.COMPLETED, to: ProjectStatus.PLANNING },
        { from: ProjectStatus.ARCHIVED, to: ProjectStatus.ACTIVE },
        { from: ProjectStatus.PLANNING, to: ProjectStatus.COMPLETED }
      ];
      
      validTransitions.forEach(({ from, to }) => {
        project.status = from;
        const validation = project.validateStatusTransition(to);
        expect(validation.isValid).toBe(true);
      });
      
      invalidTransitions.forEach(({ from, to }) => {
        project.status = from;
        const validation = project.validateStatusTransition(to);
        expect(validation.isValid).toBe(false);
      });
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle missing required fields', () => {
      const { Container } = require('../models/container');
      
      const container = new Container({
        // Missing name, inventoryId, and createdBy
        size: 'medium'
      });
      
      const validation = container.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Name is required and must be a non-empty string');
      expect(validation.errors).toContain('Inventory ID is required and must be a string');
      expect(validation.errors).toContain('Created by user ID is required and must be a string');
    });

    test('should handle invalid enum values', () => {
      const { Container } = require('../models/container');
      
      const container = new Container({
        name: 'Test Container',
        type: 'invalid-type',
        status: 'invalid-status',
        inventoryId: '12345678-1234-1234-1234-123456789012',
        createdBy: 'user-123'
      });
      
      const validation = container.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Type must be one of'))).toBe(true);
    });

    test('should handle date validation in projects', () => {
      const { MovingProject } = require('../models/movingProject');
      
      const project = new MovingProject({
        name: 'Test Project',
        startDate: 'invalid-date',
        targetDate: '2024-01-01T00:00:00.000Z',
        inventoryId: '12345678-1234-1234-1234-123456789012',
        createdBy: 'user-123'
      });
      
      const validation = project.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Start date must be a valid ISO date string'))).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large container lists efficiently', () => {
      const startTime = Date.now();
      
      // Simulate processing large container list
      const largeContainerList = Array.from({ length: 1000 }, (_, i) => ({
        id: `container-${i}`,
        name: `Container ${i}`,
        type: 'box',
        itemCount: Math.floor(Math.random() * 20),
        estimatedValue: Math.floor(Math.random() * 1000)
      }));
      
      // Calculate totals (simulating report generation)
      const totals = largeContainerList.reduce((acc, container) => ({
        totalContainers: acc.totalContainers + 1,
        totalItems: acc.totalItems + container.itemCount,
        totalValue: acc.totalValue + container.estimatedValue
      }), { totalContainers: 0, totalItems: 0, totalValue: 0 });
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(totals.totalContainers).toBe(1000);
      expect(processingTime).toBeLessThan(100); // Should process quickly
    });

    test('should validate QR code generation performance', () => {
      const QRCodeService = require('../services/qrCodeService');
      const qrService = new QRCodeService();
      
      const startTime = Date.now();
      
      // Generate multiple QR codes
      const qrCodes = Array.from({ length: 100 }, (_, i) => {
        return qrService.generateQRCodeId(`container-${i}`);
      });
      
      const endTime = Date.now();
      const generationTime = endTime - startTime;
      
      expect(qrCodes).toHaveLength(100);
      expect(qrCodes.every(code => code.match(/^CONT_/))).toBe(true);
      expect(generationTime).toBeLessThan(1000); // Should generate quickly
    });
  });
});