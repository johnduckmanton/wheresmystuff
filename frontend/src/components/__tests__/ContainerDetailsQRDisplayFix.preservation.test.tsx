/**
 * Preservation Property Tests for Container QR Display
 * 
 * **UPDATED**: Tests now reflect simplified workflow where:
 * - QR codes are auto-generated on container creation
 * - No manual QR generation needed
 * - Labels can be printed for any container using its ID
 * 
 * **Validates: Core functionality is preserved**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NotificationProvider } from '../../contexts/NotificationContext';
import ContainerDetailDialog from '../ContainerDetailDialog';
import PrintableLabel from '../PrintableLabel';
import type { Container } from '../../types/entities';
import React from 'react';

// Mock QRCode library
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr-code'),
  },
}));

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

describe('Preservation Property Tests: Container Functionality', () => {
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
    qrCodeUrl: '',
    qrCode: '',
    handlingFlags: [],
    photos: [],
    contentsSummary: 'Old items',
    createdBy: 'user1',
    updatedBy: 'user1',
    metadata: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display container information correctly', async () => {
    renderWithProviders(
      <ContainerDetailDialog
        open={true}
        container={legacyContainer}
        inventoryId="inv1"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Legacy Box')).toBeInTheDocument();
    // Use getAllByText since "Box" appears multiple times (title and type chip)
    const boxElements = screen.getAllByText(/box/i);
    expect(boxElements.length).toBeGreaterThan(0);
  });

  it('should allow printing labels even without stored QR code', async () => {
    renderWithProviders(
      <PrintableLabel
        container={legacyContainer}
        qrCodeId={legacyContainer.id}
        size="medium"
      />
    );

    // Initially should show loading state
    expect(screen.getByText(/generating label/i)).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/generating label/i)).not.toBeInTheDocument();
    }, { timeout: 6000 });

    // Should show download and print buttons after generation
    expect(screen.getByText(/download/i)).toBeInTheDocument();
    expect(screen.getByText(/print label/i)).toBeInTheDocument();
  });

  it('should show print label button for all containers', () => {
    renderWithProviders(
      <ContainerDetailDialog
        open={true}
        container={legacyContainer}
        inventoryId="inv1"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const printButton = screen.getByRole('button', { name: /print label/i });
    expect(printButton).toBeInTheDocument();
  });
});
