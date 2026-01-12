/**
 * ProjectTask Model Tests
 * Tests the ProjectTask entity model and validation logic
 */

const { ProjectTask, TaskPriority, TaskStatus, TaskCategory } = require('../models/projectTask');

describe('ProjectTask Model', () => {
  const mockProjectId = '12345678-1234-1234-1234-123456789012';
  const mockDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const mockPastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  describe('Constructor', () => {
    test('should create a task with required fields', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Pack boxes',
        category: TaskCategory.PACKING,
        priority: TaskPriority.HIGH
      });

      expect(task.projectId).toBe(mockProjectId);
      expect(task.title).toBe('Pack boxes');
      expect(task.category).toBe(TaskCategory.PACKING);
      expect(task.priority).toBe(TaskPriority.HIGH);
      expect(task.status).toBe(TaskStatus.NOT_STARTED);
      expect(task.completed).toBe(false);
      expect(task.id).toBeDefined();
    });

    test('should generate UUID if not provided', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task'
      });

      expect(task.id).toBeDefined();
      expect(task.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test('should set default values', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task'
      });

      expect(task.status).toBe(TaskStatus.NOT_STARTED);
      expect(task.priority).toBe(TaskPriority.MEDIUM);
      expect(task.category).toBe(TaskCategory.OTHER);
      expect(task.completed).toBe(false);
      expect(task.estimatedHours).toBe(0);
      expect(task.actualHours).toBe(0);
      expect(task.tags).toEqual([]);
      expect(task.dependencies).toEqual([]);
    });
  });

  describe('Validation', () => {
    test('should validate required projectId', () => {
      const task = new ProjectTask({
        title: 'Test Task'
      });

      const validation = task.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Project ID is required and must be a string');
    });

    test('should validate required title', () => {
      const task = new ProjectTask({
        projectId: mockProjectId
      });

      const validation = task.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Title is required and must be a non-empty string');
    });

    test('should validate title length', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'a'.repeat(201)
      });

      const validation = task.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Title must be 200 characters or less');
    });

    test('should validate description length', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        description: 'a'.repeat(2001)
      });

      const validation = task.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Description must be 2000 characters or less');
    });

    test('should validate priority enum', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        priority: 'invalid_priority'
      });

      const validation = task.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Priority must be one of'))).toBe(true);
    });

    test('should validate status enum', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        status: 'invalid_status'
      });

      const validation = task.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Status must be one of'))).toBe(true);
    });

    test('should validate category enum', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        category: 'invalid_category'
      });

      const validation = task.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Category must be one of'))).toBe(true);
    });

    test('should validate numeric fields', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        estimatedHours: -5
      });

      const validation = task.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Estimated hours must be a non-negative number');
    });

    test('should pass validation with all required fields', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        category: TaskCategory.PACKING,
        priority: TaskPriority.HIGH
      });

      const validation = task.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Mark Completed', () => {
    test('should mark task as completed', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task'
      });

      const result = task.markCompleted();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(task.completed).toBe(true);
      expect(task.completedAt).toBeDefined();
      expect(task.status).toBe(TaskStatus.COMPLETED);
    });

    test('should not mark already completed task', () => {
      const completedAt = new Date().toISOString();
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        completed: true,
        completedAt,
        status: TaskStatus.COMPLETED
      });

      const result = task.markCompleted();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Task is already completed');
    });
  });

  describe('Mark Incomplete', () => {
    test('should mark completed task as incomplete', () => {
      const completedAt = new Date().toISOString();
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        completed: true,
        completedAt,
        status: TaskStatus.COMPLETED
      });

      const result = task.markIncomplete();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(task.completed).toBe(false);
      expect(task.completedAt).toBeNull();
      expect(task.status).toBe(TaskStatus.NOT_STARTED);
    });

    test('should not mark incomplete task as incomplete', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task'
      });

      const result = task.markIncomplete();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Task is not completed');
    });
  });

  describe('Is Overdue', () => {
    test('should return true for past due date', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        dueDate: mockPastDate
      });

      expect(task.isOverdue()).toBe(true);
    });

    test('should return false for future due date', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        dueDate: mockDueDate
      });

      expect(task.isOverdue()).toBe(false);
    });

    test('should return false for completed task regardless of date', () => {
      const completedAt = new Date().toISOString();
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        dueDate: mockPastDate,
        completed: true,
        completedAt,
        status: TaskStatus.COMPLETED
      });

      expect(task.isOverdue()).toBe(false);
    });

    test('should return false for task without due date', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task'
      });

      expect(task.isOverdue()).toBe(false);
    });
  });

  describe('Is Due Soon', () => {
    test('should return true for task due within 3 days', () => {
      const soonDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        dueDate: soonDate
      });

      expect(task.isDueSoon()).toBe(true);
    });

    test('should return false for task due beyond 3 days', () => {
      const laterDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        dueDate: laterDate
      });

      expect(task.isDueSoon()).toBe(false);
    });

    test('should return false for completed task', () => {
      const completedAt = new Date().toISOString();
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        dueDate: mockDueDate,
        completed: true,
        completedAt,
        status: TaskStatus.COMPLETED
      });

      expect(task.isDueSoon()).toBe(false);
    });
  });

  describe('Get Days Until Due', () => {
    test('should return positive days for future due date', () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        dueDate: futureDate
      });

      const daysUntil = task.getDaysUntilDue();
      expect(daysUntil).toBeGreaterThan(0);
      expect(daysUntil).toBeLessThanOrEqual(5);
    });

    test('should return negative days for past due date', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        dueDate: mockPastDate
      });

      const daysUntil = task.getDaysUntilDue();
      expect(daysUntil).toBeLessThan(0);
    });

    test('should return null for task without due date', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task'
      });

      expect(task.getDaysUntilDue()).toBeNull();
    });
  });

  describe('Get Progress', () => {
    test('should return 100 for completed task', () => {
      const completedAt = new Date().toISOString();
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        completed: true,
        completedAt,
        status: TaskStatus.COMPLETED
      });

      expect(task.getProgress()).toBe(100);
    });

    test('should return 50 for in-progress task', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        status: TaskStatus.IN_PROGRESS
      });

      expect(task.getProgress()).toBe(50);
    });

    test('should return 25 for blocked task', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        status: TaskStatus.BLOCKED
      });

      expect(task.getProgress()).toBe(25);
    });

    test('should return 0 for not started task', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        status: TaskStatus.NOT_STARTED
      });

      expect(task.getProgress()).toBe(0);
    });
  });

  describe('DynamoDB Conversion', () => {
    test('should convert to DynamoDB item format', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        category: TaskCategory.PACKING,
        priority: TaskPriority.HIGH,
        dueDate: mockDueDate,
        estimatedHours: 4
      });

      const item = task.toDynamoDBItem();

      expect(item.pk).toBe(`PROJECT#${mockProjectId}#TASKS`);
      expect(item.sk).toBe(task.id);
      expect(item.gsi1pk).toBe(`PROJECT#${mockProjectId}`);
      expect(item.id).toBe(task.id);
      expect(item.projectId).toBe(mockProjectId);
      expect(item.title).toBe('Test Task');
      expect(item.category).toBe(TaskCategory.PACKING);
      expect(item.priority).toBe(TaskPriority.HIGH);
      expect(item.isOverdue).toBeDefined();
      expect(item.isDueSoon).toBeDefined();
      expect(item.progress).toBeDefined();
    });

    test('should create from DynamoDB item', () => {
      const completedAt = new Date().toISOString();
      const item = {
        id: '12345678-1234-1234-1234-123456789012',
        projectId: mockProjectId,
        title: 'Test Task',
        category: TaskCategory.PACKING,
        priority: TaskPriority.HIGH,
        status: TaskStatus.COMPLETED,
        dueDate: mockDueDate,
        completed: true,
        completedAt,
        estimatedHours: 4,
        actualHours: 5,
        description: 'Test description',
        notes: 'Test notes',
        tags: ['tag1', 'tag2'],
        dependencies: ['dep1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const task = ProjectTask.fromDynamoDBItem(item);

      expect(task.id).toBe(item.id);
      expect(task.projectId).toBe(mockProjectId);
      expect(task.title).toBe('Test Task');
      expect(task.category).toBe(TaskCategory.PACKING);
      expect(task.priority).toBe(TaskPriority.HIGH);
      expect(task.status).toBe(TaskStatus.COMPLETED);
      expect(task.completed).toBe(true);
      expect(task.completedAt).toBe(completedAt);
    });
  });

  describe('Update', () => {
    test('should update allowed fields', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Original Title',
        priority: TaskPriority.LOW
      });

      task.update({
        title: 'Updated Title',
        priority: TaskPriority.HIGH,
        status: TaskStatus.IN_PROGRESS
      });

      expect(task.title).toBe('Updated Title');
      expect(task.priority).toBe(TaskPriority.HIGH);
      expect(task.status).toBe(TaskStatus.IN_PROGRESS);
    });

    test('should not update disallowed fields', () => {
      const task = new ProjectTask({
        projectId: mockProjectId,
        title: 'Test Task',
        completed: false
      });

      const originalProjectId = task.projectId;
      const originalCompleted = task.completed;

      task.update({
        projectId: 'different-id',
        completed: true
      });

      expect(task.projectId).toBe(originalProjectId);
      expect(task.completed).toBe(originalCompleted);
    });
  });

  describe('Task Enums', () => {
    test('should have all task priorities defined', () => {
      expect(TaskPriority.LOW).toBe('low');
      expect(TaskPriority.MEDIUM).toBe('medium');
      expect(TaskPriority.HIGH).toBe('high');
      expect(TaskPriority.URGENT).toBe('urgent');
    });

    test('should have all task statuses defined', () => {
      expect(TaskStatus.NOT_STARTED).toBe('not_started');
      expect(TaskStatus.IN_PROGRESS).toBe('in_progress');
      expect(TaskStatus.COMPLETED).toBe('completed');
      expect(TaskStatus.BLOCKED).toBe('blocked');
      expect(TaskStatus.CANCELLED).toBe('cancelled');
    });

    test('should have all task categories defined', () => {
      expect(TaskCategory.PLANNING).toBe('planning');
      expect(TaskCategory.PACKING).toBe('packing');
      expect(TaskCategory.LOGISTICS).toBe('logistics');
      expect(TaskCategory.MOVING_DAY).toBe('moving_day');
      expect(TaskCategory.UNPACKING).toBe('unpacking');
      expect(TaskCategory.SETUP).toBe('setup');
      expect(TaskCategory.ADMIN).toBe('admin');
      expect(TaskCategory.OTHER).toBe('other');
    });
  });
});
