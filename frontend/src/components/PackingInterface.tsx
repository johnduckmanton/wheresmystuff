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
import ModeSelector from './packing/ModeSelector';
import CreationMethodSelector from './packing/CreationMethodSelector';
import AIPhotoUpload from './AIPhotoUpload';
import BarcodeScanner from './BarcodeScanner';
import BarcodeItemPreview from './BarcodeItemPreview';
import ThingFormDialog from './ThingFormDialog';
import { withRetry, isRetryableError } from '../utils/retry';
import { errorLogger } from '../utils/errorLogger';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import OfflineBanner from './OfflineBanner';
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
  
  // Offline queue hook
  const { isOnline, queuedCount, isProcessing, queueCreateAndPack, processQueue } = useOfflineQueue();

  // Mode state
  const [mode, setMode] = useState<'select' | 'create'>('select');
  
  // Creation method state
  const [creationMethod, setCreationMethod] = useState<'ai' | 'barcode' | 'manual' | null>(null);
  
  // AI analysis state
  const [aiAnalysisData, setAiAnalysisData] = useState<Partial<Thing> | null>(null);
  
  // Barcode Scanner state
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [barcodePreviewOpen, setBarcodePreviewOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [barcodeLookupError, setBarcodeLookupError] = useState<string>('');

  // Manual entry state
  const [thingFormOpen, setThingFormOpen] = useState(false);

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
  
  // Retry state
  const [retryCount, setRetryCount] = useState(0);
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [lastFailedThingData, setLastFailedThingData] = useState<Partial<Thing> | null>(null);

  // Handle mode change
  const handleModeChange = (newMode: 'select' | 'create') => {
    setMode(newMode);
    // Container selection is preserved automatically by state
    // Reset creation method when switching modes
    if (newMode === 'select') {
      setCreationMethod(null);
    }
  };

  // Handle creation method selection
  const handleMethodSelect = (method: 'ai' | 'barcode' | 'manual') => {
    // Check if container is selected before proceeding
    if (!container) {
      showError('No container selected. Please select a container before creating an item.');
      return;
    }
    
    setCreationMethod(method);
    
    // For manual entry, open the ThingFormDialog immediately
    if (method === 'manual') {
      setThingFormOpen(true);
    }
  };

  // Handle AI Photo Upload completion
  const handleAIUploadComplete = (analysisData: Partial<Thing>, _photoKey: string) => {
    // Check if container is selected
    if (!container) {
      showError('No container selected. Please select a container before creating an item.');
      setCreationMethod(null);
      return;
    }
    
    // Store AI analysis data
    console.log('AI Photo Upload completed, analysis data:', analysisData);
    setAiAnalysisData(analysisData);
    
    // Open ThingFormDialog with pre-filled data
    setThingFormOpen(true);
    
    // Reset creation method will happen after form is submitted or closed
  };

  // Handle Barcode Scanner - open scanner dialog
  const handleBarcodeScanned = (barcode: string) => {
    console.log('Barcode scanned:', barcode);
    setScannedBarcode(barcode);
    setBarcodeScannerOpen(false);
    setBarcodePreviewOpen(true);
  };

  // Handle Barcode Item Preview - accept barcode lookup results
  const handleBarcodeItemAccept = (itemData: any) => {
    // Check if container is selected
    if (!container) {
      showError('No container selected. Please select a container before creating an item.');
      setBarcodePreviewOpen(false);
      setScannedBarcode('');
      setBarcodeLookupError('');
      setCreationMethod(null);
      return;
    }
    
    console.log('Accepting barcode item data:', itemData);
    
    // Close barcode preview
    setBarcodePreviewOpen(false);
    setScannedBarcode('');
    setBarcodeLookupError('');
    
    // For now, just show success message
    // Full integration with ThingFormDialog and create-and-pack will be in later tasks
    showSuccess(`Product "${itemData.name}" found! Full form integration coming in task 6.`);
    
    // Reset to method selector
    setCreationMethod(null);
  };

  // Handle retry barcode scan
  const handleRetryBarcodeScan = () => {
    setBarcodePreviewOpen(false);
    setScannedBarcode('');
    setBarcodeLookupError('');
    // Reopen scanner for retry
    setBarcodeScannerOpen(true);
  };

  // Handle switch to manual entry from barcode error
  const handleSwitchToManualEntry = () => {
    setBarcodePreviewOpen(false);
    setScannedBarcode('');
    setBarcodeLookupError('');
    // Switch to manual entry method
    setCreationMethod('manual');
    setThingFormOpen(true);
    showSuccess('Switched to manual entry mode.');
  };

  // Handle thing form submission (create and pack)
  const handleThingFormSubmit = async (thingData: Partial<Thing>) => {
    if (!currentInventory) {
      showError('No inventory selected');
      return;
    }

    // Check if container is selected
    if (!container) {
      showError('No container selected. Please select a container before creating an item.');
      return;
    }

    // If offline, queue the operation
    if (!isOnline) {
      const operationId = queueCreateAndPack(thingData, container.id, currentInventory.id);
      setThingFormOpen(false);
      setCreationMethod(null);
      showSuccess(`Item queued for creation. Will sync when connection is restored.`);
      console.log('Operation queued with ID:', operationId);
      return;
    }

    setLoading(true);
    setShowRetryButton(false);
    
    try {
      // Call create-and-pack API endpoint with retry logic
      const result = await withRetry(
        () => apiClient.createAndPackThing(thingData, container.id, currentInventory.id),
        {
          maxRetries: 3,
          baseDelay: 1000, // 1s, 2s, 4s, 8s
          shouldRetry: (error: any) => isRetryableError(error),
        }
      ) as { success: boolean; thing: Thing; container: Container; error?: string };
      
      // Close the form
      setThingFormOpen(false);
      
      // Clear AI analysis data
      setAiAnalysisData(null);
      
      // Reload data to show the new thing in the container
      await loadData();
      
      // Show success message with thing name and container name
      showSuccess(`Item "${result.thing.name}" created and packed into ${container.name}!`);
      
      // Update parent component with the updated container
      if (onContainerUpdated && result.container) {
        onContainerUpdated(result.container);
      }
      
      // Reset creation method to show selector again
      setCreationMethod(null);
      
      // Reset retry state on success
      setRetryCount(0);
      setLastFailedThingData(null);
      setShowRetryButton(false);
    } catch (error: any) {
      // Log error with context
      errorLogger.logCreateAndPackError(
        error,
        'creation',
        currentInventory?.ownerId,
        thingData,
        container.id
      );
      
      // Save the failed data for manual retry
      setLastFailedThingData(thingData);
      
      // Detect network errors and retryable errors
      const isRetryable = isRetryableError(error);
      
      if (isRetryable) {
        // Increment retry count
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);
        
        // Show retry button
        setShowRetryButton(true);
        
        // Display user-friendly error message with retry information
        const errorMessage = error.response?.data?.message || error.message || 'Failed to create and pack item.';
        showError(`${errorMessage} (Attempt ${newRetryCount})`);
      } else {
        // Non-retryable error - display error without retry option
        const errorMessage = error.response?.data?.message || error.message || 'Failed to create and pack item. Please try again.';
        showError(errorMessage);
        setShowRetryButton(false);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Handle manual retry
  const handleManualRetry = async () => {
    if (lastFailedThingData) {
      await handleThingFormSubmit(lastFailedThingData);
    }
  };
  
  // Handle queue retry
  const handleQueueRetry = async () => {
    const result = await processQueue();
    if (result.success > 0) {
      showSuccess(`Successfully synced ${result.success} operation${result.success !== 1 ? 's' : ''}!`);
      // Reload data to show the new items
      await loadData();
    }
    if (result.failed > 0) {
      showError(`Failed to sync ${result.failed} operation${result.failed !== 1 ? 's' : ''}. Will retry automatically.`);
    }
  };

  // Listen for successful queue processing
  useEffect(() => {
    if (isOnline && !isProcessing && queuedCount === 0) {
      // Queue was just processed successfully
      const checkForNewItems = async () => {
        await loadData();
      };
      checkForNewItems();
    }
  }, [isOnline, isProcessing, queuedCount]);

  // Handle manual entry form close
  const handleManualEntryClose = () => {
    setThingFormOpen(false);
    // Clear AI analysis data if it was from AI
    setAiAnalysisData(null);
    // Reset to method selector
    setCreationMethod(null);
  };

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
    } catch (error: any) {
      // Log error with context
      errorLogger.logError(
        error as Error,
        {
          userId: currentInventory?.ownerId,
          errorType: 'DataLoadError',
          userAction: 'Loading packing interface data',
          component: 'PackingInterface',
        }
      );
      showError('Failed to load items for packing. Please try again.');
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
      showError('No items selected. Please select items to pack.');
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
      
      // Call the real API to pack items with retry logic
      const result = await withRetry(
        () => apiClient.addItemsToContainer(container.id, currentInventory.id, selectedItemIds),
        {
          maxRetries: 3,
          baseDelay: 1000,
          shouldRetry: (error: any) => isRetryableError(error),
        }
      );
      
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
    } catch (error: any) {
      // Log error with context
      errorLogger.logError(
        error as Error,
        {
          userId: currentInventory?.ownerId,
          errorType: 'PackItemsError',
          userAction: 'Packing items into container',
          component: 'PackingInterface',
          additionalData: {
            containerId: container.id,
            itemCount: selectedItems.size,
          },
        }
      );
      
      // Display user-friendly error message with retry information
      const isRetryable = isRetryableError(error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to pack items into container.';
      
      if (isRetryable) {
        showError(`${errorMessage} Please try again.`);
      } else {
        showError(errorMessage);
      }
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
      showError('No items selected. Please select items to remove from the container.');
      return;
    }

    if (!currentInventory) return;

    setLoading(true);
    try {
      // Call the real API to remove items from container with retry logic
      const result = await withRetry(
        () => apiClient.removeItemsFromContainer(container.id, currentInventory.id, itemsToRemove),
        {
          maxRetries: 3,
          baseDelay: 1000,
          shouldRetry: (error: any) => isRetryableError(error),
        }
      );
      
      // Reload data to get updated item states
      await loadData();
      
      // Clear selection
      setSelectedItems(new Set());
      
      // Notify parent components with the updated container
      if (onContainerUpdated && result.container) {
        onContainerUpdated(result.container);
      }
      
      showSuccess(`Removed ${itemsToRemove.length} items from ${container.name}`);
    } catch (error: any) {
      // Log error with context
      errorLogger.logError(
        error as Error,
        {
          userId: currentInventory?.ownerId,
          errorType: 'RemoveItemsError',
          userAction: 'Removing items from container',
          component: 'PackingInterface',
          additionalData: {
            containerId: container.id,
            itemCount: itemsToRemove.length,
          },
        }
      );
      
      // Display user-friendly error message with retry information
      const isRetryable = isRetryableError(error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to remove items from container.';
      
      if (isRetryable) {
        showError(`${errorMessage} Please try again.`);
      } else {
        showError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalItems = packingFilteredItems.length;
    // Use the container's actual itemCount instead of counting local items
    const packedInContainer = container?.itemCount || 0;
    const selectedCount = selectedItems.size;
    const availableForPacking = packingFilteredItems.filter(item => 
      !item.alreadyPacked || item.currentContainer === container?.id
    ).length;

    return {
      totalItems,
      packedInContainer,
      selectedCount,
      availableForPacking,
    };
  }, [packingFilteredItems, selectedItems, container?.id, container?.itemCount]);

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
      {/* Offline Banner */}
      <OfflineBanner
        isOnline={isOnline}
        queuedCount={queuedCount}
        isProcessing={isProcessing}
        onRetry={handleQueueRetry}
      />
      
      {/* Mode Selector */}
      <Box sx={{ 
        p: { xs: 1, sm: 2 }, 
        borderBottom: 1, 
        borderColor: 'divider' 
      }}>
        <ModeSelector mode={mode} onModeChange={handleModeChange} />
      </Box>

      {/* Conditionally render based on mode */}
      {mode === 'select' ? (
        <>
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
            p: { xs: 2, sm: 3 }, 
            borderBottom: 1, 
            borderColor: 'divider',
          }}>
            <Typography 
              variant="h5" 
              gutterBottom
              sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
            >
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
          <Box sx={{ p: { xs: 1.5, sm: 2 }, borderBottom: '1px solid', borderColor: 'divider' }}>
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
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 1, sm: 0 },
            }}>
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
          <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1.5, sm: 2 } }}>
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
          p: { xs: 2, sm: 3 }, 
          borderTop: 1, 
          borderColor: 'divider', 
          display: 'flex', 
          gap: { xs: 1, sm: 2 }, 
          justifyContent: 'space-between',
          backgroundColor: 'background.paper',
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Button 
          variant="outlined" 
          onClick={onClose}
          sx={{ 
            minHeight: '44px',
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          Close
        </Button>
        
        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 1, sm: 2 },
          flexDirection: { xs: 'column', sm: 'row' },
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
                sx={{ 
                  minHeight: '44px',
                  width: { xs: '100%', sm: 'auto' }
                }}
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
                sx={{ 
                  minHeight: '44px',
                  width: { xs: '100%', sm: 'auto' }
                }}
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
        </>
      ) : (
        /* Create New mode */
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!creationMethod ? (
            /* Show creation method selector when no method is selected */
            <Box sx={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              p: { xs: 2, sm: 4 } 
            }}>
              <Box sx={{ maxWidth: 400, width: '100%' }}>
                <Typography 
                  variant="h6" 
                  gutterBottom 
                  align="center" 
                  sx={{ mb: 3, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}
                >
                  Choose how to create a new item
                </Typography>
                <CreationMethodSelector onMethodSelect={handleMethodSelect} />
              </Box>
            </Box>
          ) : (
            /* Show appropriate component based on selected method */
            <Box sx={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'auto', 
              p: { xs: 2, sm: 4 } 
            }}>
              {creationMethod === 'ai' && (
                <Box sx={{ maxWidth: 800, width: '100%', mx: 'auto' }}>
                  <AIPhotoUpload
                    categories={categories}
                    onAnalysisComplete={handleAIUploadComplete}
                  />
                </Box>
              )}
              {creationMethod === 'barcode' && (
                <Box sx={{ maxWidth: 800, width: '100%', mx: 'auto' }}>
                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Typography 
                      variant="h6" 
                      gutterBottom
                      sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}
                    >
                      Scan Product Barcode
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      gutterBottom
                      sx={{ fontSize: { xs: '0.875rem', sm: '0.875rem' } }}
                    >
                      Use your camera to scan a product barcode (UPC, EAN, or ISBN)
                    </Typography>
                  </Box>
                  
                  {barcodeLookupError && (
                    <Alert 
                      severity="error" 
                      sx={{ mb: 2 }}
                      action={
                        <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                          <Button 
                            color="inherit" 
                            size="small" 
                            onClick={handleRetryBarcodeScan}
                            fullWidth
                          >
                            Retry
                          </Button>
                          <Button 
                            color="inherit" 
                            size="small" 
                            onClick={handleSwitchToManualEntry}
                            fullWidth
                          >
                            Manual Entry
                          </Button>
                        </Box>
                      }
                    >
                      {barcodeLookupError}
                    </Alert>
                  )}
                  
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={() => setBarcodeScannerOpen(true)}
                    sx={{ mb: 2, minHeight: '48px' }}
                  >
                    Open Barcode Scanner
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => setCreationMethod(null)}
                    sx={{ minHeight: '48px' }}
                  >
                    Back to Method Selection
                  </Button>
                </Box>
              )}
              {creationMethod === 'manual' && (
                <Box sx={{ maxWidth: 800, width: '100%', mx: 'auto' }}>
                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Typography 
                      variant="h6" 
                      gutterBottom
                      sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}
                    >
                      Create New Item
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      gutterBottom
                      sx={{ fontSize: { xs: '0.875rem', sm: '0.875rem' } }}
                    >
                      Fill in the details below to create a new item
                    </Typography>
                  </Box>
                  
                  {/* Retry Alert */}
                  {showRetryButton && lastFailedThingData && (
                    <Alert 
                      severity="error" 
                      sx={{ mb: 2 }}
                      action={
                        <Button 
                          color="inherit" 
                          size="small" 
                          onClick={handleManualRetry}
                          disabled={loading}
                        >
                          Retry {retryCount > 0 && `(${retryCount})`}
                        </Button>
                      }
                    >
                      Failed to create and pack item. Click retry to try again.
                    </Alert>
                  )}
                  
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={() => setThingFormOpen(true)}
                    sx={{ mb: 2, minHeight: '48px' }}
                  >
                    Open Item Form
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => setCreationMethod(null)}
                    sx={{ minHeight: '48px' }}
                  >
                    Back to Method Selection
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Barcode Scanner Dialog */}
      <BarcodeScanner
        open={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onBarcodeScanned={handleBarcodeScanned}
      />

      {/* Barcode Item Preview Dialog */}
      {currentInventory && (
        <BarcodeItemPreview
          open={barcodePreviewOpen}
          barcode={scannedBarcode}
          inventoryId={currentInventory.id}
          onClose={() => {
            setBarcodePreviewOpen(false);
            setScannedBarcode('');
          }}
          onAccept={handleBarcodeItemAccept}
        />
      )}

      {/* Manual Entry Thing Form Dialog */}
      <ThingFormDialog
        open={thingFormOpen}
        locations={locations}
        rooms={rooms}
        categories={categories}
        people={people}
        prefillData={aiAnalysisData || undefined}
        onSubmit={handleThingFormSubmit}
        onClose={handleManualEntryClose}
      />
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
      <CardContent sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 1, sm: 2 } }}>
          {/* Checkbox */}
          <Checkbox
            checked={selected}
            disabled={isDisabled}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            sx={{ 
              p: { xs: 0.5, sm: 1 },
              '& .MuiSvgIcon-root': { fontSize: { xs: 20, sm: 24 } }
            }}
          />

          {/* Item Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1, 
              mb: 1,
              flexWrap: 'wrap',
            }}>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  fontWeight: 'medium',
                  fontSize: { xs: '0.875rem', sm: '0.875rem' },
                }}
              >
                {item.name}
              </Typography>
              
              {/* Status indicators */}
              {isInCurrentContainer && (
                <Chip
                  label="In Container"
                  size="small"
                  color="success"
                  icon={<CheckCircleIcon />}
                  sx={{ 
                    height: { xs: 20, sm: 24 },
                    '& .MuiChip-label': { fontSize: { xs: '0.7rem', sm: '0.8125rem' }, px: { xs: 0.5, sm: 1 } },
                    '& .MuiChip-icon': { fontSize: { xs: 14, sm: 18 } },
                  }}
                />
              )}
              {item.alreadyPacked && !isInCurrentContainer && (
                <Chip
                  label="Already Packed"
                  size="small"
                  color="warning"
                  icon={<WarningIcon />}
                  sx={{ 
                    height: { xs: 20, sm: 24 },
                    '& .MuiChip-label': { fontSize: { xs: '0.7rem', sm: '0.8125rem' }, px: { xs: 0.5, sm: 1 } },
                    '& .MuiChip-icon': { fontSize: { xs: 14, sm: 18 } },
                  }}
                />
              )}
            </Box>

            {item.description && (
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  mb: 1,
                  fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                }}
              >
                {item.description}
              </Typography>
            )}

            <Box sx={{ 
              display: 'flex', 
              gap: { xs: 1, sm: 2 }, 
              flexWrap: 'wrap',
            }}>
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
              >
                📍 {locationName}
              </Typography>
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
              >
                🏷️ {categoryName}
              </Typography>
              {item.purchasePrice && (
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                >
                  💰 £{item.purchasePrice.toFixed(2)}
                </Typography>
              )}
            </Box>

            {item.alreadyPacked && currentContainerName && currentContainerName !== containerName && (
              <Typography 
                variant="caption" 
                color="warning.main" 
                sx={{ 
                  display: 'block', 
                  mt: 1,
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                }}
              >
                Currently in: {currentContainerName}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}