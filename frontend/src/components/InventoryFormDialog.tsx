import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
} from '@mui/material';
import type { Inventory } from '../types';

interface InventoryFormDialogProps {
  open: boolean;
  inventory?: Inventory | null;
  onClose: () => void;
  onSubmit: (data: Omit<Inventory, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => void;
}

/**
 * Inventory Form Dialog Component
 * Handles creation and editing of inventories
 * Validates: Requirements 1.1
 */
export default function InventoryFormDialog({
  open,
  inventory,
  onClose,
  onSubmit,
}: InventoryFormDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens/closes or inventory changes
  useEffect(() => {
    if (open) {
      if (inventory) {
        setFormData({
          name: inventory.name,
          description: inventory.description || '',
        });
      } else {
        setFormData({
          name: '',
          description: '',
        });
      }
      setErrors({});
    }
  }, [open, inventory]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Name must be 100 characters or less';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const submitData = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
    };

    onSubmit(submitData);
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value,
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        component: 'form',
        onSubmit: handleSubmit,
      }}
    >
      <DialogTitle>
        {inventory ? 'Edit Inventory' : 'Create New Inventory'}
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Name"
            value={formData.name}
            onChange={handleChange('name')}
            error={!!errors.name}
            helperText={errors.name}
            required
            fullWidth
            autoFocus
          />
          
          <TextField
            label="Description"
            value={formData.description}
            onChange={handleChange('description')}
            error={!!errors.description}
            helperText={errors.description}
            multiline
            rows={3}
            fullWidth
          />
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="contained">
          {inventory ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}