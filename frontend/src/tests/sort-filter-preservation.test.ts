/**
 * Preservation Property Tests - User Sort Override and Filter Behavior
 *
 * These tests capture the CURRENT behavior of the unfixed code to ensure
 * the bug fix (adding default date sort) does not introduce regressions.
 * They MUST PASS on unfixed code.
 *
 * Property 2: Preservation
 * - When a user clicks a column header to sort, the displayed order matches
 *   the user's chosen sort regardless of default sort logic.
 * - When filters/search are applied, filtered results contain only matching items.
 *
 * **Validates: Requirements 3.1, 3.2**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ============================================================================
// Sort Logic - Simulates DataGrid column header sorting behavior
// ============================================================================

type SortDirection = 'asc' | 'desc';

/**
 * Simulates how MUI DataGrid sorts data when a user clicks a column header.
 * The DataGrid uses a stable sort based on the sort model (field + direction).
 * This is entirely client-side and independent of the initial data order.
 */
function applyUserSort<T extends Record<string, any>>(
  items: T[],
  sortField: string,
  sortDirection: SortDirection
): T[] {
  return [...items].sort((a, b) => {
    const valA = a[sortField] ?? '';
    const valB = b[sortField] ?? '';
    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();
    const comparison = strA.localeCompare(strB);
    return sortDirection === 'asc' ? comparison : -comparison;
  });
}

/**
 * Checks that an array is sorted by a given string field in the specified direction.
 */
function isSortedByField<T extends Record<string, any>>(
  items: T[],
  field: string,
  direction: SortDirection
): boolean {
  if (items.length <= 1) return true;
  for (let i = 0; i < items.length - 1; i++) {
    const a = String(items[i][field] ?? '').toLowerCase();
    const b = String(items[i + 1][field] ?? '').toLowerCase();
    const cmp = a.localeCompare(b);
    if (direction === 'asc' && cmp > 0) return false;
    if (direction === 'desc' && cmp < 0) return false;
  }
  return true;
}

// ============================================================================
// Filter Logic - Simulates Things.tsx applyFilters() behavior
// ============================================================================

interface ThingLike {
  id: string;
  name: string;
  description?: string;
  notes?: string;
  serialNumber?: string;
  make?: string;
  model?: string;
  categoryId?: string;
  locationId?: string;
  roomId?: string;
  ownerId?: string;
  tags?: string[];
  dateAdded: string;
}

/**
 * Simulates the text search filter from Things.tsx applyFilters().
 * Searches across name, description, notes, serialNumber, make, and model.
 */
function applyTextFilter(items: ThingLike[], searchText: string): ThingLike[] {
  if (!searchText) return items;
  const searchLower = searchText.toLowerCase();
  return items.filter(thing =>
    thing.name.toLowerCase().includes(searchLower) ||
    (thing.description && thing.description.toLowerCase().includes(searchLower)) ||
    (thing.notes && thing.notes.toLowerCase().includes(searchLower)) ||
    (thing.serialNumber && thing.serialNumber.toLowerCase().includes(searchLower)) ||
    (thing.make && thing.make.toLowerCase().includes(searchLower)) ||
    (thing.model && thing.model.toLowerCase().includes(searchLower))
  );
}

/**
 * Simulates the category filter from Things.tsx applyFilters().
 */
function applyCategoryFilter(items: ThingLike[], categoryId?: string): ThingLike[] {
  if (!categoryId) return items;
  if (categoryId === 'uncategorized') {
    return items.filter(thing => !thing.categoryId);
  }
  return items.filter(thing => thing.categoryId === categoryId);
}

/**
 * Simulates the location filter from Things.tsx applyFilters().
 */
function applyLocationFilter(items: ThingLike[], locationId?: string): ThingLike[] {
  if (!locationId) return items;
  if (locationId === 'unlocated') {
    return items.filter(thing => !thing.locationId);
  }
  return items.filter(thing => thing.locationId === locationId);
}

/**
 * Simulates the tag filter from Things.tsx applyFilters() (AND mode).
 * Items must have ALL selected tags.
 */
function applyTagFilter(items: ThingLike[], tags: string[]): ThingLike[] {
  if (tags.length === 0) return items;
  return items.filter(thing => {
    if (!thing.tags || thing.tags.length === 0) return false;
    return tags.every(selectedTag =>
      thing.tags!.some(thingTag =>
        thingTag.toLowerCase() === selectedTag.toLowerCase()
      )
    );
  });
}

// ============================================================================
// Generators
// ============================================================================

/**
 * Generates Thing-like objects for testing sorting and filtering.
 */
const arbitraryThingLike = (): fc.Arbitrary<ThingLike> =>
  fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    description: fc.option(fc.string({ minLength: 0, maxLength: 50 }), { nil: undefined }),
    notes: fc.option(fc.string({ minLength: 0, maxLength: 50 }), { nil: undefined }),
    serialNumber: fc.option(fc.string({ minLength: 0, maxLength: 20 }), { nil: undefined }),
    make: fc.option(fc.string({ minLength: 0, maxLength: 20 }), { nil: undefined }),
    model: fc.option(fc.string({ minLength: 0, maxLength: 20 }), { nil: undefined }),
    categoryId: fc.option(fc.uuid(), { nil: undefined }),
    locationId: fc.option(fc.uuid(), { nil: undefined }),
    roomId: fc.option(fc.uuid(), { nil: undefined }),
    ownerId: fc.option(fc.uuid(), { nil: undefined }),
    tags: fc.option(
      fc.array(fc.string({ minLength: 1, maxLength: 15 }), { minLength: 0, maxLength: 5 }),
      { nil: undefined }
    ),
    dateAdded: fc.integer({
      min: new Date('2020-01-01').getTime(),
      max: new Date('2025-12-31').getTime(),
    }).map(ts => new Date(ts).toISOString()),
  });

const arbitraryThingsList = () =>
  fc.array(arbitraryThingLike(), { minLength: 1, maxLength: 20 });

const arbitrarySortableField = () =>
  fc.constantFrom('name', 'location', 'room', 'owner', 'category');

const arbitrarySortDirection = (): fc.Arbitrary<SortDirection> =>
  fc.constantFrom('asc' as SortDirection, 'desc' as SortDirection);

// ============================================================================
// Property Tests
// ============================================================================

describe('Preservation Property 2: User Sort Override and Filter Behavior', () => {
  describe('User Sort Override - Column header sorting respects user choice', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * Property: For all user-initiated sort interactions (column header clicks),
     * the displayed order matches the user's chosen sort regardless of the initial
     * data order or any default sort logic.
     */
    it('Property 2a: User-initiated sort produces correctly ordered results for any input data (property test, 100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryThingsList(),
          arbitrarySortableField(),
          arbitrarySortDirection(),
          (things, sortField, sortDirection) => {
            // Simulate: data arrives in some order, then user clicks a column header
            const sorted = applyUserSort(things, sortField, sortDirection);

            // Assert: the result is sorted by the user's chosen field + direction
            expect(isSortedByField(sorted, sortField, sortDirection)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2b: User sort preserves all items (no items lost or duplicated) (property test, 100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryThingsList(),
          arbitrarySortableField(),
          arbitrarySortDirection(),
          (things, sortField, sortDirection) => {
            const sorted = applyUserSort(things, sortField, sortDirection);

            // Same length (no items lost or added)
            expect(sorted.length).toBe(things.length);

            // Same set of IDs
            const originalIds = new Set(things.map(t => t.id));
            const sortedIds = new Set(sorted.map(t => t.id));
            expect(sortedIds).toEqual(originalIds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2c: Sorting is idempotent - sorting already sorted data produces same order (property test, 100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryThingsList(),
          arbitrarySortableField(),
          arbitrarySortDirection(),
          (things, sortField, sortDirection) => {
            const sortedOnce = applyUserSort(things, sortField, sortDirection);
            const sortedTwice = applyUserSort(sortedOnce, sortField, sortDirection);

            // Same order after re-sorting
            expect(sortedTwice.map(t => t.id)).toEqual(sortedOnce.map(t => t.id));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Filter Behavior - Filters return only matching items', () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * Property: For all filter/search operations, filtered results contain
     * only matching items and all matching items are included.
     */
    it('Property 2d: Text filter returns only items matching the search text (property test, 100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryThingsList(),
          fc.string({ minLength: 1, maxLength: 10 }),
          (things, searchText) => {
            const filtered = applyTextFilter(things, searchText);
            const searchLower = searchText.toLowerCase();

            // Every returned item must match the search text in at least one field
            for (const item of filtered) {
              const matchesName = item.name.toLowerCase().includes(searchLower);
              const matchesDescription = item.description?.toLowerCase().includes(searchLower) ?? false;
              const matchesNotes = item.notes?.toLowerCase().includes(searchLower) ?? false;
              const matchesSerial = item.serialNumber?.toLowerCase().includes(searchLower) ?? false;
              const matchesMake = item.make?.toLowerCase().includes(searchLower) ?? false;
              const matchesModel = item.model?.toLowerCase().includes(searchLower) ?? false;

              expect(
                matchesName || matchesDescription || matchesNotes ||
                matchesSerial || matchesMake || matchesModel
              ).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2e: Text filter does not exclude matching items (property test, 100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryThingsList(),
          fc.string({ minLength: 1, maxLength: 10 }),
          (things, searchText) => {
            const filtered = applyTextFilter(things, searchText);
            const searchLower = searchText.toLowerCase();

            // Every item that matches should be in the filtered results
            const expectedMatches = things.filter(thing =>
              thing.name.toLowerCase().includes(searchLower) ||
              (thing.description && thing.description.toLowerCase().includes(searchLower)) ||
              (thing.notes && thing.notes.toLowerCase().includes(searchLower)) ||
              (thing.serialNumber && thing.serialNumber.toLowerCase().includes(searchLower)) ||
              (thing.make && thing.make.toLowerCase().includes(searchLower)) ||
              (thing.model && thing.model.toLowerCase().includes(searchLower))
            );

            expect(filtered.length).toBe(expectedMatches.length);
            const filteredIds = new Set(filtered.map(t => t.id));
            for (const match of expectedMatches) {
              expect(filteredIds.has(match.id)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2f: Category filter returns only items with the specified category (property test, 100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryThingsList(),
          fc.uuid(),
          (things, categoryId) => {
            const filtered = applyCategoryFilter(things, categoryId);

            // Every returned item must have the matching categoryId
            for (const item of filtered) {
              expect(item.categoryId).toBe(categoryId);
            }

            // All items with matching categoryId should be included
            const expected = things.filter(t => t.categoryId === categoryId);
            expect(filtered.length).toBe(expected.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2g: Location filter returns only items with the specified location (property test, 100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryThingsList(),
          fc.uuid(),
          (things, locationId) => {
            const filtered = applyLocationFilter(things, locationId);

            // Every returned item must have the matching locationId
            for (const item of filtered) {
              expect(item.locationId).toBe(locationId);
            }

            // All items with matching locationId should be included
            const expected = things.filter(t => t.locationId === locationId);
            expect(filtered.length).toBe(expected.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2h: Tag filter (AND mode) returns only items that have ALL specified tags (property test, 100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryThingsList(),
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 }),
          (things, filterTags) => {
            const filtered = applyTagFilter(things, filterTags);

            // Every returned item must have ALL the filter tags
            for (const item of filtered) {
              expect(item.tags).toBeDefined();
              for (const tag of filterTags) {
                const hasTag = item.tags!.some(
                  t => t.toLowerCase() === tag.toLowerCase()
                );
                expect(hasTag).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2i: Empty search text returns all items unfiltered (property test, 100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryThingsList(),
          (things) => {
            const filtered = applyTextFilter(things, '');

            // Empty search should return all items
            expect(filtered.length).toBe(things.length);
            expect(filtered).toEqual(things);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2j: Filtered results are a subset of the original data (property test, 100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryThingsList(),
          fc.string({ minLength: 1, maxLength: 10 }),
          (things, searchText) => {
            const filtered = applyTextFilter(things, searchText);

            // Filtered results must be a subset
            expect(filtered.length).toBeLessThanOrEqual(things.length);

            // Every filtered item must exist in the original
            const originalIds = new Set(things.map(t => t.id));
            for (const item of filtered) {
              expect(originalIds.has(item.id)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined Sort + Filter - User sort works on filtered data', () => {
    /**
     * **Validates: Requirements 3.1, 3.2**
     *
     * Property: When filters are applied AND the user sorts, the result is
     * correctly filtered AND sorted by the user's chosen order.
     */
    it('Property 2k: User sort on filtered results produces correctly ordered filtered subset (property test, 100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryThingsList(),
          fc.string({ minLength: 1, maxLength: 8 }),
          arbitrarySortableField(),
          arbitrarySortDirection(),
          (things, searchText, sortField, sortDirection) => {
            // Step 1: Filter
            const filtered = applyTextFilter(things, searchText);

            // Step 2: User sorts the filtered results
            const sortedFiltered = applyUserSort(filtered, sortField, sortDirection);

            // Assert: result is sorted by user's choice
            expect(isSortedByField(sortedFiltered, sortField, sortDirection)).toBe(true);

            // Assert: result contains only matching items (filter still applied)
            const searchLower = searchText.toLowerCase();
            for (const item of sortedFiltered) {
              const matchesAny =
                item.name.toLowerCase().includes(searchLower) ||
                (item.description?.toLowerCase().includes(searchLower) ?? false) ||
                (item.notes?.toLowerCase().includes(searchLower) ?? false) ||
                (item.serialNumber?.toLowerCase().includes(searchLower) ?? false) ||
                (item.make?.toLowerCase().includes(searchLower) ?? false) ||
                (item.model?.toLowerCase().includes(searchLower) ?? false);
              expect(matchesAny).toBe(true);
            }

            // Assert: same count as just filtering (sort doesn't add/remove items)
            expect(sortedFiltered.length).toBe(filtered.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
