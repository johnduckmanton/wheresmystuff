/**
 * Sorts items by date in descending order (most recent first).
 * Uses `dateAdded` field first, falling back to `createdAt`.
 */
export const sortByDateDesc = <T extends { dateAdded?: string; createdAt?: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.dateAdded || a.createdAt || 0).getTime();
    const dateB = new Date(b.dateAdded || b.createdAt || 0).getTime();
    return dateB - dateA;
  });
};
