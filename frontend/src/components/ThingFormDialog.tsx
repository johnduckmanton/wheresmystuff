import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Grid,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  useMediaQuery,
  IconButton,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  LocationOn as LocationIcon,
  ShoppingCart as ShoppingCartIcon,
  Photo as PhotoIcon,
  Image as ImageIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import type { Thing, Location, Room, Category, Person, MovingProject, Container } from '../types';
import PhotoUploadZone from './PhotoUploadZone';
import PhotoPreviewGrid from './PhotoPreviewGrid';
import PhotoThumbnail from './PhotoThumbnail';
import DocumentUploadZone from './DocumentUploadZone';
import DocumentPreviewGrid from './DocumentPreviewGrid';
import InventoryFormSelector from './InventoryFormSelector';
import S3Image from './S3Image';
import EnhancedTagInput from './EnhancedTagInput';
import BarcodeScanner from './BarcodeScanner';
import BarcodeItemPreview from './BarcodeItemPreview';
import { useInventory } from '../contexts/InventoryContext';
import apiClient from '../services/api';

export interface ThingFormDialogProps {
  open: boolean;
  thing?: Thing; // If provided, we're editing; otherwise creating
  prefillData?: Partial<Thing>; // Pre-filled data for new things (e.g., from AI analysis)
  locations: Location[];
  rooms: Room[];
  categories: Category[];
  people: Person[];
  projects?: MovingProject[]; // Optional projects for assignment
  containers?: Container[]; // Optional containers for assignment
  onSubmit: (data: Partial<Thing>) => void;
  onClose: () => void;
}

interface ThingFormData extends Partial<Thing> {
  tempId?: string; // Temporary ID for photo uploads before thing is created
}

export default function ThingFormDialog({
  open,
  thing,
  prefillData,
  locations,
  rooms,
  categories,
  people,
  projects = [],
  containers = [],
  onSubmit,
  onClose,
}: ThingFormDialogProps) {
  const [formData, setFormData] = useState<ThingFormData>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [barcodePreviewOpen, setBarcodePreviewOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const { currentInventory } = useInventory();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // Memoize tags to prevent infinite re-renders
  const memoizedTags = useMemo(() => {
    return formData.tags || [];
  }, [formData.tags]);

  // Memoize the onTagsChange callback to prevent infinite re-renders
  const handleTagsChange = useCallback((tags: string[]) => {
    handleFieldChange('tags', tags);
  }, []);

  // Initialize form data when dialog opens or thing changes
  useEffect(() => {
    if (open) {
      if (thing) {
        // Editing existing thing
        setFormData({ ...thing });
      } else if (prefillData) {
        // Creating new thing with pre-filled data (e.g., from AI analysis)
        setFormData({
          name: '',
          description: '',
          make: '',
          model: '',
          serialNumber: '',
          inventoryId: currentInventory?.id || '',
          locationId: '',
          roomId: '',
          ownerId: '',
          categoryId: '',
          notes: '',
          datePurchased: '',
          purchasedFrom: '',
          purchasePrice: undefined,
          warrantyDetails: '',
          disposalDate: '',
          nextReviewDate: '',
          photos: [],
          receipts: [],
          warranties: [],
          ...prefillData, // Merge pre-filled data
        });
      } else {
        // Creating new thing - auto-select current inventory
        setFormData({
          name: '',
          description: '',
          make: '',
          model: '',
          serialNumber: '',
          inventoryId: currentInventory?.id || '',
          locationId: '',
          roomId: '',
          ownerId: '',
          categoryId: '',
          notes: '',
          datePurchased: '',
          purchasedFrom: '',
          purchasePrice: undefined,
          warrantyDetails: '',
          disposalDate: '',
          nextReviewDate: '',
          photos: [],
          receipts: [],
          warranties: [],
        });
      }
      setErrors({});
    }
  }, [open, thing, prefillData, currentInventory?.id]);

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
      newErrors.name = 'Name is required. Please enter a name for this item.';
    } else if (formData.name.length > 200) {
      newErrors.name = 'Name is too long. Please use 200 characters or less.';
    }

    // Validate purchase price if provided
    if (formData.purchasePrice !== undefined && formData.purchasePrice !== null) {
      if (formData.purchasePrice < 0) {
        newErrors.purchasePrice = 'Purchase price cannot be negative. Please enter a positive value or leave blank.';
      }
    }

    // Validate dates if provided
    if (formData.datePurchased && formData.disposalDate) {
      const purchaseDate = new Date(formData.datePurchased);
      const disposalDate = new Date(formData.disposalDate);
      if (disposalDate < purchaseDate) {
        newErrors.disposalDate = 'Disposal date cannot be before purchase date. Please check the dates.';
      }
    }

    // Validate inventory is selected
    if (!formData.inventoryId) {
      newErrors.inventoryId = 'Inventory is required. Please select an inventory.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = () => {
    if (validateForm()) {
      // For new things with photos, use tempId as the actual id
      const submitData = { ...formData };
      if (!thing && formData.tempId) {
        submitData.id = formData.tempId;
        delete submitData.tempId;
      }
      onSubmit(submitData);
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
    if (!currentInventory) {
      throw new Error('No inventory selected');
    }

    setIsUploadingPhotos(true);
    try {
      const uploadedKeys: string[] = [];

      // For new things, generate a temporary ID that will be used when creating the thing
      // For existing things, use the existing ID
      const entityId = thing?.id || formData.tempId || (() => {
        const tempId = crypto.randomUUID();
        setFormData(prev => ({ ...prev, tempId }));
        return tempId;
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

  // Handle document upload (receipts or warranties)
  const handleDocumentUpload = async (files: File[], documentType: 'receipt' | 'warranty') => {
    if (!currentInventory) {
      throw new Error('No inventory selected');
    }

    setIsUploadingDocuments(true);
    try {
      const uploadedKeys: string[] = [];

      // For new things, generate a temporary ID that will be used when creating the thing
      // For existing things, use the existing ID
      const entityId = thing?.id || formData.tempId || (() => {
        const tempId = crypto.randomUUID();
        setFormData(prev => ({ ...prev, tempId }));
        return tempId;
      })();

      // Upload each file
      for (const file of files) {
        // Generate presigned upload URL
        const { uploadUrl, key } = await apiClient.generateDocumentUploadUrl(
          file.name,
          file.type,
          currentInventory.id,
          entityId,
          documentType
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
      const fieldName = documentType === 'receipt' ? 'receipts' : 'warranties';
      setFormData((prev) => ({
        ...prev,
        [fieldName]: [...(prev[fieldName] || []), ...uploadedKeys],
      }));
    } catch (err) {
      console.error('Error uploading documents:', err);
      throw err;
    } finally {
      setIsUploadingDocuments(false);
    }
  };

  // Handle receipt upload
  const handleReceiptUpload = async (files: File[]) => {
    return handleDocumentUpload(files, 'receipt');
  };

  // Handle warranty upload
  const handleWarrantyUpload = async (files: File[]) => {
    return handleDocumentUpload(files, 'warranty');
  };

  // Handle document removal
  const handleDocumentRemove = (key: string, documentType: 'receipt' | 'warranty') => {
    const fieldName = documentType === 'receipt' ? 'receipts' : 'warranties';
    setFormData((prev) => ({
      ...prev,
      [fieldName]: (prev[fieldName] || []).filter((docKey) => docKey !== key),
    }));
  };

  // Handle barcode scan
  const handleBarcodeScanned = (barcode: string) => {
    console.log('Barcode scanned:', barcode);
    setScannedBarcode(barcode);
    setBarcodeScannerOpen(false);
    setBarcodePreviewOpen(true);
  };

  // Handle barcode item acceptance
  const handleBarcodeItemAccept = (itemData: any) => {
    console.log('Accepting barcode item data:', itemData);
    
    // Merge barcode data into form
    setFormData((prev) => ({
      ...prev,
      name: itemData.name || prev.name,
      description: itemData.description || prev.description,
      categoryId: categories.find(c => c.name === itemData.category)?.id || prev.categoryId,
      photos: itemData.photos || prev.photos,
      metadata: {
        ...prev.metadata,
        ...itemData.metadata,
        barcode: itemData.barcode,
      },
    }));
    
    setBarcodePreviewOpen(false);
    setScannedBarcode('');
  };

  // Filter rooms by selected location
  const filteredRooms = formData.locationId
    ? rooms.filter(room => room.locationId === formData.locationId)
    : rooms;

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
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

  // Primary image component - memoized to prevent continuous re-rendering
  const PrimaryImageDisplay = useMemo(() => {
    const Component = () => {
      const [primaryImageUrl, setPrimaryImageUrl] = useState<string>('');
      const [loading, setLoading] = useState(false);
      const [lightboxOpen, setLightboxOpen] = useState(false);
      
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
          <>
            <Box
              onClick={() => setLightboxOpen(true)}
              sx={{ cursor: 'zoom-in', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}
              role="button"
              aria-label="View full size image"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setLightboxOpen(true)}
            >
              <S3Image
                src={primaryImageUrl}
                alt={formData.name || 'Thing image'}
                maxWidth={imageSize}
                maxHeight={imageSize}
                style={{
                  borderRadius: '8px',
                  objectFit: 'cover',
                  width: `${imageSize}px`,
                  height: `${imageSize}px`,
                  display: 'block',
                }}
              />
            </Box>

            {/* Lightbox */}
            <Dialog
              open={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
              maxWidth="lg"
              fullWidth
              onClick={() => setLightboxOpen(false)}
              sx={{ '& .MuiDialog-paper': { bgcolor: 'black', boxShadow: 'none' } }}
            >
              <Box
                sx={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '60vh',
                  p: 1,
                }}
              >
                <IconButton
                  onClick={() => setLightboxOpen(false)}
                  sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 1 }}
                  aria-label="Close image"
                >
                  <CloseIcon />
                </IconButton>
                <img
                  src={primaryImageUrl}
                  alt={formData.name || 'Thing image'}
                  style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 4 }}
                />
              </Box>
            </Dialog>
          </>
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

  // Render basic information fields
  const renderBasicFields = () => (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12 }}>
        <TextField
          fullWidth
          label="Name"
          value={formData.name || ''}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          error={!!errors.name}
          helperText={errors.name}
          required
          size={isMobile ? 'medium' : 'small'}
          slotProps={{
            input: {
              'aria-label': 'Thing name',
              'aria-required': 'true',
              'aria-invalid': !!errors.name,
              'aria-describedby': errors.name ? 'name-error' : undefined,
              inputMode: 'text',
              sx: { minHeight: 48 },
            },
            formHelperText: {
              id: 'name-error',
            },
          }}
        />
      </Grid>
      {/* Photo upload on General tab — mobile only */}
      {isMobile && (
        <Grid size={{ xs: 12 }}>
          <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
            {formData.photos && formData.photos.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                {formData.photos.slice(0, 3).map((key) => (
                  <PhotoThumbnail key={key} photoKey={key} altText="Photo" size={48} showPopup={false} />
                ))}
                {formData.photos.length > 3 && (
                  <Typography variant="caption" color="text.secondary">
                    +{formData.photos.length - 3} more
                  </Typography>
                )}
              </Box>
            )}
            <PhotoUploadZone
              onUpload={handlePhotoUpload}
              disabled={isUploadingPhotos || isUploadingDocuments}
              currentPhotoCount={formData.photos?.length || 0}
            />
          </Box>
        </Grid>
      )}
      <Grid size={{ xs: 12 }}>
        <TextField
          fullWidth
          label="Description"
          value={formData.description || ''}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          multiline
          rows={2}
          size={isMobile ? 'medium' : 'small'}
          slotProps={{
            input: {
              'aria-label': 'Thing description',
              inputMode: 'text',
              sx: { minHeight: 48 },
            },
          }}
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <InventoryFormSelector
          value={formData.inventoryId || ''}
          onChange={(inventoryId) => handleFieldChange('inventoryId', inventoryId)}
          error={errors.inventoryId}
          required={false}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Make/Brand"
          value={formData.make || ''}
          onChange={(e) => handleFieldChange('make', e.target.value)}
          size={isMobile ? 'medium' : 'small'}
          slotProps={{
            input: {
              'aria-label': 'Make or brand',
              inputMode: 'text',
              sx: { minHeight: 48 },
            },
          }}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Model"
          value={formData.model || ''}
          onChange={(e) => handleFieldChange('model', e.target.value)}
          size={isMobile ? 'medium' : 'small'}
          slotProps={{
            input: {
              'aria-label': 'Model',
              inputMode: 'text',
              sx: { minHeight: 48 },
            },
          }}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Serial Number"
          value={formData.serialNumber || ''}
          onChange={(e) => handleFieldChange('serialNumber', e.target.value)}
          size={isMobile ? 'medium' : 'small'}
          slotProps={{
            input: {
              'aria-label': 'Serial number',
              inputMode: 'text',
              sx: { minHeight: 48 },
            },
          }}
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <EnhancedTagInput
          tags={memoizedTags}
          onTagsChange={handleTagsChange}
          label="Tags"
          placeholder="Add tags to categorize this item..."
          enableApiSuggestions={true}
          size={isMobile ? 'medium' : 'small'}
          maxTags={20}
        />
      </Grid>
    </Grid>
  );

  // Render location fields
  const renderLocationFields = () => (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, sm: 6 }}>
        <FormControl fullWidth size={isMobile ? 'medium' : 'small'} sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
          <InputLabel id="location-select-label">Location</InputLabel>
          <Select
            labelId="location-select-label"
            value={formData.locationId || ''}
            label="Location"
            onChange={(e) => {
              handleFieldChange('locationId', e.target.value);
              if (formData.roomId) {
                handleFieldChange('roomId', '');
              }
            }}
            slotProps={{
              input: {
                'aria-label': 'Select location',
              },
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
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <FormControl fullWidth disabled={!formData.locationId} size={isMobile ? 'medium' : 'small'} sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
          <InputLabel id="room-select-label">Room</InputLabel>
          <Select
            labelId="room-select-label"
            value={formData.roomId || ''}
            label="Room"
            onChange={(e) => handleFieldChange('roomId', e.target.value)}
            slotProps={{
              input: {
                'aria-label': 'Select room',
              },
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
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <FormControl fullWidth size={isMobile ? 'medium' : 'small'} sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
          <InputLabel>Container</InputLabel>
          <Select
            value={formData.containerId || ''}
            label="Container"
            onChange={(e) => handleFieldChange('containerId', e.target.value)}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {containers.map((container) => (
              <MenuItem key={container.id} value={container.id}>
                {container.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            Optional: Assign to a container
          </FormHelperText>
        </FormControl>
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <FormControl fullWidth size={isMobile ? 'medium' : 'small'} sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
          <InputLabel id="owner-select-label">Owner</InputLabel>
          <Select
            labelId="owner-select-label"
            value={formData.ownerId || ''}
            label="Owner"
            onChange={(e) => handleFieldChange('ownerId', e.target.value)}
            slotProps={{
              input: {
                'aria-label': 'Select owner',
              },
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
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <FormControl fullWidth size={isMobile ? 'medium' : 'small'} sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
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
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <FormControl fullWidth size={isMobile ? 'medium' : 'small'} sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
          <InputLabel>Moving Project</InputLabel>
          <Select
            value={formData.projectId || ''}
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
            Optional: Assign this item to a moving project
          </FormHelperText>
        </FormControl>
      </Grid>
    </Grid>
  );

  // Render purchase information fields
  const renderPurchaseFields = () => (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Date Purchased"
          type="date"
          value={formData.datePurchased || ''}
          onChange={(e) => handleFieldChange('datePurchased', e.target.value)}
          size={isMobile ? 'medium' : 'small'}
          slotProps={{
            inputLabel: {
              shrink: true,
            },
            input: {
              sx: { minHeight: 48 },
            },
          }}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Purchase Price"
          type="number"
          value={formData.purchasePrice || ''}
          onChange={(e) => handleFieldChange('purchasePrice', e.target.value ? parseFloat(e.target.value) : undefined)}
          error={!!errors.purchasePrice}
          helperText={errors.purchasePrice}
          size={isMobile ? 'medium' : 'small'}
          slotProps={{
            input: {
              startAdornment: <span style={{ marginRight: '8px', color: '#666' }}>£</span>,
              inputProps: {
                min: 0,
                step: 0.01,
                inputMode: 'decimal',
                'aria-label': 'Purchase price',
                'aria-invalid': !!errors.purchasePrice,
                'aria-describedby': errors.purchasePrice ? 'purchase-price-error' : undefined,
              },
              sx: { minHeight: 48 },
            },
            formHelperText: {
              id: 'purchase-price-error',
            },
          }}
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <TextField
          fullWidth
          label="Purchased From"
          value={formData.purchasedFrom || ''}
          onChange={(e) => handleFieldChange('purchasedFrom', e.target.value)}
          size={isMobile ? 'medium' : 'small'}
          slotProps={{
            input: {
              inputMode: 'text',
              sx: { minHeight: 48 },
            },
          }}
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <TextField
          fullWidth
          label="Warranty Details"
          value={formData.warrantyDetails || ''}
          onChange={(e) => handleFieldChange('warrantyDetails', e.target.value)}
          multiline
          rows={2}
          size={isMobile ? 'medium' : 'small'}
          slotProps={{
            input: {
              inputMode: 'text',
              sx: { minHeight: 48 },
            },
          }}
        />
      </Grid>
    </Grid>
  );

  // Render additional fields
  const renderAdditionalFields = () => (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12 }}>
        <TextField
          fullWidth
          label="Notes"
          value={formData.notes || ''}
          onChange={(e) => handleFieldChange('notes', e.target.value)}
          multiline
          rows={3}
          size={isMobile ? 'medium' : 'small'}
          slotProps={{
            input: {
              inputMode: 'text',
              sx: { minHeight: 48 },
            },
          }}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Disposal Date"
          type="date"
          value={formData.disposalDate || ''}
          onChange={(e) => handleFieldChange('disposalDate', e.target.value)}
          error={!!errors.disposalDate}
          helperText={errors.disposalDate}
          size={isMobile ? 'medium' : 'small'}
          slotProps={{
            inputLabel: {
              shrink: true,
            },
            input: {
              inputProps: {
                'aria-label': 'Disposal date',
                'aria-invalid': !!errors.disposalDate,
                'aria-describedby': errors.disposalDate ? 'disposal-date-error' : undefined,
              },
              sx: { minHeight: 48 },
            },
            formHelperText: {
              id: 'disposal-date-error',
            },
          }}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Next Review Date"
          type="date"
          value={formData.nextReviewDate || ''}
          onChange={(e) => handleFieldChange('nextReviewDate', e.target.value)}
          size={isMobile ? 'medium' : 'small'}
          slotProps={{
            inputLabel: {
              shrink: true,
            },
            input: {
              sx: { minHeight: 48 },
            },
          }}
        />
      </Grid>
    </Grid>
  );

  // Render photo and document section
  const renderPhotoAndDocumentSection = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Photos */}
      <Box>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1.5 }}>
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
          disabled={isUploadingPhotos || isUploadingDocuments}
          currentPhotoCount={formData.photos?.length || 0}
        />
      </Box>

      {/* Receipts */}
      <Box>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1.5 }}>
          Receipts
        </Typography>
        {/* Receipt Preview Grid */}
        {formData.receipts && formData.receipts.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <DocumentPreviewGrid
              documentKeys={formData.receipts}
              onRemove={(key) => handleDocumentRemove(key, 'receipt')}
              disabled={isUploadingDocuments}
              documentType="receipt"
            />
          </Box>
        )}

        {/* Receipt Upload Zone */}
        <DocumentUploadZone
          onUpload={handleReceiptUpload}
          disabled={isUploadingPhotos || isUploadingDocuments}
          currentDocumentCount={formData.receipts?.length || 0}
          documentType="receipt"
        />
      </Box>

      {/* Warranties */}
      <Box>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1.5 }}>
          Warranties
        </Typography>
        {/* Warranty Preview Grid */}
        {formData.warranties && formData.warranties.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <DocumentPreviewGrid
              documentKeys={formData.warranties}
              onRemove={(key) => handleDocumentRemove(key, 'warranty')}
              disabled={isUploadingDocuments}
              documentType="warranty"
            />
          </Box>
        )}

        {/* Warranty Upload Zone */}
        <DocumentUploadZone
          onUpload={handleWarrantyUpload}
          disabled={isUploadingPhotos || isUploadingDocuments}
          currentDocumentCount={formData.warranties?.length || 0}
          documentType="warranty"
        />
      </Box>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      aria-labelledby="thing-form-dialog-title"
      sx={{
        '& .MuiDialog-paper': {
          maxHeight: { xs: '100vh', sm: '90vh' },
        },
      }}
    >
      <DialogTitle 
        id="thing-form-dialog-title"
        sx={{ 
          pb: 1,
          px: { xs: 2, sm: 3 },
          pt: { xs: 2, sm: 2 },
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          gap: 2 
        }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="div" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {thing ? 'Edit Thing' : 'Add Thing'}
            </Typography>
            {formData.name && (
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  mt: 0.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {formData.name}
              </Typography>
            )}
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            {PrimaryImageDisplay}
          </Box>
        </Box>
      </DialogTitle>

      {/* Use tabs on mobile/tablet, accordion on desktop for better space usage */}
      {isTablet ? (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={currentTab} 
              onChange={handleTabChange} 
              variant="scrollable"
              scrollButtons="auto"
              aria-label="thing form sections"
            >
              <Tab 
                icon={<InfoIcon />} 
                label="General" 
                iconPosition="start"
                sx={{ minHeight: 48 }}
              />
              <Tab 
                icon={<LocationIcon />} 
                label="Location" 
                iconPosition="start"
                sx={{ minHeight: 48 }}
              />
              <Tab 
                icon={<ShoppingCartIcon />} 
                label="Purchase" 
                iconPosition="start"
                sx={{ minHeight: 48 }}
              />
              <Tab 
                icon={<PhotoIcon />} 
                label="Media" 
                iconPosition="start"
                sx={{ minHeight: 48 }}
              />
            </Tabs>
          </Box>
          
          <DialogContent sx={{ 
            p: { xs: 2, sm: 3 },
          }}>
            {currentTab === 0 && (
              <Box sx={{ pt: 1 }}>
                {renderBasicFields()}
              </Box>
            )}
            {currentTab === 1 && (
              <Box sx={{ pt: 1 }}>
                {renderLocationFields()}
              </Box>
            )}
            {currentTab === 2 && (
              <Box sx={{ pt: 1 }}>
                {renderPurchaseFields()}
              </Box>
            )}
            {currentTab === 3 && (
              <Box sx={{ pt: 1 }}>
                {renderPhotoAndDocumentSection()}
                <Box sx={{ mt: 2 }}>
                  {renderAdditionalFields()}
                </Box>
              </Box>
            )}
          </DialogContent>
        </>
      ) : (
        <DialogContent sx={{ 
          p: 3,
        }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Basic Information - Always visible */}
            <Box>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 1.5 }}>
                Basic Information
              </Typography>
              {renderBasicFields()}
            </Box>

            {/* Location & Classification - Collapsible */}
            <Accordion defaultExpanded sx={{ '& .MuiAccordionSummary-root': { minHeight: 56 } }}>
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon />}
                sx={{ 
                  '& .MuiAccordionSummary-content': { 
                    margin: '12px 0',
                  }
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Location & Classification
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 1.5, pb: 1.5, px: 2 }}>
                {renderLocationFields()}
              </AccordionDetails>
            </Accordion>

            {/* Purchase Information - Collapsible */}
            <Accordion sx={{ '& .MuiAccordionSummary-root': { minHeight: 56 } }}>
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon />}
                sx={{ 
                  '& .MuiAccordionSummary-content': { 
                    margin: '12px 0',
                  }
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Purchase Information
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 1.5, pb: 1.5, px: 2 }}>
                {renderPurchaseFields()}
              </AccordionDetails>
            </Accordion>

            {/* Photos - Collapsible */}
            <Accordion sx={{ '& .MuiAccordionSummary-root': { minHeight: 56 } }}>
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon />}
                sx={{ 
                  '& .MuiAccordionSummary-content': { 
                    margin: '12px 0',
                  }
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Photos, Receipts & Warranties
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 1.5, pb: 1.5, px: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {renderPhotoAndDocumentSection()}
                  <Divider sx={{ my: 1 }} />
                  {renderAdditionalFields()}
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        </DialogContent>
      )}

      <DialogActions sx={{ 
        px: { xs: 2, sm: 3 }, 
        pb: { xs: 2, sm: 2 },
        pt: { xs: 1.5, sm: 2 },
        gap: { xs: 1, sm: 1 },
        flexDirection: 'row',
        justifyContent: 'flex-end',
      }}>
        <Button 
          onClick={handleCancel} 
          color="inherit"
          size={isMobile ? 'large' : 'medium'}
          sx={{ minWidth: { xs: 100, sm: 80 } }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          size={isMobile ? 'large' : 'medium'}
          sx={{ minWidth: { xs: 100, sm: 80 } }}
        >
          {thing ? 'Update' : 'Create'}
        </Button>
      </DialogActions>

      {/* Barcode Scanner Dialog */}
      <BarcodeScanner
        open={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onBarcodeScanned={handleBarcodeScanned}
      />

      {/* Barcode Item Preview Dialog */}
      {currentInventory && (
        <BarcodeItemPreview
          open={barcodePreviewOpen}
          barcode={scannedBarcode}
          inventoryId={currentInventory.id}
          onClose={() => {
            setBarcodePreviewOpen(false);
            setScannedBarcode('');
          }}
          onAccept={handleBarcodeItemAccept}
        />
      )}
    </Dialog>
  );
}
