import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  OutlinedInput,
  type SelectChangeEvent,
} from '@mui/material';
import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import ContainerPhotoUpload from './ContainerPhotoUpload';
import apiClient from '../services/api';
import type { 
  Container, 
  ContainerType, 
  HandlingFlag, 
  ContainerStatus,
  Location 
} from '../types/entities';
import { ContainerType as ContainerTypeEnum, HandlingFlag as HandlingFlagEnum, ContainerStatus as ContainerStatusEnum } from '../types/entities';

interface ContainerFormDialogProps {
  open: boolean;
  container?: Container | null;
  onClose: () => void;
  onSuccess: (container: Container) => void;
}

const containerTypeOptions = [
  { value: ContainerTypeEnum.Box, label: 'Box' },
  { value: ContainerTypeEnum.Bag, label: 'Bag' },
  { value: ContainerTypeEnum.Crate, label: 'Crate' },
  { value: ContainerTypeEnum.Bin, label: 'Bin' },
  { value: ContainerTypeEnum.Suitcase, label: 'Suitcase' },
  { value: ContainerTypeEnum.Trunk, label: 'Trunk' },
  { value: ContainerTypeEnum.Custom, label: 'Custom' },
];

const sizeOptions = [
  { value: 'Small', label: 'Small' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Large', label: 'Large' },
  { value: 'Extra Large', label: 'Extra Large' },
  { value: 'Custom', label: 'Custom' },
];

const handlingFlagOptions = [
  { value: HandlingFlagEnum.Fragile, label: 'Fragile' },
  { value: HandlingFlagEnum.Heavy, label: 'Heavy' },
  { value: HandlingFlagEnum.Valuable, label: 'Valuable' },
  { value: HandlingFlagEnum.Priority, label: 'Priority' },
  { value: HandlingFlagEnum.KeepUpright, label: 'Keep Upright' },
  { value: HandlingFlagEnum.TemperatureSensitive, label: 'Temperature Sensitive' },
];

const statusOptions = [
  { value: ContainerStatusEnum.Empty, label: 'Empty' },
  { value: ContainerStatusEnum.Packing, label: 'Packing' },
  { value: ContainerStatusEnum.Packed, label: 'Packed' },
  { value: ContainerStatusEnum.InTransit, label: 'In Transit' },
  { value: ContainerStatusEnum.Stored, label: 'Stored' },
  { value: ContainerStatusEnum.Unpacking, label: 'Unpacking' },
  { value: ContainerStatusEnum.Unpacked, label: 'Unpacked' },
];

interface FormData {
  name: string;
  type: ContainerType;
  size: string;
  color: string;
  description: string;
  photos: string[];
  locationId: string;
  handlingFlags: HandlingFlag[];
  status: ContainerStatus;
  storageRate: string;
}

interface FormErrors {
  name?: string;
  type?: string;
  size?: string;
  color?: string;
  description?: string;
  photos?: string;
  locationId?: string;
  handlingFlags?: string;
  status?: string;
  storageRate?: string;
}

export default function ContainerFormDialog({
  open,
  container,
  onClose,
  onSuccess,
}: ContainerFormDialogProps) {
  const { currentInventory } = useInventory();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: ContainerTypeEnum.Box,
    size: '',
    color: '',
    description: '',
    photos: [],
    locationId: '',
    handlingFlags: [],
    status: ContainerStatusEnum.Empty,
    storageRate: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const isEditing = !!container;

  // Load locations when dialog opens
  useEffect(() => {
    if (open && currentInventory) {
      loadLocations();
    }
  }, [open, currentInventory]);

  // Initialize form data when container changes
  useEffect(() => {
    if (open) {
      if (container) {
        setFormData({
          name: container.name || '',
          type: container.type || ContainerTypeEnum.Box,
          size: container.size || '',
          color: container.color || '',
          description: container.description || '',
          photos: container.photos || [],
          locationId: container.locationId || '',
          handlingFlags: container.handlingFlags || [],
          status: container.status || ContainerStatusEnum.Empty,
          storageRate: container.storageRate?.toString() || '',
        });
      } else {
        setFormData({
          name: '',
          type: ContainerTypeEnum.Box,
          size: '',
          color: '',
          description: '',
          photos: [],
          locationId: '',
          handlingFlags: [],
          status: ContainerStatusEnum.Empty,
          storageRate: '',
        });
      }
      setErrors({});
    }
  }, [open, container]);

  const loadLocations = async () => {
    if (!currentInventory) return;
    
    try {
      const locationData = await apiClient.getLocations(currentInventory.id);
      setLocations(locationData);
    } catch (error) {
      console.error('Error loading locations:', error);
      showError('Failed to load locations');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Container name is required';
    }

    if (!formData.type) {
      newErrors.type = 'Container type is required';
    }

    // Validate storage rate if provided
    if (formData.storageRate && isNaN(Number(formData.storageRate))) {
      newErrors.storageRate = 'Storage rate must be a valid number';
    }

    // Validate color format if provided (hex color)
    if (formData.color && !/^#[0-9A-F]{6}$/i.test(formData.color)) {
      newErrors.color = 'Color must be a valid hex color (e.g., #FF5733)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleHandlingFlagsChange = (event: SelectChangeEvent<HandlingFlag[]>) => {
    const value = event.target.value;
    handleFieldChange('handlingFlags', typeof value === 'string' ? value.split(',') : value);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!validateForm() || !currentInventory) {
      return;
    }

    setLoading(true);

    try {
      const containerData = {
        inventoryId: currentInventory.id,
        name: formData.name.trim(),
        type: formData.type,
        size: formData.size || undefined,
        color: formData.color || undefined,
        description: formData.description || undefined,
        photos: formData.photos,
        locationId: formData.locationId || undefined,
        handlingFlags: formData.handlingFlags,
        status: formData.status,
        storageRate: formData.storageRate ? Number(formData.storageRate) : undefined,
        metadata: {},
      };

      let result: Container;
      if (isEditing && container) {
        console.log('🔄 Updating container:', container.id, containerData);
        result = await apiClient.updateContainer(container.id, containerData);
        console.log('✅ Container updated:', result);
        showSuccess('Container updated successfully');
      } else {
        console.log('➕ Creating container:', containerData);
        result = await apiClient.createContainer(containerData);
        console.log('✅ Container created:', result);
        showSuccess('Container created successfully');
      }

      console.log('🎉 Calling onSuccess with result:', result);
      onSuccess(result);
      onClose();
    } catch (error) {
      console.error('Error saving container:', error);
      showError(
        error instanceof Error ? error.message : 'Failed to save container'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      type: ContainerTypeEnum.Box,
      size: '',
      color: '',
      description: '',
      photos: [],
      locationId: '',
      handlingFlags: [],
      status: ContainerStatusEnum.Empty,
      storageRate: '',
    });
    setErrors({});
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      aria-labelledby="container-form-dialog-title"
    >
      <DialogTitle id="container-form-dialog-title">
        {isEditing ? 'Edit Container' : 'Create New Container'}
      </DialogTitle>
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
          {/* Container Name */}
          <TextField
            fullWidth
            label="Container Name"
            value={formData.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            required
            placeholder="e.g., Kitchen Box 1, Bedroom Bag A"
          />

          {/* Container Type */}
          <FormControl fullWidth error={!!errors.type} required>
            <InputLabel>Container Type</InputLabel>
            <Select
              value={formData.type}
              label="Container Type"
              onChange={(e) => handleFieldChange('type', e.target.value)}
            >
              {containerTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {errors.type && <FormHelperText>{errors.type}</FormHelperText>}
          </FormControl>

          {/* Size and Color Row */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth error={!!errors.size}>
              <InputLabel>Size</InputLabel>
              <Select
                value={formData.size}
                label="Size"
                onChange={(e) => handleFieldChange('size', e.target.value)}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {sizeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              {errors.size && <FormHelperText>{errors.size}</FormHelperText>}
            </FormControl>

            <TextField
              fullWidth
              label="Color"
              value={formData.color}
              onChange={(e) => handleFieldChange('color', e.target.value)}
              error={!!errors.color}
              helperText={errors.color || 'Hex color code (e.g., #FF5733)'}
              placeholder="#FF5733"
            />
          </Box>

          {/* Location */}
          <FormControl fullWidth error={!!errors.locationId}>
            <InputLabel>Location</InputLabel>
            <Select
              value={formData.locationId}
              label="Location"
              onChange={(e) => handleFieldChange('locationId', e.target.value)}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {locations.map((location) => (
                <MenuItem key={location.id} value={location.id}>
                  {location.name}
                </MenuItem>
              ))}
            </Select>
            {errors.locationId && <FormHelperText>{errors.locationId}</FormHelperText>}
          </FormControl>

          {/* Status */}
          <FormControl fullWidth error={!!errors.status}>
            <InputLabel>Status</InputLabel>
            <Select
              value={formData.status}
              label="Status"
              onChange={(e) => handleFieldChange('status', e.target.value)}
            >
              {statusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {errors.status && <FormHelperText>{errors.status}</FormHelperText>}
          </FormControl>

          {/* Handling Flags */}
          <FormControl fullWidth error={!!errors.handlingFlags}>
            <InputLabel>Handling Requirements</InputLabel>
            <Select
              multiple
              value={formData.handlingFlags}
              onChange={handleHandlingFlagsChange}
              input={<OutlinedInput label="Handling Requirements" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => {
                    const option = handlingFlagOptions.find(opt => opt.value === value);
                    return (
                      <Chip 
                        key={value} 
                        label={option?.label || value} 
                        size="small" 
                      />
                    );
                  })}
                </Box>
              )}
            >
              {handlingFlagOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {errors.handlingFlags && <FormHelperText>{errors.handlingFlags}</FormHelperText>}
          </FormControl>

          {/* Storage Rate */}
          <TextField
            fullWidth
            label="Storage Rate (per month)"
            type="number"
            value={formData.storageRate}
            onChange={(e) => handleFieldChange('storageRate', e.target.value)}
            error={!!errors.storageRate}
            helperText={errors.storageRate || 'Optional: Cost per month if stored'}
            inputProps={{ min: 0, step: 0.01 }}
          />

          {/* Container Photos */}
          {isEditing && container && currentInventory && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Container Photos
              </Typography>
              <ContainerPhotoUpload
                containerId={container.id}
                inventoryId={currentInventory.id}
                photos={formData.photos}
                onPhotosUpdated={(photos) => handleFieldChange('photos', photos)}
                disabled={loading}
              />
            </Box>
          )}

          {/* Description */}
          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            error={!!errors.description}
            helperText={errors.description}
            multiline
            rows={3}
            placeholder="Additional notes about this container..."
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={handleCancel} color="inherit" disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={() => handleSubmit()} 
          variant="contained" 
          color="primary"
          disabled={loading}
        >
          {loading ? 'Saving...' : (isEditing ? 'Update Container' : 'Create Container')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}