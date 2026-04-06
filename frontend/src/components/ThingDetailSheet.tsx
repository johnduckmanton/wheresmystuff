import { Box, Typography, Chip, SwipeableDrawer, Button } from '@mui/material';
import { NavigateNext } from '@mui/icons-material';
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
}: ThingDetailSheetProps) {
  if (!thing) return null;

  const breadcrumbLevels = [
    locationName,
    roomName,
    containerName,
  ].filter(Boolean) as string[];

  const primaryPhoto = thing.photos && thing.photos.length > 0 ? thing.photos[0] : undefined;

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

        {/* Primary photo */}
        {primaryPhoto && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <PhotoThumbnail
              photoKey={primaryPhoto}
              altText={thing.name}
              size={120}
              showPopup={false}
            />
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
    </SwipeableDrawer>
  );
}
