import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Tabs,
  Tab,
  type SelectChangeEvent,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Image as ImageIcon,
} from '@mui/icons-material';
import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import PhotoUploadZone from './PhotoUploadZone';
import PhotoPreviewGrid from './PhotoPreviewGrid';
import S3Image from './S3Image';
import apiClient from '../services/api';
import type { 
  Container, 
  ContainerType, 
  HandlingFlag, 
  ContainerStatus,
  Location,
  Room,
  MovingProject
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
  weight: string;
  color: string;
  contentsSummary: string;
  photos: string[];
  locationId: string;
  roomId: string;
  projectId: string;
  handlingFlags: HandlingFlag[];
  status: ContainerStatus;
  storageRate: string;
}

interface FormErrors {
  name?: string;
  type?: string;
  size?: string;
  weight?: string;
  color?: string;
  contentsSummary?: string;
  photos?: string;
  locationId?: string;
  roomId?: string;
  projectId?: string;
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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [projects, setProjects] = useState<MovingProject[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: ContainerTypeEnum.Box,
    size: '',
    weight: '',
    color: '',
    contentsSummary: '',
    photos: [],
    locationId: '',
    roomId: '',
    projectId: '',
    handlingFlags: [],
    status: ContainerStatusEnum.Empty,
    storageRate: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [currentTab, setCurrentTab] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const isEditing = !!container;

  // Load locations and projects when dialog opens
  useEffect(() => {
    if (open && currentInventory) {
      loadLocations();
      loadRooms();
      loadProjects();
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
          weight: container.weight?.toString() || '',
          color: container.color || '',
          contentsSummary: container.contentsSummary || '',
          photos: container.photos || [],
          locationId: container.locationId || '',
          roomId: container.roomId || '',
          projectId: container.projectId || '',
          handlingFlags: container.handlingFlags || [],
          status: container.status || ContainerStatusEnum.Empty,
          storageRate: container.storageRate?.toString() || '',
        });
      } else {
        setFormData({
          name: '',
          type: ContainerTypeEnum.Box,
          size: '',
          weight: '',
          color: '',
          contentsSummary: '',
          photos: [],
          locationId: '',
          roomId: '',
          projectId: '',
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

  const loadRooms = async () => {
    if (!currentInventory) return;
    
    try {
      const roomData = await apiClient.getRooms(undefined, currentInventory.id);
      setRooms(roomData);
    } catch (error) {
      console.error('Error loading rooms:', error);
      showError('Failed to load rooms');
    }
  };

  const loadProjects = async () => {
    if (!currentInventory) return;
    
    try {
      const projectData = await apiClient.getProjects(currentInventory.id);
      // Ensure we have an array, fallback to empty array if not
      const safeData = Array.isArray(projectData) ? projectData : [];
      setProjects(safeData);
    } catch (error) {
      console.error('Error loading projects:', error);
      showError('Failed to load projects');
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

    // Validate weight if provided
    if (formData.weight && isNaN(Number(formData.weight))) {
      newErrors.weight = 'Weight must be a valid number';
    }

    // Validate color format if provided (hex color)
    if (formData.color && !/^#[0-9A-F]{6}$/i.test(formData.color)) {
      newErrors.color = 'Color must be a valid hex color (e.g., #FF5733)';
    }

    // Validate contents summary length
    if (formData.contentsSummary && formData.contentsSummary.length > 200) {
      newErrors.contentsSummary = 'Contents summary must be 200 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear roomId when location changes
    if (field === 'locationId') {
      setFormData(prev => ({
        ...prev,
        locationId: value,
        roomId: '', // Clear room selection when location changes
      }));
    }

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

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
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
      // Helper to convert string to number, handling empty strings
      const toNumber = (value: string): number | undefined => {
        const trimmed = value.trim();
        if (trimmed === '') return undefined;
        const num = Number(trimmed);
        return isNaN(num) ? undefined : num;
      };

      const containerData = {
        inventoryId: currentInventory.id,
        name: formData.name.trim(),
        type: formData.type,
        size: formData.size.trim() || undefined,
        weight: toNumber(formData.weight),
        color: formData.color.trim() || undefined,
        contentsSummary: formData.contentsSummary.trim() || undefined,
        photos: formData.photos,
        locationId: formData.locationId.trim() || undefined,
        roomId: formData.roomId.trim() || undefined,
        projectId: formData.projectId.trim() || undefined,
        handlingFlags: formData.handlingFlags,
        status: formData.status,
        storageRate: toNumber(formData.storageRate),
        metadata: {},
      };
      
      console.log('📝 Form data before cleanup:', {
        weight: formData.weight,
        weightConverted: toNumber(formData.weight),
        roomId: formData.roomId,
        roomIdTrimmed: formData.roomId.trim()
      });
      
      // Remove undefined values (but keep null, 0, false, empty arrays)
      Object.keys(containerData).forEach(key => {
        const value = containerData[key as keyof typeof containerData];
        if (value === undefined) {
          delete containerData[key as keyof typeof containerData];
        }
      });
      
      console.log('📦 Container data after cleanup:', containerData);

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
      weight: '',
      color: '',
      contentsSummary: '',
      photos: [],
      locationId: '',
      roomId: '',
      projectId: '',
      handlingFlags: [],
      status: ContainerStatusEnum.Empty,
      storageRate: '',
    });
    setErrors({});
    onClose();
  };

  // Handle photo upload for new containers
  const handlePhotoUpload = async (files: File[]) => {
    if (!currentInventory) {
      throw new Error('No inventory selected');
    }

    setIsUploadingPhotos(true);
    try {
      const uploadedKeys: string[] = [];

      // For new containers, generate a temporary ID that will be used when creating the container
      // For existing containers, use the existing ID
      const entityId = container?.id || (() => {
        // Generate a temporary ID for new containers
        return crypto.randomUUID();
      })();

      // Upload each file
      for (const file of files) {
        // Generate presigned upload URL
        const { uploadUrl, key } = await apiClient.generateUploadUrl(
          file.name,
          file.type,
          currentInventory.id,
          entityId
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

  // Get primary image URL for display - memoized to prevent continuous refreshing
  const getPrimaryImageUrl = useCallback(async (photoKey: string): Promise<string> => {
    if (!currentInventory) return '';
    try {
      const response = await apiClient.generateDownloadUrl(photoKey);
      return response.downloadUrl;
    } catch (error) {
      console.error('Error generating download URL:', error);
      return '';
    }
  }, [currentInventory]);

  // Render functions for tab content
  const renderBasicFields = () => (
    <>
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

      {/* Size, Weight, and Color Row */}
      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
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
          label="Weight (kg)"
          type="number"
          value={formData.weight}
          onChange={(e) => handleFieldChange('weight', e.target.value)}
          error={!!errors.weight}
          helperText={errors.weight || 'Optional'}
          inputProps={{ min: 0, step: 0.1 }}
          placeholder="0.0"
        />

        <TextField
          fullWidth
          label="Color"
          value={formData.color}
          onChange={(e) => handleFieldChange('color', e.target.value)}
          error={!!errors.color}
          helperText={errors.color || 'Hex code'}
          placeholder="#FF5733"
        />
      </Box>

      {/* Contents Summary */}
      <TextField
        fullWidth
        label="Contents Summary"
        value={formData.contentsSummary}
        onChange={(e) => handleFieldChange('contentsSummary', e.target.value)}
        error={!!errors.contentsSummary}
        helperText={
          errors.contentsSummary || 
          `Brief description (${formData.contentsSummary.length}/200)`
        }
        placeholder="e.g., Kitchen utensils and small appliances"
        inputProps={{ maxLength: 200 }}
        FormHelperTextProps={{
          sx: {
            color: formData.contentsSummary.length > 180 ? 'warning.main' : undefined,
          }
        }}
      />
    </>
  );

  const renderAssignmentFields = () => {
    // Filter rooms by selected location
    const filteredRooms = formData.locationId
      ? rooms.filter(room => room.locationId === formData.locationId)
      : rooms;

    return (
      <>
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

        {/* Room */}
        <FormControl fullWidth error={!!errors.roomId} disabled={!formData.locationId}>
          <InputLabel>Room</InputLabel>
          <Select
            value={formData.roomId}
            label="Room"
            onChange={(e) => handleFieldChange('roomId', e.target.value)}
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
          <FormHelperText>
            {errors.roomId || (formData.locationId ? 'Optional: Select a room within the location' : 'Select a location first')}
          </FormHelperText>
        </FormControl>

        {/* Project Assignment */}
        <FormControl fullWidth error={!!errors.projectId}>
          <InputLabel>Moving Project</InputLabel>
          <Select
            value={formData.projectId}
            label="Moving Project"
            onChange={(e) => handleFieldChange('projectId', e.target.value)}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {projects.map((project) => (
              <MenuItem key={project.id} value={project.id}>
                {project.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            {errors.projectId || 'Optional: Assign to a moving project'}
          </FormHelperText>
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
      </>
    );
  };

  const renderHandlingFields = () => (
    <>
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
    </>
  );

  const renderMediaFields = () => (
    <>
      {/* Container Photos */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Container Photos
        </Typography>
        
        {/* Photo Preview Grid - Show existing photos */}
        {formData.photos && formData.photos.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <PhotoPreviewGrid
              photoKeys={formData.photos}
              onRemove={handlePhotoRemove}
              disabled={isUploadingPhotos || loading}
            />
          </Box>
        )}

        {/* Photo Upload Zone */}
        <PhotoUploadZone
          onUpload={handlePhotoUpload}
          disabled={isUploadingPhotos || loading}
          currentPhotoCount={formData.photos.length}
          maxPhotos={10}
          label="Add Container Photos"
          helperText="Add photos to help identify this container"
        />
      </Box>
    </>
  );

  // Primary image component - memoized to prevent continuous re-rendering
  const PrimaryImageDisplay = useMemo(() => {
    const Component = () => {
      const [primaryImageUrl, setPrimaryImageUrl] = useState<string>('');
      const [loading, setLoading] = useState(false);
      
      const primaryPhotoKey = formData.photos && formData.photos.length > 0 ? formData.photos[0] : null;

      useEffect(() => {
        if (primaryPhotoKey && currentInventory) {
          setLoading(true);
          getPrimaryImageUrl(primaryPhotoKey)
            .then(url => {
              setPrimaryImageUrl(url);
              setLoading(false);
            })
            .catch(() => {
              setLoading(false);
            });
        } else {
          setPrimaryImageUrl('');
          setLoading(false);
        }
      }, [primaryPhotoKey]);

      const imageSize = isMobile ? 80 : 120;

      if (loading) {
        return (
          <Box
            sx={{
              width: imageSize,
              height: imageSize,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed',
              borderColor: 'grey.300',
              borderRadius: 2,
              bgcolor: 'grey.50',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Loading...
            </Typography>
          </Box>
        );
      }

      if (primaryImageUrl) {
        return (
          <S3Image
            src={primaryImageUrl}
            alt={formData.name || 'Container image'}
            maxWidth={imageSize}
            maxHeight={imageSize}
            style={{
              borderRadius: '8px',
              objectFit: 'cover',
              width: `${imageSize}px`,
              height: `${imageSize}px`,
            }}
          />
        );
      }

      // Placeholder when no image
      return (
        <Box
          sx={{
            width: imageSize,
            height: imageSize,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed',
            borderColor: 'grey.300',
            borderRadius: 2,
            bgcolor: 'grey.50',
          }}
        >
          <ImageIcon sx={{ fontSize: isMobile ? 24 : 32, color: 'grey.400', mb: 0.5 }} />
          <Typography variant="caption" color="text.secondary" align="center">
            No Image
          </Typography>
        </Box>
      );
    };
    
    return <Component />;
  }, [formData.photos, currentInventory, isMobile, formData.name, getPrimaryImageUrl]);

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      aria-labelledby="container-form-dialog-title"
    >
      <DialogTitle id="container-form-dialog-title">
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          gap: 2 
        }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="div" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {isEditing ? 'Edit Container' : 'Create New Container'}
            </Typography>
            {formData.name && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {formData.name}
              </Typography>
            )}
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            {PrimaryImageDisplay}
          </Box>
        </Box>
      </DialogTitle>

      {/* Use tabs on mobile/tablet for better space usage */}
      {isTablet ? (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={currentTab} 
              onChange={handleTabChange} 
              variant="scrollable"
              scrollButtons="auto"
              aria-label="container form tabs"
            >
              <Tab label="General" />
              <Tab label="Assignment" />
              <Tab label="Handling" />
              <Tab label="Media" />
            </Tabs>
          </Box>
          
          <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                pt: 1,
              }}
            >
              {currentTab === 0 && renderBasicFields()}
              {currentTab === 1 && renderAssignmentFields()}
              {currentTab === 2 && renderHandlingFields()}
              {currentTab === 3 && renderMediaFields()}
            </Box>
          </DialogContent>
        </>
      ) : (
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
            {renderBasicFields()}
            {renderAssignmentFields()}
            {renderHandlingFields()}
            {renderMediaFields()}
          </Box>
        </DialogContent>
      )}

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