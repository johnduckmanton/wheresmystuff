// Mock dependencies first
jest.mock('../services/dynamodb');
jest.mock('../services/auditLogService');

const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockSend
    }))
  },
  QueryCommand: jest.fn(),
  ScanCommand: jest.fn()
}));

const analyticsService = require('../services/analyticsService');
const { hasInventoryAccess } = require('../services/dynamodb');

describe('Analytics Service', () => {
  const mockInventoryId = 'test-inventory-id';
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
    hasInventoryAccess.mockResolvedValue(true);
    mockSend.mockClear();
  });

  describe('getPackingMetrics', () => {
    it('should calculate basic packing metrics', async () => {
      // Mock DynamoDB response
      const mockContainers = [
        {
          sk: 'container-1',
          type: 'box',
          status: 'packed',
          itemCount: 10,
          estimatedValue: 100,
          createdAt: '2024-01-01T00:00:00Z'
        },
        {
          sk: 'container-2',
          type: 'bag',
          status: 'empty',
          itemCount: 0,
          estimatedValue: 0,
          createdAt: '2024-01-02T00:00:00Z'
        }
      ];

      // Mock DynamoDB response
      mockSend.mockResolvedValue({
        Items: mockContainers
      });

      const result = await analyticsService.getPackingMetrics(mockInventoryId, mockUserId);

      expect(result).toHaveProperty('metrics');
      expect(result.metrics.totalContainers).toBe(2);
      expect(result.metrics.totalItems).toBe(10);
      expect(result.metrics.totalValue).toBe(100);
      expect(result.metrics.avgItemsPerContainer).toBe(5);
      expect(result.metrics.avgValuePerContainer).toBe(50);
    });

    it('should reject access for unauthorized users', async () => {
      hasInventoryAccess.mockResolvedValue(false);

      await expect(
        analyticsService.getPackingMetrics(mockInventoryId, mockUserId)
      ).rejects.toThrow('Access denied to inventory');
    });
  });

  describe('getContainerUtilization', () => {
    it('should calculate container utilization metrics', async () => {
      const mockContainers = [
        { itemCount: 0 }, // empty
        { itemCount: 3 }, // lightly packed
        { itemCount: 15 }, // well packed
        { itemCount: 25 } // over packed
      ];

      // Mock DynamoDB response
      mockSend.mockResolvedValue({
        Items: mockContainers
      });

      const result = await analyticsService.getContainerUtilization(mockInventoryId, mockUserId);

      expect(result).toHaveProperty('utilization');
      expect(result.utilization.emptyContainers).toBe(1);
      expect(result.utilization.lightlyPacked).toBe(1);
      expect(result.utilization.wellPacked).toBe(1);
      expect(result.utilization.overPacked).toBe(1);
      expect(result.utilization.totalContainers).toBe(4);
    });
  });

  describe('getMovingProgress', () => {
    it('should calculate moving progress metrics', async () => {
      const mockContainers = [
        { 
          itemCount: 5, 
          status: 'packed',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        },
        { 
          itemCount: 0, 
          status: 'empty',
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z'
        }
      ];

      const mockItems = [
        { containerId: 'container-1' },
        { containerId: 'container-1' },
        { containerId: 'container-1' },
        { containerId: 'container-1' },
        { containerId: 'container-1' },
        { containerId: null },
        { containerId: null }
      ];

      // Mock DynamoDB responses
      mockSend
        .mockResolvedValueOnce({ Items: mockContainers }) // containers query
        .mockResolvedValueOnce({ Items: mockItems }); // items query

      const result = await analyticsService.getMovingProgress(mockInventoryId, mockUserId);

      expect(result).toHaveProperty('progress');
      expect(result.progress.totalItems).toBe(7);
      expect(result.progress.packedItems).toBe(5);
      expect(result.progress.unpackedItems).toBe(2);
      expect(result.progress.completionPercentage).toBe(71); // 5/7 * 100 rounded
    });
  });

  describe('getStorageCosts', () => {
    it('should calculate storage costs for containers in storage', async () => {
      const mockStorageContainers = [
        {
          sk: 'container-1',
          name: 'Storage Box 1',
          storageStartDate: '2024-01-01T00:00:00Z',
          storageRate: 10
        },
        {
          sk: 'container-2',
          name: 'Storage Box 2',
          storageStartDate: '2024-01-15T00:00:00Z',
          storageRate: 15
        }
      ];

      // Mock DynamoDB response
      mockSend.mockResolvedValue({
        Items: mockStorageContainers
      });

      const result = await analyticsService.getStorageCosts(mockInventoryId, mockUserId);

      expect(result).toHaveProperty('costs');
      expect(result.costs.totalContainers).toBe(2);
      expect(result.costs.totalMonthlyCost).toBe(25);
      expect(result).toHaveProperty('projections');
      expect(result.projections.nextMonth).toBe(25);
      expect(result.projections.nextYear).toBe(300);
    });
  });

  describe('getRecommendations', () => {
    it('should generate recommendations based on analytics data', async () => {
      // Mock the analytics methods to return data that would trigger recommendations
      const mockPackingMetrics = {
        metrics: {
          totalContainers: 10,
          totalItems: 20,
          totalValue: 500,
          avgItemsPerContainer: 2, // Low average - should trigger recommendation
          avgValuePerContainer: 50,
          statusBreakdown: { packed: 8, empty: 2 },
          typeBreakdown: { box: 10 },
          packingVelocity: { containersPerDay: 1.5, trend: 'decreasing' }
        },
        timeline: []
      };

      const mockUtilization = {
        utilization: {
          emptyContainers: 3, // Should trigger recommendation
          lightlyPacked: 5,
          wellPacked: 2,
          overPacked: 0,
          utilizationScore: 45,
          totalContainers: 10
        },
        efficiency: {
          efficiency: 60,
          wastedSpace: 2,
          optimalContainers: 8,
          actualContainers: 10,
          recommendations: ['Consider consolidating items']
        }
      };

      const mockProgress = {
        progress: {
          totalItems: 20,
          packedItems: 8,
          unpackedItems: 12,
          totalContainers: 10,
          packedContainers: 5,
          emptyContainers: 5,
          completionPercentage: 40,
          containersByStatus: { packed: 5, empty: 5 },
          packingRate: 40
        },
        completionTimeline: []
      };

      // Mock the individual analytics methods
      jest.spyOn(analyticsService, 'getPackingMetrics').mockResolvedValue(mockPackingMetrics);
      jest.spyOn(analyticsService, 'getContainerUtilization').mockResolvedValue(mockUtilization);
      jest.spyOn(analyticsService, 'getMovingProgress').mockResolvedValue(mockProgress);

      const result = await analyticsService.getRecommendations(mockInventoryId, mockUserId);

      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);

      // Should have recommendations for low container utilization and empty containers
      const recommendationTypes = result.recommendations.map(r => r.type);
      expect(recommendationTypes).toContain('efficiency');
      expect(recommendationTypes).toContain('utilization');
    });
  });
});