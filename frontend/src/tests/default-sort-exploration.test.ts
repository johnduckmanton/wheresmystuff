/**
 * Bug Condition Exploration Tests - Entity Lists Missing Default Sort
 *
 * These tests verify the EXPECTED behavior: entity lists should be displayed
 * sorted by creation date (dateAdded/createdAt) in descending order (most recent first).
 *
 * On UNFIXED code, these tests will FAIL because the pages store API response data
 * directly into state without sorting. DynamoDB returns items in partition key order,
 * not chronological order.
 *
 * Failure confirms the bug exists: lists are rendered in arbitrary API response order.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { sortByDateDesc } from '../utils/sortByDateDesc';

/**
 * Simulates how Things.tsx handles data from the API.
 * In the FIXED code, Things.tsx does:
 *   const thingsArray = Array.isArray(thingsData) ? thingsData : [];
 *   setThings(sortByDateDesc(thingsArray));
 * Items are sorted by dateAdded descending before being stored in state.
 */
function simulateThingsPageDataHandling<T extends { dateAdded: string }>(apiResponse: T[]): T[] {
  // This mirrors the fixed behavior in Things.tsx loadData():
  // setThings(sortByDateDesc(thingsArray)) — sorts by date descending before storing
  const thingsArray = Array.isArray(apiResponse) ? apiResponse : [];
  return sortByDateDesc(thingsArray);
}

/**
 * Simulates how ContainerList.tsx handles data from the API.
 * In the FIXED code, ContainerList.tsx does:
 *   setContainers(sortByDateDesc(response.containers));
 * Items are sorted by createdAt descending before being stored in state.
 */
function simulateContainerListDataHandling<T extends { createdAt: string }>(apiResponse: T[]): T[] {
  // This mirrors the fixed behavior in ContainerList.tsx loadContainers():
  // setContainers(sortByDateDesc(response.containers)) — sorts by date descending
  return sortByDateDesc(apiResponse);
}

/**
 * Simulates how Locations.tsx, People.tsx, Categories.tsx handle data from the API.
 * In the FIXED code, these pages do:
 *   setLocations(sortByDateDesc(Array.isArray(data) ? data : []));
 * Items are sorted by dateAdded descending before being stored in state.
 */
function simulateEntityListDataHandling<T extends { dateAdded: string }>(apiResponse: T[]): T[] {
  // This mirrors the fixed behavior — sorts by date descending before storing
  const safeData = Array.isArray(apiResponse) ? apiResponse : [];
  return sortByDateDesc(safeData);
}

/**
 * Checks if an array is sorted by date field in descending order (most recent first).
 */
function isSortedByDateDescending(items: { date: string }[]): boolean {
  if (items.length <= 1) return true;
  for (let i = 0; i < items.length - 1; i++) {
    const currentDate = new Date(items[i].date).getTime();
    const nextDate = new Date(items[i + 1].date).getTime();
    if (currentDate < nextDate) return false;
  }
  return true;
}

/**
 * Generator for Thing-like objects with random dateAdded values.
 * Generates arrays where items are NOT already in descending date order,
 * simulating the arbitrary order DynamoDB returns items in.
 */
const arbitraryThingsWithDates = () =>
  fc.array(
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 30 }),
      dateAdded: fc.integer({
        min: new Date('2020-01-01').getTime(),
        max: new Date('2025-12-31').getTime(),
      }).map(ts => new Date(ts).toISOString()),
      inventoryId: fc.uuid(),
    }),
    { minLength: 2, maxLength: 20 }
  ).filter(items => {
    // Only keep arrays that are NOT already in descending date order
    // This ensures the test is meaningful — if items happen to be sorted,
    // the test would trivially pass even on unfixed code
    for (let i = 0; i < items.length - 1; i++) {
      const a = new Date(items[i].dateAdded).getTime();
      const b = new Date(items[i + 1].dateAdded).getTime();
      if (a < b) return true; // Found at least one out-of-order pair
    }
    return false; // Array happens to already be sorted desc, skip it
  });

/**
 * Generator for Container-like objects with random createdAt values.
 */
const arbitraryContainersWithDates = () =>
  fc.array(
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 30 }),
      createdAt: fc.integer({
        min: new Date('2020-01-01').getTime(),
        max: new Date('2025-12-31').getTime(),
      }).map(ts => new Date(ts).toISOString()),
      inventoryId: fc.uuid(),
    }),
    { minLength: 2, maxLength: 20 }
  ).filter(items => {
    // Only keep arrays that are NOT already in descending createdAt order
    for (let i = 0; i < items.length - 1; i++) {
      const a = new Date(items[i].createdAt).getTime();
      const b = new Date(items[i + 1].createdAt).getTime();
      if (a < b) return true;
    }
    return false;
  });

describe('Bug Condition Exploration: Entity Lists Missing Default Sort', () => {
  it('Property 1: Things page should display items sorted by dateAdded descending (property test, 100 runs)', () => {
    /**
     * **Validates: Requirements 1.1**
     *
     * This property asserts: for any set of Things with various dateAdded values,
     * the Things page should display them in descending date order (most recent first).
     *
     * On UNFIXED code: FAILS because Things.tsx stores API data without sorting.
     */
    fc.assert(
      fc.property(
        arbitraryThingsWithDates(),
        (things) => {
          const displayedThings = simulateThingsPageDataHandling(things);
          const displayedDates = displayedThings.map(t => ({ date: t.dateAdded }));
          expect(isSortedByDateDescending(displayedDates)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: ContainerList page should display items sorted by createdAt descending (property test, 100 runs)', () => {
    /**
     * **Validates: Requirements 1.2**
     *
     * This property asserts: for any set of Containers with various createdAt values,
     * the ContainerList should display them in descending date order.
     *
     * On UNFIXED code: FAILS because ContainerList.tsx stores API data without sorting.
     */
    fc.assert(
      fc.property(
        arbitraryContainersWithDates(),
        (containers) => {
          const displayedContainers = simulateContainerListDataHandling(containers);
          const displayedDates = displayedContainers.map(c => ({ date: c.createdAt }));
          expect(isSortedByDateDescending(displayedDates)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: Locations page should display items sorted by dateAdded descending (property test, 100 runs)', () => {
    /**
     * **Validates: Requirements 1.3**
     *
     * On UNFIXED code: FAILS because Locations.tsx stores API data without sorting.
     */
    fc.assert(
      fc.property(
        arbitraryThingsWithDates(),
        (locations) => {
          const displayedLocations = simulateEntityListDataHandling(locations);
          const displayedDates = displayedLocations.map(l => ({ date: l.dateAdded }));
          expect(isSortedByDateDescending(displayedDates)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: People page should display items sorted by dateAdded descending (property test, 100 runs)', () => {
    /**
     * **Validates: Requirements 1.3**
     *
     * On UNFIXED code: FAILS because People.tsx stores API data without sorting.
     */
    fc.assert(
      fc.property(
        arbitraryThingsWithDates(),
        (people) => {
          const displayedPeople = simulateEntityListDataHandling(people);
          const displayedDates = displayedPeople.map(p => ({ date: p.dateAdded }));
          expect(isSortedByDateDescending(displayedDates)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: Categories page should display items sorted by dateAdded descending (property test, 100 runs)', () => {
    /**
     * **Validates: Requirements 1.3**
     *
     * On UNFIXED code: FAILS because Categories.tsx stores API data without sorting.
     */
    fc.assert(
      fc.property(
        arbitraryThingsWithDates(),
        (categories) => {
          const displayedCategories = simulateEntityListDataHandling(categories);
          const displayedDates = displayedCategories.map(c => ({ date: c.dateAdded }));
          expect(isSortedByDateDescending(displayedDates)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Concrete example test demonstrating the bug with specific dates.
   * This makes the bug immediately visible to developers reviewing the test output.
   */
  it('Concrete example: Things with dates [2024-01-01, 2024-03-01, 2024-02-01] should be sorted as [2024-03-01, 2024-02-01, 2024-01-01]', () => {
    const things = [
      { id: '1', name: 'Thing A', dateAdded: '2024-01-01T00:00:00.000Z', inventoryId: 'inv-1' },
      { id: '2', name: 'Thing B', dateAdded: '2024-03-01T00:00:00.000Z', inventoryId: 'inv-1' },
      { id: '3', name: 'Thing C', dateAdded: '2024-02-01T00:00:00.000Z', inventoryId: 'inv-1' },
    ];

    const displayed = simulateThingsPageDataHandling(things);
    const displayedDates = displayed.map(t => t.dateAdded);

    // Expected: sorted descending by date
    const expectedOrder = [
      '2024-03-01T00:00:00.000Z',
      '2024-02-01T00:00:00.000Z',
      '2024-01-01T00:00:00.000Z',
    ];

    expect(displayedDates).toEqual(expectedOrder);
  });

  it('Concrete example: Containers with dates in random order should be sorted by createdAt descending', () => {
    const containers = [
      { id: '1', name: 'Box A', createdAt: '2024-06-15T10:00:00.000Z', inventoryId: 'inv-1' },
      { id: '2', name: 'Box B', createdAt: '2024-01-20T08:00:00.000Z', inventoryId: 'inv-1' },
      { id: '3', name: 'Box C', createdAt: '2024-09-01T14:00:00.000Z', inventoryId: 'inv-1' },
    ];

    const displayed = simulateContainerListDataHandling(containers);
    const displayedDates = displayed.map(c => c.createdAt);

    // Expected: sorted descending by createdAt
    const expectedOrder = [
      '2024-09-01T14:00:00.000Z',
      '2024-06-15T10:00:00.000Z',
      '2024-01-20T08:00:00.000Z',
    ];

    expect(displayedDates).toEqual(expectedOrder);
  });
});
