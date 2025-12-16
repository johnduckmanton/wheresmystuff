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
  Typography,
  Divider,
} from '@mui/material';
import type { Thing, Location, Room, Category, Person } from '../types';
import PhotoUploadZone from './PhotoUploadZone';
import PhotoPreviewGrid from './PhotoPreviewGrid';
import InventoryFormSelector from './InventoryFormSelector';
import { useInventory } from '../contexts/InventoryContext';
import apiClient from '../services/api';

export interface ThingFormDialogProps {
  open: boolean;
  thing?: Thing; // If provided, we're editing; otherwise creating
  locations: Location[];
  rooms: Room[];
  categories: Category[];
  people: Person[];
  onSubmit: (data: Partial<Thing>) => void;
  onClose: () => void;
}

export default function ThingFormDialog({
  open,
  thing,
  locations,
  rooms,
  categories,
  people,
  onSubmit,
  onClose,
}: ThingFormDialogProps) {
  const [formData, setFormData] = useState<Partial<Thing>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const { currentInventory } = useInventory();

  // Initialize form data when dialog opens or thing changes
  useEffect(() => {
    if (open) {
      if (thing) {
        // Editing existing thing
        setFormData({ ...thing });
      } else {
        // Creating new thing - auto-select current inventory
        setFormData({
          name: '',
          description: '',
          serialNumber: '',
          inventoryId: currentInventory?.id || '',
          locationId: '',
          roomId: '',
          ownerId: '',
          categoryId: '',
          notes: '',
          datePurchased: '',
          purchasedFrom: '',
          warrantyDetails: '',
          disposalDate: '',
          nextReviewDate: '',
          photos: [],
        });
      }
      setErrors({});
    }
  }, [open, thing]);

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

  // Handle photo upload
  const handlePhotoUpload = async (files: File[]) => {
    setIsUploadingPhotos(true);
    try {
      const uploadedKeys: string[] = [];

      // Upload each file
      for (const file of files) {
        // Generate presigned upload URL
        const { uploadUrl, key } = await apiClient.generateUploadUrl(
          file.name,
          file.type
        );

        // Upload file to S3 using presigned URL
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        uploadedKeys.push(key);
      }

      // Add uploaded keys to form data
      setFormData((prev) => ({
        ...prev,
        photos: [...(prev.photos || []), ...uploadedKeys],
      }));
    } catch (err) {
      console.error('Error uploading photos:', err);
      throw err;
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  // Handle photo removal
  const handlePhotoRemove = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      photos: (prev.photos || []).filter((photoKey) => photoKey !== key),
    }));
  };

  // Filter rooms by selected location
  const filteredRooms = formData.locationId
    ? rooms.filter(room => room.locationId === formData.locationId)
    : rooms;

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      aria-labelledby="thing-form-dialog-title"
    >
      <DialogTitle id="thing-form-dialog-title">
        {thing ? 'Edit Thing' : 'Add Thing'}
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
          {/* Basic Information */}
          <Typography variant="subtitle2" color="text.secondary">
            Basic Information
          </Typography>

          <TextField
            fullWidth
            label="Name"
            value={formData.name || ''}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            required
            inputProps={{
              'aria-label': 'Thing name',
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
              'aria-label': 'Thing description',
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
            label="Serial Number"
            value={formData.serialNumber || ''}
            onChange={(e) => handleFieldChange('serialNumber', e.target.value)}
            inputProps={{
              'aria-label': 'Serial number',
            }}
          />

          <Divider />

          {/* Location Information */}
          <Typography variant="subtitle2" color="text.secondary">
            Location
          </Typography>

          <FormControl fullWidth>
            <InputLabel id="location-select-label">Location</InputLabel>
            <Select
              labelId="location-select-label"
              value={formData.locationId || ''}
              label="Location"
              onChange={(e) => {
                handleFieldChange('locationId', e.target.value);
                // Clear room if location changes
                if (formData.roomId) {
                  handleFieldChange('roomId', '');
                }
              }}
              inputProps={{
                'aria-label': 'Select location',
              }}
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
          </FormControl>

          <FormControl fullWidth disabled={!formData.locationId}>
            <InputLabel id="room-select-label">Room</InputLabel>
            <Select
              labelId="room-select-label"
              value={formData.roomId || ''}
              label="Room"
              onChange={(e) => handleFieldChange('roomId', e.target.value)}
              inputProps={{
                'aria-label': 'Select room',
              }}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {filteredRooms.map((room) => (
                <MenuItem key={room.id} value={room.id}>
                  {room.name}
                </MenuItem>
              ))}
            </Select>
            {!formData.locationId && (
              <FormHelperText>Select a location first</FormHelperText>
            )}
          </FormControl>

          <Divider />

          {/* Ownership and Classification */}
          <Typography variant="subtitle2" color="text.secondary">
            Ownership & Classification
          </Typography>

          <FormControl fullWidth>
            <InputLabel id="owner-select-label">Owner</InputLabel>
            <Select
              labelId="owner-select-label"
              value={formData.ownerId || ''}
              label="Owner"
              onChange={(e) => handleFieldChange('ownerId', e.target.value)}
              inputProps={{
                'aria-label': 'Select owner',
              }}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {people.map((person) => (
                <MenuItem key={person.id} value={person.id}>
                  {person.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={formData.categoryId || ''}
              label="Category"
              onChange={(e) => handleFieldChange('categoryId', e.target.value)}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />

          {/* Purchase Information */}
          <Typography variant="subtitle2" color="text.secondary">
            Purchase Information
          </Typography>

          <TextField
            fullWidth
            label="Date Purchased"
            type="date"
            value={formData.datePurchased || ''}
            onChange={(e) => handleFieldChange('datePurchased', e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
          />

          <TextField
            fullWidth
            label="Purchased From"
            value={formData.purchasedFrom || ''}
            onChange={(e) => handleFieldChange('purchasedFrom', e.target.value)}
          />

          <TextField
            fullWidth
            label="Warranty Details"
            value={formData.warrantyDetails || ''}
            onChange={(e) => handleFieldChange('warrantyDetails', e.target.value)}
            multiline
            rows={2}
          />

          <Divider />

          {/* Additional Information */}
          <Typography variant="subtitle2" color="text.secondary">
            Additional Information
          </Typography>

          <TextField
            fullWidth
            label="Notes"
            value={formData.notes || ''}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            multiline
            rows={3}
          />

          <TextField
            fullWidth
            label="Disposal Date"
            type="date"
            value={formData.disposalDate || ''}
            onChange={(e) => handleFieldChange('disposalDate', e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
          />

          <TextField
            fullWidth
            label="Next Review Date"
            type="date"
            value={formData.nextReviewDate || ''}
            onChange={(e) => handleFieldChange('nextReviewDate', e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
          />

          <Divider />

          {/* Photo Upload Section */}
          <Typography variant="subtitle2" color="text.secondary">
            Photos
          </Typography>

          {/* Photo Preview Grid - Show existing photos */}
          {formData.photos && formData.photos.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <PhotoPreviewGrid
                photoKeys={formData.photos}
                onRemove={handlePhotoRemove}
                disabled={isUploadingPhotos}
              />
            </Box>
          )}

          {/* Photo Upload Zone */}
          <PhotoUploadZone
            onUpload={handlePhotoUpload}
            disabled={isUploadingPhotos}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          {thing ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
