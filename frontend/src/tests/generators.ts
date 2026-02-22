/**
 * Property-based test generators for show-password-toggle feature
 * 
 * These generators create random test data for property-based testing
 * using fast-check library. Each generator produces values that represent
 * valid inputs for the password toggle functionality.
 */

import * as fc from 'fast-check';

/**
 * Generates random visibility states for password fields
 * @returns Arbitrary that generates 'masked' or 'visible' states
 */
export const arbitraryVisibilityState = (): fc.Arbitrary<'masked' | 'visible'> => {
  return fc.constantFrom('masked', 'visible');
};

/**
 * Generates random dialog types for authentication flows
 * @returns Arbitrary that generates 'login', 'register', or 'passwordChange' dialog types
 */
export const arbitraryDialogType = (): fc.Arbitrary<'login' | 'register' | 'passwordChange'> => {
  return fc.constantFrom('login', 'register', 'passwordChange');
};

/**
 * Generates random password strings for testing
 * Includes various password patterns: empty, short, long, special characters, etc.
 * @returns Arbitrary that generates random password strings
 */
export const arbitraryPasswordValue = (): fc.Arbitrary<string> => {
  return fc.oneof(
    fc.constant(''), // Empty password
    fc.string({ minLength: 1, maxLength: 8 }), // Short password
    fc.string({ minLength: 8, maxLength: 20 }), // Normal password
    fc.string({ minLength: 20, maxLength: 50 }), // Long password
    fc.stringMatching(/^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/), // Password with special chars
  );
};

/**
 * Generates random keyboard events for Space or Enter keys
 * Used to test keyboard accessibility of the toggle button
 * @returns Arbitrary that generates keyboard event objects for Space or Enter keys
 */
export const arbitraryKeyboardEvent = (): fc.Arbitrary<{ key: string; code: string; keyCode: number }> => {
  return fc.constantFrom(
    { key: ' ', code: 'Space', keyCode: 32 },
    { key: 'Enter', code: 'Enter', keyCode: 13 }
  );
};
