const { 
  TAG_ERROR_TYPES, 
  createTagValidationError, 
  validateTagFormat 
} = require('../utils/tagErrorHandler');

describe('Simple Error Handling Tests', () => {
  test('should create tag validation error', () => {
    const error = createTagValidationError(
      TAG_ERROR_TYPES.INVALID_TAG_FORMAT,
      'Test error message'
    );

    expect(error.error).toBe('Test error message');
    expect(error.statusCode).toBe(400);
  });

  test('should validate tag format correctly', () => {
    // Valid tag
    expect(validateTagFormat('valid-tag')).toBeNull();
    
    // Invalid tag
    const result = validateTagFormat('invalid@tag');
    expect(result).not.toBeNull();
    expect(result.error).toContain('invalid characters');
  });
});