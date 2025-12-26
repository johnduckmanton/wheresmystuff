import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  IconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,

} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';
import apiClient from '../services/api';

interface ContainerPhotoUploadProps {
  containerId: string;
  inventoryId: string;
  photos: string[];
  onPhotosUpdated: (photos: string[]) => void;
  maxPhotos?: number;
  disabled?: boolean;
}

export default function ContainerPhotoUpload({
  containerId,
  inventoryId,
  photos,
  onPhotosUpdated,
  maxPhotos = 10,
  disabled = false,
}: ContainerPhotoUploadProps) {
  const { showSuccess, showError } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set());

  // Load photo URLs when photos change
  useEffect(() => {
    const loadPhotoUrls = async () => {
      const newUrls = new Map(photoUrls);
      const newLoadingUrls = new Set<string>();

      for (const photoKey of photos) {
        if (!newUrls.has(photoKey) && !loadingUrls.has(photoKey)) {
          newLoadingUrls.add(photoKey);
          try {
            const url = await getPhotoUrl(photoKey);
            newUrls.set(photoKey, url);
          } catch (error) {
            console.error(`Failed to load URL for photo ${photoKey}:`, error);
            // Set empty string as fallback
            newUrls.set(photoKey, '');
          }
        }
      }

      setPhotoUrls(newUrls);
      setLoadingUrls(prev => {
        const updated = new Set(prev);
        newLoadingUrls.forEach(key => updated.delete(key));
        return updated;
      });
    };

    if (photos.length > 0) {
      loadPhotoUrls();
    }
  }, [photos]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('Image file must be smaller than 5MB');
      return;
    }

    // Check if we've reached the photo limit
    if (photos.length >= maxPhotos) {
      showError(`Maximum ${maxPhotos} photos allowed per container`);
      return;
    }

    uploadPhoto(file);
  };

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      // Debug logging
      console.log('🔍 Photo Upload Debug:');
      console.log('- containerId:', containerId);
      console.log('- inventoryId:', inventoryId);
      console.log('- containerId type:', typeof containerId);
      console.log('- inventoryId type:', typeof inventoryId);
      console.log('- containerId truthy:', !!containerId);
      console.log('- inventoryId truthy:', !!inventoryId);
      
      // Upload photo using the corrected photo upload API with entityId
      const photoKey = await apiClient.uploadPhoto(file, inventoryId, containerId);
      
      // Get current container data to include required fields in update
      const currentContainer = await apiClient.getContainer(containerId, inventoryId);
      
      // Update container with new photo
      const updatedPhotos = [...photos, photoKey];
      await apiClient.updateContainer(containerId, {
        inventoryId,
        name: currentContainer.name, // Include required name field
        photos: updatedPhotos,
      });

      onPhotosUpdated(updatedPhotos);
      showSuccess('Photo uploaded successfully');
    } catch (error) {
      console.error('Error uploading photo:', error);
      showError('Failed to upload photo');
    } finally {
      setUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeletePhoto = async (photoKey: string) => {
    try {
      // Get current container data to include required fields in update
      const currentContainer = await apiClient.getContainer(containerId, inventoryId);
      
      // Remove photo from container
      const updatedPhotos = photos.filter(p => p !== photoKey);
      await apiClient.updateContainer(containerId, {
        inventoryId,
        name: currentContainer.name, // Include required name field
        photos: updatedPhotos,
      });

      // Delete the photo file
      await apiClient.deletePhoto(photoKey, inventoryId);

      onPhotosUpdated(updatedPhotos);
      showSuccess('Photo deleted successfully');
    } catch (error) {
      console.error('Error deleting photo:', error);
      showError('Failed to delete photo');
    }
  };

  const handleViewPhoto = (photoKey: string) => {
    setSelectedPhoto(photoKey);
    setViewDialogOpen(true);
  };

  const getPhotoUrl = async (photoKey: string): Promise<string> => {
    try {
      return await apiClient.getPhotoUrl(photoKey);
    } catch (error) {
      console.error('Error getting photo URL:', error);
      // Return a placeholder image or empty string
      return '';
    }
  };

  return (
    <Box>
      {/* Upload Button */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={disabled || uploading}
        />
        <Button
          variant="outlined"
          startIcon={uploading ? <CircularProgress size={16} /> : <PhotoCameraIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading || photos.length >= maxPhotos}
          size="small"
        >
          {uploading ? 'Uploading...' : 'Add Photo'}
        </Button>
        <Typography variant="body2" color="text.secondary">
          {photos.length}/{maxPhotos} photos
        </Typography>
      </Box>

      {/* Photo Grid */}
      {photos.length > 0 ? (
        <ImageList 
          sx={{ width: '100%', height: 200 }} 
          cols={3} 
          rowHeight={120}
          gap={8}
        >
          {photos.map((photoKey, index) => {
            const photoUrl = photoUrls.get(photoKey);
            const isLoading = loadingUrls.has(photoKey);
            
            return (
              <ImageListItem key={photoKey}>
                {photoUrl && !isLoading ? (
                  <img
                    src={photoUrl}
                    alt={`Container photo ${index + 1}`}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleViewPhoto(photoKey)}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'grey.200',
                      cursor: isLoading ? 'default' : 'pointer',
                    }}
                    onClick={!isLoading ? () => handleViewPhoto(photoKey) : undefined}
                  >
                    {isLoading ? (
                      <CircularProgress size={24} />
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Failed to load
                      </Typography>
                    )}
                  </Box>
                )}
                <ImageListItemBar
                  sx={{
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0) 100%)',
                  }}
                  position="top"
                  actionIcon={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewPhoto(photoKey);
                        }}
                        disabled={!photoUrl || isLoading}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(photoKey);
                        }}
                        disabled={disabled}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                />
              </ImageListItem>
            );
          })}
        </ImageList>
      ) : (
        <Box
          sx={{
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            p: 3,
            textAlign: 'center',
            bgcolor: 'background.paper',
          }}
        >
          <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No photos added yet
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Add photos to help identify this container
          </Typography>
        </Box>
      )}

      {/* Photo View Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Container Photo</DialogTitle>
        <DialogContent>
          {selectedPhoto && (
            <Box sx={{ textAlign: 'center' }}>
              {photoUrls.get(selectedPhoto) ? (
                <img
                  src={photoUrls.get(selectedPhoto)}
                  alt="Container photo"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '200px',
                  }}
                >
                  {loadingUrls.has(selectedPhoto) ? (
                    <CircularProgress />
                  ) : (
                    <Typography color="text.secondary">
                      Failed to load photo
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          {selectedPhoto && (
            <Button
              color="error"
              onClick={() => {
                handleDeletePhoto(selectedPhoto);
                setViewDialogOpen(false);
              }}
              disabled={disabled}
            >
              Delete Photo
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}