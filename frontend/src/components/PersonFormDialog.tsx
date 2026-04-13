import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Avatar,
  IconButton,
  CircularProgress,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';
import type { Person } from '../types';
import InventoryFormSelector from './InventoryFormSelector';
import PhotoThumbnail from './PhotoThumbnail';
import apiClient from '../services/api';
import { useInventory } from '../contexts/InventoryContext';
import { getCurrentUser } from 'aws-amplify/auth';

export interface PersonFormDialogProps {
  open: boolean;
  person?: Person; // If provided, we're editing; otherwise creating
  onSubmit: (data: Partial<Person>) => void;
  onClose: () => void;
}

interface PersonFormData extends Partial<Person> {}

export default function PersonFormDialog({
  open,
  person,
  onSubmit,
  onClose,
}: PersonFormDialogProps) {
  const [formData, setFormData] = useState<PersonFormData>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoUploading, setPhotoUploading] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      setLocalPreviewUrl(null);
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

  // Handle photo file selection
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);
    try {
      const user = await getCurrentUser();
      const key = await apiClient.uploadAvatar(file, user.username);
      setFormData(prev => ({ ...prev, photos: [key] }));
      setLocalPreviewUrl(URL.createObjectURL(file));
    } catch (err) {
      console.error('Error uploading photo:', err);
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, photos: [] }));
    setLocalPreviewUrl(null);
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

  const currentPhoto = formData.photos?.[0];

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

          {/* Photo Upload Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
            {photoUploading ? (
              <Avatar sx={{ width: 80, height: 80, mb: 1 }}>
                <CircularProgress size={32} />
              </Avatar>
            ) : localPreviewUrl ? (
              <Avatar
                sx={{ width: 80, height: 80, mb: 1 }}
                src={localPreviewUrl}
                alt={formData.name || 'Person'}
              />
            ) : currentPhoto ? (
              <PhotoThumbnail
                photoKey={currentPhoto}
                altText={formData.name || 'Person'}
                variant="avatar"
                size={80}
                showPopup={false}
              />
            ) : (
              <Avatar sx={{ width: 80, height: 80, mb: 1, bgcolor: 'grey.300' }}>
                <PersonIcon sx={{ fontSize: 40 }} />
              </Avatar>
            )}
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button
                size="small"
                startIcon={<PhotoCameraIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
              >
                {currentPhoto ? 'Change Photo' : 'Add Photo'}
              </Button>
              {currentPhoto && (
                <IconButton
                  size="small"
                  onClick={handleRemovePhoto}
                  disabled={photoUploading}
                  aria-label="Remove photo"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handlePhotoSelect}
            />
          </Box>

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
            rows={2}
            inputProps={{
              'aria-label': 'Person description',
            }}
          />

          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formData.email || ''}
            onChange={(e) => handleFieldChange('email', e.target.value)}
            placeholder="e.g., person@example.com"
            inputProps={{
              'aria-label': 'Email address',
            }}
          />

          <TextField
            fullWidth
            label="Phone"
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => handleFieldChange('phone', e.target.value)}
            placeholder="e.g., +1 (555) 123-4567"
            inputProps={{
              'aria-label': 'Phone number',
            }}
          />

          <TextField
            fullWidth
            label="Relationship"
            value={formData.relationship || ''}
            onChange={(e) => handleFieldChange('relationship', e.target.value)}
            placeholder="e.g., Family member, Friend, Roommate"
            inputProps={{
              'aria-label': 'Relationship to you',
            }}
          />

          <TextField
            fullWidth
            label="Notes"
            value={formData.notes || ''}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            multiline
            rows={3}
            placeholder="Additional information about this person..."
            inputProps={{
              'aria-label': 'Additional notes',
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
