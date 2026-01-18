import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  LinearProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Search as SearchIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  FilterList as FilterListIcon,
  SelectAll as SelectAllIcon,
  DeselectOutlined as DeselectIcon,
} from '@mui/icons-material';
import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLoading } from '../contexts/LoadingContext';
import apiClient from '../services/api';
import QuickFilters from './QuickFilters';
import type { Container, Thing, Category, Location, Room, Person } from '../types/entities';

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

  // State for items and filtering
  const [allItems, setAllItems] = useState<Thing[]>([]);
  const [packingItems, setPackingItems] = useState<PackingItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<Thing[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);

  // Filter state
  const [showQuickFilters, setShowQuickFilters] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(undefined);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // UI state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [loading, setLocalLoading] = useState(false);

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
      const [itemsData, categoriesData, locationsData, roomsData, peopleData, containersData] = await Promise.all([
        apiClient.getThings(currentInventory.id),
        apiClient.getCategories(currentInventory.id),
        apiClient.getLocations(currentInventory.id),
        apiClient.getRooms(undefined, currentInventory.id),
        apiClient.getPeople(currentInventory.id),
        apiClient.getContainers(currentInventory.id),
      ]);

      setAllItems(itemsData);
      setCategories(categoriesData);
      setLocations(locationsData);
      setRooms(roomsData);
      setPeople(peopleData);
      // Handle containers response which might be paginated
      const containersList = Array.isArray(containersData) ? containersData : containersData.containers;
      setContainers(containersList);

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
      setFilteredItems(itemsData); // Initialize filtered items
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Failed to load items for packing');
    } finally {
      setLocalLoading(false);
    }
  };

  // Apply filters
  useEffect(() => {
    applyFilters();
  }, [allItems, searchQuery, selectedCategoryId, selectedLocationId, selectedRoomId, selectedOwnerId, selectedTags]);

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

  const containerMap = useMemo(() => {
    const map = new Map<string, Container>();
    containers.forEach(cont => map.set(cont.id, cont));
    return map;
  }, [containers]);

  const applyFilters = () => {
    let filtered = [...allItems];

    // Apply text search
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(thing =>
        thing.name.toLowerCase().includes(searchLower) ||
        (thing.description && thing.description.toLowerCase().includes(searchLower)) ||
        (thing.make && thing.make.toLowerCase().includes(searchLower)) ||
        (thing.model && thing.model.toLowerCase().includes(searchLower)) ||
        (thing.serialNumber && thing.serialNumber.toLowerCase().includes(searchLower))
      );
    }

    // Apply category filter
    if (selectedCategoryId) {
      if (selectedCategoryId === 'uncategorized') {
        filtered = filtered.filter(thing => !thing.categoryId);
      } else {
        filtered = filtered.filter(thing => thing.categoryId === selectedCategoryId);
      }
    }

    // Apply location filter
    if (selectedLocationId) {
      if (selectedLocationId === 'unlocated') {
        filtered = filtered.filter(thing => !thing.locationId);
      } else {
        filtered = filtered.filter(thing => thing.locationId === selectedLocationId);
      }
    }

    // Apply room filter
    if (selectedRoomId) {
      filtered = filtered.filter(thing => thing.roomId === selectedRoomId);
    }

    // Apply owner filter
    if (selectedOwnerId) {
      if (selectedOwnerId === 'unowned') {
        filtered = filtered.filter(thing => !thing.ownerId);
      } else {
        filtered = filtered.filter(thing => thing.ownerId === selectedOwnerId);
      }
    }

    // Apply tag filter (AND mode)
    if (selectedTags.length > 0) {
      filtered = filtered.filter(thing => {
        if (!thing.tags || thing.tags.length === 0) return false;
        return selectedTags.every(selectedTag =>
          thing.tags!.some(thingTag =>
            thingTag.toLowerCase() === selectedTag.toLowerCase()
          )
        );
      });
    }

    setFilteredItems(filtered);
  };

  const handleClearFilters = () => {
    setSelectedCategoryId(undefined);
    setSelectedLocationId(undefined);
    setSelectedRoomId(undefined);
    setSelectedOwnerId(undefined);
    setSelectedTags([]);
    setSearchQuery('');
  };

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
    const newSelected = new Set(selectedItems);
    availableItems.forEach(item => newSelected.add(item.id));
    setSelectedItems(newSelected);
  };

  const handleDeselectAll = () => {
    setSelectedItems(new Set());
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

  const getContainerName = (containerId: string) => {
    return containerMap.get(containerId)?.name || containerId;
  };

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Main Content Area */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Quick Filters Sidebar */}
        <Box
          sx={{
            width: showQuickFilters ? 280 : 0,
            overflow: 'hidden',
            transition: 'width 0.3s ease-in-out',
            flexShrink: 0,
            borderRight: showQuickFilters ? '1px solid' : 'none',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {showQuickFilters && (
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <QuickFilters
                things={allItems}
                categories={categories}
                locations={locations}
                rooms={rooms}
                people={people}
                selectedCategoryId={selectedCategoryId}
                selectedLocationId={selectedLocationId}
                selectedRoomId={selectedRoomId}
                selectedOwnerId={selectedOwnerId}
                selectedTags={selectedTags}
                onCategoryFilter={setSelectedCategoryId}
                onLocationFilter={setSelectedLocationId}
                onRoomFilter={setSelectedRoomId}
                onOwnerFilter={setSelectedOwnerId}
                onTagFilter={setSelectedTags}
                onClearFilters={handleClearFilters}
              />
            </Box>
          )}
        </Box>

        {/* Items List Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Header with Stats */}
          <Box sx={{ 
            p: 3, 
            borderBottom: 1, 
            borderColor: 'divider',
          }}>
            <Typography variant="h5" gutterBottom>
              Pack Items into {container.name}
            </Typography>
            
            {/* Statistics */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Chip
                icon={<InventoryIcon />}
                label={`${stats.packedInContainer} items in container`}
                color="success"
                variant="outlined"
                size="small"
              />
              <Chip
                icon={<SearchIcon />}
                label={`${stats.totalItems} items shown`}
                color="info"
                variant="outlined"
                size="small"
              />
              <Chip
                icon={<CheckCircleIcon />}
                label={`${stats.selectedCount} selected`}
                color="primary"
                variant={stats.selectedCount > 0 ? 'filled' : 'outlined'}
                size="small"
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

          {/* Search Bar and Controls */}
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <Tooltip title={showQuickFilters ? "Hide Filters" : "Show Filters"}>
                <IconButton
                  onClick={() => setShowQuickFilters(!showQuickFilters)}
                  color={showQuickFilters ? 'primary' : 'default'}
                  size="small"
                  sx={{ flexShrink: 0 }}
                >
                  <FilterListIcon />
                </IconButton>
              </Tooltip>
              <TextField
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                fullWidth
                size="small"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {selectedItems.size > 0 ? (
                <Chip
                  label={`${selectedItems.size} selected`}
                  color="primary"
                  size="small"
                  onDelete={handleDeselectAll}
                />
              ) : (
                <Box />
              )}
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button
                  onClick={handleSelectAll}
                  disabled={stats.availableForPacking === 0}
                  size="small"
                  startIcon={<SelectAllIcon />}
                >
                  Select All
                </Button>
                <Button
                  onClick={handleDeselectAll}
                  disabled={selectedItems.size === 0}
                  size="small"
                  startIcon={<DeselectIcon />}
                >
                  Deselect
                </Button>
              </Box>
            </Box>
          </Box>

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
                {/* Items */}
                {packingFilteredItems.map((item) => (
                  <PackingItemCard
                    key={item.id}
                    item={item}
                    selected={selectedItems.has(item.id)}
                    onToggle={() => handleItemToggle(item.id)}
                    locationName={getItemLocationName(item)}
                    categoryName={getItemCategoryName(item)}
                    containerName={container.name}
                    currentContainerName={item.currentContainer ? getContainerName(item.currentContainer) : undefined}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Action Buttons */}
      <Box 
        sx={{ 
          p: 3, 
          borderTop: 1, 
          borderColor: 'divider', 
          display: 'flex', 
          gap: 2, 
          justifyContent: 'space-between',
          backgroundColor: 'background.paper',
        }}
      >
        <Button variant="outlined" onClick={onClose}>
          Close
        </Button>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
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
              >
                Pack Selected ({stats.selectedCount})
              </Button>
            </>
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
  locationName: string;
  categoryName: string;
  containerName: string;
  currentContainerName?: string;
}

function PackingItemCard({
  item,
  selected,
  onToggle,
  locationName,
  categoryName,
  containerName,
  currentContainerName,
}: PackingItemCardProps) {
  const isDisabled = item.alreadyPacked && item.currentContainer !== containerName;
  const isInCurrentContainer = item.currentContainer === containerName;

  return (
    <Card
      sx={{
        opacity: isDisabled ? 0.6 : 1,
        border: selected ? 2 : 1,
        borderColor: selected ? 'primary.main' : 'divider',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        '&:hover': isDisabled ? {} : {
          borderColor: 'primary.main',
          boxShadow: 1,
        },
      }}
      onClick={isDisabled ? undefined : onToggle}
    >
      <CardContent sx={{ py: 2, px: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          {/* Checkbox */}
          <Checkbox
            checked={selected}
            disabled={isDisabled}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Item Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                {item.name}
              </Typography>
              
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
                  💰 £{item.purchasePrice.toFixed(2)}
                </Typography>
              )}
            </Box>

            {item.alreadyPacked && currentContainerName && currentContainerName !== containerName && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
                Currently in: {currentContainerName}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}