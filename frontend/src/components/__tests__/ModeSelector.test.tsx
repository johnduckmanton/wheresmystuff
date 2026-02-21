import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModeSelector from '../packing/ModeSelector';

describe('ModeSelector Component', () => {
  it('renders both mode options', () => {
    const mockOnModeChange = vi.fn();
    render(<ModeSelector mode="select" onModeChange={mockOnModeChange} />);
    
    expect(screen.getByText('Select Existing')).toBeInTheDocument();
    expect(screen.getByText('Create New')).toBeInTheDocument();
  });

  it('calls onModeChange with correct value when Select Existing is clicked', () => {
    const mockOnModeChange = vi.fn();
    render(<ModeSelector mode="create" onModeChange={mockOnModeChange} />);
    
    const selectButton = screen.getByText('Select Existing');
    fireEvent.click(selectButton);
    
    expect(mockOnModeChange).toHaveBeenCalledWith('select');
  });

  it('calls onModeChange with correct value when Create New is clicked', () => {
    const mockOnModeChange = vi.fn();
    render(<ModeSelector mode="select" onModeChange={mockOnModeChange} />);
    
    const createButton = screen.getByText('Create New');
    fireEvent.click(createButton);
    
    expect(mockOnModeChange).toHaveBeenCalledWith('create');
  });

  it('applies correct styling to active mode', () => {
    const mockOnModeChange = vi.fn();
    const { rerender } = render(<ModeSelector mode="select" onModeChange={mockOnModeChange} />);
    
    const selectButton = screen.getByText('Select Existing').closest('button');
    expect(selectButton).toHaveClass('Mui-selected');
    
    rerender(<ModeSelector mode="create" onModeChange={mockOnModeChange} />);
    
    const createButton = screen.getByText('Create New').closest('button');
    expect(createButton).toHaveClass('Mui-selected');
  });

  it('disables buttons when disabled prop is true', () => {
    const mockOnModeChange = vi.fn();
    render(<ModeSelector mode="select" onModeChange={mockOnModeChange} disabled={true} />);
    
    const selectButton = screen.getByText('Select Existing').closest('button');
    const createButton = screen.getByText('Create New').closest('button');
    
    expect(selectButton).toBeDisabled();
    expect(createButton).toBeDisabled();
  });
});
