import { describe, it, expect } from 'vitest';
import { sortByDateDesc } from '../sortByDateDesc';

describe('sortByDateDesc', () => {
  it('should sort items by dateAdded in descending order', () => {
    const items = [
      { dateAdded: '2024-01-01T00:00:00Z' },
      { dateAdded: '2024-03-01T00:00:00Z' },
      { dateAdded: '2024-02-01T00:00:00Z' },
    ];

    const sorted = sortByDateDesc(items);

    expect(sorted[0].dateAdded).toBe('2024-03-01T00:00:00Z');
    expect(sorted[1].dateAdded).toBe('2024-02-01T00:00:00Z');
    expect(sorted[2].dateAdded).toBe('2024-01-01T00:00:00Z');
  });

  it('should sort items by createdAt when dateAdded is not present', () => {
    const items = [
      { createdAt: '2024-01-15T00:00:00Z' },
      { createdAt: '2024-06-01T00:00:00Z' },
      { createdAt: '2024-03-20T00:00:00Z' },
    ];

    const sorted = sortByDateDesc(items);

    expect(sorted[0].createdAt).toBe('2024-06-01T00:00:00Z');
    expect(sorted[1].createdAt).toBe('2024-03-20T00:00:00Z');
    expect(sorted[2].createdAt).toBe('2024-01-15T00:00:00Z');
  });

  it('should prefer dateAdded over createdAt', () => {
    const items = [
      { dateAdded: '2024-05-01T00:00:00Z', createdAt: '2024-01-01T00:00:00Z' },
      { dateAdded: '2024-01-01T00:00:00Z', createdAt: '2024-12-01T00:00:00Z' },
    ];

    const sorted = sortByDateDesc(items);

    expect(sorted[0].dateAdded).toBe('2024-05-01T00:00:00Z');
    expect(sorted[1].dateAdded).toBe('2024-01-01T00:00:00Z');
  });

  it('should handle items with no date fields', () => {
    const items = [
      { dateAdded: '2024-03-01T00:00:00Z' },
      {},
      { dateAdded: '2024-01-01T00:00:00Z' },
    ];

    const sorted = sortByDateDesc(items);

    expect(sorted[0].dateAdded).toBe('2024-03-01T00:00:00Z');
    expect(sorted[1].dateAdded).toBe('2024-01-01T00:00:00Z');
    expect(sorted[2]).toEqual({});
  });

  it('should return empty array for empty input', () => {
    const sorted = sortByDateDesc([]);
    expect(sorted).toEqual([]);
  });

  it('should not mutate the original array', () => {
    const items = [
      { dateAdded: '2024-01-01T00:00:00Z' },
      { dateAdded: '2024-03-01T00:00:00Z' },
    ];
    const original = [...items];

    sortByDateDesc(items);

    expect(items).toEqual(original);
  });

  it('should handle single item array', () => {
    const items = [{ dateAdded: '2024-01-01T00:00:00Z' }];
    const sorted = sortByDateDesc(items);
    expect(sorted).toEqual(items);
  });
});
