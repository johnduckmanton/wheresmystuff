/**
 * Fast-check configuration for property-based testing
 * 
 * Configures default parameters for all property-based tests
 * to ensure consistent behavior across the test suite.
 */

import * as fc from 'fast-check';

/**
 * Default parameters for property-based tests
 * Minimum 100 iterations per property test as per design spec
 */
export const defaultPropertyTestParams: fc.Parameters<unknown> = {
  numRuns: 100, // Minimum 100 iterations per property test
  verbose: true, // Show detailed output on failure
  seed: undefined, // Random seed (can be set for reproducibility)
};

/**
 * Helper function to run property tests with default configuration
 * 
 * @param property - The property to test
 * @param params - Optional parameters to override defaults
 */
export function testProperty<Ts>(
  property: fc.IProperty<Ts>,
  params?: Partial<fc.Parameters<Ts>>
): void {
  fc.assert(property, { ...defaultPropertyTestParams, ...params } as fc.Parameters<Ts>);
}
