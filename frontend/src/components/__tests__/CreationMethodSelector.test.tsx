import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CreationMethodSelector from '../packing/CreationMethodSelector';

describe('CreationMethodSelector Component', () => {
  it('renders all four method options', () => {
    const mockOnMethodSelect = vi.fn();
    render(<CreationMethodSelector onMethodSelect={mockOnMethodSelect} />);
    
    expect(screen.getByText('AI Photo Upload')).toBeInTheDocument();
    expect(screen.getByText('Barcode Scan')).toBeInTheDocument();
    expect(screen.getByText('Manual Entry')).toBeInTheDocument();
    expect(screen.getByText('Quick Pack')).toBeInTheDocument();
  });

  it('calls onMethodSelect with "ai" when AI Photo Upload is clicked', () => {
    const mockOnMethodSelect = vi.fn();
    render(<CreationMethodSelector onMethodSelect={mockOnMethodSelect} />);
    
    const aiButton = screen.getByText('AI Photo Upload');
    fireEvent.click(aiButton);
    
    expect(mockOnMethodSelect).toHaveBeenCalledWith('ai');
  });

  it('calls onMethodSelect with "barcode" when Barcode Scan is clicked', () => {
    const mockOnMethodSelect = vi.fn();
    render(<CreationMethodSelector onMethodSelect={mockOnMethodSelect} />);
    
    const barcodeButton = screen.getByText('Barcode Scan');
    fireEvent.click(barcodeButton);
    
    expect(mockOnMethodSelect).toHaveBeenCalledWith('barcode');
  });

  it('calls onMethodSelect with "manual" when Manual Entry is clicked', () => {
    const mockOnMethodSelect = vi.fn();
    render(<CreationMethodSelector onMethodSelect={mockOnMethodSelect} />);
    
    const manualButton = screen.getByText('Manual Entry');
    fireEvent.click(manualButton);
    
    expect(mockOnMethodSelect).toHaveBeenCalledWith('manual');
  });

  it('calls onMethodSelect with "quickpack" when Quick Pack is clicked', () => {
    const mockOnMethodSelect = vi.fn();
    render(<CreationMethodSelector onMethodSelect={mockOnMethodSelect} />);
    
    const quickPackButton = screen.getByText('Quick Pack');
    fireEvent.click(quickPackButton);
    
    expect(mockOnMethodSelect).toHaveBeenCalledWith('quickpack');
  });

  it('Quick Pack button has correct aria-label', () => {
    const mockOnMethodSelect = vi.fn();
    render(<CreationMethodSelector onMethodSelect={mockOnMethodSelect} />);
    
    const quickPackButton = screen.getByRole('button', { name: 'enter quick pack mode' });
    expect(quickPackButton).toBeInTheDocument();
  });

  it('disables all buttons when disabled prop is true', () => {
    const mockOnMethodSelect = vi.fn();
    render(<CreationMethodSelector onMethodSelect={mockOnMethodSelect} disabled={true} />);
    
    const aiButton = screen.getByText('AI Photo Upload').closest('button');
    const barcodeButton = screen.getByText('Barcode Scan').closest('button');
    const manualButton = screen.getByText('Manual Entry').closest('button');
    const quickPackButton = screen.getByText('Quick Pack').closest('button');
    
    expect(aiButton).toBeDisabled();
    expect(barcodeButton).toBeDisabled();
    expect(manualButton).toBeDisabled();
    expect(quickPackButton).toBeDisabled();
  });

  it('has minimum 56px height for touch targets', () => {
    const mockOnMethodSelect = vi.fn();
    render(<CreationMethodSelector onMethodSelect={mockOnMethodSelect} />);
    
    const aiButton = screen.getByText('AI Photo Upload').closest('button');
    
    // Check that minHeight is set to 56px
    expect(aiButton).toHaveStyle({ minHeight: '56px' });
  });
});
