import { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  LinearProgress,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  QrCode as QrCodeIcon,
  MoveToInbox as PackIcon,
  Visibility as ViewIcon,
  LocationOn as LocationIcon,
  Inventory as InventoryIcon,
  AttachMoney as MoneyIcon,

  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { useSwipeGestures } from '../hooks/useSwipeGestures';
import { useMobileDetection } from '../hooks/useMobileDetection';
import HandlingFlagChip from './HandlingFlagChip';
import type { Container, ContainerStatus } from '../types/entities';

/**
 * Mobile-optimized container card component
 * Features touch-friendly interactions and swipe gestures
 * Validates: Requirements 13.1, 13.2, 13.3
 */

interface MobileContainerCardProps {
  container: Container;
  locationName?: string;
  onView: (container: Container) => void;
  onEdit: (container: Container) => void;
  onDelete: (container: Container) => void;
  onPack: (container: Container) => void;
  onGenerateQR: (container: Container) => void;
  onToggleFavorite?: (container: Container) => void;
  isFavorite?: boolean;
}

export default function MobileContainerCard({
  container,
  locationName,
  onView,
  onEdit,
  onDelete,
  onPack,
  onGenerateQR,
  onToggleFavorite,
  isFavorite = false,
}: MobileContainerCardProps) {
  const { isMobile } = useMobileDetection();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [isSwipeRevealed, setIsSwipeRevealed] = useState(false);

  // Swipe gesture for quick actions
  const swipeRef = useSwipeGestures({
    onSwipeLeft: () => setIsSwipeRevealed(true),
    onSwipeRight: () => setIsSwipeRevealed(false),
    threshold: 50,
  });

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
    if (isSwipeRevealed) {
      setIsSwipeRevealed(false);
    } else {
      onView(container);
    }
  };

  const getStatusColor = (status: ContainerStatus) => {
    switch (status) {
      case 'empty': return 'default';
      case 'packing': return 'info';
      case 'packed': return 'success';
      case 'in_transit': return 'warning';
      case 'stored': return 'secondary';
      case 'unpacking': return 'info';
      case 'unpacked': return 'success';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: ContainerStatus) => {
    switch (status) {
      case 'empty': return '📦';
      case 'packing': return '📥';
      case 'packed': return '✅';
      case 'in_transit': return '🚚';
      case 'stored': return '🏪';
      case 'unpacking': return '📤';
      case 'unpacked': return '✅';
      default: return '📦';
    }
  };



  const capacityPercentage = container.itemCount > 0 ? Math.min((container.itemCount / 50) * 100, 100) : 0;

  return (
    <Box
      ref={isMobile ? swipeRef : undefined}
      sx={{
        position: 'relative',
        mb: 2,
        overflow: 'hidden',
        borderRadius: 2,
      }}
    >
      {/* Swipe Actions (Mobile Only) */}
      {isMobile && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            background: 'linear-gradient(90deg, #f44336, #d32f2f)',
            color: 'white',
            padding: '0 16px',
            transform: isSwipeRevealed ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s ease',
            zIndex: 1,
          }}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(container);
                setIsSwipeRevealed(false);
              }}
              sx={{ color: 'white', minWidth: 40, minHeight: 40 }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(container);
                setIsSwipeRevealed(false);
              }}
              sx={{ color: 'white', minWidth: 40, minHeight: 40 }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Main Card */}
      <Card
        onClick={handleCardClick}
        sx={{
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          transform: isSwipeRevealed ? 'translateX(-120px)' : 'translateX(0)',
          '&:hover': !isMobile ? {
            transform: 'translateY(-2px)',
            boxShadow: 4,
          } : {},
          '&:active': isMobile ? {
            transform: isSwipeRevealed ? 'translateX(-120px) scale(0.98)' : 'scale(0.98)',
          } : {},
          minHeight: isMobile ? 120 : 'auto',
          position: 'relative',
          ...(container.color && {
            borderLeft: `4px solid ${container.color}`,
          }),
        }}
      >
        <CardContent sx={{ p: isMobile ? 2 : 3 }}>
          {/* Header Row */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Avatar
                  sx={{
                    width: isMobile ? 32 : 40,
                    height: isMobile ? 32 : 40,
                    bgcolor: container.color || 'primary.main',
                    fontSize: isMobile ? '0.875rem' : '1rem',
                    border: container.color ? `2px solid ${container.color}` : 'none',
                  }}
                >
                  {container.photos && container.photos.length > 0 ? (
                    <img
                      src={`${process.env.REACT_APP_API_URL}/photos/${container.photos[0]}`}
                      alt="Container"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '50%',
                      }}
                    />
                  ) : (
                    getStatusIcon(container.status)
                  )}
                </Avatar>
                <Typography
                  variant={isMobile ? 'subtitle1' : 'h6'}
                  sx={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {container.name}
                </Typography>
                {onToggleFavorite && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(container);
                    }}
                    sx={{ p: 0.5 }}
                  >
                    {isFavorite ? (
                      <StarIcon fontSize="small" color="primary" />
                    ) : (
                      <StarBorderIcon fontSize="small" />
                    )}
                  </IconButton>
                )}
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={container.type.charAt(0).toUpperCase() + container.type.slice(1)}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.75rem' }}
                />
                <Chip
                  label={container.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  size="small"
                  color={getStatusColor(container.status)}
                  sx={{ fontSize: '0.75rem' }}
                />
                {container.size && (
                  <Chip
                    label={container.size}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                )}
              </Box>
            </Box>

            <IconButton
              size="small"
              onClick={handleMenuOpen}
              sx={{ 
                ml: 1,
                minWidth: isMobile ? 40 : 32,
                minHeight: isMobile ? 40 : 32,
              }}
            >
              <MoreVertIcon />
            </IconButton>
          </Box>

          {/* Handling Flags */}
          {container.handlingFlags && container.handlingFlags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
              {container.handlingFlags.slice(0, 4).map((flag) => (
                <HandlingFlagChip
                  key={flag}
                  flag={flag}
                  size="small"
                  variant="outlined"
                  showIcon={true}
                  showLabel={true}
                />
              ))}
              {container.handlingFlags.length > 4 && (
                <Chip
                  label={`+${container.handlingFlags.length - 4} more`}
                  size="small"
                  color="default"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 24 }}
                />
              )}
            </Box>
          )}

          {/* Stats Row */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InventoryIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {container.itemCount || 0} items
                </Typography>
              </Box>
              
              {locationName && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocationIcon fontSize="small" color="action" />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 100,
                    }}
                  >
                    {locationName}
                  </Typography>
                </Box>
              )}
            </Box>

            {container.estimatedValue > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <MoneyIcon fontSize="small" color="action" />
                <Typography variant="body2" color="primary" fontWeight="medium">
                  ${container.estimatedValue.toLocaleString()}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Capacity Indicator */}
          {container.itemCount > 0 && (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Capacity
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(capacityPercentage)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={capacityPercentage}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'grey.200',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 2,
                    backgroundColor: capacityPercentage > 80 ? 'warning.main' : 'success.main',
                  },
                }}
              />
            </Box>
          )}

          {/* Description */}
          {container.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {container.description}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            minWidth: 200,
          },
        }}
      >
        <MenuItem onClick={() => handleMenuAction(() => onView(container))}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => handleMenuAction(() => onPack(container))}>
          <ListItemIcon>
            <PackIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Pack Items</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => handleMenuAction(() => onGenerateQR(container))}>
          <ListItemIcon>
            <QrCodeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Generate QR Code</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => handleMenuAction(() => onEdit(container))}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Container</ListItemText>
        </MenuItem>
        
        <MenuItem 
          onClick={() => handleMenuAction(() => onDelete(container))}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete Container</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}