const { ThingAssignment } = require('../models/thingAssignment');

describe('ThingAssignment Model', () => {
  const mockProjectId = '12345678-1234-1234-1234-123456789012';
  const mockThingId = '87654321-4321-4321-4321-210987654321';
  const mockInventoryId = 'abcdef12-abcd-abcd-abcd-abcdefabcdef';

  describe('Constructor', () => {
    test('should create a new assignment with required fields', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId
      });

      expect(assignment.projectId).toBe(mockProjectId);
      expect(assignment.thingId).toBe(mockThingId);
      expect(assignment.inventoryId).toBe(mockInventoryId);
      expect(assignment.id).toBeDefined();
      expect(assignment.assignedAt).toBeDefined();
      expect(assignment.unassignedAt).toBeNull();
      expect(assignment.containerizedAt).toBeNull();
      expect(assignment.containerizedContainerId).toBeNull();
    });

    test('should generate unique IDs for each assignment', () => {
      const assignment1 = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId
      });

      const assignment2 = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId
      });

      expect(assignment1.id).not.toBe(assignment2.id);
    });
  });

  describe('Validation', () => {
    test('should validate a valid assignment', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId
      });

      const validation = assignment.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject assignment without projectId', () => {
      const assignment = new ThingAssignment({
        thingId: mockThingId,
        inventoryId: mockInventoryId
      });

      const validation = assignment.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Project ID is required and must be a string');
    });

    test('should reject assignment without thingId', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        inventoryId: mockInventoryId
      });

      const validation = assignment.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Thing ID is required and must be a string');
    });

    test('should reject assignment without inventoryId', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId
      });

      const validation = assignment.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Inventory ID is required and must be a string');
    });

    test('should reject invalid ISO dates', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId,
        assignedAt: 'invalid-date'
      });

      const validation = assignment.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Assigned at must be a valid ISO date string');
    });

    test('should reject unassignedAt before assignedAt', () => {
      const now = new Date();
      const later = new Date(now.getTime() + 1000);

      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId,
        assignedAt: later.toISOString(),
        unassignedAt: now.toISOString()
      });

      const validation = assignment.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Unassigned date must be after assigned date');
    });

    test('should reject containerizedAt before assignedAt', () => {
      const now = new Date();
      const later = new Date(now.getTime() + 1000);

      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId,
        assignedAt: later.toISOString(),
        containerizedAt: now.toISOString(),
        containerizedContainerId: 'container-123'
      });

      const validation = assignment.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Containerized date cannot be before assigned date');
    });

    test('should reject containerizedAt without containerizedContainerId', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId,
        containerizedAt: new Date().toISOString()
      });

      const validation = assignment.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Containerized container ID is required when containerized at is set');
    });

    test('should reject containerizedContainerId without containerizedAt', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId,
        containerizedContainerId: 'container-123'
      });

      const validation = assignment.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Containerized at is required when containerized container ID is set');
    });
  });

  describe('markContainerized', () => {
    test('should mark thing as containerized', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId
      });

      const result = assignment.markContainerized('container-123');

      expect(result.success).toBe(true);
      expect(assignment.containerizedAt).toBeDefined();
      expect(assignment.containerizedContainerId).toBe('container-123');
      expect(assignment.isContainerized()).toBe(true);
    });

    test('should reject marking unassigned thing as containerized', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId,
        unassignedAt: new Date().toISOString()
      });

      const result = assignment.markContainerized('container-123');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Cannot containerize an unassigned thing');
    });

    test('should reject invalid container ID', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId
      });

      const result = assignment.markContainerized(null);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Container ID is required and must be a string');
    });
  });

  describe('markUncontainerized', () => {
    test('should mark thing as uncontainerized', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId,
        containerizedAt: new Date().toISOString(),
        containerizedContainerId: 'container-123'
      });

      const result = assignment.markUncontainerized();

      expect(result.success).toBe(true);
      expect(assignment.containerizedAt).toBeNull();
      expect(assignment.containerizedContainerId).toBeNull();
      expect(assignment.isContainerized()).toBe(false);
    });

    test('should reject uncontainerizing unassigned thing', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId,
        unassignedAt: new Date().toISOString()
      });

      const result = assignment.markUncontainerized();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Cannot uncontainerize an unassigned thing');
    });
  });

  describe('unassign', () => {
    test('should unassign thing from project', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId
      });

      const result = assignment.unassign();

      expect(result.success).toBe(true);
      expect(assignment.unassignedAt).toBeDefined();
      expect(assignment.isActive()).toBe(false);
    });

    test('should reject unassigning already unassigned thing', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId,
        unassignedAt: new Date().toISOString()
      });

      const result = assignment.unassign();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Thing is already unassigned');
    });
  });

  describe('isActive', () => {
    test('should return true for active assignment', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId
      });

      expect(assignment.isActive()).toBe(true);
    });

    test('should return false for unassigned thing', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId,
        unassignedAt: new Date().toISOString()
      });

      expect(assignment.isActive()).toBe(false);
    });
  });

  describe('isContainerized', () => {
    test('should return true for containerized thing', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId,
        containerizedAt: new Date().toISOString(),
        containerizedContainerId: 'container-123'
      });

      expect(assignment.isContainerized()).toBe(true);
    });

    test('should return false for loose thing', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId
      });

      expect(assignment.isContainerized()).toBe(false);
    });
  });

  describe('DynamoDB conversion', () => {
    test('should convert to DynamoDB item format', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId
      });

      const item = assignment.toDynamoDBItem();

      expect(item.pk).toBe(`PROJECT#${mockProjectId}#THINGS`);
      expect(item.sk).toBe(assignment.id);
      expect(item.gsi1pk).toBe(`THING#${mockThingId}`);
      expect(item.gsi1sk).toBe(`PROJECT#${mockProjectId}`);
      expect(item.gsi2pk).toBe(`INVENTORY#${mockInventoryId}`);
      expect(item.projectId).toBe(mockProjectId);
      expect(item.thingId).toBe(mockThingId);
      expect(item.inventoryId).toBe(mockInventoryId);
      expect(item.isActive).toBe(true);
      expect(item.isContainerized).toBe(false);
    });

    test('should create from DynamoDB item', () => {
      const now = new Date().toISOString();
      const item = {
        id: 'assignment-123',
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId,
        assignedAt: now,
        unassignedAt: null,
        containerizedAt: null,
        containerizedContainerId: null,
        createdAt: now,
        updatedAt: now
      };

      const assignment = ThingAssignment.fromDynamoDBItem(item);

      expect(assignment.id).toBe('assignment-123');
      expect(assignment.projectId).toBe(mockProjectId);
      expect(assignment.thingId).toBe(mockThingId);
      expect(assignment.inventoryId).toBe(mockInventoryId);
      expect(assignment.assignedAt).toBe(now);
      expect(assignment.unassignedAt).toBeNull();
    });
  });

  describe('update', () => {
    test('should update containerized fields', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId
      });

      const now = new Date().toISOString();
      assignment.update({
        containerizedAt: now,
        containerizedContainerId: 'container-456'
      });

      expect(assignment.containerizedAt).toBe(now);
      expect(assignment.containerizedContainerId).toBe('container-456');
      expect(assignment.updatedAt).toBeDefined();
    });

    test('should not update restricted fields', () => {
      const assignment = new ThingAssignment({
        projectId: mockProjectId,
        thingId: mockThingId,
        inventoryId: mockInventoryId
      });

      const originalProjectId = assignment.projectId;
      assignment.update({
        projectId: 'different-project-id',
        thingId: 'different-thing-id'
      });

      expect(assignment.projectId).toBe(originalProjectId);
      expect(assignment.thingId).toBe(mockThingId);
    });
  });
});
