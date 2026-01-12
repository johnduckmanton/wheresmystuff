const { validateAndSanitize } = require('../utils/validation');
const { thingSchema } = require('../utils/schemas');

describe('Thing Project Assignment Schema Tests', () => {
  const mockInventoryId = '12345678-1234-1234-1234-123456789012';
  const mockProjectId = '87654321-4321-4321-4321-210987654321';

  describe('Schema validation for projectId field', () => {
    test('should accept valid projectId in thing data', () => {
      const thingData = {
        name: 'Test Item',
        inventoryId: mockInventoryId,
        projectId: mockProjectId,
        description: 'Test item for project assignment'
      };

      const validation = validateAndSanitize(thingData, thingSchema);
      
      expect(validation.valid).toBe(true);
      expect(validation.data.projectId).toBe(mockProjectId);
    });

    test('should accept thing data without projectId (optional field)', () => {
      const thingData = {
        name: 'Test Item',
        inventoryId: mockInventoryId,
        description: 'Test item without project assignment'
      };

      const validation = validateAndSanitize(thingData, thingSchema);
      
      expect(validation.valid).toBe(true);
      expect(validation.data.projectId).toBeUndefined();
    });

    test('should reject invalid projectId format', () => {
      const thingData = {
        name: 'Test Item',
        inventoryId: mockInventoryId,
        projectId: 'invalid-project-id', // Invalid UUID format
        description: 'Test item with invalid project ID'
      };

      const validation = validateAndSanitize(thingData, thingSchema);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('projectId does not match required pattern');
    });

    test('should accept empty string projectId (removes assignment)', () => {
      const thingData = {
        name: 'Test Item',
        inventoryId: mockInventoryId,
        projectId: '', // Empty string to remove assignment
        description: 'Test item without project assignment'
      };

      const validation = validateAndSanitize(thingData, thingSchema);
      
      expect(validation.valid).toBe(true);
      // Empty string should be converted to undefined or removed
      expect(validation.data.projectId === '' || validation.data.projectId === undefined).toBe(true);
    });
  });
});