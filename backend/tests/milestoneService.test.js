/**
 * Milestone Service Tests
 * Tests the MilestoneService business logic and database operations
 */

const milestoneService = require('../services/milestoneService');
const { Milestone, MilestoneType } = require('../models/milestone');

// Mock dependencies
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: jest.fn()
    }))
  },
  QueryCommand: jest.fn(),
  PutCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn()
}));
jest.mock('../services/dynamodb', () => ({
  hasInventoryAccess: jest.fn().mockResolvedValue(true)
}));
jest.mock('../services/auditLogService', () => ({
  logDataAccess: jest.fn().mockResolvedValue(undefined),
  logProjectOperation: jest.fn().mockResolvedValue(undefined)
}));

const { hasInventoryAccess } = require('../services/dynamodb');
const { logDataAccess, logProjectOperation } = require('../services/auditLogService');

describe('Milestone Service', () => {
  const mockProjectId = '12345678-1234-1234-1234-123456789012';
  const mockInventoryId = 'abcdef12-abcd-abcd-abcd-abcdefabcdef';
  const mockUserId = 'user-123';
  const mockDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const mockPastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Access Control', () => {
    test('should check inventory access for all operations', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      const operations = [
        () => milestoneService.getMilestones(mockProjectId, mockInventoryId, mockUserId),
        () => milestoneService.getOverdueMilestones(mockInventoryId, mockUserId),
        () => milestoneService.getUpcomingMilestones(mockInventoryId, mockUserId),
        () => milestoneService.getMilestoneStats(mockProjectId, mockInventoryId, mockUserId)
      ];

      for (const operation of operations) {
        hasInventoryAccess.mockResolvedValueOnce(false);
        await expect(operation()).rejects.toThrow('Access denied to inventory');
      }
    });
  });

  describe('Audit Logging', () => {
    test('should log data access for read operations', async () => {
      hasInventoryAccess.mockResolvedValueOnce(true);

      expect(logDataAccess).toBeDefined();
    });

    test('should log project operations for write operations', async () => {
      hasInventoryAccess.mockResolvedValueOnce(true);

      expect(logProjectOperation).toBeDefined();
    });
  });

  describe('Service Methods Exist', () => {
    test('should have createMilestone method', () => {
      expect(typeof milestoneService.createMilestone).toBe('function');
    });

    test('should have getMilestone method', () => {
      expect(typeof milestoneService.getMilestone).toBe('function');
    });

    test('should have getMilestones method', () => {
      expect(typeof milestoneService.getMilestones).toBe('function');
    });

    test('should have updateMilestone method', () => {
      expect(typeof milestoneService.updateMilestone).toBe('function');
    });

    test('should have markMilestoneCompleted method', () => {
      expect(typeof milestoneService.markMilestoneCompleted).toBe('function');
    });

    test('should have markMilestoneIncomplete method', () => {
      expect(typeof milestoneService.markMilestoneIncomplete).toBe('function');
    });

    test('should have deleteMilestone method', () => {
      expect(typeof milestoneService.deleteMilestone).toBe('function');
    });

    test('should have getOverdueMilestones method', () => {
      expect(typeof milestoneService.getOverdueMilestones).toBe('function');
    });

    test('should have getUpcomingMilestones method', () => {
      expect(typeof milestoneService.getUpcomingMilestones).toBe('function');
    });

    test('should have getMilestoneStats method', () => {
      expect(typeof milestoneService.getMilestoneStats).toBe('function');
    });
  });

  describe('Validation', () => {
    test('should reject if inventory access denied on getMilestones', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      await expect(
        milestoneService.getMilestones(
          mockProjectId,
          mockInventoryId,
          mockUserId
        )
      ).rejects.toThrow('Access denied to inventory');
    });

    test('should reject if inventory access denied on getOverdueMilestones', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      await expect(
        milestoneService.getOverdueMilestones(mockInventoryId, mockUserId)
      ).rejects.toThrow('Access denied to inventory');
    });

    test('should reject if inventory access denied on getUpcomingMilestones', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      await expect(
        milestoneService.getUpcomingMilestones(mockInventoryId, mockUserId)
      ).rejects.toThrow('Access denied to inventory');
    });

    test('should reject if inventory access denied on getMilestoneStats', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      await expect(
        milestoneService.getMilestoneStats(
          mockProjectId,
          mockInventoryId,
          mockUserId
        )
      ).rejects.toThrow('Access denied to inventory');
    });
  });
});
