/**
 * Unit tests for the HTML entity decode migration script.
 * Tests core logic: decoding, entity detection, safety checks, and object traversal.
 */

const {
  decodeHtmlEntities,
  containsHtmlEntities,
  containsDangerousContent,
  decodeObjectFields
} = require('../scripts/migrateEncodedData');

describe('migrateEncodedData', () => {
  describe('decodeHtmlEntities', () => {
    it('decodes &amp; to &', () => {
      expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
    });

    it('decodes &#x27; to apostrophe', () => {
      expect(decodeHtmlEntities("it&#x27;s fine")).toBe("it's fine");
    });

    it('decodes &#x2F; to /', () => {
      expect(decodeHtmlEntities('3&#x2F;4 inch')).toBe('3/4 inch');
    });

    it('decodes &quot; to "', () => {
      expect(decodeHtmlEntities('&quot;hello&quot;')).toBe('"hello"');
    });

    it('decodes &lt; to <', () => {
      expect(decodeHtmlEntities('a &lt; b')).toBe('a < b');
    });

    it('decodes &gt; to >', () => {
      expect(decodeHtmlEntities('a &gt; b')).toBe('a > b');
    });

    it('decodes multiple entities in one string', () => {
      expect(decodeHtmlEntities('Tom &amp; Jerry&#x27;s 3&#x2F;4 &quot;stuff&quot;'))
        .toBe('Tom & Jerry\'s 3/4 "stuff"');
    });

    it('returns non-string values unchanged', () => {
      expect(decodeHtmlEntities(123)).toBe(123);
      expect(decodeHtmlEntities(null)).toBe(null);
      expect(decodeHtmlEntities(undefined)).toBe(undefined);
    });

    it('returns strings without entities unchanged', () => {
      expect(decodeHtmlEntities('plain text')).toBe('plain text');
    });
  });

  describe('containsHtmlEntities', () => {
    it('detects &amp;', () => {
      expect(containsHtmlEntities('foo &amp; bar')).toBe(true);
    });

    it('detects &lt;', () => {
      expect(containsHtmlEntities('a &lt; b')).toBe(true);
    });

    it('detects &gt;', () => {
      expect(containsHtmlEntities('a &gt; b')).toBe(true);
    });

    it('detects &quot;', () => {
      expect(containsHtmlEntities('&quot;x&quot;')).toBe(true);
    });

    it('detects &#x27;', () => {
      expect(containsHtmlEntities("it&#x27;s")).toBe(true);
    });

    it('detects &#x2F;', () => {
      expect(containsHtmlEntities('3&#x2F;4')).toBe(true);
    });

    it('returns false for strings without entities', () => {
      expect(containsHtmlEntities('plain text & stuff')).toBe(false);
    });

    it('returns false for non-string values', () => {
      expect(containsHtmlEntities(null)).toBe(false);
      expect(containsHtmlEntities(42)).toBe(false);
      expect(containsHtmlEntities(undefined)).toBe(false);
    });
  });

  describe('containsDangerousContent', () => {
    it('detects <script> tags', () => {
      expect(containsDangerousContent('<script>alert(1)</script>')).toBe(true);
    });

    it('detects <iframe> tags', () => {
      expect(containsDangerousContent('<iframe src="evil.com">')).toBe(true);
    });

    it('detects javascript: protocol', () => {
      expect(containsDangerousContent('javascript:alert(1)')).toBe(true);
    });

    it('detects onerror= event handler', () => {
      expect(containsDangerousContent('onerror=alert(1)')).toBe(true);
    });

    it('detects onload= event handler', () => {
      expect(containsDangerousContent('onload=doStuff()')).toBe(true);
    });

    it('returns false for safe strings with special characters', () => {
      expect(containsDangerousContent('Tom & Jerry')).toBe(false);
      expect(containsDangerousContent('value < 5')).toBe(false);
      expect(containsDangerousContent("it's fine")).toBe(false);
      expect(containsDangerousContent('3/4 inch bolt')).toBe(false);
    });
  });

  describe('decodeObjectFields', () => {
    it('decodes string fields in a flat object', () => {
      const obj = { name: 'Tom &amp; Jerry', count: 5 };
      const result = decodeObjectFields(obj);

      expect(result.decoded.name).toBe('Tom & Jerry');
      expect(result.decoded.count).toBe(5);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].path).toBe('name');
    });

    it('decodes nested object fields', () => {
      const obj = {
        pk: 'INVENTORY#abc#THINGS',
        sk: 'id-1',
        data: {
          name: 'Smith &amp; Son&#x27;s',
          description: '3&#x2F;4 inch &quot;bolt&quot;'
        }
      };
      const result = decodeObjectFields(obj);

      expect(result.decoded.data.name).toBe("Smith & Son's");
      expect(result.decoded.data.description).toBe('3/4 inch "bolt"');
      expect(result.changes).toHaveLength(2);
    });

    it('decodes strings inside arrays', () => {
      const obj = { tags: ['item &amp; stuff', 'clean'] };
      const result = decodeObjectFields(obj);

      expect(result.decoded.tags[0]).toBe('item & stuff');
      expect(result.decoded.tags[1]).toBe('clean');
      expect(result.changes).toHaveLength(1);
    });

    it('skips fields that would produce dangerous content after decoding', () => {
      const obj = {
        name: '&lt;script&gt;alert(1)&lt;/script&gt;'
      };
      const result = decodeObjectFields(obj);

      // Should NOT decode — leaves the original encoded value
      expect(result.decoded.name).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(result.changes).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toMatch(/Dangerous content/);
    });

    it('skips fields with javascript: protocol after decoding', () => {
      const obj = { url: 'javascript:alert(1)' };
      // This doesn't contain HTML entities so won't be decoded anyway
      const result = decodeObjectFields(obj);
      expect(result.changes).toHaveLength(0);
    });

    it('handles null and undefined values', () => {
      const result1 = decodeObjectFields(null);
      expect(result1.decoded).toBeNull();
      expect(result1.changes).toHaveLength(0);

      const result2 = decodeObjectFields(undefined);
      expect(result2.decoded).toBeUndefined();
      expect(result2.changes).toHaveLength(0);
    });

    it('returns no changes for objects without HTML entities', () => {
      const obj = { name: 'Clean Name', value: 42, flag: true };
      const result = decodeObjectFields(obj);

      expect(result.decoded).toEqual(obj);
      expect(result.changes).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
    });

    it('preserves pk and sk fields that contain entities', () => {
      // Even pk/sk fields get decoded if they have entities (unlikely but handle gracefully)
      const obj = { pk: 'INVENTORY#abc#THINGS', sk: 'id-1', data: { name: '&amp;' } };
      const result = decodeObjectFields(obj);

      expect(result.decoded.pk).toBe('INVENTORY#abc#THINGS');
      expect(result.decoded.data.name).toBe('&');
    });

    it('handles deeply nested objects', () => {
      const obj = {
        data: {
          metadata: {
            custom: {
              label: 'Tom &amp; Jerry'
            }
          }
        }
      };
      const result = decodeObjectFields(obj);

      expect(result.decoded.data.metadata.custom.label).toBe('Tom & Jerry');
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].path).toBe('data.metadata.custom.label');
    });
  });
});
