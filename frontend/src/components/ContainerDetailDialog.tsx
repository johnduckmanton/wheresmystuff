import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  Inventory as InventoryIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  Close as CloseIcon,
  ViewList as ContentsIcon,
  Info as InfoIcon,
  Share as ShareIcon,
  Add as AddIcon,
  Print as PrintIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';


import ContainerContentsView from './ContainerContentsView';
import PrintableLabel from './PrintableLabel';
import HandlingFlagChip from './HandlingFlagChip';
import ContainerPhotoUpload from './ContainerPhotoUpload';
import ContainerSharingDialog from './ContainerSharingDialog';
import StorageManagementDialog from './StorageManagementDialog';
import type { Container, Location, Room, ContainerStatus } from '../types/entities';
import apiClient from '../services/api';

interface ContainerDetailDialogProps {
  open: boolean;
  container: Container;
  inventoryId: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPack?: () => void;
  onUpdate?: (container: Container) => void;
}

export default function ContainerDetailDialog({
  open,
  container,
  inventoryId,
  onClose,
  onEdit,
  onDelete,
  onPack,
  onUpdate: _onUpdate, // Prefix with underscore to indicate intentionally unused
}: ContainerDetailDialogProps) {
  const [location, setLocation] = useState<Location | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [updatedContainer, setUpdatedContainer] = useState<Container>(container);
  const [printLabelDialogOpen, setPrintLabelDialogOpen] = useState(false);
  const [sharingDialogOpen, setSharingDialogOpen] = useState(false);
  const [storageDialogOpen, setStorageDialogOpen] = useState(false);

  const loadLocationAndRoom = useCallback(async () => {
    if (!container.locationId) {
      setLocation(null);
      setRoom(null);
      return;
    }

    try {
      const locationData = await apiClient.getLocation(container.locationId, inventoryId);
      setLocation(locationData);

      // Load room if roomId exists
      if (container.roomId) {
        try {
          const roomData = await apiClient.getRoom(container.roomId, inventoryId);
          setRoom(roomData);
        } catch (error) {
          // Silently handle room loading errors - room might not exist or be accessible
          console.warn('Could not load room:', error);
          setRoom(null);
        }
      } else {
        setRoom(null);
      }
    } catch (error) {
      console.error('Error loading location:', error);
      setLocation(null);
      setRoom(null);
    }
  }, [container.locationId, container.roomId, inventoryId]);

  const loadFullContainer = useCallback(async () => {
    try {
      const fullContainer = await apiClient.getContainer(container.id, inventoryId);
      setUpdatedContainer(fullContainer);
    } catch (error) {
      console.error('Error loading full container:', error);
      setUpdatedContainer(container);
    }
  }, [container.id, container, inventoryId]);

  // Load location, room, and full container data when dialog opens
  useEffect(() => {
    if (open && container) {
      loadLocationAndRoom();
      loadFullContainer();
    }
  }, [open, container, loadLocationAndRoom, loadFullContainer]);

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

  // const getHandlingFlagColor = (flag: HandlingFlag) => {
  //   switch (flag) {
  //     case 'fragile': return 'error';
  //     case 'heavy': return 'warning';
  //     case 'valuable': return 'success';
  //     case 'priority': return 'primary';
  //     default: return 'default';
  //   }
  // };

  // const formatHandlingFlag = (flag: HandlingFlag) => {
  //   return flag.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  // };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleContainerUpdated = (container: Container) => {
    setUpdatedContainer(container);
  };

  const handleItemsChanged = () => {
    // Refresh container data when items change
    // This could trigger a parent component refresh
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={false} // Don't use fullScreen on mobile for better UX
      scroll="paper"
      aria-labelledby="container-detail-dialog-title"
      sx={{
        '& .MuiDialog-paper': {
          margin: { xs: 1, sm: 2 }, // Reduce margins on mobile
          maxHeight: { xs: 'calc(100vh - 16px)', sm: 'calc(100vh - 64px)' }, // Better height management
          height: { xs: 'auto', sm: 'auto' },
        },
      }}
    >
      <DialogTitle 
        id="container-detail-dialog-title"
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: { xs: 'wrap', sm: 'nowrap' }, // Allow wrapping on very small screens
          gap: 1,
          pb: 1, // Reduce bottom padding
        }}
      >
        <Typography 
          variant="h6" 
          component="div"
          sx={{ 
            fontSize: { xs: '1.1rem', sm: '1.25rem' }, // Smaller font on mobile
            minWidth: 0, // Allow text to shrink
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {updatedContainer.name}
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          gap: 0.5, // Smaller gap between buttons
          flexShrink: 0, // Don't shrink the buttons
        }}>
          <Tooltip title="Print Label">
            <IconButton onClick={() => setPrintLabelDialogOpen(true)} size="small" color="secondary">
              <PrintIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Storage Management">
            <IconButton onClick={() => setStorageDialogOpen(true)} size="small" color="secondary">
              <StorageIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Share Container">
            <IconButton onClick={() => setSharingDialogOpen(true)} size="small" color="primary">
              <ShareIcon />
            </IconButton>
          </Tooltip>
          {onPack && (
            <Tooltip title="Pack Items">
              <IconButton onClick={onPack} size="small" color="info">
                <AddIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Edit Container">
            <IconButton onClick={onEdit} size="small">
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Container">
            <IconButton onClick={onDelete} size="small" color="error">
              <DeleteIcon />
            </IconButton>
          </Tooltip>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={handleTabChange} aria-label="container detail tabs">
          <Tab 
            icon={<InfoIcon />} 
            label="Details" 
            iconPosition="start"
          />
          <Tab 
            icon={<ContentsIcon />} 
            label={`Contents (${updatedContainer.itemCount})`}
            iconPosition="start"
          />
        </Tabs>
      </Box>
      
      <DialogContent sx={{ 
        p: 0,
        '&:first-of-type': { pt: 0 }, // Remove default top padding
      }}>
        {/* Details Tab */}
        {currentTab === 0 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}> {/* Responsive padding */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
              {/* Top Row - Container Info and Statistics */}
              <Box sx={{ 
                display: 'flex', 
                gap: { xs: 2, sm: 3 }, 
                flexDirection: { xs: 'column', md: 'row' } 
              }}>
                {/* Container Information */}
                <Box sx={{ flex: 1 }}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Container Details
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Type and Status */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                            Type:
                          </Typography>
                          <Chip
                            label={updatedContainer.type.charAt(0).toUpperCase() + updatedContainer.type.slice(1)}
                            size="small"
                            variant="outlined"
                          />
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                            Status:
                          </Typography>
                          <Chip
                            label={updatedContainer.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            size="small"
                            color={getStatusColor(updatedContainer.status)}
                          />
                        </Box>

                        {/* Size and Color */}
                        {updatedContainer.size && (
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                              Size:
                            </Typography>
                            <Typography variant="body2">{updatedContainer.size}</Typography>
                          </Box>
                        )}

                        {updatedContainer.color && (
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                              Color:
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 20,
                                  height: 20,
                                  backgroundColor: updatedContainer.color,
                                  border: '1px solid #ccc',
                                  borderRadius: 1,
                                }}
                              />
                              <Typography variant="body2">{updatedContainer.color}</Typography>
                            </Box>
                          </Box>
                        )}

                        {/* Weight */}
                        {updatedContainer.weight && updatedContainer.weight > 0 && (
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                              Weight:
                            </Typography>
                            <Typography variant="body2">{updatedContainer.weight}kg</Typography>
                          </Box>
                        )}

                        {/* Location */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                            Location:
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LocationIcon fontSize="small" color="action" />
                            <Typography variant="body2">
                              {location 
                                ? (room ? `${location.name} > ${room.name}` : location.name)
                                : 'No location set'}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Contents Summary */}
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Contents:
                          </Typography>
                          <Typography variant="body2">
                            {updatedContainer.contentsSummary || 'No contents summary provided'}
                          </Typography>
                        </Box>

                        {/* Handling Flags */}
                        {updatedContainer.handlingFlags.length > 0 && (
                          <Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Handling Requirements:
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {updatedContainer.handlingFlags.map((flag) => (
                                <HandlingFlagChip
                                  key={flag}
                                  flag={flag}
                                  size="small"
                                  showIcon={true}
                                  showLabel={true}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}

                        {/* Description */}
                        {updatedContainer.description && (
                          <Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Description:
                            </Typography>
                            <Typography variant="body2">{updatedContainer.description}</Typography>
                          </Box>
                        )}

                        {/* Container Photos */}
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Photos:
                          </Typography>
                          <ContainerPhotoUpload
                            containerId={updatedContainer.id}
                            inventoryId={inventoryId}
                            photos={updatedContainer.photos || []}
                            onPhotosUpdated={(photos) => {
                              setUpdatedContainer(prev => ({ ...prev, photos }));
                            }}
                          />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>

                {/* Statistics */}
                <Box sx={{ flex: 1 }}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Statistics
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InventoryIcon color="action" />
                          <Typography variant="body2">
                            <strong>{updatedContainer.itemCount}</strong> items
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <MoneyIcon color="action" />
                          <Typography variant="body2">
                            <strong>£{updatedContainer.estimatedValue.toFixed(2)}</strong> total value
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CalendarIcon color="action" />
                          <Typography variant="body2">
                            Created {formatDate(updatedContainer.createdAt)}
                          </Typography>
                        </Box>

                        {updatedContainer.storageStartDate && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CalendarIcon color="action" />
                            <Typography variant="body2">
                              In storage since {formatDate(updatedContainer.storageStartDate)}
                            </Typography>
                          </Box>
                        )}

                        {updatedContainer.storageRate && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <MoneyIcon color="action" />
                            <Typography variant="body2">
                              Storage: <strong>${updatedContainer.storageRate}/month</strong>
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* Contents Tab */}
        {currentTab === 1 && (
          <ContainerContentsView
            container={updatedContainer}
            onContainerUpdated={handleContainerUpdated}
            onItemsChanged={handleItemsChanged}
          />
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {/* Print Label Dialog */}
      <Dialog
        open={printLabelDialogOpen}
        onClose={() => setPrintLabelDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Print Label - {updatedContainer.name}</DialogTitle>
        <DialogContent>
          <PrintableLabel
            container={updatedContainer}
            qrCodeId={updatedContainer.id}
            size="medium"
            locationName={location?.name}
            roomName={room?.name}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintLabelDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Container Sharing Dialog */}
      <ContainerSharingDialog
        open={sharingDialogOpen}
        onClose={() => setSharingDialogOpen(false)}
        container={updatedContainer}
        inventoryId={inventoryId}
      />

      {/* Storage Management Dialog */}
      <StorageManagementDialog
        open={storageDialogOpen}
        onClose={() => setStorageDialogOpen(false)}
        container={updatedContainer}
        inventoryId={inventoryId}
        onStorageUpdated={() => {
          // Reload container data after storage update
          // The parent component should handle refreshing
        }}
      />
    </Dialog>
  );
}