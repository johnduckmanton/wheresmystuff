const { normalizeAndValidateTag, validateAndNormalizeTags } = require('../utils/validation');

describe('Tag Validation Tests', () => {
  describe('normalizeAndValidateTag', () => {
    test('should normalize valid tags to lowercase', () => {
      const result = normalizeAndValidateTag('MyTag');
      expect(result.valid).toBe(true);
      expect(result.normalizedTag).toBe('mytag');
      expect(result.error).toBeNull();
    });

    test('should accept alphanumeric characters, hyphens, and underscores', () => {
      const validTags = ['tag123', 'my-tag', 'my_tag', 'TAG-123_test'];
      
      validTags.forEach(tag => {
        const result = normalizeAndValidateTag(tag);
        expect(result.valid).toBe(true);
        expect(result.normalizedTag).toBe(tag.toLowerCase());
        expect(result.error).toBeNull();
      });
    });

    test('should reject tags with invalid characters', () => {
      const invalidTags = ['tag with spaces', 'tag@symbol', 'tag!', 'tag.dot', 'tag/slash'];
      
      invalidTags.forEach(tag => {
        const result = normalizeAndValidateTag(tag);
        expect(result.valid).toBe(false);
        expect(result.normalizedTag).toBeNull();
        expect(result.error).toContain('can only contain letters, numbers, hyphens, and underscores');
      });
    });

    test('should reject empty tags', () => {
      const emptyTags = ['', '   ', null, undefined];
      
      emptyTags.forEach(tag => {
        const result = normalizeAndValidateTag(tag);
        expect(result.valid).toBe(false);
        expect(result.normalizedTag).toBeNull();
        expect(result.error).toContain('cannot be empty');
      });
    });

    test('should reject tags longer than 50 characters', () => {
      const longTag = 'a'.repeat(51);
      const result = normalizeAndValidateTag(longTag);
      expect(result.valid).toBe(false);
      expect(result.normalizedTag).toBeNull();
      expect(result.error).toContain('cannot exceed 50 characters');
    });

    test('should trim whitespace', () => {
      const result = normalizeAndValidateTag('  my-tag  ');
      expect(result.valid).toBe(true);
      expect(result.normalizedTag).toBe('my-tag');
      expect(result.error).toBeNull();
    });
  });

  describe('validateAndNormalizeTags', () => {
    test('should normalize array of valid tags', () => {
      const tags = ['Tag1', 'TAG-2', 'tag_3'];
      const result = validateAndNormalizeTags(tags);
      
      expect(result.valid).toBe(true);
      expect(result.normalizedTags).toEqual(['tag1', 'tag-2', 'tag_3']);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect duplicate tags after normalization', () => {
      const tags = ['Tag1', 'tag1', 'TAG1'];
      const result = validateAndNormalizeTags(tags);
      
      expect(result.valid).toBe(false);
      expect(result.normalizedTags).toBeNull();
      expect(result.errors).toContain('Tag 2: Duplicate tag "tag1"');
      expect(result.errors).toContain('Tag 3: Duplicate tag "tag1"');
    });

    test('should reject non-array input', () => {
      const result = validateAndNormalizeTags('not-an-array');
      
      expect(result.valid).toBe(false);
      expect(result.normalizedTags).toBeNull();
      expect(result.errors).toContain('Tags must be an array');
    });

    test('should handle empty array', () => {
      const result = validateAndNormalizeTags([]);
      
      expect(result.valid).toBe(true);
      expect(result.normalizedTags).toEqual([]);
      expect(result.errors).toHaveLength(0);
    });

    test('should collect multiple validation errors', () => {
      const tags = ['valid-tag', 'invalid tag', '', 'another@invalid'];
      const result = validateAndNormalizeTags(tags);
      
      expect(result.valid).toBe(false);
      expect(result.normalizedTags).toBeNull();
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.some(error => error.includes('can only contain letters'))).toBe(true);
      expect(result.errors.some(error => error.includes('cannot be empty'))).toBe(true);
    });

    test('should preserve order of valid tags', () => {
      const tags = ['zebra', 'alpha', 'beta'];
      const result = validateAndNormalizeTags(tags);
      
      expect(result.valid).toBe(true);
      expect(result.normalizedTags).toEqual(['zebra', 'alpha', 'beta']);
    });
  });
});