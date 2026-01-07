const { 
  TAG_ERROR_TYPES, 
  createTagValidationError, 
  validateTagFormat, 
  validateTagArray 
} = require('../utils/tagErrorHandler');

describe('Tag Error Handling Tests', () => {
  describe('validateTagFormat', () => {
    test('should return null for valid tags', () => {
      const result = validateTagFormat('valid-tag_123');
      expect(result).toBeNull();
    });

    test('should return error for empty tags', () => {
      const result = validateTagFormat('');
      expect(result).not.toBeNull();
      expect(result.error).toContain('empty');
    });

    test('should return error for tags that are too long', () => {
      const longTag = 'a'.repeat(51);
      const result = validateTagFormat(longTag);
      expect(result).not.toBeNull();
      expect(result.error).toContain('51 characters long');
      expect(result.tagError.details.length).toBe(51);
    });

    test('should return error for tags with invalid characters', () => {
      const result = validateTagFormat('invalid@tag!');
      expect(result).not.toBeNull();
      expect(result.error).toContain('invalid characters');
      expect(result.tagError.details.invalidCharacters).toContain('@');
      expect(result.tagError.details.invalidCharacters).toContain('!');
    });

    test('should return error for whitespace-only tags', () => {
      const result = validateTagFormat('   ');
      expect(result).not.toBeNull();
      expect(result.error).toContain('whitespace');
    });
  });

  describe('validateTagArray', () => {
    test('should validate array of valid tags', () => {
      const result = validateTagArray(['tag1', 'tag-2', 'tag_3']);
      expect(result.valid).toBe(true);
      expect(result.validTags).toEqual(['tag1', 'tag-2', 'tag_3']);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect duplicate tags', () => {
      const result = validateTagArray(['tag1', 'TAG1', 'tag2']);
      expect(result.valid).toBe(true);
      expect(result.validTags).toEqual(['tag1', 'tag2']);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe(TAG_ERROR_TYPES.DUPLICATE_TAG);
    });

    test('should enforce maximum tag limit', () => {
      const result = validateTagArray(['tag1', 'tag2', 'tag3'], 2);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].tagError.type).toBe(TAG_ERROR_TYPES.MAX_TAGS_EXCEEDED);
    });

    test('should handle mixed valid and invalid tags', () => {
      const result = validateTagArray(['valid-tag', 'invalid@tag', '', 'another-valid']);
      expect(result.valid).toBe(false);
      expect(result.validTags).toEqual(['valid-tag', 'another-valid']);
      expect(result.errors).toHaveLength(2); // invalid@tag and empty string
    });

    test('should reject non-array input', () => {
      const result = validateTagArray('not-an-array');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('array');
    });
  });

  describe('createTagValidationError', () => {
    test('should create proper error response structure', () => {
      const error = createTagValidationError(
        TAG_ERROR_TYPES.INVALID_TAG_FORMAT,
        'Custom error message',
        { field: 'test' },
        'request-123'
      );

      expect(error.error).toBe('Custom error message');
      expect(error.statusCode).toBe(400);
      expect(error.requestId).toBe('request-123');
      expect(error.tagError.type).toBe(TAG_ERROR_TYPES.INVALID_TAG_FORMAT);
      expect(error.tagError.details.field).toBe('test');
    });

    test('should use default message when custom message not provided', () => {
      const error = createTagValidationError(TAG_ERROR_TYPES.TAG_TOO_LONG);
      expect(error.error).toContain('too long');
      expect(error.error).toContain('50 characters');
    });
  });
});