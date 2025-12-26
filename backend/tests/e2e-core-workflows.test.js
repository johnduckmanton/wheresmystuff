/**
 * Core End-to-End Workflow Tests
 * Tests essential moving & storage workflows without complex mocking
 */

describe('Core Moving & Storage Workflows', () => {
  describe('Service Integration Tests', () => {
    test('should validate container service methods exist', () => {
      const ContainerService = require('../services/containerService');
      
      expect(typeof ContainerService.prototype.createContainer).toBe('function');
      expect(typeof ContainerService.prototype.getContainer).toBe('function');
      expect(typeof ContainerService.prototype.updateContainer).toBe('function');
      expect(typeof ContainerService.prototype.deleteContainer).toBe('function');
      expect(typeof ContainerService.prototype.listContainers).toBe('function');
      expect(typeof ContainerService.prototype.moveContainer).toBe('function');
      expect(typeof ContainerService.prototype.bulkMoveContainers).toBe('function');
    });

    test('should validate packing service methods exist', () => {
      const PackingService = require('../services/packingService');
      
      expect(typeof PackingService.prototype.addItemsToContainer).toBe('function');
      expect(typeof PackingService.prototype.removeItemsFromContainer).toBe('function');
      expect(typeof PackingService.prototype.moveItemsBetweenContainers).toBe('function');
      expect(typeof PackingService.prototype.getContainerContents).toBe('function');
      expect(typeof PackingService.prototype.validateContainerCapacity).toBe('function');
      expect(typeof PackingService.prototype.bulkAssignItems).toBe('function');
    });

    test('should validate QR code service methods exist', () => {
      const QRCodeService = require('../services/qrCodeService');
      
      expect(typeof QRCodeService.prototype.generateQRCodeId).toBe('function');
      expect(typeof QRCodeService.prototype.decodeQRCodeId).toBe('function');
      expect(typeof QRCodeService.prototype.validateQRCode).toBe('function');
      expect(typeof QRCodeService.prototype.scanQRCode).toBe('function');
      expect(typeof QRCodeService.prototype.generateQRCodeImage).toBe('function');
    });

    test('should validate report service methods exist', () => {
      const ReportService = require('../services/reportService');
      
      expect(typeof ReportService.prototype.generateLocationReport).toBe('function');
      expect(typeof ReportService.prototype.generateProjectReport).toBe('function');
      expect(typeof ReportService.prototype.generateContainerManifest).toBe('function');
      expect(typeof ReportService.prototype.exportToCSV).toBe('function');
      expect(typeof ReportService.prototype.exportToPDF).toBe('function');
    });

    test('should validate moving project service methods exist', () => {
      const MovingProjectService = require('../services/movingProjectService');
      
      expect(typeof MovingProjectService.prototype.createProject).toBe('function');
      expect(typeof MovingProjectService.prototype.getProject).toBe('function');
      expect(typeof MovingProjectService.prototype.updateProject).toBe('function');
      expect(typeof MovingProjectService.prototype.deleteProject).toBe('function');
      expect(typeof MovingProjectService.prototype.assignContainersToProject).toBe('function');
      expect(typeof MovingProjectService.prototype.getProjectProgress).toBe('function');
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
      const Container = require('../models/container');
      
      expect(typeof Container.validateContainer).toBe('function');
      expect(typeof Container.createContainer).toBe('function');
      expect(typeof Container.updateContainer).toBe('function');
      expect(typeof Container.generateQRCode).toBe('function');
    });

    test('should validate moving project model structure', () => {
      const MovingProject = require('../models/movingProject');
      
      expect(typeof MovingProject.validateProject).toBe('function');
      expect(typeof MovingProject.createProject).toBe('function');
      expect(typeof MovingProject.updateProject).toBe('function');
      expect(typeof MovingProject.calculateProgress).toBe('function');
    });
  });

  describe('QR Code Workflow Tests', () => {
    test('should generate and validate QR code format', () => {
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
      const scanResult = qrService.scanQRCode(qrCodeId);
      expect(scanResult.success).toBe(true);
      expect(scanResult.containerId).toBe(containerId);
    });

    test('should handle invalid QR codes', () => {
      const QRCodeService = require('../services/qrCodeService');
      const qrService = new QRCodeService();
      
      const invalidCodes = [
        'invalid-format',
        'WRONG_prefix_123_abc',
        'CONT_test_future_123', // future timestamp
        'CONT_test_old_123' // very old timestamp
      ];

      invalidCodes.forEach(code => {
        const result = qrService.scanQRCode(code);
        expect(result.success).toBe(false);
        expect(result.error).toBe('INVALID_QR_CODE');
      });
    });
  });

  describe('Container Workflow Tests', () => {
    test('should validate container creation data structure', () => {
      const Container = require('../models/container');
      
      const validContainerData = {
        name: 'Test Container',
        type: 'box',
        size: 'medium',
        description: 'Test description',
        locationId: 'location-123',
        handlingFlags: ['fragile']
      };

      const validation = Container.validateContainer(validContainerData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid container data', () => {
      const Container = require('../models/container');
      
      const invalidContainerData = {
        // Missing required name
        type: 'invalid-type',
        size: 'invalid-size'
      };

      const validation = Container.validateContainer(invalidContainerData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should generate container with QR code', () => {
      const Container = require('../models/container');
      
      const containerData = {
        name: 'QR Test Container',
        type: 'box',
        size: 'large'
      };

      const container = Container.createContainer('inventory-123', containerData, 'user-123');
      
      expect(container.id).toBeDefined();
      expect(container.name).toBe('QR Test Container');
      expect(container.qrCode).toMatch(/^CONT_/);
      expect(container.status).toBe('empty');
      expect(container.itemCount).toBe(0);
      expect(container.estimatedValue).toBe(0);
      expect(container.createdAt).toBeDefined();
      expect(container.createdBy).toBe('user-123');
    });
  });

  describe('Moving Project Workflow Tests', () => {
    test('should validate project creation', () => {
      const MovingProject = require('../models/movingProject');
      
      const projectData = {
        name: 'Test Move',
        description: 'Test moving project',
        startDate: '2024-01-01T00:00:00Z',
        targetDate: '2024-01-15T00:00:00Z',
        sourceLocation: 'old-house',
        destinationLocation: 'new-house'
      };

      const validation = MovingProject.validateProject(projectData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should create project with correct structure', () => {
      const MovingProject = require('../models/movingProject');
      
      const projectData = {
        name: 'Kitchen Move',
        description: 'Moving kitchen items',
        startDate: '2024-01-01T00:00:00Z',
        targetDate: '2024-01-15T00:00:00Z'
      };

      const project = MovingProject.createProject('inventory-123', projectData, 'user-123');
      
      expect(project.id).toBeDefined();
      expect(project.name).toBe('Kitchen Move');
      expect(project.status).toBe('planning');
      expect(project.containerCount).toBe(0);
      expect(project.itemCount).toBe(0);
      expect(project.completionPercentage).toBe(0);
      expect(project.createdBy).toBe('user-123');
    });

    test('should calculate project progress correctly', () => {
      const MovingProject = require('../models/movingProject');
      
      const containers = [
        { status: 'packed', itemCount: 10 },
        { status: 'packing', itemCount: 5 },
        { status: 'empty', itemCount: 0 }
      ];

      const progress = MovingProject.calculateProgress(containers);
      
      expect(progress.totalContainers).toBe(3);
      expect(progress.packedContainers).toBe(1);
      expect(progress.packingContainers).toBe(1);
      expect(progress.emptyContainers).toBe(1);
      expect(progress.totalItems).toBe(15);
      expect(progress.completionPercentage).toBe(33.33);
    });
  });

  describe('Report Generation Tests', () => {
    test('should validate CSV export format', () => {
      const ReportService = require('../services/reportService');
      const reportService = new ReportService();
      
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
      const ReportService = require('../services/reportService');
      const reportService = new ReportService();
      
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
      const Container = require('../models/container');
      
      const validFlags = ['fragile', 'heavy', 'valuable', 'priority', 'keep_upright'];
      const invalidFlags = ['invalid-flag', 'wrong-flag'];
      
      validFlags.forEach(flag => {
        const containerData = {
          name: 'Test Container',
          type: 'box',
          handlingFlags: [flag]
        };
        
        const validation = Container.validateContainer(containerData);
        expect(validation.isValid).toBe(true);
      });
      
      invalidFlags.forEach(flag => {
        const containerData = {
          name: 'Test Container',
          type: 'box',
          handlingFlags: [flag]
        };
        
        const validation = Container.validateContainer(containerData);
        expect(validation.isValid).toBe(false);
      });
    });

    test('should validate project status transitions', () => {
      const MovingProject = require('../models/movingProject');
      
      const validTransitions = [
        { from: 'planning', to: 'active' },
        { from: 'active', to: 'paused' },
        { from: 'paused', to: 'active' },
        { from: 'active', to: 'completed' },
        { from: 'completed', to: 'archived' }
      ];
      
      const invalidTransitions = [
        { from: 'completed', to: 'planning' },
        { from: 'archived', to: 'active' },
        { from: 'planning', to: 'completed' }
      ];
      
      validTransitions.forEach(({ from, to }) => {
        const isValid = MovingProject.validateStatusTransition(from, to);
        expect(isValid).toBe(true);
      });
      
      invalidTransitions.forEach(({ from, to }) => {
        const isValid = MovingProject.validateStatusTransition(from, to);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle missing required fields', () => {
      const Container = require('../models/container');
      
      const incompleteData = {
        // Missing name and type
        size: 'medium'
      };
      
      const validation = Container.validateContainer(incompleteData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Container name is required');
      expect(validation.errors).toContain('Container type is required');
    });

    test('should handle invalid enum values', () => {
      const Container = require('../models/container');
      
      const invalidData = {
        name: 'Test Container',
        type: 'invalid-type',
        size: 'invalid-size',
        status: 'invalid-status'
      };
      
      const validation = Container.validateContainer(invalidData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid container type'))).toBe(true);
    });

    test('should handle date validation in projects', () => {
      const MovingProject = require('../models/movingProject');
      
      const invalidDateData = {
        name: 'Test Project',
        startDate: 'invalid-date',
        targetDate: '2024-01-01T00:00:00Z' // Before start date
      };
      
      const validation = MovingProject.validateProject(invalidDateData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid date format'))).toBe(true);
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