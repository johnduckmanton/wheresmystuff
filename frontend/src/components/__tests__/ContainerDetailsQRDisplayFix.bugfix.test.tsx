/**
 * Container Details QR Display and Label Generation Tests
 * 
 * **UPDATED**: Tests now reflect simplified workflow where:
 * - QR codes are auto-generated on container creation
 * - Labels are printed directly without separate QR generation dialog
 * - QR code is generated dynamically from container ID
 * 
 * **Validates: QR code display and label generation functionality**
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
      hasQRCode: true,
      downloadUrl: 'https://example.com/qr-code.png'
    }),
    getContainer: vi.fn().mockResolvedValue({
      id: 'container1',
      name: 'Test Container',
      qrCodeUrl: 'qr-codes/container1/medium_123.png'
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

describe('Container Details QR Display and Label Generation', () => {
  const mockContainerWithQR: Container = {
    id: 'container1',
    name: 'Test Container',
    type: 'box',
    status: 'packed',
    itemCount: 5,
    estimatedValue: 100,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    inventoryId: 'inv1',
    qrCodeUrl: 'qr-codes/container1/medium_123.png',
    handlingFlags: ['fragile', 'keep_upright'],
    photos: [],
    contentsSummary: 'Test contents',
    qrCode: 'QR123456',
    createdBy: 'user1',
    updatedBy: 'user1',
    metadata: {},
  };

  const mockContainerWithoutQR: Container = {
    ...mockContainerWithQR,
    qrCodeUrl: '',
    qrCode: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display QR code image when container has qrCodeUrl', async () => {
    renderWithProviders(
      <ContainerDetailDialog
        open={true}
        container={mockContainerWithQR}
        inventoryId="inv1"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await waitFor(() => {
      const qrImage = screen.getByAltText('Container QR Code');
      expect(qrImage).toBeInTheDocument();
      expect(qrImage).toHaveAttribute('src', 'https://example.com/qr-code.png');
      expect(qrImage).toHaveStyle({ width: '120px', height: '120px' });
    });
  });

  it('should show Print Label button in toolbar', () => {
    renderWithProviders(
      <ContainerDetailDialog
        open={true}
        container={mockContainerWithQR}
        inventoryId="inv1"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const printButton = screen.getByRole('button', { name: /print label/i });
    expect(printButton).toBeInTheDocument();
  });

  it('should generate printable label with QR code from container ID', async () => {
    renderWithProviders(
      <PrintableLabel
        container={mockContainerWithQR}
        qrCodeId={mockContainerWithQR.id}
        size="medium"
      />
    );

    // Initially should show loading state
    expect(screen.getByText(/generating label/i)).toBeInTheDocument();

    // Wait for loading to complete and canvas to appear
    await waitFor(() => {
      expect(screen.queryByText(/generating label/i)).not.toBeInTheDocument();
    }, { timeout: 6000 });

    // Should show download and print buttons after generation
    expect(screen.getByText(/download/i)).toBeInTheDocument();
    expect(screen.getByText(/print label/i)).toBeInTheDocument();
  });

  it('should show message when container has no QR code', async () => {
    renderWithProviders(
      <ContainerDetailDialog
        open={true}
        container={mockContainerWithoutQR}
        inventoryId="inv1"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/no qr code generated yet/i)).toBeInTheDocument();
    });
  });
});
