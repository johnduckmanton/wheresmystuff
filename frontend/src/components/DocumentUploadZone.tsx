import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Description as DocumentIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';

interface DocumentUploadZoneProps {
  onUpload: (files: File[]) => Promise<void>;
  disabled?: boolean;
  maxDocuments?: number;
  currentDocumentCount?: number;
  multiple?: boolean;
  documentType: 'receipt' | 'warranty';
  maxFileSize?: number; // in MB
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
].join(',');

export default function DocumentUploadZone({
  onUpload,
  disabled = false,
  maxDocuments = 5,
  currentDocumentCount = 0,
  multiple = true,
  documentType,
  maxFileSize = 10,
}: DocumentUploadZoneProps) {
  const { showError } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const canAddMore = currentDocumentCount < maxDocuments;
  const remainingSlots = maxDocuments - currentDocumentCount;

  const validateFiles = (files: FileList): File[] => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type. Allowed: PDF, images, Word documents`);
        continue;
      }

      // Check file size
      if (file.size > maxFileSize * 1024 * 1024) {
        errors.push(`${file.name}: File too large (max ${maxFileSize}MB)`);
        continue;
      }

      // Check if we have room for more documents
      if (validFiles.length >= remainingSlots) {
        errors.push(`Can only add ${remainingSlots} more document${remainingSlots !== 1 ? 's' : ''}`);
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

  const label = documentType === 'receipt' ? 'Add Receipts' : 'Add Warranties';
  const helperText = `PDF, images (JPEG, PNG, WebP, HEIC), or Word documents up to ${maxFileSize}MB`;

  return (
    <Box>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple={multiple}
        onChange={handleInputChange}
        style={{ display: 'none' }}
        disabled={disabled || uploading}
      />

      {/* Upload Button */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          variant="outlined"
          startIcon={uploading ? <CircularProgress size={16} /> : <DocumentIcon />}
          onClick={handleClick}
          disabled={disabled || uploading || !canAddMore}
          size="small"
        >
          {uploading ? 'Uploading...' : label}
        </Button>
        <Typography variant="body2" color="text.secondary">
          {currentDocumentCount}/{maxDocuments} documents
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
          {dragOver ? 'Drop documents here' : 'Drag documents here or click to select'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {helperText}
        </Typography>
        
        {!canAddMore && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Maximum {maxDocuments} documents reached
          </Alert>
        )}
      </Box>
    </Box>
  );
}
