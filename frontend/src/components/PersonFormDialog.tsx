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
import type { Person } from '../types';

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

  // Initialize form data when dialog opens or person changes
  useEffect(() => {
    if (open) {
      if (person) {
        // Editing existing person
        setFormData({ ...person });
      } else {
        // Creating new person
        setFormData({
          name: '',
          description: '',
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
          <TextField
            fullWidth
            label="Name"
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

          <TextField
            fullWidth
            label="Description"
            value={formData.description || ''}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            multiline
            rows={3}
            inputProps={{
              'aria-label': 'Person description',
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
