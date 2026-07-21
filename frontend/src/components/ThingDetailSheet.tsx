import { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  SwipeableDrawer,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { NavigateNext, Delete as DeleteIcon } from '@mui/icons-material';
import PhotoThumbnail from './PhotoThumbnail';
import type { Thing } from '../types';

interface ThingDetailSheetProps {
  thing: Thing | null;
  open: boolean;
  categoryName?: string;
  locationName?: string;
  roomName?: string;
  containerName?: string;
  ownerName?: string;
  onClose: () => void;
  onEdit: (thing: Thing) => void;
  onDeletePhoto?: (photoKey: string) => void;
}

export default function ThingDetailSheet({
  thing,
  open,
  categoryName,
  locationName,
  roomName,
  containerName,
  ownerName,
  onClose,
  onEdit,
  onDeletePhoto,
}: ThingDetailSheetProps) {
  const [deletePhotoKey, setDeletePhotoKey] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (!thing) return null;

  const breadcrumbLevels = [
    locationName,
    roomName,
    containerName,
  ].filter(Boolean) as string[];

  const photos = thing.photos && thing.photos.length > 0 ? thing.photos : [];

  const handleDeleteClick = (photoKey: string) => {
    setDeletePhotoKey(photoKey);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletePhotoKey && onDeletePhoto) {
      onDeletePhoto(deletePhotoKey);
    }
    setDeleteDialogOpen(false);
    setDeletePhotoKey(null);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setDeletePhotoKey(null);
  };

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen={true}
      PaperProps={{
        sx: {
          borderRadius: '16px 16px 0 0',
          maxHeight: '80vh',
          overflow: 'hidden',
        },
      }}
    >
      {/* Puller handle */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
        <Box
          sx={{
            width: 32,
            height: 4,
            borderRadius: 2,
            bgcolor: 'grey.400',
          }}
        />
      </Box>

      {/* Scrollable content area */}
      <Box sx={{ overflow: 'auto', px: 2, pt: 1, pb: 0 }}>
        {/* Thing name */}
        <Typography variant="h6" sx={{ mb: 1 }}>
          {thing.name}
        </Typography>

        {/* Location breadcrumb */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
          {breadcrumbLevels.length > 0 ? (
            breadcrumbLevels.map((level, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
                {index > 0 && <NavigateNext sx={{ fontSize: 18, color: 'text.secondary' }} />}
                <Typography variant="body2" color="text.secondary">
                  {level}
                </Typography>
              </Box>
            ))
          ) : (
            <Typography variant="body2" color="text.disabled">
              No location set
            </Typography>
          )}
        </Box>

        {/* Photos */}
        {photos.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              overflowX: 'auto',
              mb: 2,
              pb: 1,
            }}
          >
            {photos.map((photoKey) => (
              <Box
                key={photoKey}
                sx={{
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <PhotoThumbnail
                  photoKey={photoKey}
                  altText={thing.name}
                  size={100}
                  showPopup={false}
                />
                {onDeletePhoto && (
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteClick(photoKey)}
                    aria-label="Delete photo"
                    sx={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      bgcolor: 'rgba(0, 0, 0, 0.5)',
                      color: 'white',
                      p: 0.5,
                      '&:hover': {
                        bgcolor: 'rgba(211, 47, 47, 0.8)',
                      },
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* Metadata chips */}
        {(categoryName || ownerName) && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {categoryName && (
              <Chip label={categoryName} variant="outlined" size="small" />
            )}
            {ownerName && (
              <Chip label={ownerName} variant="outlined" size="small" />
            )}
          </Box>
        )}

        {/* Description */}
        {thing.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {thing.description}
          </Typography>
        )}

        {/* Date added */}
        {thing.dateAdded && (
          <Typography variant="caption" color="text.disabled" sx={{ mb: 2, display: 'block' }}>
            Added {new Date(thing.dateAdded).toLocaleDateString()}
          </Typography>
        )}
      </Box>

      {/* Sticky action bar */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          p: 2,
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end',
        }}
      >
        <Button variant="outlined" onClick={onClose}>
          Close
        </Button>
        <Button variant="contained" onClick={() => onEdit(thing)}>
          Edit
        </Button>
      </Box>

      {/* Delete Photo Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-photo-dialog-title"
        aria-describedby="delete-photo-dialog-description"
      >
        <DialogTitle id="delete-photo-dialog-title">
          Delete Photo
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-photo-dialog-description">
            Are you sure you want to delete this photo? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </SwipeableDrawer>
  );
}
