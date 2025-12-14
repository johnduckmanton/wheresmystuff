import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
} from '@mui/material';
import type { Category } from '../types';

export interface CategoryFormDialogProps {
  open: boolean;
  category?: Category; // If provided, we're editing; otherwise creating
  onSubmit: (data: Partial<Category>) => void;
  onClose: () => void;
}

export default function CategoryFormDialog({
  open,
  category,
  onSubmit,
  onClose,
}: CategoryFormDialogProps) {
  const [formData, setFormData] = useState<Partial<Category>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when dialog opens or category changes
  useEffect(() => {
    if (open) {
      if (category) {
        // Editing existing category
        setFormData({ ...category });
      } else {
        // Creating new category
        setFormData({
          name: '',
          description: '',
        });
      }
      setErrors({});
    }
  }, [open, category]);

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
      aria-labelledby="category-form-dialog-title"
    >
      <DialogTitle id="category-form-dialog-title">
        {category ? 'Edit Category' : 'Add Category'}
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
          <TextField
            fullWidth
            label="Name"
            value={formData.name || ''}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            required
            inputProps={{
              'aria-label': 'Category name',
              'aria-required': 'true',
            }}
          />

          <TextField
            fullWidth
            label="Description"
            value={formData.description || ''}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            multiline
            rows={3}
            inputProps={{
              'aria-label': 'Category description',
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          {category ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
