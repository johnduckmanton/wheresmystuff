/**
 * Bug Condition Exploration Tests - ThingDetailSheet Missing Photo Delete Action
 *
 * These tests verify the EXPECTED behavior: when a Thing has photos displayed
 * in the mobile ThingDetailSheet, each photo should have a delete button/action.
 *
 * On UNFIXED code, these tests will FAIL because ThingDetailSheet renders photos
 * as display-only thumbnails with no delete action affordance.
 *
 * Failure confirms the bug exists: no photo delete mechanism in the mobile detail sheet.
 *
 * **Validates: Requirements 1.4, 1.5**
 */
import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import ThingDetailSheet from '../components/ThingDetailSheet';
import type { Thing } from '../types';

// Mock the apiClient and photoQueue to prevent actual API calls
vi.mock('../services/api', () => ({
  default: {
    getPhotoUrl: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
  },
}));

vi.mock('../services/photoQueue', () => ({
  photoQueue: {
    loadPhoto: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
  },
}));

/**
 * Creates a Thing object with the given photo keys for testing.
 */
function createThingWithPhotos(photoKeys: string[]): Thing {
  return {
    id: 'thing-123',
    inventoryId: 'inv-456',
    name: 'Test Thing',
    description: 'A test thing with photos',
    photos: photoKeys,
    dateAdded: '2024-01-15T10:00:00.000Z',
  };
}

/**
 * Generator for photo key arrays with 1-3 photos.
 * Simulates Things that have photos attached.
 */
const arbitraryPhotoKeys = () =>
  fc.array(
    fc.string({ minLength: 5, maxLength: 30 }).map(s => `photos/${s}.jpg`),
    { minLength: 1, maxLength: 3 }
  );

/**
 * Renders ThingDetailSheet with a Thing that has photos and checks
 * if delete buttons/actions are present for the photos.
 *
 * Returns the number of delete-related elements found.
 */
function countPhotoDeleteActions(container: HTMLElement): number {
  // Look for delete buttons via various common patterns:
  // - Buttons with aria-label containing "delete"
  // - Icons with data-testid containing "delete" or "Delete"
  // - Buttons within the photo area that have delete-related text
  const deleteButtons = container.querySelectorAll(
    'button[aria-label*="delete" i], ' +
    'button[aria-label*="remove" i], ' +
    '[data-testid*="delete" i], ' +
    '[data-testid*="Delete"], ' +
    'svg[data-testid="DeleteIcon"], ' +
    'svg[data-testid="DeleteOutlineIcon"], ' +
    'svg[data-testid="CloseIcon"]'
  );

  // Also check for MUI IconButton with delete-related content
  const allButtons = container.querySelectorAll('button, [role="button"]');
  let deleteActionCount = deleteButtons.length;

  allButtons.forEach(button => {
    const ariaLabel = button.getAttribute('aria-label') || '';
    const textContent = button.textContent || '';
    if (
      ariaLabel.toLowerCase().includes('delete') ||
      ariaLabel.toLowerCase().includes('remove') ||
      textContent.toLowerCase().includes('delete') ||
      textContent.toLowerCase().includes('remove')
    ) {
      // Avoid double-counting if already found via querySelectorAll
      if (!Array.from(deleteButtons).includes(button)) {
        deleteActionCount++;
      }
    }
  });

  return deleteActionCount;
}

describe('Bug Condition Exploration: ThingDetailSheet Missing Photo Delete Action', () => {
  it('Property 1: ThingDetailSheet should render delete action for each photo (property test, 100 runs)', () => {
    /**
     * **Validates: Requirements 1.4, 1.5**
     *
     * This property asserts: for any Thing with 1-3 photos rendered in ThingDetailSheet,
     * there should be at least one delete button/action for photos.
     *
     * On UNFIXED code: FAILS because ThingDetailSheet only renders a PhotoThumbnail
     * for the primary photo with no interaction handlers or delete actions.
     */
    fc.assert(
      fc.property(
        arbitraryPhotoKeys(),
        (photoKeys) => {
          cleanup();
          const thing = createThingWithPhotos(photoKeys);

          render(
            <ThingDetailSheet
              thing={thing}
              open={true}
              onClose={() => {}}
              onEdit={() => {}}
              onDeletePhoto={() => {}}
            />
          );

          const deleteActionCount = countPhotoDeleteActions(document.body);

          // Expected behavior: at least one delete action should exist when photos are present
          expect(deleteActionCount).toBeGreaterThan(0);
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Concrete example: Thing with 2 photos should have delete buttons in ThingDetailSheet', () => {
    /**
     * **Validates: Requirements 1.4, 1.5**
     *
     * Concrete demonstration of the bug: render ThingDetailSheet with a Thing
     * that has 2 photos and verify delete actions exist.
     *
     * On UNFIXED code: FAILS because ThingDetailSheet renders photos as
     * display-only thumbnails with no delete action.
     */
    const thing = createThingWithPhotos(['photos/photo1.jpg', 'photos/photo2.jpg']);

    render(
      <ThingDetailSheet
        thing={thing}
        open={true}
        onClose={() => {}}
        onEdit={() => {}}
        onDeletePhoto={() => {}}
      />
    );

    const deleteActionCount = countPhotoDeleteActions(document.body);

    // Expected: at least one delete action for the photos
    // On unfixed code this will be 0 because no delete UI exists
    expect(deleteActionCount).toBeGreaterThan(0);
  });

  it('Concrete example: Thing with 1 photo should have a delete button in ThingDetailSheet', () => {
    /**
     * **Validates: Requirements 1.4**
     *
     * Even a single photo should have a delete affordance.
     * On UNFIXED code: FAILS — no delete action rendered.
     */
    const thing = createThingWithPhotos(['photos/single-photo.jpg']);

    render(
      <ThingDetailSheet
        thing={thing}
        open={true}
        onClose={() => {}}
        onEdit={() => {}}
        onDeletePhoto={() => {}}
      />
    );

    const deleteActionCount = countPhotoDeleteActions(document.body);

    // Expected: at least one delete action
    expect(deleteActionCount).toBeGreaterThan(0);
  });
});
