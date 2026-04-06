import { useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocationOn as LocationOnIcon,
} from '@mui/icons-material';
import PhotoThumbnail from './PhotoThumbnail';
import type { Thing } from '../types/entities';

interface MobileThingCardProps {
  thing: Thing;
  categoryName?: string;
  locationName?: string;
  isSelectMode: boolean;
  isSelected: boolean;
  onTap: (thing: Thing) => void;
  onEdit: (thing: Thing) => void;
  onDelete: (thing: Thing) => void;
  onSelectionToggle: (thing: Thing) => void;
}

export default function MobileThingCard({
  thing,
  categoryName,
  locationName,
  isSelectMode,
  isSelected,
  onTap,
  onEdit,
  onDelete,
  onSelectionToggle,
}: MobileThingCardProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleMenuAction = (action: () => void) => {
    action();
    handleMenuClose();
  };

  const handleCardClick = () => {
    if (isSelectMode) {
      onSelectionToggle(thing);
    } else {
      onTap(thing);
    }
  };

  const primaryPhoto = thing.photos && thing.photos.length > 0 ? thing.photos[0] : undefined;

  return (
    <Box sx={{ mb: 1 }}>
      <Card
        onClick={handleCardClick}
        sx={{
          cursor: 'pointer',
          border: isSelected ? '2px solid' : '1px solid',
          borderColor: isSelected ? 'primary.main' : 'divider',
          '&:active': { transform: 'scale(0.99)' },
          transition: 'border-color 0.15s ease',
        }}
      >
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          {/* Row 1: [checkbox] | thumbnail | name | overflow menu */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            {isSelectMode && (
              <Checkbox
                checked={isSelected}
                onChange={() => onSelectionToggle(thing)}
                onClick={(e) => e.stopPropagation()}
                sx={{ p: 0, flexShrink: 0 }}
                size="small"
              />
            )}

            <PhotoThumbnail
              photoKey={primaryPhoto}
              altText={thing.name}
              size={40}
              showPopup={false}
            />

            <Typography
              variant="subtitle1"
              sx={{
                flex: 1,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {thing.name}
            </Typography>

            <IconButton
              size="small"
              onClick={handleMenuOpen}
              sx={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
              aria-label="More options"
            >
              <MoreVertIcon />
            </IconButton>
          </Box>

          {/* Row 2: category chip | location */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pl: isSelectMode ? '80px' : '48px' }}>
            {categoryName && (
              <Chip
                label={categoryName}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.75rem', height: 24 }}
              />
            )}

            {locationName && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <LocationOnIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {locationName}
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Overflow menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{ sx: { minWidth: 160 } }}
      >
        <MenuItem
          onClick={() => handleMenuAction(() => onEdit(thing))}
          sx={{ minHeight: 44 }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => handleMenuAction(() => onDelete(thing))}
          sx={{ minHeight: 44, color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
