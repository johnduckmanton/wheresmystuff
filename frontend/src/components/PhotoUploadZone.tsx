import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Alert,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

export interface PhotoUploadZoneProps {
  onUpload: (files: File[]) => Promise<void>;
  disabled?: boolean;
}

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

export default function PhotoUploadZone({ onUpload, disabled = false }: PhotoUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Validate file types
  const validateFiles = (files: File[]): { valid: File[]; invalid: string[] } => {
    const valid: File[] = [];
    const invalid: string[] = [];

    files.forEach((file) => {
      if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
        valid.push(file);
      } else {
        invalid.push(file.name);
      }
    });

    return { valid, invalid };
  };

  // Handle file upload
  const handleFiles = useCallback(
    async (files: File[]) => {
      if (disabled || isUploading) return;

      setError(null);

      // Validate files
      const { valid, invalid } = validateFiles(files);

      if (invalid.length > 0) {
        setError(
          `Invalid file type(s): ${invalid.join(', ')}. Only images are allowed.`
        );
        return;
      }

      if (valid.length === 0) {
        return;
      }

      try {
        setIsUploading(true);
        setUploadProgress(0);

        // Simulate progress (actual progress would come from upload implementation)
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 100);

        await onUpload(valid);

        clearInterval(progressInterval);
        setUploadProgress(100);

        // Reset after a short delay
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
        }, 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload files');
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [onUpload, disabled, isUploading]
  );

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled || isUploading) return;

      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [disabled, isUploading, handleFiles]
  );

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const files = Array.from(e.target.files);
        handleFiles(files);
      }
      // Reset input value to allow selecting the same file again
      e.target.value = '';
    },
    [handleFiles]
  );

  return (
    <Box>
      <Box
        role="button"
        tabIndex={disabled || isUploading ? -1 : 0}
        aria-label="Photo upload zone. Drag and drop images or click to browse files"
        aria-disabled={disabled || isUploading}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          border: '2px dashed',
          borderColor: isDragging
            ? 'primary.main'
            : disabled
            ? 'action.disabled'
            : 'divider',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          bgcolor: isDragging
            ? 'action.hover'
            : disabled
            ? 'action.disabledBackground'
            : 'background.default',
          cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: disabled || isUploading ? 'divider' : 'primary.main',
            bgcolor: disabled || isUploading ? 'background.default' : 'action.hover',
          },
        }}
      >
        <CloudUploadIcon
          sx={{
            fontSize: 48,
            color: disabled ? 'action.disabled' : 'primary.main',
            mb: 2,
          }}
          aria-hidden="true"
        />
        <Typography variant="body1" gutterBottom>
          {isDragging
            ? 'Drop files here'
            : 'Drag and drop image files here'}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          or
        </Typography>
        <Button
          variant="contained"
          component="label"
          disabled={disabled || isUploading}
          sx={{ mt: 1 }}
          aria-label="Browse files to upload"
        >
          Browse Files
          <input
            type="file"
            hidden
            multiple
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            onChange={handleFileInputChange}
            disabled={disabled || isUploading}
            aria-label="File input for photo upload"
          />
        </Button>
        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 2 }}>
          Supported formats: JPEG, PNG, GIF, WebP, SVG
        </Typography>
      </Box>

      {isUploading && (
        <Box sx={{ mt: 2 }} role="status" aria-live="polite">
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Uploading...
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={uploadProgress}
            aria-label={`Upload progress: ${uploadProgress}%`}
          />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)} role="alert">
          {error}
        </Alert>
      )}
    </Box>
  );
}
