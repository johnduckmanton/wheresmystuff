import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  IconButton,
  Card,
  CardMedia,
  CardActions,
  CircularProgress,
  Typography,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import apiClient from '../services/api';

export interface PhotoPreviewGridProps {
  photoKeys: string[];
  onRemove: (key: string) => void;
  disabled?: boolean;
}

interface PhotoWithUrl {
  key: string;
  url: string | null;
  loading: boolean;
  error: string | null;
}

export default function PhotoPreviewGrid({
  photoKeys,
  onRemove,
  disabled = false,
}: PhotoPreviewGridProps) {
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);

  // Load presigned URLs for photos
  useEffect(() => {
    const loadPhotos = async () => {
      // Initialize photos with loading state
      const initialPhotos: PhotoWithUrl[] = photoKeys.map((key) => ({
        key,
        url: null,
        loading: true,
        error: null,
      }));
      setPhotos(initialPhotos);

      // Load each photo URL
      for (let i = 0; i < photoKeys.length; i++) {
        const key = photoKeys[i];
        try {
          const response = await apiClient.generateDownloadUrl(key);
          setPhotos((prev) =>
            prev.map((photo) =>
              photo.key === key
                ? { ...photo, url: response.downloadUrl, loading: false }
                : photo
            )
          );
        } catch (err) {
          console.error(`Failed to load photo ${key}:`, err);
          setPhotos((prev) =>
            prev.map((photo) =>
              photo.key === key
                ? {
                    ...photo,
                    loading: false,
                    error: err instanceof Error ? err.message : 'Failed to load',
                  }
                : photo
            )
          );
        }
      }
    };

    if (photoKeys.length > 0) {
      loadPhotos();
    } else {
      setPhotos([]);
    }
  }, [photoKeys]);

  // Handle photo removal
  const handleRemove = (key: string) => {
    if (!disabled) {
      onRemove(key);
    }
  };

  if (photoKeys.length === 0) {
    return (
      <Box
        role="status"
        sx={{
          p: 3,
          textAlign: 'center',
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.default',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No photos uploaded yet
        </Typography>
      </Box>
    );
  }

  return (
    <Grid 
      container 
      spacing={2}
      role="list"
      aria-label="Photo gallery"
    >
      {photos.map((photo, index) => (
        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={photo.key} role="listitem">
          <Card
            sx={{
              position: 'relative',
              height: 200,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {photo.loading && (
              <Box
                role="status"
                aria-label="Loading photo"
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'background.default',
                }}
              >
                <CircularProgress size={40} />
              </Box>
            )}

            {photo.error && (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'background.default',
                  p: 2,
                }}
              >
                <Alert severity="error" sx={{ width: '100%' }} role="alert">
                  {photo.error}
                </Alert>
              </Box>
            )}

            {photo.url && !photo.loading && !photo.error && (
              <>
                <CardMedia
                  component="img"
                  image={photo.url}
                  alt={`Photo ${index + 1} of ${photos.length}`}
                  sx={{
                    flex: 1,
                    objectFit: 'cover',
                    height: 160,
                  }}
                  loading="lazy"
                />
                <CardActions
                  sx={{
                    justifyContent: 'flex-end',
                    p: 1,
                    bgcolor: 'background.paper',
                  }}
                >
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleRemove(photo.key)}
                    disabled={disabled}
                    aria-label={`Remove photo ${index + 1}`}
                  >
                    <DeleteIcon fontSize="small" aria-hidden="true" />
                  </IconButton>
                </CardActions>
              </>
            )}
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
