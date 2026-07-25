/**
 * Bug Condition Exploration Test - Special Characters HTML-Entity-Encoded on Storage
 *
 * This test encodes the EXPECTED (correct) behavior: sanitizeString() should preserve
 * literal special characters without HTML-entity-encoding them.
 *
 * On UNFIXED code, this test is EXPECTED TO FAIL — failure confirms the bug exists.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

const fc = require('fast-check');
const { sanitizeString, validateAndSanitize } = require('../utils/validation');

describe('Bug Condition: sanitizeString() HTML-entity-encodes special characters', () => {

  /**
   * Property 1: Special characters should be preserved literally in output.
   * Generates strings containing at least one of &, ', /, " (avoiding dangerous HTML patterns).
   * Asserts the output does NOT contain HTML entities and preserves the literal characters.
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   */
  it('should preserve literal special characters without HTML-entity-encoding', () => {
    // Generate strings that contain special characters but no dangerous HTML patterns
    const specialChars = ['&', "'", '/', '"'];
    const safeAlphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-_:;()';

    const stringWithSpecialChars = fc.gen().map((gen) => {
      // Build a string with at least one special character interspersed with safe chars
      const length = gen(fc.integer, { min: 3, max: 50 });
      const insertPositions = new Set();
      // Ensure at least one special char
      insertPositions.add(gen(fc.integer, { min: 0, max: length - 1 }));
      // Maybe add more
      const extraCount = gen(fc.integer, { min: 0, max: 3 });
      for (let i = 0; i < extraCount; i++) {
        insertPositions.add(gen(fc.integer, { min: 0, max: length - 1 }));
      }

      let result = '';
      for (let i = 0; i < length; i++) {
        if (insertPositions.has(i)) {
          const charIdx = gen(fc.integer, { min: 0, max: specialChars.length - 1 });
          result += specialChars[charIdx];
        } else {
          const charIdx = gen(fc.integer, { min: 0, max: safeAlphabet.length - 1 });
          result += safeAlphabet[charIdx];
        }
      }
      return result;
    });

    fc.assert(
      fc.property(stringWithSpecialChars, (input) => {
        const output = sanitizeString(input);

        // Output should NOT contain HTML entities
        expect(output).not.toMatch(/&amp;/);
        expect(output).not.toMatch(/&#x27;/);
        expect(output).not.toMatch(/&#x2F;/);
        expect(output).not.toMatch(/&quot;/);

        // Output should preserve the literal special characters from input
        for (const char of specialChars) {
          if (input.includes(char)) {
            expect(output).toContain(char);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Length inflation - strings with special characters near maxLength
   * should NOT be rejected due to encoding inflation when validated via schema.
   *
   * Generate a string of 253 chars with 2 ampersands and maxLength=255.
   * The current buggy code encodes & to &amp; (5 chars each), so 253 + 2*4 = 261 > 255.
   * validateAndSanitize checks length AFTER encoding, so it throws.
   * The correct behavior: 253 chars with 2 ampersands is within 255, should NOT throw.
   *
   * **Validates: Requirements 1.6**
   */
  it('should NOT reject strings within maxLength due to encoding inflation', () => {
    const safeChars = 'abcdefghijklmnopqrstuvwxyz';

    const stringNearMaxLength = fc.gen().map((gen) => {
      const totalLength = 253;
      // Place 2 ampersands at random positions
      const pos1 = gen(fc.integer, { min: 0, max: totalLength - 2 });
      let pos2 = gen(fc.integer, { min: 0, max: totalLength - 2 });
      if (pos2 === pos1) pos2 = (pos1 + 1) % totalLength;

      let result = '';
      for (let i = 0; i < totalLength; i++) {
        if (i === pos1 || i === pos2) {
          result += '&';
        } else {
          const charIdx = gen(fc.integer, { min: 0, max: safeChars.length - 1 });
          result += safeChars[charIdx];
        }
      }
      return result;
    });

    const schema = {
      type: 'string',
      maxLength: 255
    };

    fc.assert(
      fc.property(stringNearMaxLength, (input) => {
        // Input is 253 chars, maxLength is 255 — should be valid
        expect(input.length).toBe(253);
        const result = validateAndSanitize(input, schema);
        // The correct behavior: validation should succeed (input is within 255 chars)
        expect(result.valid).toBe(true);
        // The result data should be the same length or shorter (not inflated)
        if (result.data) {
          expect(result.data.length).toBeLessThanOrEqual(255);
        }
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 3: Idempotency - applying sanitizeString twice should produce the same result.
   * On buggy code, sanitizeString("&") → "&amp;" → "&amp;amp;" (double-encoding).
   *
   * **Validates: Requirements 1.5**
   */
  it('should be idempotent: sanitizeString(sanitizeString(x)) === sanitizeString(x)', () => {
    const specialChars = ['&', "'", '/', '"'];
    const safeAlphabet = 'abcdefghijklmnopqrstuvwxyz0123456789 .,!?-_';

    const stringWithSpecialChars = fc.gen().map((gen) => {
      const length = gen(fc.integer, { min: 2, max: 30 });
      let result = '';
      // Ensure at least one special char
      const specialPos = gen(fc.integer, { min: 0, max: length - 1 });
      for (let i = 0; i < length; i++) {
        if (i === specialPos) {
          const charIdx = gen(fc.integer, { min: 0, max: specialChars.length - 1 });
          result += specialChars[charIdx];
        } else {
          const charIdx = gen(fc.integer, { min: 0, max: safeAlphabet.length - 1 });
          result += safeAlphabet[charIdx];
        }
      }
      return result;
    });

    fc.assert(
      fc.property(stringWithSpecialChars, (input) => {
        const once = sanitizeString(input);
        const twice = sanitizeString(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 100 }
    );
  });
});
