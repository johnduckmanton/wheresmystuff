import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';

export type FieldType = 'text' | 'textarea' | 'select' | 'date';

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  options?: Array<{ value: string; label: string }>;
}

export interface EntityFormDialogProps {
  open: boolean;
  title: string;
  fields: FieldConfig[];
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => void;
  onClose: () => void;
}

export default function EntityFormDialog({
  open,
  title,
  fields,
  initialData = {},
  onSubmit,
  onClose,
}: EntityFormDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when dialog opens or initialData changes
  useEffect(() => {
    if (open) {
      const data: Record<string, any> = {};
      fields.forEach((field) => {
        data[field.name] = initialData[field.name] ?? '';
      });
      setFormData(data);
      setErrors({});
    }
  }, [open, initialData, fields]);

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

    fields.forEach((field) => {
      if (field.required) {
        const value = formData[field.name];
        if (value === undefined || value === null || value === '') {
          newErrors[field.name] = `${field.label} is required`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
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

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Ctrl/Cmd + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit();
    }
  };

  // Render field based on type
  const renderField = (field: FieldConfig) => {
    const hasError = !!errors[field.name];
    const errorMessage = errors[field.name];
    const value = formData[field.name] ?? '';

    switch (field.type) {
      case 'select':
        return (
          <FormControl
            key={field.name}
            fullWidth
            error={hasError}
            required={field.required}
          >
            <InputLabel>{field.label}</InputLabel>
            <Select
              value={value}
              label={field.label}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {field.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {hasError && <FormHelperText>{errorMessage}</FormHelperText>}
          </FormControl>
        );

      case 'date':
        return (
          <TextField
            key={field.name}
            fullWidth
            label={field.label}
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            error={hasError}
            helperText={errorMessage}
            required={field.required}
            InputLabelProps={{
              shrink: true,
            }}
          />
        );

      case 'textarea':
        return (
          <TextField
            key={field.name}
            fullWidth
            label={field.label}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            error={hasError}
            helperText={errorMessage}
            required={field.required}
            multiline
            rows={field.rows || 4}
          />
        );

      case 'text':
      default:
        return (
          <TextField
            key={field.name}
            fullWidth
            label={field.label}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            error={hasError}
            helperText={errorMessage}
            required={field.required}
            multiline={field.multiline}
            rows={field.multiline ? field.rows || 3 : undefined}
          />
        );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      fullScreen={false}
      aria-labelledby="entity-form-dialog-title"
      onKeyDown={handleKeyDown}
      sx={{
        '& .MuiDialog-paper': {
          m: { xs: 2, sm: 3 },
          maxHeight: { xs: 'calc(100% - 32px)', sm: 'calc(100% - 64px)' },
        },
      }}
    >
      <DialogTitle id="entity-form-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pt: 1,
          }}
          noValidate
        >
          {fields.map((field) => renderField(field))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2, gap: 1 }}>
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={() => handleSubmit()} 
          variant="contained" 
          color="primary"
          type="submit"
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
