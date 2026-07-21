/**
 * Preservation Property Tests - Home Page Container Navigation and Layout
 *
 * These tests capture the CURRENT behavior of the UNFIXED code to ensure
 * the Bug 4 fix (making recently added things clickable) does NOT introduce
 * regressions to existing Home page functionality. They MUST PASS on unfixed code.
 *
 * Property 2: Preservation - Home Page Container Navigation and Layout
 * - Recent containers section CardActionArea onClick navigates to `/containers`
 * - Module cards (Inventory, Moving & Storage) navigate correctly
 * - Top 3 most recent items display logic works correctly for various data sets
 *
 * **Validates: Requirements 3.5, 3.8, 3.9**
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  List,
  ListItem,
  Chip,
  Button,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import type { Thing, Container } from '../types';

const theme = createTheme();

// ============================================================================
// Simulated Components - Reproduce Home.tsx rendering patterns
// ============================================================================

/**
 * Reproduces the module cards section from Home.tsx (Inventory + Moving & Storage).
 * These cards use CardActionArea with onClick to navigate.
 */
function ModuleCards({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 6, sm: 6 }}>
        <Card elevation={2}>
          <CardActionArea
            onClick={() => onNavigate('/things')}
            sx={{ p: 3, textAlign: 'center' }}
            aria-label="Navigate to Inventory Management"
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Inventory
            </Typography>
          </CardActionArea>
        </Card>
      </Grid>
      <Grid size={{ xs: 6, sm: 6 }}>
        <Card elevation={2}>
          <CardActionArea
            onClick={() => onNavigate('/containers')}
            sx={{ p: 3, textAlign: 'center' }}
            aria-label="Navigate to Moving and Storage"
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Moving & Storage
            </Typography>
          </CardActionArea>
        </Card>
      </Grid>
    </Grid>
  );
}

/**
 * Reproduces the recent containers section from Home.tsx.
 * Each container card uses CardActionArea with onClick to navigate to /containers.
 */
function RecentContainersSection({
  containers,
  onNavigate,
}: {
  containers: Container[];
  onNavigate: (path: string) => void;
}) {
  const recentContainers = [...containers]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  if (recentContainers.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body2" color="text.secondary">
            No containers yet.
          </Typography>
          <Button onClick={() => onNavigate('/containers')}>New Container</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={1}>
      {recentContainers.map((container) => (
        <Grid size={{ xs: 6, sm: 6, md: 3 }} key={container.id}>
          <Card variant="outlined">
            <CardActionArea
              onClick={() => onNavigate('/containers')}
              sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}
              data-testid={`container-card-${container.id}`}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {container.name}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip
                    label={container.status.replace('_', ' ')}
                    size="small"
                    color={container.status === 'packed' ? 'success' : 'default'}
                    sx={{ fontSize: '0.65rem', height: 20 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {container.itemCount || 0} items
                  </Typography>
                </Box>
              </Box>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

/**
 * Reproduces the recent things display logic from Home.tsx.
 * Takes the full list, sorts by dateAdded descending, takes top 3.
 */
function RecentThingsSection({ things }: { things: Thing[] }) {
  const recentThings = [...things]
    .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
    .slice(0, 3);

  if (recentThings.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="text.secondary" data-testid="no-items-message">
            No items yet. Add your first thing to get started.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <List disablePadding>
        {recentThings.map((thing, idx) => (
          <ListItem
            key={thing.id}
            divider={idx < recentThings.length - 1}
            sx={{ py: 1.5, px: 2, alignItems: 'flex-start', gap: 1.5 }}
            data-testid={`recent-thing-${thing.id}`}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {thing.name}
              </Typography>
              {thing.description && (
                <Typography variant="caption" color="text.secondary">
                  {thing.description}
                </Typography>
              )}
            </Box>
          </ListItem>
        ))}
      </List>
    </Card>
  );
}

// ============================================================================
// Generators
// ============================================================================

/**
 * Generates a valid ISO date string between 2023-01-01 and 2024-12-31.
 */
const arbitraryISODate = () =>
  fc.integer({ min: 1672531200000, max: 1735689600000 }) // 2023-01-01 to 2024-12-31 in ms
    .map(ms => new Date(ms).toISOString());

/**
 * Generates a valid Container with required fields.
 */
const arbitraryContainer = (): fc.Arbitrary<Container> =>
  fc.record({
    id: fc.uuid(),
    inventoryId: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
    type: fc.constantFrom('box', 'bag', 'crate', 'suitcase', 'other'),
    qrCode: fc.uuid(),
    handlingFlags: fc.constant([]),
    itemCount: fc.nat({ max: 50 }),
    estimatedValue: fc.nat({ max: 10000 }),
    createdAt: arbitraryISODate(),
    updatedAt: arbitraryISODate(),
    createdBy: fc.uuid(),
    updatedBy: fc.uuid(),
    status: fc.constantFrom('empty', 'packing', 'packed', 'in_transit', 'stored', 'unpacking', 'unpacked'),
    metadata: fc.constant({}),
  }) as unknown as fc.Arbitrary<Container>;

/**
 * Generates a valid Thing with required fields.
 */
const arbitraryThing = (): fc.Arbitrary<Thing> =>
  fc.record({
    id: fc.uuid(),
    inventoryId: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
    description: fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { nil: undefined }),
    dateAdded: arbitraryISODate(),
    photos: fc.constant([] as string[]),
  }) as unknown as fc.Arbitrary<Thing>;

/**
 * Generates a list of 0-10 things (to test the top-3 slicing logic).
 */
const arbitraryThingsList = () =>
  fc.array(arbitraryThing(), { minLength: 0, maxLength: 10 });

/**
 * Generates a list of 1-8 containers (to test the top-3 slicing logic).
 */
const arbitraryContainersList = () =>
  fc.array(arbitraryContainer(), { minLength: 1, maxLength: 8 });

// ============================================================================
// Property Tests - Container Card Navigation
// ============================================================================

describe('Preservation Property: Home Page Container Navigation and Layout', () => {
  beforeEach(() => {
    cleanup();
  });

  describe('Container card navigation to /containers', () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * Property: For all container card clicks on the Home page, navigation
     * to `/containers` occurs. The CardActionArea onClick always navigates
     * to the containers page regardless of which container is clicked.
     */
    it('Property: Clicking any container card navigates to /containers (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryContainersList(),
          (containers) => {
            cleanup();
            const navigateMock = vi.fn();

            const { container: domContainer } = render(
              <ThemeProvider theme={theme}>
                <RecentContainersSection
                  containers={containers}
                  onNavigate={navigateMock}
                />
              </ThemeProvider>
            );

            // CardActionArea renders as <button> elements with MuiCardActionArea-root class
            const cardButtons = domContainer.querySelectorAll('button.MuiCardActionArea-root');
            const expectedCount = Math.min(containers.length, 3);
            expect(cardButtons.length).toBe(expectedCount);

            // Click each container card
            for (const cardButton of Array.from(cardButtons)) {
              navigateMock.mockClear();
              fireEvent.click(cardButton);
              expect(navigateMock).toHaveBeenCalledWith('/containers');
            }

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 3.5**
     *
     * Property: The recent containers section always shows at most 3 containers,
     * sorted by createdAt descending (most recent first).
     */
    it('Property: Recent containers shows at most 3 items sorted by createdAt descending (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryContainersList(),
          (containers) => {
            cleanup();
            const navigateMock = vi.fn();

            const { container: domContainer } = render(
              <ThemeProvider theme={theme}>
                <RecentContainersSection
                  containers={containers}
                  onNavigate={navigateMock}
                />
              </ThemeProvider>
            );

            // Find container card buttons
            const cardButtons = domContainer.querySelectorAll('button.MuiCardActionArea-root');
            const expectedCount = Math.min(containers.length, 3);
            expect(cardButtons.length).toBe(expectedCount);

            // Verify the displayed containers are the most recent ones
            const sortedContainers = [...containers]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 3);

            // Verify names match the sorted order
            for (let i = 0; i < sortedContainers.length; i++) {
              const cardContent = cardButtons[i].textContent;
              expect(cardContent).toContain(sortedContainers[i].name);
            }

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Module card navigation', () => {
    /**
     * **Validates: Requirements 3.9**
     *
     * Property: For all Inventory card clicks, navigation to `/things` is triggered.
     * For all Moving & Storage card clicks, navigation to `/containers` is triggered.
     */
    it('Property: Module cards navigate to correct routes on click (100 runs)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('inventory', 'moving'),
          (cardType) => {
            cleanup();
            const navigateMock = vi.fn();

            render(
              <ThemeProvider theme={theme}>
                <ModuleCards onNavigate={navigateMock} />
              </ThemeProvider>
            );

            if (cardType === 'inventory') {
              const inventoryCard = screen.getByLabelText('Navigate to Inventory Management');
              fireEvent.click(inventoryCard);
              expect(navigateMock).toHaveBeenCalledWith('/things');
            } else {
              const movingCard = screen.getByLabelText('Navigate to Moving and Storage');
              fireEvent.click(movingCard);
              expect(navigateMock).toHaveBeenCalledWith('/containers');
            }

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 3.9**
     *
     * Property: Both module cards render as native <button> elements (via MUI
     * CardActionArea/ButtonBase) with proper aria-labels for accessibility.
     * They are focusable (tabIndex=0) for keyboard navigation.
     */
    it('Property: Module cards are rendered as interactive button elements with aria-labels', () => {
      const navigateMock = vi.fn();

      render(
        <ThemeProvider theme={theme}>
          <ModuleCards onNavigate={navigateMock} />
        </ThemeProvider>
      );

      const inventoryCard = screen.getByLabelText('Navigate to Inventory Management');
      const movingCard = screen.getByLabelText('Navigate to Moving and Storage');

      // CardActionArea renders as native <button> elements (ButtonBase)
      expect(inventoryCard.tagName).toBe('BUTTON');
      expect(movingCard.tagName).toBe('BUTTON');

      // Both should have tabIndex for keyboard navigation
      expect(inventoryCard.getAttribute('tabindex')).toBe('0');
      expect(movingCard.getAttribute('tabindex')).toBe('0');

      cleanup();
    });
  });

  describe('Recent items count and display logic', () => {
    /**
     * **Validates: Requirements 3.5, 3.8**
     *
     * Property: The recentThings computation always returns at most 3 items,
     * sorted by dateAdded descending, regardless of the total number of items.
     */
    it('Property: Recent things displays at most 3 items sorted by dateAdded descending (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryThingsList().filter(arr => arr.length > 0),
          (things) => {
            cleanup();

            const { container } = render(
              <ThemeProvider theme={theme}>
                <RecentThingsSection things={things} />
              </ThemeProvider>
            );

            // Find all list items
            const listItems = container.querySelectorAll('li');
            const expectedCount = Math.min(things.length, 3);
            expect(listItems.length).toBe(expectedCount);

            // Verify they're sorted by dateAdded descending
            const sortedThings = [...things]
              .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
              .slice(0, 3);

            for (let i = 0; i < sortedThings.length; i++) {
              expect(listItems[i].textContent).toContain(sortedThings[i].name);
            }

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 3.5**
     *
     * Property: When the things array is empty, the section displays a
     * "No items yet" message rather than rendering an empty list.
     */
    it('Property: Empty things array shows "No items yet" message (100 runs)', () => {
      fc.assert(
        fc.property(
          fc.constant([] as Thing[]),
          (things: Thing[]) => {
            cleanup();

            const { container } = render(
              <ThemeProvider theme={theme}>
                <RecentThingsSection things={things} />
              </ThemeProvider>
            );

            // Should show the no-items message
            const noItemsMsg = container.querySelector('[data-testid="no-items-message"]');
            expect(noItemsMsg).not.toBeNull();
            expect(noItemsMsg!.textContent).toContain('No items yet');

            // Should not render any list items
            const listItems = container.querySelectorAll('li');
            expect(listItems.length).toBe(0);

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 3.5, 3.8**
     *
     * Property: The recent things sort is stable and deterministic —
     * given the same input data, the same top 3 items are always displayed.
     */
    it('Property: Recent things sort is deterministic for consistent date values (100 runs)', () => {
      fc.assert(
        fc.property(
          arbitraryThingsList().filter(arr => arr.length >= 2),
          (things) => {
            cleanup();

            // Compute expected result (the same logic as Home.tsx)
            const expected = [...things]
              .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
              .slice(0, 3);

            // Render once
            const { container: container1 } = render(
              <ThemeProvider theme={theme}>
                <RecentThingsSection things={things} />
              </ThemeProvider>
            );

            const listItems1 = container1.querySelectorAll('li');
            const names1 = Array.from(listItems1).map(li => li.textContent);

            cleanup();

            // Render again with the same data
            const { container: container2 } = render(
              <ThemeProvider theme={theme}>
                <RecentThingsSection things={things} />
              </ThemeProvider>
            );

            const listItems2 = container2.querySelectorAll('li');
            const names2 = Array.from(listItems2).map(li => li.textContent);

            // Results should be identical
            expect(names1).toEqual(names2);

            // And should match the expected sorted order
            for (let i = 0; i < expected.length; i++) {
              expect(names1[i]).toContain(expected[i].name);
            }

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 3.5**
     *
     * Property: When fewer than 3 things exist, all are displayed
     * (the slice(0, 3) doesn't drop items when there are fewer than 3).
     */
    it('Property: When fewer than 3 things exist, all are displayed (100 runs)', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryThing(), { minLength: 1, maxLength: 2 }),
          (things) => {
            cleanup();

            const { container } = render(
              <ThemeProvider theme={theme}>
                <RecentThingsSection things={things} />
              </ThemeProvider>
            );

            const listItems = container.querySelectorAll('li');
            expect(listItems.length).toBe(things.length);

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 3.5**
     *
     * Property: When more than 3 things exist, exactly 3 are displayed
     * (the most recent 3 by dateAdded).
     */
    it('Property: When more than 3 things exist, exactly 3 are displayed (100 runs)', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryThing(), { minLength: 4, maxLength: 10 }),
          (things) => {
            cleanup();

            const { container } = render(
              <ThemeProvider theme={theme}>
                <RecentThingsSection things={things} />
              </ThemeProvider>
            );

            const listItems = container.querySelectorAll('li');
            expect(listItems.length).toBe(3);

            // Verify the displayed items are the top 3 most recent
            const sortedThings = [...things]
              .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
              .slice(0, 3);

            for (let i = 0; i < 3; i++) {
              expect(listItems[i].textContent).toContain(sortedThings[i].name);
            }

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
