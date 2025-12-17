import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Autocomplete,
  Chip,
} from '@mui/material';
import type { Category } from '../types';
import InventoryFormSelector from './InventoryFormSelector';
import { useInventory } from '../contexts/InventoryContext';

// Predefined color options
const COLOR_OPTIONS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2',
  '#A3E4D7', '#F9E79F', '#D5A6BD', '#AED6F1', '#A9DFBF'
];

// Predefined icon options (Material-UI icon names)
const ICON_OPTIONS = [
  'chair', 'tv', 'kitchen', 'blender', 'shirt', 'book', 'hammer', 'leaf',
  'sports', 'palette', 'diamond', 'music', 'briefcase', 'bath', 'spray',
  'lightbulb', 'box', 'car', 'pets', 'favorite', 'child_care', 'description',
  'ac_unit', 'help_outline', 'home', 'computer', 'phone', 'camera'
];

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
  const { currentInventory } = useInventory();

  // Initialize form data when dialog opens or category changes
  useEffect(() => {
    if (open) {
      if (category) {
        // Editing existing category
        setFormData({ ...category });
      } else {
        // Creating new category - auto-select current inventory
        setFormData({
          name: '',
          inventoryId: currentInventory?.id || '',
          description: '',
          color: '#4ECDC4', // Default color
          icon: 'category', // Default icon
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

          <InventoryFormSelector
            value={formData.inventoryId || ''}
            onChange={(inventoryId) => handleFieldChange('inventoryId', inventoryId)}
            error={errors.inventoryId}
            required
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

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Autocomplete
              options={COLOR_OPTIONS}
              value={formData.color || ''}
              onChange={(_, newValue) => handleFieldChange('color', newValue)}
              freeSolo
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Color"
                  placeholder="Select or enter hex color"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          backgroundColor: formData.color || '#4ECDC4',
                          border: '1px solid #ccc',
                          mr: 1,
                        }}
                      />
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: option,
                      border: '1px solid #ccc',
                    }}
                  />
                  {option}
                </Box>
              )}
              sx={{ flex: 1 }}
            />

            <Autocomplete
              options={ICON_OPTIONS}
              value={formData.icon || ''}
              onChange={(_, newValue) => handleFieldChange('icon', newValue)}
              freeSolo
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Icon"
                  placeholder="Select or enter icon name"
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span className="material-icons" style={{ fontSize: 16 }}>
                    {option}
                  </span>
                  {option}
                </Box>
              )}
              sx={{ flex: 1 }}
            />
          </Box>
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
