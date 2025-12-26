// Mock the dependencies before requiring the service
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('../services/dynamodb');
jest.mock('../services/auditLogService');
jest.mock('../services/cacheService');
jest.mock('../services/databaseOptimizationService');

const mockDocClient = {
  send: jest.fn()
};

// Mock the modules
require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient = {
  from: jest.fn(() => mockDocClient)
};

const mockHasInventoryAccess = jest.fn();
const mockLogDataAccess = jest.fn();
const mockOptimizedQuery = jest.fn();
const mockGetCachedReportResult = jest.fn();
const mockCacheReportResult = jest.fn();

require('../services/dynamodb').hasInventoryAccess = mockHasInventoryAccess;
require('../services/auditLogService').logDataAccess = mockLogDataAccess;
require('../services/databaseOptimizationService').optimizedQuery = mockOptimizedQuery;
require('../services/cacheService').getCachedReportResult = mockGetCachedReportResult;
require('../services/cacheService').cacheReportResult = mockCacheReportResult;

// Now require the service after mocking
const reportService = require('../services/reportService');

describe('ReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasInventoryAccess.mockResolvedValue(true);
    mockGetCachedReportResult.mockResolvedValue(null); // No cache by default
    mockLogDataAccess.mockResolvedValue(undefined);
  });

  describe('generateLocationReport', () => {
    it('should generate a basic location report', async () => {
      // Mock container data
      const mockContainers = [
        {
          sk: 'container-1',
          data: {
            name: 'Kitchen Box 1',
            type: 'box',
            status: 'packed',
            createdAt: '2024-01-01T00:00:00Z',
            handlingFlags: ['fragile']
          }
        }
      ];

      // Mock items data
      const mockItems = [
        {
          sk: 'item-1',
          data: {
            name: 'Plates',
            categoryName: 'Kitchen',
            value: '50.00',
            quantity: 8
          }
        }
      ];

      // Mock location data
      const mockLocation = [
        {
          data: {
            name: 'Storage Unit A',
            description: 'Main storage facility'
          }
        }
      ];

      // Setup mock responses
      mockOptimizedQuery
        .mockResolvedValueOnce({ items: mockContainers }) // containers query
        .mockResolvedValueOnce({ items: mockItems }) // items query for container-1
        .mockResolvedValueOnce({ items: mockLocation }); // location query

      const result = await reportService.generateLocationReport(
        'location-1',
        'inventory-1',
        'user-1',
        {}
      );

      expect(result).toBeDefined();
      expect(result.location.name).toBe('Storage Unit A');
      expect(result.summary.totalContainers).toBe(1);
      expect(result.summary.totalItems).toBe(1);
      expect(result.summary.totalValue).toBe(50);
      expect(result.containers).toHaveLength(1);
      expect(result.containers[0].container.name).toBe('Kitchen Box 1');
      expect(result.containers[0].items).toHaveLength(1);
      expect(result.containers[0].items[0].name).toBe('Plates');
    });

    it('should apply container type filter', async () => {
      const mockContainers = [
        {
          sk: 'container-1',
          data: { name: 'Box 1', type: 'box', status: 'packed', createdAt: '2024-01-01T00:00:00Z' }
        },
        {
          sk: 'container-2',
          data: { name: 'Bag 1', type: 'bag', status: 'packed', createdAt: '2024-01-01T00:00:00Z' }
        }
      ];

      // Mock optimized query calls
      mockOptimizedQuery
        .mockResolvedValueOnce({ items: mockContainers }) // containers query
        .mockResolvedValueOnce({ items: [] }) // items for container-1
        .mockResolvedValueOnce({ items: [{ data: { name: 'Test Location' } }] }); // location

      const result = await reportService.generateLocationReport(
        'location-1',
        'inventory-1',
        'user-1',
        { containerTypeFilter: 'box' }
      );

      expect(result.summary.totalContainers).toBe(1);
      expect(result.containers[0].container.name).toBe('Box 1');
    });

    it('should handle access denied error', async () => {
      mockHasInventoryAccess.mockResolvedValue(false);

      await expect(
        reportService.generateLocationReport('location-1', 'inventory-1', 'user-1', {})
      ).rejects.toThrow('Access denied to inventory');
    });
  });

  describe('exportToCSV', () => {
    it('should export location report to CSV format', () => {
      const mockReportData = {
        containers: [
          {
            container: {
              name: 'Kitchen Box 1',
              type: 'box',
              status: 'packed'
            },
            itemCount: 2,
            estimatedValue: 100.50,
            items: [
              {
                name: 'Plates',
                categoryName: 'Kitchen',
                value: '50.00',
                quantity: 8
              },
              {
                name: 'Cups',
                categoryName: 'Kitchen',
                value: '50.50',
                quantity: 6
              }
            ]
          }
        ]
      };

      const csvResult = reportService.exportToCSV(mockReportData, 'location');

      expect(csvResult).toContain('Container Name,Container Type,Container Status');
      expect(csvResult).toContain('"Kitchen Box 1","box","packed"');
      expect(csvResult).toContain('"Plates","Kitchen"');
      expect(csvResult).toContain('"Cups","Kitchen"');
    });

    it('should handle empty containers in CSV export', () => {
      const mockReportData = {
        containers: [
          {
            container: {
              name: 'Empty Box',
              type: 'box',
              status: 'empty'
            },
            itemCount: 0,
            estimatedValue: 0,
            items: []
          }
        ]
      };

      const csvResult = reportService.exportToCSV(mockReportData, 'location');

      expect(csvResult).toContain('"Empty Box","box","empty"');
      expect(csvResult).toContain('0,0.00');
    });
  });

  describe('generateCustomTemplate', () => {
    it('should generate summary template', () => {
      const mockReportData = {
        location: { name: 'Test Location' },
        summary: { totalContainers: 1 },
        containers: [
          {
            container: {
              name: 'Test Container',
              type: 'box',
              status: 'packed',
              handlingFlags: ['fragile']
            },
            itemCount: 5,
            estimatedValue: 100,
            items: [{ name: 'Test Item' }]
          }
        ]
      };

      const result = reportService.generateCustomTemplate(mockReportData, 'summary');

      expect(result.containers[0].container.handlingFlags).toBeUndefined();
      expect(result.containers[0].items).toBeUndefined();
      expect(result.containers[0].itemCount).toBe(5);
      expect(result.containers[0].estimatedValue).toBe(100);
    });

    it('should generate moving template', () => {
      const mockReportData = {
        location: { name: 'Test Location' },
        summary: { totalContainers: 1 },
        containers: [
          {
            container: {
              name: 'Test Container',
              type: 'box',
              status: 'packed',
              qrCode: 'QR123',
              handlingFlags: ['fragile']
            },
            itemCount: 5,
            estimatedValue: 100
          }
        ]
      };

      const result = reportService.generateCustomTemplate(mockReportData, 'moving');

      expect(result.containers[0].container.qrCode).toBe('QR123');
      expect(result.containers[0].container.handlingFlags).toEqual(['fragile']);
      expect(result.containers[0].packingStatus).toBe('Packed');
    });
  });
});