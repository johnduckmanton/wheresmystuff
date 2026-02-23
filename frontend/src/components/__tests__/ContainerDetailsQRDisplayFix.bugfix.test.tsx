/**
 * Bug Condition Exploration Test for Container Details QR Display Fix
 * 
 * **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
 * **DO NOT attempt to fix the tests or the code when they fail**
 * **NOTE**: These tests encode the expected behavior - they will validate the fix when they pass after implementation
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 * 
 * Property 1: Fault Condition - QR Code Display Defects
 * 
 * Tests that containers with existing QR codes display correctly:
 * - Show actual QR image instead of text
 * - Hide "Generate QR Code" button in Statistics card
 * - Use PrintIcon instead of QrCodeIcon for Print Label button
 * - Hide size dropdown in QRCodeGenerator dialog
 * - Hide "Generate QR Code" button in QRCodeGenerator dialog
 * - Generate labels with proper handling flag icons and layout
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NotificationProvider } from '../../contexts/NotificationContext';
import ContainerDetailDialog from '../ContainerDetailDialog';
import QRCodeGenerator from '../QRCodeGenerator';
import type { Container } from '../../types/entities';
import { readFileSync } from 'fs';
import { join } from 'path';
import React from 'react';

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

describe('Bug Condition Exploration: Container Details QR Display', () => {
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
    qrCodeUrl: 'qr-codes/container1/medium_123.png', // Container HAS existing QR code
    handlingFlags: ['fragile', 'keep_upright'],
    photos: [],
    contentsSummary: 'Test contents',
  };

  const mockContainerWithoutQR: Container = {
    ...mockContainerWithQR,
    qrCodeUrl: '', // Container does NOT have QR code
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * DEFECT 1: QR Code displayed as text instead of image
   * 
   * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
   * - Statistics card shows text "QR Code" instead of img element
   * - No img element with src attribute pointing to QR code image
   * 
   * EXPECTED OUTCOME ON FIXED CODE: Test PASSES
   * - Statistics card shows img element with QR code image
   * - Image has proper dimensions (120x120px)
   */
  it('should display QR code image instead of text when container has qrCodeUrl (Defect 1)', async () => {
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

    // Wait for QR code to load
    await waitFor(() => {
      // On UNFIXED code: This will FAIL because only text "QR Code" is shown
      // On FIXED code: This will PASS because img element is rendered
      const qrImage = screen.getByAltText('Container QR Code');
      expect(qrImage).toBeInTheDocument();
      expect(qrImage).toHaveAttribute('src', 'https://example.com/qr-code.png');
      
      // Verify image dimensions
      expect(qrImage).toHaveStyle({ width: '120px', height: '120px' });
    });
  });

  /**
   * DEFECT 2: "Generate QR Code" button shown when QR already exists
   * 
   * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
   * - "Generate QR Code" button is visible in Statistics card
   * - Button should not be present when qrCodeUrl exists
   * 
   * EXPECTED OUTCOME ON FIXED CODE: Test PASSES
   * - "Generate QR Code" button is NOT visible in Statistics card
   * - Only "Print Label" button is shown
   */
  it('should NOT show "Generate QR Code" button in Statistics card when container has qrCodeUrl (Defect 2)', async () => {
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
      // On UNFIXED code: This will FAIL because "Generate QR Code" button exists
      // On FIXED code: This will PASS because button is hidden
      const generateButton = screen.queryByRole('button', { name: /generate qr code/i });
      expect(generateButton).not.toBeInTheDocument();
    });

    // Verify "Print Label" button IS shown
    await waitFor(() => {
      const printButton = screen.getByRole('button', { name: /print label/i });
      expect(printButton).toBeInTheDocument();
    });
  });

  /**
   * DEFECT 3: Print Label button uses QrCodeIcon instead of PrintIcon
   * 
   * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
   * - Menu bar IconButton uses QrCodeIcon
   * - Source code shows <QrCodeIcon /> in the Print Label button
   * 
   * EXPECTED OUTCOME ON FIXED CODE: Test PASSES
   * - Menu bar IconButton uses PrintIcon
   * - Source code shows <PrintIcon /> in the Print Label button
   */
  it('should use PrintIcon instead of QrCodeIcon for Print Label button (Defect 3)', () => {
    // Read the ContainerDetailDialog.tsx file
    const dialogPath = join(__dirname, '../ContainerDetailDialog.tsx');
    const dialogContent = readFileSync(dialogPath, 'utf-8');

    // Find the Print Label IconButton in the menu bar (DialogTitle section)
    // The button should have tooltip "Print Label" and use PrintIcon
    
    // Check for PrintIcon import
    const hasPrintIconImport = dialogContent.includes("Print as PrintIcon");
    
    // Find the Print Label button section
    const printLabelButtonMatch = dialogContent.match(
      /<Tooltip title="Print Label">[\s\S]*?<IconButton[\s\S]*?<\/IconButton>[\s\S]*?<\/Tooltip>/
    );
    
    expect(printLabelButtonMatch).toBeTruthy();
    
    if (printLabelButtonMatch) {
      const printLabelButton = printLabelButtonMatch[0];
      
      // On UNFIXED code: This will FAIL because it has <QrCodeIcon />
      // On FIXED code: This will PASS because it has <PrintIcon />
      expect(printLabelButton).toMatch(/<PrintIcon\s*\/>/);
      expect(printLabelButton).not.toMatch(/<QrCodeIcon\s*\/>/);
    }
  });

  /**
   * DEFECT 4: QRCodeGenerator dialog shows size dropdown when QR already exists
   * 
   * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
   * - Size dropdown is visible in dialog
   * - FormControl with "QR Code Size" label is rendered
   * 
   * EXPECTED OUTCOME ON FIXED CODE: Test PASSES
   * - Size dropdown is NOT visible when qrCodeUrl exists
   * - FormControl is conditionally hidden
   */
  it('should NOT show size dropdown in QRCodeGenerator dialog when container has qrCodeUrl (Defect 4)', async () => {
    renderWithProviders(
      <QRCodeGenerator
        open={true}
        onClose={vi.fn()}
        container={mockContainerWithQR}
        inventoryId="inv1"
      />
    );

    // On UNFIXED code: This will FAIL because size dropdown is visible
    // On FIXED code: This will PASS because dropdown is hidden
    const sizeDropdown = screen.queryByLabelText(/qr code size/i);
    expect(sizeDropdown).not.toBeInTheDocument();
  });

  /**
   * DEFECT 5: QRCodeGenerator dialog shows "Generate QR Code" button when QR already exists
   * 
   * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
   * - "Generate QR Code" button is visible in dialog
   * - Button should not be present when qrCodeUrl exists
   * 
   * EXPECTED OUTCOME ON FIXED CODE: Test PASSES
   * - "Generate QR Code" button is NOT visible when qrCodeUrl exists
   * - Only "Generate Printable Label" button is shown
   */
  it('should NOT show "Generate QR Code" button in QRCodeGenerator dialog when container has qrCodeUrl (Defect 5)', async () => {
    renderWithProviders(
      <QRCodeGenerator
        open={true}
        onClose={vi.fn()}
        container={mockContainerWithQR}
        inventoryId="inv1"
      />
    );

    // On UNFIXED code: This will FAIL because "Generate QR Code" button exists
    // On FIXED code: This will PASS because button is hidden
    const generateQRButton = screen.queryByRole('button', { name: /^generate qr code$/i });
    expect(generateQRButton).not.toBeInTheDocument();

    // Verify "Generate Printable Label" button IS shown
    const generateLabelButton = screen.getByRole('button', { name: /generate printable label/i });
    expect(generateLabelButton).toBeInTheDocument();
  });

  /**
   * DEFECT 6: Generated labels don't match specification layout
   * 
   * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
   * - Label SVG doesn't include proper handling flag icons
   * - Icons don't match specification (fragile glass symbol, keep_upright arrow)
   * - Colors don't match specification (#DC2626 for fragile, #2563EB for keep_upright)
   * 
   * EXPECTED OUTCOME ON FIXED CODE: Test PASSES
   * - Label SVG includes proper handling flag icons with correct symbols
   * - Icons use specification colors
   * - Layout matches specification with icons at bottom
   */
  it('should generate labels with proper handling flag icons matching specification (Defect 6)', () => {
    // Read the labelService.js file
    const labelServicePath = join(__dirname, '../../../../backend/services/labelService.js');
    const labelServiceContent = readFileSync(labelServicePath, 'utf-8');

    // Check that _getHandlingIconData returns proper icon data
    const getHandlingIconDataMatch = labelServiceContent.match(
      /_getHandlingIconData\(flag, size\) \{[\s\S]*?return icons\[flag\][\s\S]*?\}/
    );
    
    expect(getHandlingIconDataMatch).toBeTruthy();
    
    if (getHandlingIconDataMatch) {
      const getHandlingIconDataFunction = getHandlingIconDataMatch[0];
      
      // Check for fragile icon with proper color and glass/warning symbol
      // On UNFIXED code: This might FAIL if icon is simplified or missing proper SVG
      // On FIXED code: This will PASS with proper glass symbol and #DC2626 color
      expect(getHandlingIconDataFunction).toMatch(/fragile:[\s\S]*?color:\s*['"]#DC2626['"]/);
      expect(getHandlingIconDataFunction).toMatch(/fragile:[\s\S]*?label:\s*['"]FRAGILE['"]/);
      
      // Check for keep_upright icon with proper color and arrow symbol
      // On UNFIXED code: This might FAIL if icon is simplified or missing proper SVG
      // On FIXED code: This will PASS with proper arrow and #2563EB color
      expect(getHandlingIconDataFunction).toMatch(/keep_upright:[\s\S]*?color:\s*['"]#2563EB['"]/);
      expect(getHandlingIconDataFunction).toMatch(/keep_upright:[\s\S]*?label:\s*['"]THIS WAY UP['"]/);
      
      // Verify SVG paths exist for icons (not just text)
      expect(getHandlingIconDataFunction).toMatch(/fragile:[\s\S]*?svg:[\s\S]*?<path/);
      expect(getHandlingIconDataFunction).toMatch(/keep_upright:[\s\S]*?svg:[\s\S]*?<path/);
    }

    // Check that _generateHandlingIcons properly positions icons at bottom
    const generateHandlingIconsMatch = labelServiceContent.match(
      /_generateHandlingIcons\(handlingFlags, startY, width, fontSize\) \{[\s\S]*?return iconsMarkup;[\s\S]*?\}/
    );
    
    expect(generateHandlingIconsMatch).toBeTruthy();
    
    if (generateHandlingIconsMatch) {
      const generateHandlingIconsFunction = generateHandlingIconsMatch[0];
      
      // Verify icons are centered and properly spaced
      expect(generateHandlingIconsFunction).toMatch(/startX = \(width - totalIconsWidth\) \/ 2/);
      expect(generateHandlingIconsFunction).toMatch(/currentX \+= iconSize \+ iconSpacing/);
      
      // Verify text labels are positioned below icons
      expect(generateHandlingIconsFunction).toMatch(/y="\$\{iconSize \+ fontSize/);
    }
  });

  /**
   * PRESERVATION TEST: Containers without QR codes should still show "Generate QR Code" button
   * 
   * This test verifies that the fix doesn't break existing functionality for
   * containers that don't have QR codes (legacy containers or failed generation).
   */
  it('should still show "Generate QR Code" button for containers WITHOUT qrCodeUrl (Preservation)', async () => {
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

    // For containers without QR codes, "Generate QR Code" button SHOULD be visible
    await waitFor(() => {
      const generateButton = screen.getByRole('button', { name: /generate qr code/i });
      expect(generateButton).toBeInTheDocument();
    });
  });
});

/**
 * COUNTEREXAMPLES DOCUMENTATION
 * 
 * Based on the bug description and design document, the expected counterexamples are:
 * 
 * 1. **QR Code Display Defect**:
 *    - Container with qrCodeUrl="qr-codes/abc123/medium_1234567890.png"
 *    - Statistics card shows text "QR Code" instead of 120x120px image
 *    - Root cause: ContainerDetailDialog.tsx renders text instead of conditional img element
 * 
 * 2. **Generate Button Visibility Defect**:
 *    - Container with existing qrCodeUrl
 *    - Statistics card shows "Generate QR Code" button when it shouldn't
 *    - Root cause: Button is rendered unconditionally without checking qrCodeUrl
 * 
 * 3. **Print Label Icon Defect**:
 *    - Print Label button in menu bar uses QrCodeIcon
 *    - Should use PrintIcon instead
 *    - Root cause: Wrong icon component imported/used in IconButton
 * 
 * 4. **Size Dropdown Visibility Defect**:
 *    - Container with existing qrCodeUrl opens QRCodeGenerator dialog
 *    - Dialog shows "QR Code Size" dropdown when size was already determined
 *    - Root cause: FormControl is rendered unconditionally without checking qrCodeUrl
 * 
 * 5. **Dialog Generate Button Visibility Defect**:
 *    - Container with existing qrCodeUrl opens QRCodeGenerator dialog
 *    - Dialog shows "Generate QR Code" button when code already exists
 *    - Root cause: Button is rendered unconditionally without checking qrCodeUrl
 * 
 * 6. **Label Layout Defect**:
 *    - Container with handlingFlags=['fragile', 'keep_upright']
 *    - Generated label doesn't include proper handling flag icons
 *    - Icons don't match specification (missing glass symbol, arrow, proper colors)
 *    - Root cause: labelService._getHandlingIconData has simplified or incorrect SVG markup
 * 
 * **Fix Required**:
 * - ContainerDetailDialog.tsx: Add conditional rendering for QR image vs text
 * - ContainerDetailDialog.tsx: Hide "Generate QR Code" button when qrCodeUrl exists
 * - ContainerDetailDialog.tsx: Change QrCodeIcon to PrintIcon in menu bar
 * - QRCodeGenerator.tsx: Hide size dropdown when qrCodeUrl exists
 * - QRCodeGenerator.tsx: Hide "Generate QR Code" button when qrCodeUrl exists
 * - labelService.js: Update _getHandlingIconData with proper SVG icons matching specification
 */
