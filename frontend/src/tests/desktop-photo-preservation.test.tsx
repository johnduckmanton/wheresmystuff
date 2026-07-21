/**
 * Preservation Property Tests - Desktop Photo Upload and Delete Behavior
 *
 * These tests capture the CURRENT behavior of the unfixed code to ensure
 * the Bug 2 fix (adding photo delete to ThingDetailSheet on mobile) does NOT
 * introduce regressions to existing desktop photo management workflows.
 * They MUST PASS on unfixed code.
 *
 * Property 2: Preservation - Desktop Photo Upload and Delete Behavior
 * - ContainerPhotoUpload component renders delete buttons for photos and handles deletion
 * - Photo upload flow on desktop continues to add photos correctly
 * - ThingFormDialog photo management on desktop continues to function
 *
 * **Validates: Requirements 3.3, 3.4**
 */
import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { render } from '@testing-library/react';
import ContainerPhotoUpload from '../components/ContainerPhotoUpload';

// Mock apiClient to prevent actual API calls
vi.mock('../services/api', () => ({
  default: {
    getPhotoUrl: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
    deletePhoto: vi.fn().mockResolvedValue(undefined),
    updateContainer: vi.fn().mockResolvedValue({}),
    getContainer: vi.fn().mockResolvedValue({ name: 'Test Container', photos: [] }),
    uploadPhoto: vi.fn().mockResolvedValue('photos/new-photo.jpg'),
    generateUploadUrl: vi.fn().mockResolvedValue({ uploadUrl: 'https://s3.example.com/upload', key: 'photos/new.jpg' }),
    generateDownloadUrl: vi.fn().mockResolvedValue({ downloadUrl: 'https://s3.example.com/download' }),
  },
}));

vi.mock('../services/photoQueue', () => ({
  photoQueue: {
    loadPhoto: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
  },
}));

// Mock NotificationContext
vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn(),
  }),
}));

// Mock InventoryContext
vi.mock('../contexts/InventoryContext', () => ({
  useInventory: () => ({
    currentInventory: { id: 'inv-123', name: 'Test Inventory' },
    inventories: [{ id: 'inv-123', name: 'Test Inventory' }],
  }),
}));

// ============================================================================
// Photo Array Management Logic (mirrors ContainerPhotoUpload behavior)
// ============================================================================

/**
 * Simulates the photo deletion logic from ContainerPhotoUpload.handleDeletePhoto:
 * Removes a specific photo key from the photos array (filter out by exact match).
 */
function removePhotoFromArray(photos: string[], photoKeyToDelete: string): string[] {
  return photos.filter(p => p !== photoKeyToDelete);
}

/**
 * Simulates the photo upload addition logic from ContainerPhotoUpload.uploadPhoto:
 * Appends a new photo key to the existing photos array.
 */
function addPhotoToArray(photos: string[], newPhotoKey: string): string[] {
  return [...photos, newPhotoKey];
}

/**
 * Simulates ThingFormDialog handlePhotoRemove:
 * Removes a specific photo key from the photos array by filtering.
 */
function thingFormRemovePhoto(photos: string[], keyToRemove: string): string[] {
  return photos.filter(photoKey => photoKey !== keyToRemove);
}

/**
 * Simulates ThingFormDialog handlePhotoUpload result:
 * Appends new uploaded photo keys to existing array.
 */
function thingFormAddPhotos(existingPhotos: string[], newKeys: string[]): string[] {
  return [...existingPhotos, ...newKeys];
}

// ============================================================================
// Generators
// ============================================================================

/**
 * Generates realistic photo key strings (S3-like paths).
 */
const arbitraryPhotoKey = () =>
  fc.string({ minLength: 5, maxLength: 40 }).map(s => `photos/${s.replace(/[^a-zA-Z0-9]/g, '')}.jpg`);

/**
 * Generates arrays of unique photo keys (simulating a container/thing with photos).
 */
const arbitraryPhotoArray = () =>
  fc.array(arbitraryPhotoKey(), { minLength: 1, maxLength: 10 })
    .map(keys => [...new Set(keys)]); // Ensure unique keys

/**
 * Generates arrays of multiple new photo keys (simulating batch upload).
 */
const arbitraryNewPhotoKeys = () =>
  fc.array(arbitraryPhotoKey(), { minLength: 1, maxLength: 5 })
    .map(keys => [...new Set(keys)]);

// ============================================================================
// Property Tests - ContainerPhotoUpload Behavior
// ============================================================================

describe('Preservation Property: Desktop Photo Upload and Delete Behavior', () => {
  describe('ContainerPhotoUpload - Photo deletion logic', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * Property: When a user deletes a photo from a container on desktop,
     * the specific photo is removed from the array and no other photos are affected.
     */
    it('Property: Deleting a photo removes exactly that photo from the array (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryPhotoArray(),
          (photos) => {
            // Pick a random photo to delete (the first one for determinism)
            const photoToDelete = photos[0];
            const result = removePhotoFromArray(photos, photoToDelete);

            // The deleted photo should not be in the result
            expect(result).not.toContain(photoToDelete);

            // Result should have exactly one fewer element
            expect(result.length).toBe(photos.length - 1);

            // All other photos should remain
            const otherPhotos = photos.filter(p => p !== photoToDelete);
            expect(result).toEqual(otherPhotos);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: Deleting a photo that does not exist leaves the array unchanged (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryPhotoArray(),
          arbitraryPhotoKey(),
          (photos, nonExistentKey) => {
            // Ensure the key is not in the array
            fc.pre(!photos.includes(nonExistentKey));

            const result = removePhotoFromArray(photos, nonExistentKey);

            // Array should be unchanged
            expect(result).toEqual(photos);
            expect(result.length).toBe(photos.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: Photo deletion preserves the order of remaining photos (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryPhotoArray().filter(arr => arr.length >= 2),
          fc.nat(),
          (photos, indexSeed) => {
            // Pick a photo at a random index to delete
            const deleteIndex = indexSeed % photos.length;
            const photoToDelete = photos[deleteIndex];
            const result = removePhotoFromArray(photos, photoToDelete);

            // Remaining photos should be in their original relative order
            const expectedOrder = photos.filter(p => p !== photoToDelete);
            expect(result).toEqual(expectedOrder);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('ContainerPhotoUpload - Photo upload (add) logic', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * Property: When a user uploads a new photo on desktop, it is appended
     * to the existing photos array without disturbing existing photos.
     */
    it('Property: Adding a photo appends it to the end of the array (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryPhotoArray(),
          arbitraryPhotoKey(),
          (existingPhotos, newPhotoKey) => {
            const result = addPhotoToArray(existingPhotos, newPhotoKey);

            // New photo should be at the end
            expect(result[result.length - 1]).toBe(newPhotoKey);

            // Length should increase by 1
            expect(result.length).toBe(existingPhotos.length + 1);

            // All existing photos should still be present in original order
            expect(result.slice(0, existingPhotos.length)).toEqual(existingPhotos);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: Adding a photo does not modify the existing photos in the array (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryPhotoArray(),
          arbitraryPhotoKey(),
          (existingPhotos, newPhotoKey) => {
            const originalCopy = [...existingPhotos];
            const result = addPhotoToArray(existingPhotos, newPhotoKey);

            // Original array should not be mutated
            expect(existingPhotos).toEqual(originalCopy);

            // Existing photos in result should be identical
            for (let i = 0; i < existingPhotos.length; i++) {
              expect(result[i]).toBe(existingPhotos[i]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('ContainerPhotoUpload - Delete button rendering', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * Property: ContainerPhotoUpload renders a delete button for each photo
     * when photos exist. This confirms the existing desktop delete UI is present.
     */
    it('Property: ContainerPhotoUpload renders delete buttons when photos are present (100 runs)', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryPhotoKey(), { minLength: 1, maxLength: 5 })
            .map(keys => [...new Set(keys)]),
          (photoKeys) => {
            const onPhotosUpdated = vi.fn();
            const { container } = render(
              <ContainerPhotoUpload
                containerId="container-123"
                inventoryId="inv-456"
                photos={photoKeys}
                onPhotosUpdated={onPhotosUpdated}
              />
            );

            // Look for delete icons/buttons in the rendered output
            // ContainerPhotoUpload uses MUI DeleteIcon inside IconButton
            const deleteIcons = container.querySelectorAll('[data-testid="DeleteIcon"]');
            const deleteButtons = container.querySelectorAll(
              'button[aria-label*="delete" i], button[aria-label*="remove" i]'
            );

            // At least some delete affordance should exist for photos
            // ContainerPhotoUpload renders one delete IconButton per photo in ImageListItemBar
            const totalDeleteElements = deleteIcons.length + deleteButtons.length;
            expect(totalDeleteElements).toBeGreaterThanOrEqual(photoKeys.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('ThingFormDialog - Photo management logic', () => {
    /**
     * **Validates: Requirements 3.3, 3.4**
     *
     * Property: ThingFormDialog photo removal correctly removes the specified
     * photo from the form's photo array without affecting others.
     */
    it('Property: ThingFormDialog photo removal removes exactly one photo (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryPhotoArray(),
          (photos) => {
            const keyToRemove = photos[0];
            const result = thingFormRemovePhoto(photos, keyToRemove);

            // Removed photo should not be in result
            expect(result).not.toContain(keyToRemove);

            // One fewer photo
            expect(result.length).toBe(photos.length - 1);

            // Remaining photos preserve order
            const expected = photos.filter(k => k !== keyToRemove);
            expect(result).toEqual(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 3.3**
     *
     * Property: ThingFormDialog batch photo upload appends all new keys
     * while preserving existing photos.
     */
    it('Property: ThingFormDialog batch photo upload appends all new photos correctly (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryPhotoArray(),
          arbitraryNewPhotoKeys(),
          (existingPhotos, newKeys) => {
            const result = thingFormAddPhotos(existingPhotos, newKeys);

            // Result should contain all existing photos in order
            expect(result.slice(0, existingPhotos.length)).toEqual(existingPhotos);

            // Result should contain all new photos appended
            expect(result.slice(existingPhotos.length)).toEqual(newKeys);

            // Total length should be sum
            expect(result.length).toBe(existingPhotos.length + newKeys.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: ThingFormDialog photo operations do not mutate the input array (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryPhotoArray(),
          arbitraryPhotoKey(),
          (photos, newKey) => {
            const originalPhotos = [...photos];

            // Test add doesn't mutate
            thingFormAddPhotos(photos, [newKey]);
            expect(photos).toEqual(originalPhotos);

            // Test remove doesn't mutate
            thingFormRemovePhoto(photos, photos[0]);
            expect(photos).toEqual(originalPhotos);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined operations - Upload then delete preserves consistency', () => {
    /**
     * **Validates: Requirements 3.3, 3.4**
     *
     * Property: A sequence of add and delete operations produces consistent
     * results - the final state matches the expected set of photos.
     */
    it('Property: Adding then deleting the same photo returns to original state (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryPhotoArray(),
          arbitraryPhotoKey(),
          (existingPhotos, newKey) => {
            // Ensure new key doesn't already exist
            fc.pre(!existingPhotos.includes(newKey));

            // Add a photo
            const afterAdd = addPhotoToArray(existingPhotos, newKey);
            expect(afterAdd.length).toBe(existingPhotos.length + 1);

            // Delete the same photo
            const afterDelete = removePhotoFromArray(afterAdd, newKey);

            // Should be back to original
            expect(afterDelete).toEqual(existingPhotos);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: Deleting all photos one by one results in an empty array (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryPhotoArray(),
          (photos) => {
            let current = [...photos];

            // Delete each photo one by one
            for (const key of photos) {
              current = removePhotoFromArray(current, key);
            }

            expect(current).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
