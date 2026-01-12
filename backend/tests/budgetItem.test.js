/**
 * BudgetItem Model Tests
 * Tests the BudgetItem entity model and validation logic
 */

const { BudgetItem, BudgetCategory, PaymentStatus } = require('../models/budgetItem');

describe('BudgetItem Model', () => {
  const mockProjectId = '12345678-1234-1234-1234-123456789012';
  const mockDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const mockPastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  describe('Constructor', () => {
    test('should create a budget item with required fields', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Moving company fee',
        category: BudgetCategory.MOVING_COMPANY,
        estimatedCost: 5000
      });

      expect(item.projectId).toBe(mockProjectId);
      expect(item.description).toBe('Moving company fee');
      expect(item.category).toBe(BudgetCategory.MOVING_COMPANY);
      expect(item.estimatedCost).toBe(5000);
      expect(item.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(item.id).toBeDefined();
    });

    test('should generate UUID if not provided', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item'
      });

      expect(item.id).toBeDefined();
      expect(item.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test('should set default values', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item'
      });

      expect(item.category).toBe(BudgetCategory.MISCELLANEOUS);
      expect(item.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(item.estimatedCost).toBe(0);
      expect(item.actualCost).toBe(0);
      expect(item.amountPaid).toBe(0);
      expect(item.currency).toBe('USD');
      expect(item.vendor).toBe('');
      expect(item.notes).toBe('');
      expect(item.tags).toEqual([]);
    });
  });

  describe('Validation', () => {
    test('should validate required projectId', () => {
      const item = new BudgetItem({
        description: 'Test Item'
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Project ID is required and must be a string');
    });

    test('should validate required description', () => {
      const item = new BudgetItem({
        projectId: mockProjectId
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Description is required and must be a non-empty string');
    });

    test('should validate description length', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'a'.repeat(501)
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Description must be 500 characters or less');
    });

    test('should validate vendor length', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        vendor: 'a'.repeat(201)
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Vendor must be 200 characters or less');
    });

    test('should validate notes length', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        notes: 'a'.repeat(1001)
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Notes must be 1000 characters or less');
    });

    test('should validate category enum', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        category: 'invalid_category'
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Category must be one of'))).toBe(true);
    });

    test('should validate paymentStatus enum', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        paymentStatus: 'invalid_status'
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Payment status must be one of'))).toBe(true);
    });

    test('should validate numeric fields', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        estimatedCost: -100
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Estimated cost must be a non-negative number');
    });

    test('should validate amount paid does not exceed actual cost', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000,
        amountPaid: 1500
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Amount paid cannot exceed actual cost');
    });

    test('should validate paid status requires amount equals actual cost', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000,
        amountPaid: 500,
        paymentStatus: PaymentStatus.PAID
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Amount paid must equal actual cost when status is paid');
    });

    test('should validate paid status requires paidDate', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000,
        amountPaid: 1000,
        paymentStatus: PaymentStatus.PAID
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Paid date is required when payment status is paid');
    });

    test('should pass validation with all required fields', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        category: BudgetCategory.MOVING_COMPANY,
        estimatedCost: 5000
      });

      const validation = item.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Mark As Paid', () => {
    test('should mark item as paid with full amount', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000
      });

      const result = item.markAsPaid(1000);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(item.amountPaid).toBe(1000);
      expect(item.paymentStatus).toBe(PaymentStatus.PAID);
      expect(item.paidDate).toBeDefined();
    });

    test('should mark item as partially paid', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000
      });

      const result = item.markAsPaid(500);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(item.amountPaid).toBe(500);
      expect(item.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);
      expect(item.paidDate).toBeDefined();
    });

    test('should not mark already paid item', () => {
      const paidDate = new Date().toISOString();
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000,
        amountPaid: 1000,
        paymentStatus: PaymentStatus.PAID,
        paidDate
      });

      const result = item.markAsPaid(1000);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Item is already paid');
    });

    test('should not mark with negative amount', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000
      });

      const result = item.markAsPaid(-100);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Amount must be non-negative');
    });

    test('should not mark with amount exceeding actual cost', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000
      });

      const result = item.markAsPaid(1500);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Amount cannot exceed actual cost');
    });
  });

  describe('Mark As Unpaid', () => {
    test('should mark paid item as unpaid', () => {
      const paidDate = new Date().toISOString();
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000,
        amountPaid: 1000,
        paymentStatus: PaymentStatus.PAID,
        paidDate
      });

      const result = item.markAsUnpaid();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(item.amountPaid).toBe(0);
      expect(item.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(item.paidDate).toBeNull();
    });

    test('should not mark already pending item', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item'
      });

      const result = item.markAsUnpaid();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Item is already pending');
    });
  });

  describe('Is Overdue', () => {
    test('should return true for past due date', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        dueDate: mockPastDate
      });

      expect(item.isOverdue()).toBe(true);
    });

    test('should return false for future due date', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        dueDate: mockDueDate
      });

      expect(item.isOverdue()).toBe(false);
    });

    test('should return false for paid item regardless of date', () => {
      const paidDate = new Date().toISOString();
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        dueDate: mockPastDate,
        amountPaid: 1000,
        actualCost: 1000,
        paymentStatus: PaymentStatus.PAID,
        paidDate
      });

      expect(item.isOverdue()).toBe(false);
    });

    test('should return false for item without due date', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item'
      });

      expect(item.isOverdue()).toBe(false);
    });
  });

  describe('Get Remaining Balance', () => {
    test('should calculate remaining balance', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000,
        amountPaid: 300
      });

      expect(item.getRemainingBalance()).toBe(700);
    });

    test('should return 0 when fully paid', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000,
        amountPaid: 1000
      });

      expect(item.getRemainingBalance()).toBe(0);
    });

    test('should return actual cost when nothing paid', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000
      });

      expect(item.getRemainingBalance()).toBe(1000);
    });
  });

  describe('Get Payment Percentage', () => {
    test('should calculate payment percentage', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000,
        amountPaid: 250
      });

      expect(item.getPaymentPercentage()).toBe(25);
    });

    test('should return 100 when fully paid', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000,
        amountPaid: 1000
      });

      expect(item.getPaymentPercentage()).toBe(100);
    });

    test('should return 0 when nothing paid', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 1000
      });

      expect(item.getPaymentPercentage()).toBe(0);
    });

    test('should return 0 when actual cost is 0', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        actualCost: 0
      });

      expect(item.getPaymentPercentage()).toBe(0);
    });
  });

  describe('Get Variance', () => {
    test('should calculate positive variance when over budget', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        estimatedCost: 1000,
        actualCost: 1500
      });

      expect(item.getVariance()).toBe(500);
    });

    test('should calculate negative variance when under budget', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        estimatedCost: 1000,
        actualCost: 800
      });

      expect(item.getVariance()).toBe(-200);
    });

    test('should return 0 when on budget', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        estimatedCost: 1000,
        actualCost: 1000
      });

      expect(item.getVariance()).toBe(0);
    });
  });

  describe('DynamoDB Conversion', () => {
    test('should convert to DynamoDB item format', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        category: BudgetCategory.MOVING_COMPANY,
        estimatedCost: 5000,
        actualCost: 5200,
        dueDate: mockDueDate
      });

      const dbItem = item.toDynamoDBItem();

      expect(dbItem.pk).toBe(`PROJECT#${mockProjectId}#BUDGET`);
      expect(dbItem.sk).toBe(item.id);
      expect(dbItem.gsi1pk).toBe(`PROJECT#${mockProjectId}`);
      expect(dbItem.id).toBe(item.id);
      expect(dbItem.projectId).toBe(mockProjectId);
      expect(dbItem.description).toBe('Test Item');
      expect(dbItem.category).toBe(BudgetCategory.MOVING_COMPANY);
      expect(dbItem.estimatedCost).toBe(5000);
      expect(dbItem.actualCost).toBe(5200);
      expect(dbItem.isOverdue).toBeDefined();
      expect(dbItem.remainingBalance).toBeDefined();
      expect(dbItem.paymentPercentage).toBeDefined();
      expect(dbItem.variance).toBeDefined();
    });

    test('should create from DynamoDB item', () => {
      const paidDate = new Date().toISOString();
      const dbItem = {
        id: '12345678-1234-1234-1234-123456789012',
        projectId: mockProjectId,
        description: 'Test Item',
        category: BudgetCategory.MOVING_COMPANY,
        estimatedCost: 5000,
        actualCost: 5200,
        currency: 'USD',
        paymentStatus: PaymentStatus.PAID,
        dueDate: mockDueDate,
        paidDate,
        amountPaid: 5200,
        vendor: 'Test Vendor',
        notes: 'Test notes',
        tags: ['tag1', 'tag2'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const item = BudgetItem.fromDynamoDBItem(dbItem);

      expect(item.id).toBe(dbItem.id);
      expect(item.projectId).toBe(mockProjectId);
      expect(item.description).toBe('Test Item');
      expect(item.category).toBe(BudgetCategory.MOVING_COMPANY);
      expect(item.estimatedCost).toBe(5000);
      expect(item.actualCost).toBe(5200);
      expect(item.paymentStatus).toBe(PaymentStatus.PAID);
      expect(item.amountPaid).toBe(5200);
    });
  });

  describe('Update', () => {
    test('should update allowed fields', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Original Description',
        estimatedCost: 1000
      });

      item.update({
        description: 'Updated Description',
        estimatedCost: 1500,
        category: BudgetCategory.TRUCK_RENTAL
      });

      expect(item.description).toBe('Updated Description');
      expect(item.estimatedCost).toBe(1500);
      expect(item.category).toBe(BudgetCategory.TRUCK_RENTAL);
    });

    test('should not update disallowed fields', () => {
      const item = new BudgetItem({
        projectId: mockProjectId,
        description: 'Test Item',
        paymentStatus: PaymentStatus.PENDING
      });

      const originalProjectId = item.projectId;
      const originalStatus = item.paymentStatus;

      item.update({
        projectId: 'different-id',
        paymentStatus: PaymentStatus.PAID
      });

      expect(item.projectId).toBe(originalProjectId);
      expect(item.paymentStatus).toBe(originalStatus);
    });
  });

  describe('Budget Categories', () => {
    test('should have all budget categories defined', () => {
      expect(BudgetCategory.MOVING_COMPANY).toBe('moving_company');
      expect(BudgetCategory.TRUCK_RENTAL).toBe('truck_rental');
      expect(BudgetCategory.PACKING_SUPPLIES).toBe('packing_supplies');
      expect(BudgetCategory.UTILITIES).toBe('utilities');
      expect(BudgetCategory.DEPOSITS).toBe('deposits');
      expect(BudgetCategory.TRAVEL).toBe('travel');
      expect(BudgetCategory.ACCOMMODATION).toBe('accommodation');
      expect(BudgetCategory.INSURANCE).toBe('insurance');
      expect(BudgetCategory.PERMITS).toBe('permits');
      expect(BudgetCategory.REPAIRS).toBe('repairs');
      expect(BudgetCategory.FURNITURE).toBe('furniture');
      expect(BudgetCategory.MISCELLANEOUS).toBe('miscellaneous');
    });
  });

  describe('Payment Statuses', () => {
    test('should have all payment statuses defined', () => {
      expect(PaymentStatus.PENDING).toBe('pending');
      expect(PaymentStatus.PAID).toBe('paid');
      expect(PaymentStatus.PARTIALLY_PAID).toBe('partially_paid');
      expect(PaymentStatus.OVERDUE).toBe('overdue');
      expect(PaymentStatus.CANCELLED).toBe('cancelled');
    });
  });
});
