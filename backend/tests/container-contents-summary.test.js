const { Container } = require('../models/container');

describe('Container Contents Summary', () => {
  describe('Container Model', () => {
    test('should accept contentsSummary in constructor', () => {
      const containerData = {
        name: 'Test Container',
        inventoryId: 'inv-123',
        createdBy: 'user-123',
        contentsSummary: 'Kitchen utensils and small appliances'
      };

      const container = new Container(containerData);
      
      expect(container.contentsSummary).toBe('Kitchen utensils and small appliances');
    });

    test('should default contentsSummary to empty string', () => {
      const containerData = {
        name: 'Test Container',
        inventoryId: 'inv-123',
        createdBy: 'user-123'
      };

      const container = new Container(containerData);
      
      expect(container.contentsSummary).toBe('');
    });

    test('should validate contentsSummary length', () => {
      const containerData = {
        name: 'Test Container',
        inventoryId: 'inv-123',
        createdBy: 'user-123',
        contentsSummary: 'a'.repeat(501) // 501 characters, exceeds limit
      };

      const container = new Container(containerData);
      const validation = container.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Contents summary must be 500 characters or less');
    });

    test('should accept valid contentsSummary length', () => {
      const containerData = {
        name: 'Test Container',
        inventoryId: 'inv-123',
        createdBy: 'user-123',
        contentsSummary: 'a'.repeat(500) // Exactly 500 characters
      };

      const container = new Container(containerData);
      const validation = container.validate();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).not.toContain('Contents summary must be 500 characters or less');
    });

    test('should validate contentsSummary type', () => {
      const containerData = {
        name: 'Test Container',
        inventoryId: 'inv-123',
        createdBy: 'user-123',
        contentsSummary: 123 // Invalid type
      };

      const container = new Container(containerData);
      const validation = container.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Contents summary must be a string');
    });

    test('should include contentsSummary in DynamoDB item', () => {
      const containerData = {
        name: 'Test Container',
        inventoryId: 'inv-123',
        createdBy: 'user-123',
        contentsSummary: 'Kitchen items'
      };

      const container = new Container(containerData);
      const dynamoItem = container.toDynamoDBItem();
      
      expect(dynamoItem.contentsSummary).toBe('Kitchen items');
    });

    test('should create from DynamoDB item with contentsSummary', () => {
      const dynamoItem = {
        id: 'container-123',
        inventoryId: 'inv-123',
        name: 'Test Container',
        type: 'box',
        description: 'Test description',
        contentsSummary: 'Kitchen items',
        photos: [],
        qrCode: 'QR123',
        handlingFlags: [],
        itemCount: 0,
        estimatedValue: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'user-123',
        updatedBy: 'user-123',
        status: 'empty',
        metadata: {}
      };

      const container = Container.fromDynamoDBItem(dynamoItem);
      
      expect(container.contentsSummary).toBe('Kitchen items');
    });

    test('should allow updating contentsSummary', () => {
      const container = new Container({
        name: 'Test Container',
        inventoryId: 'inv-123',
        createdBy: 'user-123',
        contentsSummary: 'Original contents'
      });

      container.update({ contentsSummary: 'Updated contents' }, 'user-456');
      
      expect(container.contentsSummary).toBe('Updated contents');
      expect(container.updatedBy).toBe('user-456');
    });
  });

  describe('Schema Validation', () => {
    const { validateAndSanitize } = require('../utils/validation');
    const { containerSchema } = require('../utils/schemas');

    test('should validate contentsSummary in schema', () => {
      const containerData = {
        name: 'Test Container',
        inventoryId: '12345678-1234-1234-1234-123456789012',
        createdBy: '12345678-1234-1234-1234-123456789012',
        contentsSummary: 'Kitchen utensils and small appliances'
      };

      const validation = validateAndSanitize(containerData, containerSchema);
      
      expect(validation.valid).toBe(true);
      expect(validation.data.contentsSummary).toBe('Kitchen utensils and small appliances');
    });

    test('should reject contentsSummary exceeding 500 characters', () => {
      const containerData = {
        name: 'Test Container',
        inventoryId: '12345678-1234-1234-1234-123456789012',
        createdBy: '12345678-1234-1234-1234-123456789012',
        contentsSummary: 'a'.repeat(501)
      };

      const validation = validateAndSanitize(containerData, containerSchema);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should sanitize and trim contentsSummary', () => {
      const containerData = {
        name: 'Test Container',
        inventoryId: '12345678-1234-1234-1234-123456789012',
        createdBy: '12345678-1234-1234-1234-123456789012',
        contentsSummary: '  Kitchen items  '
      };

      const validation = validateAndSanitize(containerData, containerSchema);
      
      expect(validation.valid).toBe(true);
      expect(validation.data.contentsSummary).toBe('Kitchen items');
    });
  });
});