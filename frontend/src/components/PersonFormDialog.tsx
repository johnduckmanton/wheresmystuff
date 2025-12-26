import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
} from '@mui/material';
import type { Person } from '../types';
import InventoryFormSelector from './InventoryFormSelector';
import { useInventory } from '../contexts/InventoryContext';

export interface PersonFormDialogProps {
  open: boolean;
  person?: Person; // If provided, we're editing; otherwise creating
  onSubmit: (data: Partial<Person>) => void;
  onClose: () => void;
}

export default function PersonFormDialog({
  open,
  person,
  onSubmit,
  onClose,
}: PersonFormDialogProps) {
  const [formData, setFormData] = useState<Partial<Person>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { currentInventory } = useInventory();

  // Initialize form data when dialog opens or person changes
  useEffect(() => {
    if (open) {
      if (person) {
        // Editing existing person
        setFormData({ ...person });
      } else {
        // Creating new person - auto-select current inventory
        setFormData({
          name: '',
          inventoryId: currentInventory?.id || '',
          description: '',
          email: '',
          phone: '',
          relationship: '',
          notes: '',
          photos: [],
        });
      }
      setErrors({});
    }
  }, [open, person]);

  // Handle field change
  const handleFieldChange = (name: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name is required
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Name is required';
    }

    // Inventory is required
    if (!formData.inventoryId || formData.inventoryId.trim() === '') {
      newErrors.inventoryId = 'Inventory is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setFormData({});
    setErrors({});
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      aria-labelledby="person-form-dialog-title"
    >
      <DialogTitle id="person-form-dialog-title">
        {person ? 'Edit Person' : 'Add Person'}
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pt: 1,
          }}
        >
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ 
              mb: 1,
              fontStyle: 'italic'
            }}
          >
            Fields marked with * are required
          </Typography>

          <TextField
            fullWidth
            label="Name *"
            value={formData.name || ''}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            required
            inputProps={{
              'aria-label': 'Person name',
              'aria-required': 'true',
            }}
          />

          <InventoryFormSelector
            value={formData.inventoryId || ''}
            onChange={(inventoryId) => handleFieldChange('inventoryId', inventoryId)}
            error={errors.inventoryId}
            required
          />

          <TextField
            fullWidth
            label="Description (Optional)"
            value={formData.description || ''}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            multiline
            rows={2}
            inputProps={{
              'aria-label': 'Person description (optional)',
            }}
          />

          <TextField
            fullWidth
            label="Email (Optional)"
            type="email"
            value={formData.email || ''}
            onChange={(e) => handleFieldChange('email', e.target.value)}
            placeholder="e.g., person@example.com"
            inputProps={{
              'aria-label': 'Email address (optional)',
            }}
          />

          <TextField
            fullWidth
            label="Phone (Optional)"
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => handleFieldChange('phone', e.target.value)}
            placeholder="e.g., +1 (555) 123-4567"
            inputProps={{
              'aria-label': 'Phone number (optional)',
            }}
          />

          <TextField
            fullWidth
            label="Relationship (Optional)"
            value={formData.relationship || ''}
            onChange={(e) => handleFieldChange('relationship', e.target.value)}
            placeholder="e.g., Family member, Friend, Roommate"
            inputProps={{
              'aria-label': 'Relationship to you (optional)',
            }}
          />

          <TextField
            fullWidth
            label="Notes (Optional)"
            value={formData.notes || ''}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            multiline
            rows={3}
            placeholder="Additional information about this person..."
            inputProps={{
              'aria-label': 'Additional notes (optional)',
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          {person ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
