import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';

interface PhotoUploadZoneProps {
  onUpload: (files: File[]) => Promise<void>;
  disabled?: boolean;
  maxPhotos?: number;
  currentPhotoCount?: number;
  multiple?: boolean;
  acceptedTypes?: string;
  maxFileSize?: number; // in MB
  label?: string;
  helperText?: string;
}

export default function PhotoUploadZone({
  onUpload,
  disabled = false,
  maxPhotos = 10,
  currentPhotoCount = 0,
  multiple = true,
  acceptedTypes = 'image/*',
  maxFileSize = 5,
  label = 'Add Photos',
  helperText,
}: PhotoUploadZoneProps) {
  const { showError } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const canAddMore = currentPhotoCount < maxPhotos;
  const remainingSlots = maxPhotos - currentPhotoCount;

  const validateFiles = (files: FileList): File[] => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check file type
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: Not an image file`);
        continue;
      }

      // Check file size
      if (file.size > maxFileSize * 1024 * 1024) {
        errors.push(`${file.name}: File too large (max ${maxFileSize}MB)`);
        continue;
      }

      // Check if we have room for more photos
      if (validFiles.length >= remainingSlots) {
        errors.push(`Can only add ${remainingSlots} more photo${remainingSlots !== 1 ? 's' : ''}`);
        break;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      showError(errors.join(', '));
    }

    return validFiles;
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles = validateFiles(files);
    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      await onUpload(validFiles);
    } catch (error) {
      console.error('Error uploading files:', error);
      // Error handling is done in the parent component
    } finally {
      setUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(event.target.files);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    if (!disabled && !uploading && canAddMore) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    if (disabled || uploading || !canAddMore) return;

    handleFileSelect(event.dataTransfer.files);
  };

  const handleClick = () => {
    if (!disabled && !uploading && canAddMore) {
      fileInputRef.current?.click();
    }
  };

  return (
    <Box>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        multiple={multiple}
        onChange={handleInputChange}
        style={{ display: 'none' }}
        disabled={disabled || uploading}
      />

      {/* Upload Button */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          variant="outlined"
          startIcon={uploading ? <CircularProgress size={16} /> : <PhotoCameraIcon />}
          onClick={handleClick}
          disabled={disabled || uploading || !canAddMore}
          size="small"
        >
          {uploading ? 'Uploading...' : label}
        </Button>
        <Typography variant="body2" color="text.secondary">
          {currentPhotoCount}/{maxPhotos} photos
        </Typography>
      </Box>

      {/* Drag and Drop Zone */}
      <Box
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          borderRadius: 1,
          p: 3,
          textAlign: 'center',
          bgcolor: dragOver ? 'primary.50' : 'background.paper',
          cursor: disabled || uploading || !canAddMore ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': !disabled && !uploading && canAddMore ? {
            borderColor: 'primary.main',
            bgcolor: 'primary.50',
          } : {},
        }}
      >
        <UploadIcon 
          sx={{ 
            fontSize: 48, 
            color: dragOver ? 'primary.main' : 'text.secondary', 
            mb: 1 
          }} 
        />
        <Typography variant="body1" gutterBottom>
          {dragOver ? 'Drop photos here' : 'Drag photos here or click to select'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {helperText || `Supports images up to ${maxFileSize}MB each`}
        </Typography>
        
        {!canAddMore && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Maximum {maxPhotos} photos reached
          </Alert>
        )}
      </Box>
    </Box>
  );
}