/**
 * Preservation Property Tests - XSS Prevention and Length Validation Maintained
 *
 * These tests define the PRESERVATION CONTRACT that must hold both BEFORE and AFTER
 * the bugfix. They verify:
 * 1. XSS prevention: dangerous HTML vectors are never executable in the output
 * 2. Length validation: strings exceeding maxLength are always rejected
 * 3. Idempotency: sanitizing safe strings twice produces the same result
 *
 * On UNFIXED code: Tests PASS (XSS is prevented via encoding, length works, safe idempotency holds)
 * On FIXED code: Tests PASS (XSS is prevented via stripping, length works, safe idempotency holds)
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

const fc = require('fast-check');
const { sanitizeString } = require('../utils/validation');

describe('Preservation: XSS Prevention Maintained', () => {

  /**
   * Property: For all generated strings containing dangerous HTML script tags,
   * the output of sanitizeString SHALL NOT contain executable <script vectors.
   *
   * **Validates: Requirements 3.1**
   */
  it('should prevent <script> tag execution in output', () => {
    const dangerousTags = ['script', 'SCRIPT', 'Script', 'sCrIpT'];
    const payloads = ['alert(1)', 'alert("xss")', 'document.cookie', 'eval("exploit")'];

    const scriptInjection = fc.record({
      tag: fc.constantFrom(...dangerousTags),
      payload: fc.constantFrom(...payloads),
      prefix: fc.string({ minLength: 0, maxLength: 10 }),
      suffix: fc.string({ minLength: 0, maxLength: 10 })
    }).map(({ tag, payload, prefix, suffix }) => {
      return `${prefix}<${tag}>${payload}</${tag}>${suffix}`;
    });

    fc.assert(
      fc.property(scriptInjection, (input) => {
        const output = sanitizeString(input);
        // Output must NOT contain an executable <script tag (case-insensitive)
        expect(output.toLowerCase()).not.toMatch(/<script/);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For all generated strings containing <iframe> tags,
   * the output SHALL NOT contain executable <iframe vectors.
   *
   * **Validates: Requirements 3.1**
   */
  it('should prevent <iframe> tag execution in output', () => {
    const iframeSources = ['evil.com', 'http://malicious.org', 'data:text/html,<script>alert(1)</script>'];

    const iframeInjection = fc.record({
      src: fc.constantFrom(...iframeSources),
      prefix: fc.string({ minLength: 0, maxLength: 10 }),
      suffix: fc.string({ minLength: 0, maxLength: 10 })
    }).map(({ src, prefix, suffix }) => {
      return `${prefix}<iframe src="${src}"></iframe>${suffix}`;
    });

    fc.assert(
      fc.property(iframeInjection, (input) => {
        const output = sanitizeString(input);
        // Output must NOT contain an executable <iframe tag
        expect(output.toLowerCase()).not.toMatch(/<iframe/);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For all generated strings containing <object> or <embed> tags,
   * the output SHALL NOT contain those executable vectors.
   *
   * **Validates: Requirements 3.1**
   */
  it('should prevent <object> and <embed> tag execution in output', () => {
    const dangerousTag = fc.constantFrom('object', 'embed', 'OBJECT', 'EMBED');
    const attrs = fc.constantFrom('data="evil.swf"', 'src="malicious.js"', 'type="application/x-shockwave-flash"');

    const objectEmbedInjection = fc.record({
      tag: dangerousTag,
      attr: attrs,
      prefix: fc.string({ minLength: 0, maxLength: 8 }),
    }).map(({ tag, attr, prefix }) => {
      return `${prefix}<${tag} ${attr}></${tag}>`;
    });

    fc.assert(
      fc.property(objectEmbedInjection, (input) => {
        const output = sanitizeString(input);
        // Output must NOT contain executable <object or <embed tags
        expect(output.toLowerCase()).not.toMatch(/<object/);
        expect(output.toLowerCase()).not.toMatch(/<embed/);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For all generated strings containing the javascript: protocol,
   * the output SHALL NOT contain the javascript: protocol string.
   *
   * **Validates: Requirements 3.2**
   */
  it('should remove javascript: protocol from output', () => {
    const jsPayloads = ['alert(1)', 'alert(document.cookie)', 'void(0)', 'eval("exploit")'];
    const caseVariations = ['javascript:', 'JavaScript:', 'JAVASCRIPT:', 'jAvAsCrIpT:'];

    const jsProtocolInjection = fc.record({
      protocol: fc.constantFrom(...caseVariations),
      payload: fc.constantFrom(...jsPayloads),
      prefix: fc.string({ minLength: 0, maxLength: 10 }),
    }).map(({ protocol, payload, prefix }) => {
      return `${prefix}${protocol}${payload}`;
    });

    fc.assert(
      fc.property(jsProtocolInjection, (input) => {
        const output = sanitizeString(input);
        // Output must NOT contain the javascript: protocol (case-insensitive)
        expect(output.toLowerCase()).not.toMatch(/javascript:/);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For all generated strings containing event handler attributes
   * within HTML-like tags, the output SHALL NOT contain executable event handler
   * patterns (the tag itself must not be executable).
   *
   * **Validates: Requirements 3.1**
   */
  it('should prevent event handler execution within HTML tags in output', () => {
    const eventHandlers = ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'];
    const tagNames = ['img', 'svg', 'body', 'div', 'input', 'a'];
    const payloads = ['alert(1)', 'alert("xss")', 'document.cookie'];

    const eventHandlerInjection = fc.record({
      tag: fc.constantFrom(...tagNames),
      handler: fc.constantFrom(...eventHandlers),
      payload: fc.constantFrom(...payloads),
    }).map(({ tag, handler, payload }) => {
      return `<${tag} ${handler}=${payload}>`;
    });

    fc.assert(
      fc.property(eventHandlerInjection, (input) => {
        const output = sanitizeString(input);
        // The output must not contain an executable HTML tag with the event handler.
        // The key assertion: the output must not have a literal '<tagname' pattern
        // because that would make the event handler attribute executable in a browser.
        const tagMatch = input.match(/<(\w+)/);
        if (tagMatch) {
          const tagName = tagMatch[1].toLowerCase();
          // The output must NOT contain a literal opening tag that could be parsed by a browser
          expect(output.toLowerCase()).not.toMatch(new RegExp(`<${tagName}\\s`));
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Structured generator combining dangerous tag names × attributes × content.
   * For all combinations, the output SHALL NOT contain any executable script vector.
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it('should prevent all dangerous tag × attribute × content combinations', () => {
    const dangerousTagNames = ['script', 'iframe', 'object', 'embed'];
    const dangerousAttributes = ['src', 'onerror', 'onload', 'data', 'href'];
    const dangerousContent = ['alert(1)', 'javascript:void(0)', 'eval("x")', ''];

    const structuredXss = fc.record({
      tag: fc.constantFrom(...dangerousTagNames),
      attr: fc.constantFrom(...dangerousAttributes),
      attrValue: fc.constantFrom('evil.js', 'javascript:alert(1)', 'http://attacker.com'),
      content: fc.constantFrom(...dangerousContent),
    }).map(({ tag, attr, attrValue, content }) => {
      if (content) {
        return `<${tag} ${attr}="${attrValue}">${content}</${tag}>`;
      }
      return `<${tag} ${attr}="${attrValue}"/>`;
    });

    fc.assert(
      fc.property(structuredXss, (input) => {
        const output = sanitizeString(input);
        const lowerOutput = output.toLowerCase();

        // No executable script vectors in output
        expect(lowerOutput).not.toMatch(/<script/);
        expect(lowerOutput).not.toMatch(/<iframe/);
        expect(lowerOutput).not.toMatch(/<object/);
        expect(lowerOutput).not.toMatch(/<embed/);
        expect(lowerOutput).not.toMatch(/javascript:/);
      }),
      { numRuns: 200 }
    );
  });
});

describe('Preservation: Length Validation Maintained', () => {

  /**
   * Property: For all generated strings where str.length > maxLength,
   * sanitizeString(str, maxLength) SHALL throw an error.
   *
   * Note: The current code checks length AFTER trimming but BEFORE encoding.
   * So we generate strings that are longer than maxLength after trimming.
   *
   * **Validates: Requirements 3.3**
   */
  it('should reject strings longer than maxLength', () => {
    const safeChars = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');

    const tooLongString = fc.record({
      maxLength: fc.integer({ min: 5, max: 50 }),
      extraLength: fc.integer({ min: 1, max: 20 }),
    }).chain(({ maxLength, extraLength }) => {
      const totalLength = maxLength + extraLength;
      return fc.record({
        maxLength: fc.constant(maxLength),
        str: fc.array(fc.constantFrom(...safeChars), { minLength: totalLength, maxLength: totalLength })
          .map(chars => chars.join('')),
      });
    });

    fc.assert(
      fc.property(tooLongString, ({ str, maxLength }) => {
        // The input (after trimming) is longer than maxLength
        expect(str.trim().length).toBeGreaterThan(maxLength);
        // sanitizeString should throw
        expect(() => sanitizeString(str, maxLength)).toThrow();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For all generated strings where str.length <= maxLength
   * (and no dangerous HTML that would be modified), sanitizeString SHALL NOT throw.
   *
   * We use safe strings (no HTML, no special chars that get encoded) to ensure
   * the string is not modified by the current encoding logic.
   *
   * **Validates: Requirements 3.3**
   */
  it('should accept safe strings within maxLength without throwing', () => {
    // Characters that won't be modified by the current encoding and won't be trimmed
    const safeChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-_:;()@#$%^*+=[]{}|~'.split('');

    const withinLimitString = fc.record({
      maxLength: fc.integer({ min: 10, max: 100 }),
    }).chain(({ maxLength }) => {
      return fc.record({
        maxLength: fc.constant(maxLength),
        str: fc.array(fc.constantFrom(...safeChars), { minLength: 1, maxLength: maxLength })
          .map(chars => chars.join('')),
      });
    });

    fc.assert(
      fc.property(withinLimitString, ({ str, maxLength }) => {
        // String doesn't have leading/trailing spaces so trimming won't change length
        expect(str.length).toBeLessThanOrEqual(maxLength);
        // sanitizeString should NOT throw
        expect(() => sanitizeString(str, maxLength)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });
});

describe('Preservation: Idempotent Sanitization for Safe Strings', () => {

  /**
   * Property: For all generated safe strings (no dangerous HTML, no characters that
   * get encoded differently on second pass), sanitizeString(sanitizeString(x)) === sanitizeString(x).
   *
   * This holds for the current code because safe strings without & < > " ' / are not
   * modified by the encoding logic.
   *
   * **Validates: Requirements 3.5**
   */
  it('should be idempotent for safe strings without HTML special characters', () => {
    // Characters that are NOT modified by the current sanitizeString encoding
    const safeChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-_:;()@#$%^*+=[]{}|~'.split('');

    const safeString = fc.array(fc.constantFrom(...safeChars), { minLength: 1, maxLength: 50 })
      .map(chars => chars.join(''));

    fc.assert(
      fc.property(safeString, (input) => {
        const once = sanitizeString(input);
        const twice = sanitizeString(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Property: Idempotency specifically for alphanumeric strings with spaces.
   * These are the most common user inputs and must always be idempotent.
   *
   * **Validates: Requirements 3.5**
   */
  it('should be idempotent for alphanumeric strings with common punctuation', () => {
    const commonChars = 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-_'.split('');

    const commonInput = fc.array(fc.constantFrom(...commonChars), { minLength: 1, maxLength: 80 })
      .map(chars => chars.join(''));

    fc.assert(
      fc.property(commonInput, (input) => {
        const once = sanitizeString(input);
        const twice = sanitizeString(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 200 }
    );
  });
});
