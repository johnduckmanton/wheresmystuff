import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Chip,
  LinearProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Search as SearchIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLoading } from '../contexts/LoadingContext';
import { useMobileDetection } from '../hooks/useMobileDetection';
import { useSwipeGestures } from '../hooks/useSwipeGestures';
import apiClient from '../services/api';
import PackingItemSearch, { useFavoriteItems } from './PackingItemSearch';
import type { Container, Thing, Category, Location, Room } from '../types/entities';

interface PackingInterfaceProps {
  container: Container;
  onClose: () => void;
  onItemsAdded: (itemIds: string[]) => void;
  onContainerUpdated?: (container: Container) => void;
}

interface PackingItem extends Thing {
  selected: boolean;
  alreadyPacked: boolean;
  currentContainer?: string;
}

export default function PackingInterface({
  container,
  onClose,
  onItemsAdded,
  onContainerUpdated,
}: PackingInterfaceProps) {
  const { currentInventory } = useInventory();
  const { showSuccess, showError } = useNotification();
  const { setLoading } = useLoading();
  const { isMobile } = useMobileDetection();

  // State for items and filtering
  const [allItems, setAllItems] = useState<Thing[]>([]);
  const [packingItems, setPackingItems] = useState<PackingItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<Thing[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // UI state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [loading, setLocalLoading] = useState(false);

  // Favorites hook
  const { toggleFavorite, isFavorite } = useFavoriteItems();

  // Load data when component mounts
  useEffect(() => {
    if (currentInventory) {
      loadData();
    }
  }, [currentInventory]);

  const loadData = async () => {
    if (!currentInventory) return;

    setLocalLoading(true);
    try {
      const [itemsData, categoriesData, locationsData, roomsData] = await Promise.all([
        apiClient.getThings(currentInventory.id),
        apiClient.getCategories(currentInventory.id),
        apiClient.getLocations(currentInventory.id),
        apiClient.getRooms(undefined, currentInventory.id),
      ]);

      setAllItems(itemsData);
      setCategories(categoriesData);
      setLocations(locationsData);
      setRooms(roomsData);

      // Transform items for packing interface
      const packingItemsData: PackingItem[] = itemsData.map(item => {
        const extendedItem = item as any;
        const alreadyPacked = !!extendedItem.containerId;

        
        return {
          ...item,
          selected: false,
          alreadyPacked,
          currentContainer: extendedItem.containerId,
        };
      });

      setPackingItems(packingItemsData);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Failed to load items for packing');
    } finally {
      setLocalLoading(false);
    }
  };

  // Create lookup maps
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(cat => map.set(cat.id, cat));
    return map;
  }, [categories]);

  const locationMap = useMemo(() => {
    const map = new Map<string, Location>();
    locations.forEach(loc => map.set(loc.id, loc));
    return map;
  }, [locations]);

  const roomMap = useMemo(() => {
    const map = new Map<string, Room>();
    rooms.forEach(room => map.set(room.id, room));
    return map;
  }, [rooms]);

  // Transform filtered items to packing items
  const packingFilteredItems = useMemo(() => {
    return filteredItems.map(item => {
      const extendedItem = item as any;
      const alreadyPacked = !!extendedItem.containerId;
      
      return {
        ...item,
        selected: selectedItems.has(item.id),
        alreadyPacked,
        currentContainer: extendedItem.containerId,
      } as PackingItem;
    });
  }, [filteredItems, selectedItems]);

  // Handle item selection
  const handleItemToggle = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  // Handle select all/none
  const handleSelectAll = () => {
    const availableItems = packingFilteredItems.filter(item => 
      !item.alreadyPacked || item.currentContainer === container.id
    );
    const allSelected = availableItems.every(item => selectedItems.has(item.id));
    
    if (allSelected) {
      // Deselect all
      const newSelected = new Set(selectedItems);
      availableItems.forEach(item => newSelected.delete(item.id));
      setSelectedItems(newSelected);
    } else {
      // Select all available
      const newSelected = new Set(selectedItems);
      availableItems.forEach(item => newSelected.add(item.id));
      setSelectedItems(newSelected);
    }
  };

  // Handle packing items
  const handlePackItems = () => {
    if (selectedItems.size === 0) {
      showError('Please select items to pack');
      return;
    }
    setConfirmDialogOpen(true);
  };

  const confirmPackItems = async () => {
    if (!currentInventory) return;

    setLoading(true);
    try {
      // Call packing API to add items to container
      const selectedItemIds = Array.from(selectedItems);
      
      // Call the real API to pack items
      const result = await apiClient.addItemsToContainer(container.id, currentInventory.id, selectedItemIds);
      
      // Reload data to get updated item states
      await loadData();
      
      // Clear selection
      setSelectedItems(new Set());
      
      // Notify parent components with the updated container
      onItemsAdded(selectedItemIds);
      if (onContainerUpdated && result.container) {
        onContainerUpdated(result.container);
      }
      
      showSuccess(`Successfully packed ${selectedItemIds.length} items into ${container.name}`);
      setConfirmDialogOpen(false);
    } catch (error) {
      console.error('Error packing items:', error);
      showError('Failed to pack items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle removing items from container
  const handleRemoveItems = async () => {
    const itemsToRemove = Array.from(selectedItems).filter(itemId => {
      const item = packingItems.find(i => i.id === itemId);
      return item?.currentContainer === container.id;
    });

    if (itemsToRemove.length === 0) {
      showError('No items selected for removal');
      return;
    }

    if (!currentInventory) return;

    setLoading(true);
    try {
      // Call the real API to remove items from container
      const result = await apiClient.removeItemsFromContainer(container.id, currentInventory.id, itemsToRemove);
      
      // Reload data to get updated item states
      await loadData();
      
      // Clear selection
      setSelectedItems(new Set());
      
      // Notify parent components with the updated container
      if (onContainerUpdated && result.container) {
        onContainerUpdated(result.container);
      }
      
      showSuccess(`Removed ${itemsToRemove.length} items from ${container.name}`);
    } catch (error) {
      console.error('Error removing items:', error);
      showError('Failed to remove items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalItems = packingFilteredItems.length;
    // Use the container's actual itemCount instead of counting local items
    const packedInContainer = container.itemCount || 0;
    const selectedCount = selectedItems.size;
    const availableForPacking = packingFilteredItems.filter(item => 
      !item.alreadyPacked || item.currentContainer === container.id
    ).length;

    return {
      totalItems,
      packedInContainer,
      selectedCount,
      availableForPacking,
    };
  }, [packingFilteredItems, selectedItems, container.id, container.itemCount]);

  const getItemLocationName = (item: Thing) => {
    if (!item.locationId) return 'No location';
    const location = locationMap.get(item.locationId);
    const room = item.roomId ? roomMap.get(item.roomId) : null;
    return room ? `${location?.name || 'Unknown'} - ${room.name}` : location?.name || 'Unknown';
  };

  const getItemCategoryName = (item: Thing) => {
    if (!item.categoryId) return 'No category';
    return categoryMap.get(item.categoryId)?.name || 'Unknown';
  };

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      pb: isMobile ? 8 : 0, // Space for mobile action bar
    }}>
      {/* Header */}
      <Box sx={{ 
        p: isMobile ? 2 : 3, 
        borderBottom: 1, 
        borderColor: 'divider',
        position: isMobile ? 'sticky' : 'static',
        top: 0,
        backgroundColor: 'background.paper',
        zIndex: 100,
      }}>
        <Typography 
          variant={isMobile ? 'h6' : 'h5'} 
          gutterBottom
          className={isMobile ? 'mobile-title' : ''}
        >
          Pack Items into {container.name}
        </Typography>
        
        {/* Statistics */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Chip
            icon={<InventoryIcon />}
            label={`${stats.packedInContainer} items in container`}
            color="success"
            variant="outlined"
          />
          <Chip
            icon={<SearchIcon />}
            label={`${stats.totalItems} items shown`}
            color="info"
            variant="outlined"
          />
          <Chip
            icon={<CheckCircleIcon />}
            label={`${stats.selectedCount} selected`}
            color="primary"
            variant={stats.selectedCount > 0 ? 'filled' : 'outlined'}
          />
        </Box>

        {/* Progress indicator */}
        {stats.availableForPacking > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Container capacity: {stats.packedInContainer} items
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min((stats.packedInContainer / Math.max(stats.availableForPacking, 1)) * 100, 100)}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}
      </Box>

      {/* Advanced Search and Filters */}
      <PackingItemSearch
        items={allItems}
        categories={categories}
        locations={locations}
        rooms={rooms}
        onFilteredItemsChange={setFilteredItems}
      />

      {/* Items List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <Typography>Loading items...</Typography>
          </Box>
        ) : packingFilteredItems.length === 0 ? (
          <Alert severity="info">
            No items found matching your filters. Try adjusting your search criteria.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Select All/None */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={stats.selectedCount > 0}
                    indeterminate={stats.selectedCount > 0 && stats.selectedCount < stats.availableForPacking}
                    onChange={handleSelectAll}
                  />
                }
                label={`Select All Available (${stats.availableForPacking} items)`}
              />
            </Box>

            {/* Items */}
            {packingFilteredItems.map((item) => (
              <PackingItemCard
                key={item.id}
                item={item}
                selected={selectedItems.has(item.id)}
                onToggle={() => handleItemToggle(item.id)}
                onToggleFavorite={() => toggleFavorite(item.id)}
                isFavorite={isFavorite(item.id)}
                locationName={getItemLocationName(item)}
                categoryName={getItemCategoryName(item)}
                containerName={container.name}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Action Buttons */}
      <Box 
        sx={{ 
          p: isMobile ? 2 : 3, 
          borderTop: 1, 
          borderColor: 'divider', 
          display: 'flex', 
          gap: 2, 
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
          position: isMobile ? 'fixed' : 'static',
          bottom: isMobile ? 0 : 'auto',
          left: isMobile ? 0 : 'auto',
          right: isMobile ? 0 : 'auto',
          backgroundColor: 'background.paper',
          zIndex: 1000,
          boxShadow: isMobile ? '0 -2px 8px rgba(0,0,0,0.1)' : 'none',
        }}
        className={isMobile ? 'mobile-action-bar' : ''}
      >
        {!isMobile && (
          <Button variant="outlined" onClick={onClose}>
            Close
          </Button>
        )}
        
        <Box sx={{ 
          display: 'flex', 
          gap: isMobile ? 1 : 2,
          flexDirection: isMobile ? 'column' : 'row',
          width: isMobile ? '100%' : 'auto',
        }}>
          {stats.selectedCount > 0 && (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<RemoveIcon />}
                onClick={handleRemoveItems}
                disabled={!Array.from(selectedItems).some(itemId => {
                  const item = packingItems.find(i => i.id === itemId);
                  return item?.currentContainer === container.id;
                })}
                fullWidth={isMobile}
                className={isMobile ? 'mobile-action-button' : ''}
              >
                Remove from Container
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handlePackItems}
                disabled={!Array.from(selectedItems).some(itemId => {
                  const item = packingItems.find(i => i.id === itemId);
                  return !item?.alreadyPacked || item?.currentContainer === container.id;
                })}
                fullWidth={isMobile}
                className={isMobile ? 'mobile-action-button' : ''}
              >
                Pack Selected ({stats.selectedCount})
              </Button>
            </>
          )}
          {isMobile && (
            <Button 
              variant="outlined" 
              onClick={onClose}
              fullWidth
              className="mobile-action-button"
            >
              Close
            </Button>
          )}
        </Box>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Packing</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to pack {selectedItems.size} items into "{container.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This will update the location of these items to match the container's location.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmPackItems} variant="contained" autoFocus>
            Pack Items
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}



// Individual item card component
interface PackingItemCardProps {
  item: PackingItem;
  selected: boolean;
  onToggle: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  locationName: string;
  categoryName: string;
  containerName: string;
}

function PackingItemCard({
  item,
  selected,
  onToggle,
  onToggleFavorite,
  isFavorite,
  locationName,
  categoryName,
  containerName,
}: PackingItemCardProps) {
  const { isMobile } = useMobileDetection();
  const isDisabled = item.alreadyPacked && item.currentContainer !== containerName;
  const isInCurrentContainer = item.currentContainer === containerName;

  // Swipe gesture for mobile quick actions
  const swipeRef = useSwipeGestures({
    onSwipeRight: () => {
      if (!isDisabled) {
        onToggle();
      }
    },
    threshold: 50,
  });

  return (
    <Card
      ref={isMobile ? swipeRef as any : undefined}
      sx={{
        opacity: isDisabled ? 0.6 : 1,
        border: selected ? 2 : 1,
        borderColor: selected ? 'primary.main' : 'divider',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        borderRadius: isMobile ? 2 : 1,
        '&:hover': isDisabled ? {} : {
          borderColor: 'primary.main',
          boxShadow: 1,
        },
        '&:active': isMobile && !isDisabled ? {
          transform: 'scale(0.98)',
          transition: 'transform 0.1s ease',
        } : {},
      }}
      onClick={isDisabled ? undefined : onToggle}
      className={isMobile ? 'mobile-packing-item' : ''}
    >
      <CardContent sx={{ py: isMobile ? 1.5 : 2, px: isMobile ? 2 : 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 1.5 : 2 }}>
          {/* Checkbox */}
          <Checkbox
            checked={selected}
            disabled={isDisabled}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            sx={{
              p: isMobile ? 0.5 : 1,
              '& .MuiSvgIcon-root': {
                fontSize: isMobile ? 20 : 24,
              },
            }}
            className={isMobile ? 'mobile-packing-item-checkbox' : ''}
          />

          {/* Item Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                {item.name}
              </Typography>
              
              {/* Favorite button */}
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                sx={{ p: 0.5 }}
              >
                {isFavorite ? (
                  <StarIcon fontSize="small" color="primary" />
                ) : (
                  <StarBorderIcon fontSize="small" />
                )}
              </IconButton>
              
              {/* Status indicators */}
              {isInCurrentContainer && (
                <Chip
                  label="In Container"
                  size="small"
                  color="success"
                  icon={<CheckCircleIcon />}
                />
              )}
              {item.alreadyPacked && !isInCurrentContainer && (
                <Chip
                  label="Already Packed"
                  size="small"
                  color="warning"
                  icon={<WarningIcon />}
                />
              )}
            </Box>

            {item.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {item.description}
              </Typography>
            )}

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                📍 {locationName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                🏷️ {categoryName}
              </Typography>
              {item.purchasePrice && (
                <Typography variant="caption" color="text.secondary">
                  💰 ${item.purchasePrice.toFixed(2)}
                </Typography>
              )}
            </Box>

            {item.alreadyPacked && item.currentContainer && item.currentContainer !== containerName && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
                Currently in: {item.currentContainer}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}