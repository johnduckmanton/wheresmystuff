import { useState, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Fab,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import {
  CameraAlt as CameraAltIcon,
  Close as CloseIcon,
  ImageSearch as ImageSearchIcon,
  PhotoLibrary as PhotoLibraryIcon,
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import apiClient from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import PhotoSearchResults, { type PhotoSearchResult } from './PhotoSearchResults';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PhotoSearchButtonProps {
  inventoryId: string;
  variant?: 'icon' | 'button';
  onResultSelect?: (thingId: string) => void;
  onNavigateToContainer?: (containerId: string) => void;
}

// ─── Internal phases ──────────────────────────────────────────────────────────

type Phase =
  | 'idle'            // button not yet clicked
  | 'picker'          // choosing camera vs gallery
  | 'uploading'       // uploading the query photo
  | 'searching'       // waiting for search results
  | 'results';        // showing PhotoSearchResults

// ─── Image optimisation ───────────────────────────────────────────────────────

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.8;

/**
 * Resize a File/Blob to fit within MAX_DIMENSION, then return a JPEG Blob.
 */
function optimiseImage(source: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(source);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob returned null'));
        },
        'image/jpeg',
        JPEG_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for optimisation'));
    };

    img.src = objectUrl;
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * PhotoSearchButton
 *
 * A reusable button/icon that initiates a visual similarity photo search.
 * Opens a picker to capture a new photo or choose from the gallery, uploads the
 * query photo, calls POST /photo-search, and renders PhotoSearchResults.
 *
 * Validates: Requirements 7.1, 7.2
 */
export default function PhotoSearchButton({
  inventoryId,
  variant = 'icon',
  onResultSelect,
  onNavigateToContainer,
}: PhotoSearchButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [queryPhotoKey, setQueryPhotoKey] = useState<string>('');
  const [results, setResults] = useState<PhotoSearchResult[]>([]);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { showError } = useNotification();

  // ── Photo handling ─────────────────────────────────────────────────────────

  const handleFileSelected = useCallback(
    async (file: File) => {
      setPhase('uploading');
      setSearchError(null);
      setResults([]);

      let optimised: Blob;
      try {
        optimised = await optimiseImage(file);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to process image';
        setSearchError(msg);
        setPhase('results');
        return;
      }

      // Upload the query photo using a temporary entity ID
      const tempEntityId = uuidv4();
      let photoKey: string;
      try {
        const { uploadUrl, key } = await apiClient.generateUploadUrl(
          `photo-search-query-${tempEntityId}.jpg`,
          'image/jpeg',
          inventoryId,
          tempEntityId,
        );

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: optimised,
          headers: { 'Content-Type': 'image/jpeg' },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }

        photoKey = key;
        setQueryPhotoKey(photoKey);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to upload photo';
        setSearchError(msg);
        setPhase('results');
        return;
      }

      // Run the search
      setPhase('searching');
      try {
        const response = await apiClient.searchByPhoto(photoKey, inventoryId);
        setResults(response.results ?? []);
        setPhase('results');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Photo search failed';
        setSearchError(msg);
        setPhase('results');
      }
    },
    [inventoryId],
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset the input immediately so the same file can be re-selected
      event.target.value = '';
      if (file) {
        handleFileSelected(file);
      }
    },
    [handleFileSelected],
  );

  // ── Retry ──────────────────────────────────────────────────────────────────

  const handleRetry = useCallback(async () => {
    if (!queryPhotoKey) {
      setPhase('picker');
      return;
    }
    setSearchError(null);
    setPhase('searching');
    try {
      const response = await apiClient.searchByPhoto(queryPhotoKey, inventoryId);
      setResults(response.results ?? []);
      setPhase('results');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Photo search failed';
      setSearchError(msg);
      setPhase('results');
    }
  }, [inventoryId, queryPhotoKey]);

  // ── Close / reset ──────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    setPhase('idle');
    setSearchError(null);
    setQueryPhotoKey('');
    setResults([]);
  }, []);

  // ── Result navigation ──────────────────────────────────────────────────────

  const handleResultSelect = useCallback(
    (thingId: string) => {
      if (onResultSelect) {
        onResultSelect(thingId);
      } else {
        showError('Navigation handler not configured');
      }
      handleClose();
    },
    [onResultSelect, showError, handleClose],
  );

  const handleNavigateToContainer = useCallback(
    (containerId: string) => {
      if (onNavigateToContainer) {
        onNavigateToContainer(containerId);
      }
      handleClose();
    },
    [onNavigateToContainer, handleClose],
  );

  // ── Derived loading state ──────────────────────────────────────────────────

  const isLoading = phase === 'uploading' || phase === 'searching';

  // ── Trigger button ─────────────────────────────────────────────────────────

  const triggerButton =
    variant === 'button' ? (
      <Button
        variant="outlined"
        startIcon={<ImageSearchIcon />}
        onClick={() => setPhase('picker')}
        aria-label="Search by photo"
      >
        Search by Photo
      </Button>
    ) : (
      <Fab
        size="small"
        color="primary"
        onClick={() => setPhase('picker')}
        aria-label="Search by photo"
        sx={{ boxShadow: 1 }}
      >
        <ImageSearchIcon sx={{ color: 'white' }} />
      </Fab>
    );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger */}
      {triggerButton}

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* ── Photo source picker dialog ─────────────────────────────────────── */}
      <Dialog
        open={phase === 'picker'}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        aria-labelledby="photo-search-picker-title"
      >
        <DialogTitle id="photo-search-picker-title" sx={{ pr: 6 }}>
          Search by Photo
          <IconButton
            onClick={handleClose}
            aria-label="Close photo search"
            sx={{ position: 'absolute', right: 8, top: 8 }}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Take or upload a photo to find visually similar items in your inventory.
          </Typography>

          <List disablePadding>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => cameraInputRef.current?.click()}
                sx={{ borderRadius: 1 }}
                aria-label="Take a photo with camera"
              >
                <ListItemIcon>
                  <CameraAltIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Take a Photo"
                  secondary="Use your camera to capture an item"
                />
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding>
              <ListItemButton
                onClick={() => galleryInputRef.current?.click()}
                sx={{ borderRadius: 1 }}
                aria-label="Choose a photo from your gallery"
              >
                <ListItemIcon>
                  <PhotoLibraryIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Choose from Gallery"
                  secondary="Select an existing photo from your device"
                />
              </ListItemButton>
            </ListItem>
          </List>
        </DialogContent>
      </Dialog>

      {/* ── Upload / search progress dialog ───────────────────────────────── */}
      <Dialog
        open={isLoading}
        maxWidth="xs"
        fullWidth
        aria-labelledby="photo-search-progress-title"
        aria-describedby="photo-search-progress-description"
      >
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            py: 4,
          }}
        >
          <CircularProgress aria-hidden="true" />
          <Box id="photo-search-progress-description" textAlign="center">
            <Typography
              id="photo-search-progress-title"
              variant="body1"
              fontWeight="medium"
              gutterBottom
            >
              {phase === 'uploading' ? 'Uploading photo…' : 'Searching for matches…'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {phase === 'uploading'
                ? 'Preparing your query image'
                : 'Comparing against your inventory items'}
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>

      {/* ── Results dialog ─────────────────────────────────────────────────── */}
      <Dialog
        open={phase === 'results'}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        fullScreen={false}
        aria-labelledby="photo-search-results-dialog"
        PaperProps={{ sx: { height: '80vh', maxHeight: 700, display: 'flex', flexDirection: 'column' } }}
      >
        <PhotoSearchResults
          queryPhotoKey={queryPhotoKey}
          results={results}
          onSelectResult={handleResultSelect}
          onNavigateToContainer={handleNavigateToContainer}
          onClose={handleClose}
          isLoading={false}
          error={searchError}
          onRetry={handleRetry}
        />
      </Dialog>
    </>
  );
}
