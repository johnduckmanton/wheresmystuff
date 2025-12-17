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
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import type { Room, Location } from '../types';
import InventoryFormSelector from './InventoryFormSelector';
import { useInventory } from '../contexts/InventoryContext';

const PREDEFINED_FLOORS = [
  'Basement',
  'Ground Floor',
  '1st Floor',
  '2nd Floor',
  '3rd Floor',
  '4th Floor',
  'Attic',
];

export interface RoomFormDialogProps {
  open: boolean;
  room?: Room;
  locations: Location[];
  preselectedLocationId?: string;
  onSubmit: (data: Partial<Room>) => void;
  onClose: () => void;
}

export default function RoomFormDialog({
  open,
  room,
  locations,
  preselectedLocationId,
  onSubmit,
  onClose,
}: RoomFormDialogProps) {
  const { currentInventory } = useInventory();
  const [formData, setFormData] = useState<Partial<Room>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [floorInputMode, setFloorInputMode] = useState<'dropdown' | 'custom'>('dropdown');

  // Initialize form data when dialog opens or room changes
  useEffect(() => {
    if (open) {
      if (room) {
        setFormData({ ...room });
        // Check if floor is a custom value
        const isCustomFloor = room.floor && !PREDEFINED_FLOORS.includes(room.floor);
        setFloorInputMode(isCustomFloor ? 'custom' : 'dropdown');
      } else {
        setFormData({
          name: '',
          inventoryId: currentInventory?.id || '',
          locationId: preselectedLocationId || '',
          floor: '',
        });
        setFloorInputMode('dropdown');
      }
      setErrors({});
    }
  }, [open, room, preselectedLocationId, currentInventory]);

  // Handle field change
  const handleFieldChange = (name: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field
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

    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Name is required';
    }

    if (!formData.inventoryId || formData.inventoryId.trim() === '') {
      newErrors.inventoryId = 'Inventory is required';
    }

    if (!formData.locationId) {
      newErrors.locationId = 'Location is required';
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
    setFloorInputMode('dropdown');
    onClose();
  };

  // Handle floor input mode toggle
  const handleFloorModeChange = (
    _: React.MouseEvent<HTMLElement>,
    newMode: 'dropdown' | 'custom' | null,
  ) => {
    if (newMode !== null) {
      setFloorInputMode(newMode);
      // Clear floor value when switching modes
      if (newMode === 'dropdown' && formData.floor && !PREDEFINED_FLOORS.includes(formData.floor)) {
        handleFieldChange('floor', '');
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      aria-labelledby="room-form-dialog-title"
    >
      <DialogTitle id="room-form-dialog-title">
        {room ? 'Edit Room' : 'Add Room'}
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
              'aria-label': 'Room name',
              'aria-required': 'true',
            }}
          />

          <InventoryFormSelector
            value={formData.inventoryId || ''}
            onChange={(inventoryId) => handleFieldChange('inventoryId', inventoryId)}
            error={errors.inventoryId}
            required
          />

          <FormControl fullWidth error={!!errors.locationId} required>
            <InputLabel id="room-location-select-label">Location</InputLabel>
            <Select
              labelId="room-location-select-label"
              value={formData.locationId || ''}
              label="Location"
              onChange={(e) => handleFieldChange('locationId', e.target.value)}
              disabled={!!preselectedLocationId}
              inputProps={{
                'aria-label': 'Select location for room',
                'aria-required': 'true',
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
            {errors.locationId && (
              <Box sx={{ color: 'error.main', fontSize: '0.75rem', mt: 0.5, ml: 1.75 }}>
                {errors.locationId}
              </Box>
            )}
          </FormControl>

          {/* Floor Input Mode Toggle */}
          <Box>
            <ToggleButtonGroup
              value={floorInputMode}
              exclusive
              onChange={handleFloorModeChange}
              size="small"
              fullWidth
              sx={{ mb: 1 }}
            >
              <ToggleButton value="dropdown">
                Predefined Floor
              </ToggleButton>
              <ToggleButton value="custom">
                Custom Floor
              </ToggleButton>
            </ToggleButtonGroup>

            {floorInputMode === 'dropdown' ? (
              <FormControl fullWidth>
                <InputLabel>Floor</InputLabel>
                <Select
                  value={
                    formData.floor && PREDEFINED_FLOORS.includes(formData.floor)
                      ? formData.floor
                      : ''
                  }
                  label="Floor"
                  onChange={(e) => handleFieldChange('floor', e.target.value)}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {PREDEFINED_FLOORS.map((floor) => (
                    <MenuItem key={floor} value={floor}>
                      {floor}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <TextField
                fullWidth
                label="Custom Floor"
                value={formData.floor || ''}
                onChange={(e) => handleFieldChange('floor', e.target.value)}
                placeholder="Enter custom floor name"
              />
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          {room ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
