/**
 * Preservation Property Tests for Container Details QR Display Fix
 * 
 * **IMPORTANT**: These tests verify behavior that MUST BE PRESERVED after the fix
 * **EXPECTED OUTCOME ON UNFIXED CODE**: Tests PASS (confirms baseline behavior)
 * **EXPECTED OUTCOME ON FIXED CODE**: Tests PASS (confirms no regressions)
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 * 
 * Property 2: Preservation - Legacy Container Support
 * 
 * Tests that containers WITHOUT existing QR codes continue to work correctly:
 * - Show "Generate QR Code" button in Statistics card
 * - Show size dropdown in QRCodeGenerator dialog
 * - Show "Generate QR Code" button in QRCodeGenerator dialog
 * - All dialog operations work identically
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { test, fc } from '@fast-check/vitest';
import { NotificationProvider } from '../../contexts/NotificationContext';
import ContainerDetailDialog from '../ContainerDetailDialog';
import QRCodeGenerator from '../QRCodeGenerator';
import type { Container, ContainerStatus, ContainerType, HandlingFlag } from '../../types/entities';
import React from 'react';

// Mock API client
vi.mock('../../services/api', () => ({
  default: {
    getLocation: vi.fn().mockResolvedValue({ id: 'loc1', name: 'Test Location' }),
    getContainerQRCode: vi.fn().mockResolvedValue({
      hasQRCode: false,
      downloadUrl: null
    }),
    getContainer: vi.fn().mockResolvedValue({
      id: 'container1',
      name: 'Test Container',
      qrCodeUrl: ''
    }),
  },
}));

// Helper to render with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <NotificationProvider>
      {component}
    </NotificationProvider>
  );
};

// Arbitraries for property-based testing
const containerStatusArbitrary = fc.constantFrom<ContainerStatus>(
  'empty', 'packing', 'packed', 'in_transit', 'stored', 'unpacking', 'unpacked'
);

const containerTypeArbitrary = fc.constantFrom<ContainerType>(
  'box', 'bag', 'bin', 'crate', 'other'
);

const handlingFlagArbitrary = fc.constantFrom<HandlingFlag>(
  'fragile', 'keep_upright', 'heavy', 'valuable', 'priority', 'temperature_sensitive'
);

const containerWithoutQRArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  type: containerTypeArbitrary,
  status: containerStatusArbitrary,
  itemCount: fc.integer({ min: 0, max: 100 }),
  estimatedValue: fc.float({ min: 0, max: 10000, noNaN: true }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }).map(d => d.toISOString()),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }).map(d => d.toISOString()),
  inventoryId: fc.uuid(),
  qrCodeUrl: fc.constantFrom('', null as any), // Container does NOT have QR code
  handlingFlags: fc.uniqueArray(handlingFlagArbitrary, { maxLength: 3 }), // Use uniqueArray to avoid duplicate keys
  photos: fc.constant([]),
  contentsSummary: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  qrCode: fc.constant(undefined),
  createdBy: fc.constant(undefined),
  updatedBy: fc.constant(undefined),
  metadata: fc.constant(undefined),
});

describe('Preservation Property Tests: Legacy Container Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 2.1: Containers without QR codes show "Generate QR Code" button
   * 
   * EXPECTED OUTCOME: Test PASSES on both unfixed and fixed code
   * - For ALL containers where qrCodeUrl is null/empty
   * - The Statistics card MUST show "Generate QR Code" button
   * - This allows users to manually generate QR codes for legacy containers
   */
  test.prop([containerWithoutQRArbitrary], { timeout: 15000, numRuns: 10 })(
    'should show "Generate QR Code" button for all containers without qrCodeUrl',
    async (container) => {
      renderWithProviders(
        <ContainerDetailDialog
          open={true}
          container={container}
          inventoryId={container.inventoryId}
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      // For containers without QR codes, "Generate QR Code" button MUST be visible
      await waitFor(() => {
        const generateButton = screen.getByRole('button', { name: /generate qr code/i });
        expect(generateButton).toBeInTheDocument();
      }, { timeout: 5000 });
    }
  );

  /**
   * Property 2.2: QRCodeGenerator dialog shows size dropdown for containers without QR codes
   * 
   * EXPECTED OUTCOME: Test PASSES on both unfixed and fixed code
   * - For ALL containers where qrCodeUrl is null/empty
   * - The QRCodeGenerator dialog MUST show the size dropdown
   * - This allows users to select QR code size when generating
   */
  test.prop([containerWithoutQRArbitrary], { timeout: 15000, numRuns: 10 })(
    'should show size dropdown in QRCodeGenerator dialog for all containers without qrCodeUrl',
    async (container) => {
      const { unmount } = renderWithProviders(
        <QRCodeGenerator
          open={true}
          onClose={vi.fn()}
          container={container}
          inventoryId={container.inventoryId}
        />
      );

      // For containers without QR codes, size dropdown MUST be visible
      // Query by the label text which should be present when the FormControl is rendered
      await waitFor(() => {
        const sizeLabels = screen.getAllByText(/qr code size/i);
        expect(sizeLabels.length).toBeGreaterThan(0);
      }, { timeout: 5000 });
      
      unmount();
    }
  );

  /**
   * Property 2.3: QRCodeGenerator dialog shows "Generate QR Code" button for containers without QR codes
   * 
   * EXPECTED OUTCOME: Test PASSES on both unfixed and fixed code
   * - For ALL containers where qrCodeUrl is null/empty
   * - The QRCodeGenerator dialog MUST show "Generate QR Code" button
   * - This allows users to generate QR codes manually
   */
  test.prop([containerWithoutQRArbitrary], { timeout: 15000, numRuns: 10 })(
    'should show "Generate QR Code" button in QRCodeGenerator dialog for all containers without qrCodeUrl',
    async (container) => {
      renderWithProviders(
        <QRCodeGenerator
          open={true}
          onClose={vi.fn()}
          container={container}
          inventoryId={container.inventoryId}
        />
      );

      // For containers without QR codes, "Generate QR Code" button MUST be visible
      await waitFor(() => {
        const generateQRButton = screen.getByRole('button', { name: /^generate qr code$/i });
        expect(generateQRButton).toBeInTheDocument();
      }, { timeout: 5000 });

      // "Generate Printable Label" button should also be visible
      const generateLabelButton = screen.getByRole('button', { name: /generate printable label/i });
      expect(generateLabelButton).toBeInTheDocument();
    }
  );

  /**
   * Property 2.4: Dialog displays container information correctly
   * 
   * EXPECTED OUTCOME: Test PASSES on both unfixed and fixed code
   * - For ALL containers where qrCodeUrl is null/empty
   * - The QRCodeGenerator dialog MUST display container information
   * - This includes name, type, item count, and status
   */
  test.prop([containerWithoutQRArbitrary], { timeout: 15000, numRuns: 10 })(
    'should display container information in QRCodeGenerator dialog for all containers without qrCodeUrl',
    async (container) => {
      const { unmount } = renderWithProviders(
        <QRCodeGenerator
          open={true}
          onClose={vi.fn()}
          container={container}
          inventoryId={container.inventoryId}
        />
      );

      // Container information MUST be displayed - check for "Container Information" heading
      await waitFor(() => {
        expect(screen.getByText('Container Information')).toBeInTheDocument();
      }, { timeout: 5000 });
      
      // Also verify the container type is displayed
      expect(screen.getByText(container.type)).toBeInTheDocument();
      
      unmount();
    }
  );

  /**
   * Unit test: Verify specific example of legacy container behavior
   * 
   * This test uses a concrete example to verify the preservation behavior
   * complements the property-based tests above
   */
  it('should preserve legacy container behavior for specific example', async () => {
    const legacyContainer: Container = {
      id: 'legacy-container-1',
      name: 'Legacy Box',
      type: 'box',
      status: 'packed',
      itemCount: 10,
      estimatedValue: 500,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      inventoryId: 'inv1',
      qrCodeUrl: '', // No QR code - legacy container
      handlingFlags: [],
      photos: [],
      contentsSummary: 'Old items',
      qrCode: undefined,
      createdBy: undefined,
      updatedBy: undefined,
      metadata: undefined,
    };

    // Test ContainerDetailDialog
    const { unmount } = renderWithProviders(
      <ContainerDetailDialog
        open={true}
        container={legacyContainer}
        inventoryId="inv1"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Verify "Generate QR Code" button is shown
    await waitFor(() => {
      const generateButton = screen.getByRole('button', { name: /generate qr code/i });
      expect(generateButton).toBeInTheDocument();
    });

    unmount();

    // Test QRCodeGenerator dialog
    renderWithProviders(
      <QRCodeGenerator
        open={true}
        onClose={vi.fn()}
        container={legacyContainer}
        inventoryId="inv1"
      />
    );

    // Verify size dropdown is shown
    await waitFor(() => {
      const sizeLabels = screen.getAllByText(/qr code size/i);
      expect(sizeLabels.length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    // Verify "Generate QR Code" button is shown
    const generateQRButton = screen.getByRole('button', { name: /^generate qr code$/i });
    expect(generateQRButton).toBeInTheDocument();

    // Verify "Generate Printable Label" button is also shown
    const generateLabelButton = screen.getByRole('button', { name: /generate printable label/i });
    expect(generateLabelButton).toBeInTheDocument();
  });

  /**
   * Unit test: Verify null qrCodeUrl is treated same as empty string
   * 
   * This test ensures both null and empty string are handled identically
   */
  it('should treat null qrCodeUrl same as empty string', async () => {
    const containerWithNull: Container = {
      id: 'container-null',
      name: 'Container with null QR',
      type: 'box',
      status: 'packed',
      itemCount: 5,
      estimatedValue: 100,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      inventoryId: 'inv1',
      qrCodeUrl: null as any, // Explicitly null
      handlingFlags: [],
      photos: [],
      contentsSummary: 'Test',
      qrCode: undefined,
      createdBy: undefined,
      updatedBy: undefined,
      metadata: undefined,
    };

    renderWithProviders(
      <ContainerDetailDialog
        open={true}
        container={containerWithNull}
        inventoryId="inv1"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Should show "Generate QR Code" button for null qrCodeUrl
    await waitFor(() => {
      const generateButton = screen.getByRole('button', { name: /generate qr code/i });
      expect(generateButton).toBeInTheDocument();
    });
  });
});

/**
 * PRESERVATION BEHAVIOR DOCUMENTATION
 * 
 * These tests verify that the bugfix does NOT break existing functionality for:
 * 
 * 1. **Legacy Containers**: Containers created before QR code auto-generation was implemented
 *    - These containers have qrCodeUrl = null or ''
 *    - Users must be able to manually generate QR codes for these containers
 * 
 * 2. **Failed QR Generation**: Containers where QR code generation failed during creation
 *    - These containers also have qrCodeUrl = null or ''
 *    - Users must be able to retry QR code generation
 * 
 * 3. **Manual QR Generation Flow**:
 *    - User opens container details
 *    - Sees "Generate QR Code" button in Statistics card
 *    - Clicks button to open QRCodeGenerator dialog
 *    - Sees size dropdown to select QR code size
 *    - Sees "Generate QR Code" button to trigger generation
 *    - Can also generate printable labels
 * 
 * **Property-Based Testing Approach**:
 * - Generates many random containers without QR codes
 * - Tests across different container types, statuses, and handling flags
 * - Provides stronger guarantees than unit tests alone
 * - Catches edge cases that manual tests might miss
 * 
 * **Expected Test Results**:
 * - ON UNFIXED CODE: All tests PASS (baseline behavior is correct)
 * - ON FIXED CODE: All tests PASS (no regressions introduced)
 * 
 * If any test fails after the fix, it indicates a regression that breaks
 * legacy container support and must be corrected before deployment.
 */
