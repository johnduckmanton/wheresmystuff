import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Avatar,
  IconButton,
  Tooltip,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Divider,
  Alert,
  Skeleton,
  Menu,
  MenuItem as MenuItemComponent,
  ListItemIcon,
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  SwapHoriz as TransferIcon,
  MoreVert as MoreIcon,
  AttachMoney as MoneyIcon,
  Category as CategoryIcon,
  Photo as PhotoIcon,
  MoveUp as MoveUpIcon,
  MoveDown as MoveDownIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
// Removed drag and drop for React 19 compatibility
import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import apiClient from '../services/api';
import PhotoThumbnail from './PhotoThumbnail';
import type { Container, Category, ThingWithContainer } from '../types/entities';

interface ContainerContentsViewProps {
  container: Container;
  onContainerUpdated?: (container: Container) => void;
  onItemsChanged?: () => void;
}

interface ContainerContents {
  container: Container;
  items: ThingWithContainer[];
  itemCount: number;
  totalValue: number;
  categories: number;
  summary: {
    itemCount: number;
    totalValue: number;
    categoriesCount: number;
    hasPhotos: boolean;
  };
}

interface TransferDialogState {
  open: boolean;
  selectedItems: string[];
  targetContainerId: string;
}

export default function ContainerContentsView({
  container,
  onContainerUpdated,
  onItemsChanged,
}: ContainerContentsViewProps) {
  const { currentInventory } = useInventory();
  const { showSuccess, showError } = useNotification();
  
  // State management
  const [contents, setContents] = useState<ContainerContents | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [categories, setCategories] = useState<Category[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  
  // Dialog states
  const [transferDialog, setTransferDialog] = useState<TransferDialogState>({
    open: false,
    selectedItems: [],
    targetContainerId: '',
  });
  const [removeDialog, setRemoveDialog] = useState({
    open: false,
    selectedItems: [] as string[],
  });
  
  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuItemId, setMenuItemId] = useState<string | null>(null);

  // Load container contents on mount and when container changes
  useEffect(() => {
    if (container && currentInventory) {
      loadContainerContents();
      loadSupportingData();
    }
  }, [container, currentInventory]);

  const loadContainerContents = async () => {
    if (!currentInventory) return;

    setLoading(true);
    try {
      const result = await apiClient.getContainerContents(container.id, currentInventory.id);
      setContents(result);
    } catch (error) {
      console.error('Error loading container contents:', error);
      showError('Failed to load container contents');
    } finally {
      setLoading(false);
    }
  };

  const loadSupportingData = async () => {
    if (!currentInventory) return;

    try {
      const [categoriesData, containersResponse] = await Promise.all([
        apiClient.getCategories(currentInventory.id),
        apiClient.getContainers(currentInventory.id),
      ]);

      setCategories(categoriesData);
      
      // Handle both array response (old format) and object response (new format)
      let containersData: Container[];
      if (Array.isArray(containersResponse)) {
        containersData = containersResponse;
      } else if (containersResponse && typeof containersResponse === 'object' && 'containers' in containersResponse) {
        containersData = containersResponse.containers || [];
      } else {
        containersData = [];
      }
      
      setContainers(containersData.filter(c => c.id !== container.id)); // Exclude current container
    } catch (error) {
      console.error('Error loading supporting data:', error);
    }
  };



  // Create lookup maps for efficient data access
  const categoryMap = new Map(categories.map(cat => [cat.id, cat]));

  // Handle item selection
  const handleItemSelect = (itemId: string, selected: boolean) => {
    const newSelection = new Set(selectedItems);
    if (selected) {
      newSelection.add(itemId);
    } else {
      newSelection.delete(itemId);
    }
    setSelectedItems(newSelection);
  };

  const handleSelectAll = () => {
    if (!contents) return;
    
    if (selectedItems.size === contents.items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(contents.items.map(item => item.id)));
    }
  };

  // Handle item removal
  const handleRemoveItems = async (itemIds: string[]) => {
    if (!currentInventory || itemIds.length === 0) return;

    try {
      const result = await apiClient.removeItemsFromContainer(container.id, currentInventory.id, itemIds);
      showSuccess(`Successfully removed ${itemIds.length} item(s) from container`);
      await loadContainerContents();
      setSelectedItems(new Set());
      if (onItemsChanged) onItemsChanged();
      if (onContainerUpdated) onContainerUpdated(result.container);
    } catch (error) {
      console.error('Error removing items:', error);
      showError(error instanceof Error ? error.message : 'Failed to remove items');
    }
  };

  // Handle item transfer between containers
  const handleTransferItems = async (itemIds: string[], targetContainerId: string) => {
    if (!currentInventory || itemIds.length === 0) return;

    try {
      const result = await apiClient.transferItemsBetweenContainers(
        container.id,
        targetContainerId,
        currentInventory.id,
        itemIds
      );
      
      const targetContainer = containers.find(c => c.id === targetContainerId);
      showSuccess(`Successfully transferred ${itemIds.length} item(s) to ${targetContainer?.name || 'target container'}`);
      await loadContainerContents();
      setSelectedItems(new Set());
      if (onItemsChanged) onItemsChanged();
      if (onContainerUpdated) onContainerUpdated(result.sourceContainer);
    } catch (error) {
      console.error('Error transferring items:', error);
      showError(error instanceof Error ? error.message : 'Failed to transfer items');
    }
  };

  // Handle item reordering
  const handleMoveItem = (itemId: string, direction: 'up' | 'down') => {
    if (!contents) return;

    const items = Array.from(contents.items);
    const currentIndex = items.findIndex(item => item.id === itemId);
    
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= items.length) return;

    // Swap items
    [items[currentIndex], items[newIndex]] = [items[newIndex], items[currentIndex]];

    // Update local state immediately for better UX
    setContents({
      ...contents,
      items,
    });

    // TODO: Implement backend API for item reordering
    // For now, we'll just update the local state
    showSuccess('Item order updated');
  };

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, itemId: string) => {
    setAnchorEl(event.currentTarget);
    setMenuItemId(itemId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuItemId(null);
  };

  // Dialog handlers
  const openTransferDialog = (itemIds: string[]) => {
    setTransferDialog({
      open: true,
      selectedItems: itemIds,
      targetContainerId: '',
    });
  };

  const openRemoveDialog = (itemIds: string[]) => {
    setRemoveDialog({
      open: true,
      selectedItems: itemIds,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="text" height={40} sx={{ mb: 1 }} />
        <Skeleton variant="text" height={40} sx={{ mb: 1 }} />
        <Skeleton variant="text" height={40} />
      </Box>
    );
  }

  if (!contents) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error">
          Failed to load container contents. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Container Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Container Summary
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon color="primary" />
              <Typography variant="body1">
                <strong>{contents.itemCount}</strong> items
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MoneyIcon color="primary" />
              <Typography variant="body1">
                <strong>{formatCurrency(contents.totalValue)}</strong> total value
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CategoryIcon color="primary" />
              <Typography variant="body1">
                <strong>{contents.categories}</strong> categories
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Action Bar */}
      {contents.items.length > 0 && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            onClick={handleSelectAll}
            size="small"
          >
            {selectedItems.size === contents.items.length ? 'Deselect All' : 'Select All'}
          </Button>
          
          {selectedItems.size > 0 && (
            <>
              <Button
                variant="contained"
                color="primary"
                startIcon={<TransferIcon />}
                onClick={() => openTransferDialog(Array.from(selectedItems))}
                size="small"
              >
                Transfer ({selectedItems.size})
              </Button>
              
              <Button
                variant="contained"
                color="error"
                startIcon={<RemoveIcon />}
                onClick={() => openRemoveDialog(Array.from(selectedItems))}
                size="small"
              >
                Remove ({selectedItems.size})
              </Button>
            </>
          )}
          
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            {selectedItems.size} of {contents.items.length} selected
          </Typography>
        </Box>
      )}

      {/* Items List */}
      {contents.items.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <InventoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              This container is empty
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use the packing interface to add items to this container
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Contents ({contents.items.length} items)
            </Typography>
            
            <List dense>
              {contents.items.map((item, index) => (
                <React.Fragment key={item.id}>
                  <ListItem
                    sx={{
                      border: selectedItems.has(item.id) ? '2px solid' : '1px solid',
                      borderColor: selectedItems.has(item.id) ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      mb: 1,
                      bgcolor: selectedItems.has(item.id) ? 'primary.50' : 'background.paper',
                    }}
                  >
                    {/* Reorder Controls */}
                    <Box sx={{ mr: 1, display: 'flex', flexDirection: 'column' }}>
                      <Tooltip title="Move up">
                        <IconButton
                          size="small"
                          onClick={() => handleMoveItem(item.id, 'up')}
                          disabled={index === 0}
                        >
                          <MoveUpIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Move down">
                        <IconButton
                          size="small"
                          onClick={() => handleMoveItem(item.id, 'down')}
                          disabled={index === contents.items.length - 1}
                        >
                          <MoveDownIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    
                    {/* Selection Checkbox */}
                    <Box sx={{ mr: 2 }}>
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={(e) => handleItemSelect(item.id, e.target.checked)}
                      />
                    </Box>
                    
                    {/* Item Avatar */}
                    <ListItemAvatar>
                      <PhotoThumbnail
                        photoKey={item.photos?.[0]}
                        altText={item.name}
                        variant="avatar"
                        size={40}
                        showPopup={true}
                      />
                    </ListItemAvatar>
                    
                    {/* Item Details */}
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" fontWeight="medium">
                            {item.name}
                          </Typography>
                          {item.categoryId && (
                            <Chip
                              label={categoryMap.get(item.categoryId)?.name || 'Unknown'}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          {item.description && (
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              {item.description}
                            </Typography>
                          )}
                          
                          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                            {item.purchasePrice && (
                              <Typography variant="caption" color="text.secondary">
                                Value: {formatCurrency(item.purchasePrice)}
                              </Typography>
                            )}
                            
                            {item.datePurchased && (
                              <Typography variant="caption" color="text.secondary">
                                Purchased: {formatDate(item.datePurchased)}
                              </Typography>
                            )}
                            
                            {item.packedAt && (
                              <Typography variant="caption" color="text.secondary">
                                Packed: {formatDate(item.packedAt)}
                              </Typography>
                            )}
                            
                            {item.serialNumber && (
                              <Typography variant="caption" color="text.secondary">
                                S/N: {item.serialNumber}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      }
                    />
                    
                    {/* Item Actions */}
                    <ListItemSecondaryAction>
                      <Tooltip title="More actions">
                        <IconButton
                          edge="end"
                          onClick={(e) => handleMenuOpen(e, item.id)}
                        >
                          <MoreIcon />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                  
                  {index < contents.items.length - 1 && <Divider variant="inset" />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Item Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItemComponent onClick={() => {
          if (menuItemId) openTransferDialog([menuItemId]);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <TransferIcon fontSize="small" />
          </ListItemIcon>
          Transfer to another container
        </MenuItemComponent>
        
        <MenuItemComponent onClick={() => {
          if (menuItemId) openRemoveDialog([menuItemId]);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <RemoveIcon fontSize="small" />
          </ListItemIcon>
          Remove from container
        </MenuItemComponent>
      </Menu>

      {/* Transfer Dialog */}
      <Dialog
        open={transferDialog.open}
        onClose={() => setTransferDialog({ ...transferDialog, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Transfer Items to Another Container
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Select the target container for {transferDialog.selectedItems.length} item(s):
          </Typography>
          
          <TextField
            select
            fullWidth
            label="Target Container"
            value={transferDialog.targetContainerId}
            onChange={(e) => setTransferDialog({ ...transferDialog, targetContainerId: e.target.value })}
            sx={{ mt: 2 }}
          >
            {containers.map((cont) => (
              <MenuItem key={cont.id} value={cont.id}>
                {cont.name} ({cont.itemCount} items)
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialog({ ...transferDialog, open: false })}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              handleTransferItems(transferDialog.selectedItems, transferDialog.targetContainerId);
              setTransferDialog({ open: false, selectedItems: [], targetContainerId: '' });
            }}
            variant="contained"
            disabled={!transferDialog.targetContainerId}
          >
            Transfer Items
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Dialog */}
      <Dialog
        open={removeDialog.open}
        onClose={() => setRemoveDialog({ ...removeDialog, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Remove Items from Container</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to remove {removeDialog.selectedItems.length} item(s) from this container?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The items will be returned to their previous locations or the container's current location.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveDialog({ ...removeDialog, open: false })}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              handleRemoveItems(removeDialog.selectedItems);
              setRemoveDialog({ open: false, selectedItems: [] });
            }}
            variant="contained"
            color="error"
          >
            Remove Items
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}