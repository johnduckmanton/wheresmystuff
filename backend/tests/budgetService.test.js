/**
 * Budget Service Tests
 * Tests the BudgetService business logic and database operations
 */

const budgetService = require('../services/budgetService');
const { BudgetItem, BudgetCategory, PaymentStatus } = require('../models/budgetItem');

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

describe('BudgetService', () => {
  const mockUserId = 'user-123';
  const mockInventoryId = 'inventory-123';
  const mockProjectId = 'project-123';
  const mockItemId = 'item-123';

  beforeEach(() => {
    jest.clearAllMocks();
    hasInventoryAccess.mockResolvedValue(true);
  });

  describe('Service Methods Exist', () => {
    test('should have createBudgetItem method', () => {
      expect(typeof budgetService.createBudgetItem).toBe('function');
    });

    test('should have getBudgetItem method', () => {
      expect(typeof budgetService.getBudgetItem).toBe('function');
    });

    test('should have getBudgetItems method', () => {
      expect(typeof budgetService.getBudgetItems).toBe('function');
    });

    test('should have updateBudgetItem method', () => {
      expect(typeof budgetService.updateBudgetItem).toBe('function');
    });

    test('should have markItemAsPaid method', () => {
      expect(typeof budgetService.markItemAsPaid).toBe('function');
    });

    test('should have markItemAsUnpaid method', () => {
      expect(typeof budgetService.markItemAsUnpaid).toBe('function');
    });

    test('should have deleteBudgetItem method', () => {
      expect(typeof budgetService.deleteBudgetItem).toBe('function');
    });

    test('should have getBudgetStats method', () => {
      expect(typeof budgetService.getBudgetStats).toBe('function');
    });

    test('should have getOverdueItems method', () => {
      expect(typeof budgetService.getOverdueItems).toBe('function');
    });

    test('should have getByCategory method', () => {
      expect(typeof budgetService.getByCategory).toBe('function');
    });

    test('should have getPaymentSummary method', () => {
      expect(typeof budgetService.getPaymentSummary).toBe('function');
    });

    test('should have checkBudgetLimits method', () => {
      expect(typeof budgetService.checkBudgetLimits).toBe('function');
    });
  });

  describe('Access Control', () => {
    test('should check inventory access for createBudgetItem', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      const itemData = {
        description: 'Test Item',
        estimatedCost: 1000
      };

      await expect(budgetService.createBudgetItem(mockProjectId, mockInventoryId, itemData, mockUserId))
        .rejects.toThrow('Access denied to inventory');
    });

    test('should check inventory access for getBudgetItem', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      await expect(budgetService.getBudgetItem(mockItemId, mockProjectId, mockInventoryId, mockUserId))
        .rejects.toThrow('Access denied to inventory');
    });

    test('should check inventory access for getBudgetItems', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      await expect(budgetService.getBudgetItems(mockProjectId, mockInventoryId, mockUserId))
        .rejects.toThrow('Access denied to inventory');
    });

    test('should check inventory access for updateBudgetItem', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      const updates = { description: 'Updated' };

      await expect(budgetService.updateBudgetItem(mockItemId, mockProjectId, mockInventoryId, updates, mockUserId))
        .rejects.toThrow('Access denied to inventory');
    });

    test('should check inventory access for markItemAsPaid', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      await expect(budgetService.markItemAsPaid(mockItemId, mockProjectId, mockInventoryId, 100, mockUserId))
        .rejects.toThrow('Access denied to inventory');
    });

    test('should check inventory access for markItemAsUnpaid', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      await expect(budgetService.markItemAsUnpaid(mockItemId, mockProjectId, mockInventoryId, mockUserId))
        .rejects.toThrow('Access denied to inventory');
    });

    test('should check inventory access for deleteBudgetItem', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      await expect(budgetService.deleteBudgetItem(mockItemId, mockProjectId, mockInventoryId, mockUserId))
        .rejects.toThrow('Access denied to inventory');
    });

    test('should check inventory access for getBudgetStats', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      await expect(budgetService.getBudgetStats(mockProjectId, mockInventoryId, mockUserId))
        .rejects.toThrow('Access denied to inventory');
    });

    test('should check inventory access for getOverdueItems', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      await expect(budgetService.getOverdueItems(mockProjectId, mockInventoryId, mockUserId))
        .rejects.toThrow('Access denied to inventory');
    });

    test('should check inventory access for getByCategory', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      await expect(budgetService.getByCategory(mockProjectId, BudgetCategory.MOVING_COMPANY, mockInventoryId, mockUserId))
        .rejects.toThrow('Access denied to inventory');
    });

    test('should check inventory access for getPaymentSummary', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      await expect(budgetService.getPaymentSummary(mockProjectId, mockInventoryId, mockUserId))
        .rejects.toThrow('Access denied to inventory');
    });

    test('should check inventory access for checkBudgetLimits', async () => {
      hasInventoryAccess.mockResolvedValueOnce(false);

      await expect(budgetService.checkBudgetLimits(mockProjectId, mockInventoryId, 5000, mockUserId))
        .rejects.toThrow('Access denied to inventory');
    });
  });

  describe('Validation', () => {
    test('should reject invalid category in getByCategory', async () => {
      await expect(budgetService.getByCategory(mockProjectId, 'invalid_category', mockInventoryId, mockUserId))
        .rejects.toThrow('Invalid category');
    });
  });
});
