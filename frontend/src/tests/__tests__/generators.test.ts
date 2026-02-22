/**
 * Tests for property-based test generators
 * 
 * Validates that the generators produce correct types and values
 * for use in property-based testing of the show-password-toggle feature.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  arbitraryVisibilityState,
  arbitraryDialogType,
  arbitraryPasswordValue,
  arbitraryKeyboardEvent,
} from '../generators';

describe('Property Test Generators', () => {
  describe('arbitraryVisibilityState', () => {
    it('should generate only "masked" or "visible" states', () => {
      fc.assert(
        fc.property(arbitraryVisibilityState(), (state) => {
          expect(['masked', 'visible']).toContain(state);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('arbitraryDialogType', () => {
    it('should generate only valid dialog types', () => {
      fc.assert(
        fc.property(arbitraryDialogType(), (dialogType) => {
          expect(['login', 'register', 'passwordChange']).toContain(dialogType);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('arbitraryPasswordValue', () => {
    it('should generate string values', () => {
      fc.assert(
        fc.property(arbitraryPasswordValue(), (password) => {
          expect(typeof password).toBe('string');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('arbitraryKeyboardEvent', () => {
    it('should generate only Space or Enter key events', () => {
      fc.assert(
        fc.property(arbitraryKeyboardEvent(), (event) => {
          expect(['Space', 'Enter']).toContain(event.code);
          expect([' ', 'Enter']).toContain(event.key);
          expect([32, 13]).toContain(event.keyCode);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate consistent key event properties', () => {
      fc.assert(
        fc.property(arbitraryKeyboardEvent(), (event) => {
          if (event.code === 'Space') {
            expect(event.key).toBe(' ');
            expect(event.keyCode).toBe(32);
          } else if (event.code === 'Enter') {
            expect(event.key).toBe('Enter');
            expect(event.keyCode).toBe(13);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
