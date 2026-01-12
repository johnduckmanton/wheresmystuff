/**
 * Milestone Model Tests
 * Tests the Milestone entity model and validation logic
 */

const { Milestone, MilestoneType } = require('../models/milestone');

describe('Milestone Model', () => {
  const mockProjectId = '12345678-1234-1234-1234-123456789012';
  const mockDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now
  const mockPastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago

  describe('Constructor', () => {
    test('should create a milestone with required fields', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Moving Day',
        type: MilestoneType.MOVING_IN_DATE,
        date: mockDate
      });

      expect(milestone.projectId).toBe(mockProjectId);
      expect(milestone.name).toBe('Moving Day');
      expect(milestone.type).toBe(MilestoneType.MOVING_IN_DATE);
      expect(milestone.date).toBe(mockDate);
      expect(milestone.completed).toBe(false);
      expect(milestone.id).toBeDefined();
      expect(milestone.createdAt).toBeDefined();
      expect(milestone.updatedAt).toBeDefined();
    });

    test('should generate UUID if not provided', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate
      });

      expect(milestone.id).toBeDefined();
      expect(milestone.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test('should set default type to CUSTOM', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate
      });

      expect(milestone.type).toBe(MilestoneType.CUSTOM);
    });

    test('should set default completed to false', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate
      });

      expect(milestone.completed).toBe(false);
      expect(milestone.completedAt).toBeNull();
    });

    test('should accept optional description', () => {
      const description = 'This is a test milestone';
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate,
        description
      });

      expect(milestone.description).toBe(description);
    });
  });

  describe('Validation', () => {
    test('should validate required projectId', () => {
      const milestone = new Milestone({
        name: 'Test Milestone',
        date: mockDate
      });

      const validation = milestone.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Project ID is required and must be a string');
    });

    test('should validate required name', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        date: mockDate
      });

      const validation = milestone.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Name is required and must be a non-empty string');
    });

    test('should validate required date', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone'
      });

      const validation = milestone.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Date is required and must be a string');
    });

    test('should validate name length', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'a'.repeat(101),
        date: mockDate
      });

      const validation = milestone.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Name must be 100 characters or less');
    });

    test('should validate description length', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate,
        description: 'a'.repeat(501)
      });

      const validation = milestone.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Description must be 500 characters or less');
    });

    test('should validate milestone type', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate,
        type: 'invalid_type'
      });

      const validation = milestone.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Type must be one of'))).toBe(true);
    });

    test('should validate ISO date format', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: 'not-a-date'
      });

      const validation = milestone.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Date must be a valid ISO date string');
    });

    test('should validate completed state consistency', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate,
        completed: true
      });

      const validation = milestone.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Completed at is required when milestone is marked as completed');
    });

    test('should pass validation with all required fields', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate,
        type: MilestoneType.CUSTOM
      });

      const validation = milestone.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should pass validation with all fields', () => {
      const completedAt = new Date().toISOString();
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate,
        type: MilestoneType.MOVING_IN_DATE,
        description: 'Test description',
        completed: true,
        completedAt
      });

      const validation = milestone.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Mark Completed', () => {
    test('should mark milestone as completed', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate
      });

      const result = milestone.markCompleted();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(milestone.completed).toBe(true);
      expect(milestone.completedAt).toBeDefined();
    });

    test('should not mark already completed milestone', () => {
      const completedAt = new Date().toISOString();
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate,
        completed: true,
        completedAt
      });

      const result = milestone.markCompleted();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Milestone is already completed');
    });

    test('should update updatedAt when marking completed', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate
      });

      const oldTime = new Date(Date.now() - 1000).toISOString();
      milestone.updatedAt = oldTime;
      milestone.markCompleted();

      expect(milestone.updatedAt).not.toBe(oldTime);
      expect(milestone.completed).toBe(true);
    });
  });

  describe('Mark Incomplete', () => {
    test('should mark completed milestone as incomplete', () => {
      const completedAt = new Date().toISOString();
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate,
        completed: true,
        completedAt
      });

      const result = milestone.markIncomplete();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(milestone.completed).toBe(false);
      expect(milestone.completedAt).toBeNull();
    });

    test('should not mark incomplete milestone as incomplete', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate
      });

      const result = milestone.markIncomplete();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Milestone is not completed');
    });

    test('should update updatedAt when marking incomplete', () => {
      const completedAt = new Date().toISOString();
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate,
        completed: true,
        completedAt
      });

      const oldTime = new Date(Date.now() - 1000).toISOString();
      milestone.updatedAt = oldTime;
      milestone.markIncomplete();

      expect(milestone.updatedAt).not.toBe(oldTime);
      expect(milestone.completed).toBe(false);
    });
  });

  describe('Is Overdue', () => {
    test('should return true for past date milestone', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockPastDate
      });

      expect(milestone.isOverdue()).toBe(true);
    });

    test('should return false for future date milestone', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate
      });

      expect(milestone.isOverdue()).toBe(false);
    });

    test('should return false for completed milestone regardless of date', () => {
      const completedAt = new Date().toISOString();
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockPastDate,
        completed: true,
        completedAt
      });

      expect(milestone.isOverdue()).toBe(false);
    });
  });

  describe('Is Upcoming', () => {
    test('should return true for milestone within 7 days', () => {
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: futureDate
      });

      expect(milestone.isUpcoming()).toBe(true);
    });

    test('should return false for milestone beyond 7 days', () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: futureDate
      });

      expect(milestone.isUpcoming()).toBe(false);
    });

    test('should return false for past date milestone', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockPastDate
      });

      expect(milestone.isUpcoming()).toBe(false);
    });

    test('should return false for completed milestone', () => {
      const completedAt = new Date().toISOString();
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate,
        completed: true,
        completedAt
      });

      expect(milestone.isUpcoming()).toBe(false);
    });
  });

  describe('Get Days Until', () => {
    test('should return positive days for future milestone', () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: futureDate
      });

      const daysUntil = milestone.getDaysUntil();
      expect(daysUntil).toBeGreaterThan(0);
      expect(daysUntil).toBeLessThanOrEqual(5);
    });

    test('should return negative days for past milestone', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockPastDate
      });

      const daysUntil = milestone.getDaysUntil();
      expect(daysUntil).toBeLessThan(0);
    });
  });

  describe('DynamoDB Conversion', () => {
    test('should convert to DynamoDB item format', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate,
        type: MilestoneType.MOVING_IN_DATE,
        description: 'Test description'
      });

      const item = milestone.toDynamoDBItem();

      expect(item.pk).toBe(`PROJECT#${mockProjectId}#MILESTONES`);
      expect(item.sk).toBe(milestone.id);
      expect(item.gsi1pk).toBe(`PROJECT#${mockProjectId}`);
      expect(item.gsi1sk).toContain('MILESTONE#');
      expect(item.id).toBe(milestone.id);
      expect(item.projectId).toBe(mockProjectId);
      expect(item.name).toBe('Test Milestone');
      expect(item.type).toBe(MilestoneType.MOVING_IN_DATE);
      expect(item.description).toBe('Test description');
      expect(item.completed).toBe(false);
      expect(item.isOverdue).toBeDefined();
      expect(item.isUpcoming).toBeDefined();
      expect(item.daysUntil).toBeDefined();
    });

    test('should create from DynamoDB item', () => {
      const completedAt = new Date().toISOString();
      const item = {
        id: '12345678-1234-1234-1234-123456789012',
        projectId: mockProjectId,
        name: 'Test Milestone',
        type: MilestoneType.MOVING_IN_DATE,
        date: mockDate,
        description: 'Test description',
        completed: true,
        completedAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const milestone = Milestone.fromDynamoDBItem(item);

      expect(milestone.id).toBe(item.id);
      expect(milestone.projectId).toBe(mockProjectId);
      expect(milestone.name).toBe('Test Milestone');
      expect(milestone.type).toBe(MilestoneType.MOVING_IN_DATE);
      expect(milestone.date).toBe(mockDate);
      expect(milestone.description).toBe('Test description');
      expect(milestone.completed).toBe(true);
      expect(milestone.completedAt).toBe(completedAt);
    });
  });

  describe('Update', () => {
    test('should update allowed fields', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Original Name',
        date: mockDate,
        type: MilestoneType.CUSTOM
      });

      const newDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      milestone.update({
        name: 'Updated Name',
        date: newDate,
        type: MilestoneType.MOVING_IN_DATE,
        description: 'Updated description'
      });

      expect(milestone.name).toBe('Updated Name');
      expect(milestone.date).toBe(newDate);
      expect(milestone.type).toBe(MilestoneType.MOVING_IN_DATE);
      expect(milestone.description).toBe('Updated description');
    });

    test('should not update disallowed fields', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate
      });

      const originalProjectId = milestone.projectId;
      const originalCompleted = milestone.completed;

      milestone.update({
        projectId: 'different-id',
        completed: true
      });

      expect(milestone.projectId).toBe(originalProjectId);
      expect(milestone.completed).toBe(originalCompleted);
    });

    test('should update updatedAt timestamp', () => {
      const milestone = new Milestone({
        projectId: mockProjectId,
        name: 'Test Milestone',
        date: mockDate
      });

      const oldTime = new Date(Date.now() - 1000).toISOString();
      milestone.updatedAt = oldTime;
      milestone.update({ name: 'Updated Name' });

      expect(milestone.updatedAt).not.toBe(oldTime);
      expect(milestone.name).toBe('Updated Name');
    });
  });

  describe('Milestone Types', () => {
    test('should have all milestone types defined', () => {
      expect(MilestoneType.START_DATE).toBe('start_date');
      expect(MilestoneType.MOVING_OUT_DATE).toBe('moving_out_date');
      expect(MilestoneType.MOVING_IN_DATE).toBe('moving_in_date');
      expect(MilestoneType.CUSTOM).toBe('custom');
    });
  });
});
