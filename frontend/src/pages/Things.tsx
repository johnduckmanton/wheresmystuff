import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Alert, Collapse, IconButton, Tooltip, CircularProgress } from '@mui/material';
import { useState, useEffect } from 'react';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import FilterListIcon from '@mui/icons-material/FilterList';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import EntityTable from '../components/EntityTable';
import type { EntityTableColumn } from '../components/EntityTable';
import ThingFormDialog from '../components/ThingFormDialog';
import AIPhotoUpload from '../components/AIPhotoUpload';
import BarcodeUpload from '../components/BarcodeUpload';
import QuickFilters from '../components/QuickFilters';
import PhotoThumbnail from '../components/PhotoThumbnail';
import MobileThingCard from '../components/MobileThingCard';
import ThingDetailSheet from '../components/ThingDetailSheet';
import ThingBulkActionBar from '../components/ThingBulkActionBar';
import type { SearchQuery } from '../components/SearchBar';
import { useLoading } from '../contexts/LoadingContext';
import { useNotification } from '../contexts/NotificationContext';
import { useInventory } from '../contexts/InventoryContext';
import { useMobileDetection } from '../hooks/useMobileDetection';
import apiClient from '../services/api';
import type { Thing, Location, Room, Category, Person, MovingProject, Container } from '../types';

const columns: EntityTableColumn[] = [
  { 
    field: 'thumbnail', 
    headerName: '', 
    width: 60,
    sortable: false,
    renderCell: (params) => (
      <PhotoThumbnail 
        photoKey={params.row.firstPhotoKey} 
        altText={params.row.name} 
      />
    )
  },
  { field: 'name', headerName: 'Name', flex: 1 },
  { field: 'location', headerName: 'Location', flex: 1 },
  { field: 'room', headerName: 'Room', flex: 1 },
  { field: 'owner', headerName: 'Owner', flex: 1 },
  { field: 'category', headerName: 'Category', flex: 1 },
];

interface ThingTableRow {
  id: string;
  thumbnail: string;
  name: string;
  location: string;
  room: string;
  container: string;
  owner: string;
  category: string;
  firstPhotoKey?: string;
}

export default function Things() {
  const [things, setThings] = useState<Thing[]>([]);
  const [allThings, setAllThings] = useState<Thing[]>([]); // Store all things for filtering
  const [locations, setLocations] = useState<Location[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<MovingProject[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingThing, setEditingThing] = useState<Thing | undefined>(undefined);
  const [prefillData, setPrefillData] = useState<Partial<Thing> | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [thingToDelete, setThingToDelete] = useState<ThingTableRow | null>(null);
  
  // AI Upload states
  const [showAIUpload, setShowAIUpload] = useState(false);
  
  // Barcode Upload states
  const [showBarcodeUpload, setShowBarcodeUpload] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState<SearchQuery>({
    tagMode: 'and',
  });

  // Quick filter state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(undefined);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [nameFilter, setNameFilter] = useState<string>('');
  const [showQuickFilters, setShowQuickFilters] = useState(false);

  // Contexts
  const { setLoading: setGlobalLoading } = useLoading();
  const { showSuccess, showError } = useNotification();
  const { currentInventory } = useInventory();
  const { isMobile } = useMobileDetection();

  // Mobile UX state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [detailThing, setDetailThing] = useState<Thing | null>(null);

  // Fetch all data when inventory changes
  useEffect(() => {
    if (currentInventory) {
      loadData();
    }
  }, [currentInventory]);

  const loadData = async () => {
    if (!currentInventory) {
      setLoading(false);
      setGlobalLoading(false);
      return;
    }

    try {
      setLoading(true);
      setGlobalLoading(true);
      const [thingsData, locationsData, roomsData, categoriesData, peopleData, projectsData, containersData] = await Promise.all([
        apiClient.getThings(currentInventory.id),
        apiClient.getLocations(currentInventory.id),
        apiClient.getRooms(undefined, currentInventory.id),
        apiClient.getCategories(currentInventory.id),
        apiClient.getPeople(currentInventory.id),
        apiClient.getProjects(currentInventory.id),
        apiClient.getContainers(currentInventory.id),
      ]);
      
      // Ensure all data are arrays, fallback to empty arrays if not
      const thingsArray = Array.isArray(thingsData) ? thingsData : [];
      setThings(thingsArray);
      setAllThings(thingsArray); // Store all things for filtering
      setLocations(Array.isArray(locationsData) ? locationsData : []);
      setRooms(Array.isArray(roomsData) ? roomsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setPeople(Array.isArray(peopleData) ? peopleData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setContainers(containersData.containers);
    } catch (error) {
      console.error('Error loading data:', error);
      showError(error instanceof Error ? error.message : 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  // Resolve entity names from IDs
  const getLocationName = (locationId?: string): string => {
    if (!locationId) return '';
    const location = locations.find(l => l.id === locationId);
    return location?.name || 'Unknown';
  };

  const getRoomName = (roomId?: string): string => {
    if (!roomId) return '';
    const room = rooms.find(r => r.id === roomId);
    return room?.name || 'Unknown';
  };

  const getOwnerName = (ownerId?: string): string => {
    if (!ownerId) return '';
    const owner = people.find(p => p.id === ownerId);
    return owner?.name || 'Unknown';
  };

  const getCategoryName = (categoryId?: string): string => {
    if (!categoryId) return '';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  const getContainerName = (containerId?: string): string => {
    if (!containerId) return '';
    const container = containers.find(c => c.id === containerId);
    return container?.name || 'Unknown';
  };

  // Transform Things data for table display
  const tableData: ThingTableRow[] = things.map(thing => ({
    id: thing.id,
    thumbnail: '', // Placeholder for thumbnail column
    name: thing.name,
    location: getLocationName(thing.locationId),
    room: getRoomName(thing.roomId),
    owner: getOwnerName(thing.ownerId),
    category: getCategoryName(thing.categoryId),
    container: getContainerName(thing.containerId),
    firstPhotoKey: thing.photos && thing.photos.length > 0 ? thing.photos[0] : undefined,
  }));

  // Handle tag search
  const handleTagSearch = async (query: SearchQuery) => {
    if (!currentInventory) return;

    setSearchQuery(query);
    applyFilters(query, selectedCategoryId, selectedLocationId, selectedRoomId, selectedOwnerId, selectedTags);
  };

  // Apply all filters (search, category, location, room, owner, tags, name)
  const applyFilters = (query: SearchQuery, categoryId?: string, locationId?: string, roomId?: string, ownerId?: string, tags: string[] = [], nameFilterText: string = '') => {
    try {
      setSearchLoading(true);
      
      let filteredThings = [...allThings];

      // Apply name filter (from Quick Filters)
      if (nameFilterText.trim()) {
        const nameLower = nameFilterText.toLowerCase();
        filteredThings = filteredThings.filter(thing => 
          thing.name.toLowerCase().includes(nameLower)
        );
      }

      // Apply text search
      if (query.text) {
        const searchLower = query.text.toLowerCase();
        filteredThings = filteredThings.filter(thing => 
          thing.name.toLowerCase().includes(searchLower) ||
          (thing.description && thing.description.toLowerCase().includes(searchLower)) ||
          (thing.notes && thing.notes.toLowerCase().includes(searchLower)) ||
          (thing.serialNumber && thing.serialNumber.toLowerCase().includes(searchLower)) ||
          (thing.make && thing.make.toLowerCase().includes(searchLower)) ||
          (thing.model && thing.model.toLowerCase().includes(searchLower))
        );
      }

      // Apply search bar tag search
      if (query.tags && query.tags.length > 0) {
        if (query.tagMode === 'and') {
          // AND mode: thing must have ALL specified tags
          filteredThings = filteredThings.filter(thing => {
            if (!thing.tags || thing.tags.length === 0) return false;
            return query.tags!.every(searchTag => 
              thing.tags!.some(thingTag => 
                thingTag.toLowerCase().includes(searchTag.toLowerCase())
              )
            );
          });
        } else {
          // OR mode: thing must have ANY of the specified tags
          filteredThings = filteredThings.filter(thing => {
            if (!thing.tags || thing.tags.length === 0) return false;
            return query.tags!.some(searchTag => 
              thing.tags!.some(thingTag => 
                thingTag.toLowerCase().includes(searchTag.toLowerCase())
              )
            );
          });
        }
      }

      // Apply category filter
      if (categoryId) {
        if (categoryId === 'uncategorized') {
          filteredThings = filteredThings.filter(thing => !thing.categoryId);
        } else {
          filteredThings = filteredThings.filter(thing => thing.categoryId === categoryId);
        }
      }

      // Apply location filter
      if (locationId) {
        if (locationId === 'unlocated') {
          filteredThings = filteredThings.filter(thing => !thing.locationId);
        } else {
          filteredThings = filteredThings.filter(thing => thing.locationId === locationId);
        }
      }

      // Apply room filter
      if (roomId) {
        filteredThings = filteredThings.filter(thing => thing.roomId === roomId);
      }

      // Apply owner filter
      if (ownerId) {
        if (ownerId === 'unowned') {
          filteredThings = filteredThings.filter(thing => !thing.ownerId);
        } else {
          filteredThings = filteredThings.filter(thing => thing.ownerId === ownerId);
        }
      }

      // Apply quick filter tags (AND mode - thing must have ALL selected tags)
      if (tags.length > 0) {
        filteredThings = filteredThings.filter(thing => {
          if (!thing.tags || thing.tags.length === 0) return false;
          return tags.every(selectedTag => 
            thing.tags!.some(thingTag => 
              thingTag.toLowerCase() === selectedTag.toLowerCase()
            )
          );
        });
      }

      setThings(filteredThings);
    } catch (error) {
      console.error('Error filtering things:', error);
      showError('Failed to filter things. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle category filter
  const handleCategoryFilter = (categoryId: string | undefined) => {
    setSelectedCategoryId(categoryId);
    applyFilters(searchQuery, categoryId, selectedLocationId, selectedRoomId, selectedOwnerId, selectedTags, nameFilter);
  };

  // Handle location filter
  const handleLocationFilter = (locationId: string | undefined) => {
    setSelectedLocationId(locationId);
    applyFilters(searchQuery, selectedCategoryId, locationId, selectedRoomId, selectedOwnerId, selectedTags, nameFilter);
  };

  // Handle room filter
  const handleRoomFilter = (roomId: string | undefined) => {
    setSelectedRoomId(roomId);
    applyFilters(searchQuery, selectedCategoryId, selectedLocationId, roomId, selectedOwnerId, selectedTags, nameFilter);
  };

  // Handle owner filter
  const handleOwnerFilter = (ownerId: string | undefined) => {
    setSelectedOwnerId(ownerId);
    applyFilters(searchQuery, selectedCategoryId, selectedLocationId, selectedRoomId, ownerId, selectedTags, nameFilter);
  };

  // Handle tag filter
  const handleTagFilter = (tags: string[]) => {
    setSelectedTags(tags);
    applyFilters(searchQuery, selectedCategoryId, selectedLocationId, selectedRoomId, selectedOwnerId, tags, nameFilter);
  };

  // Handle name filter
  const handleNameFilter = (name: string) => {
    setNameFilter(name);
    applyFilters(searchQuery, selectedCategoryId, selectedLocationId, selectedRoomId, selectedOwnerId, selectedTags, name);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedCategoryId(undefined);
    setSelectedLocationId(undefined);
    setSelectedRoomId(undefined);
    setSelectedOwnerId(undefined);
    setSelectedTags([]);
    setNameFilter('');
    setSearchQuery({ tagMode: 'and' });
    setThings(allThings);
  };

  const handleAdd = () => {
    setEditingThing(undefined);
    setPrefillData(undefined);
    setFormDialogOpen(true);
  };

  const handleEdit = (row: ThingTableRow) => {
    // Find the full Thing object
    const thing = things.find(t => t.id === row.id);
    if (thing) {
      setEditingThing(thing);
      setPrefillData(undefined);
      setFormDialogOpen(true);
    }
  };

  const handleDelete = (row: ThingTableRow) => {
    setThingToDelete(row);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!thingToDelete || !currentInventory) return;

    try {
      setGlobalLoading(true);
      await apiClient.deleteThing(thingToDelete.id, currentInventory.id);
      setDeleteDialogOpen(false);
      setThingToDelete(null);
      // Optimistic: remove from both arrays
      setThings(prev => prev.filter(t => t.id !== thingToDelete.id));
      setAllThings(prev => prev.filter(t => t.id !== thingToDelete.id));
      showSuccess('Thing deleted successfully');
    } catch (error) {
      console.error('Error deleting thing:', error);
      showError(error instanceof Error ? error.message : 'Failed to delete thing. Please try again.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setThingToDelete(null);
  };

  const handleFormSubmit = async (data: Partial<Thing>) => {
    try {
      setGlobalLoading(true);
      if (editingThing) {
        // Update existing thing — optimistic
        const updated = await apiClient.updateThing(editingThing.id, data);
        setThings(prev => prev.map(t => t.id === editingThing.id ? { ...t, ...updated } : t));
        setAllThings(prev => prev.map(t => t.id === editingThing.id ? { ...t, ...updated } : t));
        showSuccess('Thing updated successfully');
      } else {
        // Create new thing — optimistic
        const createData = { ...data } as Omit<Thing, 'dateAdded'>;
        const created = await apiClient.createThing(createData);
        setThings(prev => [created, ...prev]);
        setAllThings(prev => [created, ...prev]);
        showSuccess('Thing created successfully');
      }
      
      setFormDialogOpen(false);
      setEditingThing(undefined);
    } catch (error) {
      console.error('Error saving thing:', error);
      showError(error instanceof Error ? error.message : 'Failed to save thing. Please try again.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleFormClose = () => {
    setFormDialogOpen(false);
    setEditingThing(undefined);
    setPrefillData(undefined);
  };

  const handleRowClick = (row: ThingTableRow) => {
    // Open edit dialog when row is clicked
    handleEdit(row);
  };

  // Mobile: open detail sheet on card tap
  const handleCardTap = (thing: Thing) => {
    setDetailThing(thing);
  };

  // Mobile: toggle selection
  const handleSelectionToggle = (thing: Thing) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(thing.id)) next.delete(thing.id);
      else next.add(thing.id);
      return next;
    });
  };

  // Bulk move to location
  const handleBulkMoveToLocation = async (locationId: string) => {
    if (!currentInventory) return;
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map(id => apiClient.updateThing(id, { locationId, inventoryId: currentInventory.id }))
    );
    const succeeded = ids.filter((_, i) => results[i].status === 'fulfilled');
    const failCount = ids.length - succeeded.length;
    setThings(prev => prev.map(t => succeeded.includes(t.id) ? { ...t, locationId } : t));
    setAllThings(prev => prev.map(t => succeeded.includes(t.id) ? { ...t, locationId } : t));
    setSelectedIds(new Set());
    setIsSelectMode(false);
    if (failCount > 0) showError(`${failCount} item(s) could not be moved`);
    else showSuccess(`Moved ${succeeded.length} item(s) to new location`);
  };

  // Bulk move to container
  const handleBulkMoveToContainer = async (containerId: string) => {
    if (!currentInventory) return;
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map(id => apiClient.updateThing(id, { containerId, inventoryId: currentInventory.id }))
    );
    const succeeded = ids.filter((_, i) => results[i].status === 'fulfilled');
    const failCount = ids.length - succeeded.length;
    setThings(prev => prev.map(t => succeeded.includes(t.id) ? { ...t, containerId } : t));
    setAllThings(prev => prev.map(t => succeeded.includes(t.id) ? { ...t, containerId } : t));
    setSelectedIds(new Set());
    setIsSelectMode(false);
    if (failCount > 0) showError(`${failCount} item(s) could not be moved`);
    else showSuccess(`Moved ${succeeded.length} item(s) to container`);
  };

  // Show message if no inventory is selected
  if (!currentInventory) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          Things
        </Typography>
        <Alert severity="info">
          Please select an inventory to view things. You can create a new inventory from the Inventories page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        mb: { xs: 2, sm: 3 },
        gap: 2,
        flexWrap: 'wrap',
      }}>
        {!isMobile && (
          <Typography 
            variant="h4" 
            component="h1"
            sx={{ 
              fontSize: { xs: '1.5rem', sm: '2.125rem' },
              minWidth: 0,
              flex: { xs: '1 1 100%', sm: '1 1 auto' },
            }}
          >
            Things - {currentInventory.name}
          </Typography>
        )}
        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 1, sm: 2 }, 
          alignItems: 'center',
          flexWrap: 'wrap',
          width: '100%',
          justifyContent: 'flex-start',
        }}>
          <Tooltip title={showQuickFilters ? "Hide Filters" : "Show Filters"}>
            <IconButton
              onClick={() => setShowQuickFilters(!showQuickFilters)}
              color={showQuickFilters ? 'primary' : 'default'}
              size="small"
              sx={{
                border: '1px solid',
                borderColor: showQuickFilters ? 'primary.main' : 'divider',
                '&:hover': {
                  backgroundColor: 'primary.50',
                  borderColor: 'primary.main',
                }
              }}
            >
              <FilterListIcon />
            </IconButton>
          </Tooltip>
          
          {/* Desktop: Full buttons */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
            <Button 
              variant="outlined" 
              startIcon={<AutoAwesomeIcon />} 
              onClick={() => {
                setShowAIUpload(!showAIUpload);
                if (!showAIUpload) setShowBarcodeUpload(false);
              }}
              color={showAIUpload ? 'primary' : 'primary'}
              sx={{
                color: showAIUpload ? 'primary.main' : 'text.primary',
                borderColor: showAIUpload ? 'primary.main' : 'text.primary',
                '&:hover': {
                  backgroundColor: 'primary.50',
                  borderColor: 'primary.main',
                }
              }}
            >
              AI Photo Upload
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<QrCodeScannerIcon />} 
              onClick={() => {
                setShowBarcodeUpload(!showBarcodeUpload);
                if (!showBarcodeUpload) setShowAIUpload(false);
              }}
              color={showBarcodeUpload ? 'primary' : 'primary'}
              sx={{
                color: showBarcodeUpload ? 'primary.main' : 'text.primary',
                borderColor: showBarcodeUpload ? 'primary.main' : 'text.primary',
                '&:hover': {
                  backgroundColor: 'primary.50',
                  borderColor: 'primary.main',
                }
              }}
            >
              Barcode Scan
            </Button>
          </Box>
          
          {/* Mobile: Icon buttons only */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 1 }}>
            {isMobile && (
              <Tooltip title={isSelectMode ? "Cancel Select" : "Select Items"}>
                <IconButton
                  size="small"
                  onClick={() => { setIsSelectMode(!isSelectMode); if (isSelectMode) setSelectedIds(new Set()); }}
                  sx={{
                    border: '1px solid',
                    borderColor: isSelectMode ? 'primary.main' : 'divider',
                    '&:hover': { backgroundColor: 'primary.50', borderColor: 'primary.main' }
                  }}
                >
                  <CheckBoxIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="AI Photo Upload">
              <IconButton
                size="small"
                onClick={() => {
                  setShowAIUpload(!showAIUpload);
                  if (!showAIUpload) setShowBarcodeUpload(false);
                }}
                sx={{
                  border: '1px solid',
                  borderColor: showAIUpload ? 'primary.main' : 'divider',
                  '&:hover': {
                    backgroundColor: 'primary.50',
                    borderColor: 'primary.main',
                  }
                }}
              >
                <AutoAwesomeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Barcode Scan">
              <IconButton
                size="small"
                onClick={() => {
                  setShowBarcodeUpload(!showBarcodeUpload);
                  if (!showBarcodeUpload) setShowAIUpload(false);
                }}
                sx={{
                  border: '1px solid',
                  borderColor: showBarcodeUpload ? 'primary.main' : 'divider',
                  '&:hover': {
                    backgroundColor: 'primary.50',
                    borderColor: 'primary.main',
                  }
                }}
              >
                <QrCodeScannerIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={handleAdd}
            size="small"
            sx={{
              minWidth: { xs: 'auto', sm: '120px' },
              px: { xs: 2, sm: 3 },
              ml: 'auto',
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Add Thing
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              Add
            </Box>
          </Button>
        </Box>
      </Box>

      {/* AI Photo Upload Section */}
      <Collapse in={showAIUpload}>
        <Box sx={{ mb: 3 }}>
          <AIPhotoUpload 
            categories={categories}
            onAnalysisComplete={(analysisData, _photoKey) => {
              // Open the form dialog with pre-filled data
              setPrefillData(analysisData);
              setEditingThing(undefined);
              setFormDialogOpen(true);
              setShowAIUpload(false);
            }}
          />
        </Box>
      </Collapse>

      {/* Barcode Upload Section */}
      <Collapse in={showBarcodeUpload}>
        <Box sx={{ mb: 3 }}>
          <BarcodeUpload 
            onBarcodeComplete={(itemData) => {
              // Open the form dialog with pre-filled data
              setPrefillData(itemData);
              setEditingThing(undefined);
              setFormDialogOpen(true);
              setShowBarcodeUpload(false);
            }}
            onCancel={() => setShowBarcodeUpload(false)}
          />
        </Box>
      </Collapse>

      {/* Main Content with Filters */}
      <Box sx={{ 
        display: 'flex', 
        gap: { xs: 0, md: 3 }, 
        alignItems: 'flex-start',
        flexDirection: { xs: 'column', md: 'row' },
        width: '100%',
      }}>
        {/* Quick Filters Sidebar */}
        <Box
          sx={{
            width: { xs: '100%', md: showQuickFilters ? 280 : 0 },
            overflow: 'hidden',
            transition: 'width 0.3s ease-in-out',
            flexShrink: 0,
            mb: { xs: showQuickFilters ? 2 : 0, md: 0 },
          }}
        >
          {showQuickFilters && (
            <QuickFilters
              things={allThings}
              categories={categories}
              locations={locations}
              rooms={rooms}
              people={people}
              selectedCategoryId={selectedCategoryId}
              selectedLocationId={selectedLocationId}
              selectedRoomId={selectedRoomId}
              selectedOwnerId={selectedOwnerId}
              selectedTags={selectedTags}
              nameFilter={nameFilter}
              onCategoryFilter={handleCategoryFilter}
              onLocationFilter={handleLocationFilter}
              onRoomFilter={handleRoomFilter}
              onOwnerFilter={handleOwnerFilter}
              onTagFilter={handleTagFilter}
              onNameFilter={handleNameFilter}
              onClearFilters={handleClearFilters}
            />
          )}
        </Box>

        {/* Main Content — Mobile cards or Desktop table */}
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          {isMobile ? (
            // Mobile: card list
            loading || searchLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : tableData.length === 0 ? (
              <Box sx={{ textAlign: 'center', p: 4 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No things found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Tap + to add your first item
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                {tableData.map(row => {
                  const fullThing = things.find(t => t.id === row.id);
                  if (!fullThing) return null;
                  return (
                    <MobileThingCard
                      key={row.id}
                      thing={fullThing}
                      categoryName={row.category || undefined}
                      locationName={row.location || undefined}
                      isSelectMode={isSelectMode}
                      isSelected={selectedIds.has(row.id)}
                      onTap={handleCardTap}
                      onEdit={() => handleEdit(row)}
                      onDelete={() => handleDelete(row)}
                      onSelectionToggle={handleSelectionToggle}
                    />
                  );
                })}
              </Box>
            )
          ) : (
            // Desktop: existing table
            <EntityTable
              columns={columns}
              data={tableData}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRowClick={handleRowClick}
              loading={loading || searchLoading}
              inventoryId={currentInventory.id}
              enableTagSearch={true}
              onTagSearch={handleTagSearch}
              currentSearchQuery={searchQuery}
            />
          )}
        </Box>
      </Box>

      {/* Thing Form Dialog */}
      <ThingFormDialog
        open={formDialogOpen}
        thing={editingThing}
        prefillData={prefillData}
        locations={locations}
        rooms={rooms}
        categories={categories}
        people={people}
        projects={projects}
        containers={containers}
        onSubmit={handleFormSubmit}
        onClose={handleFormClose}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete "{thingToDelete?.name}"? This action cannot be undone.
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

      {/* Thing Detail Sheet (mobile) */}
      <ThingDetailSheet
        thing={detailThing}
        open={detailThing !== null}
        categoryName={detailThing ? getCategoryName(detailThing.categoryId) : undefined}
        locationName={detailThing ? getLocationName(detailThing.locationId) : undefined}
        roomName={detailThing ? getRoomName(detailThing.roomId) : undefined}
        containerName={detailThing ? getContainerName(detailThing.containerId) : undefined}
        ownerName={detailThing ? getOwnerName(detailThing.ownerId) : undefined}
        onClose={() => setDetailThing(null)}
        onEdit={(t) => {
          setDetailThing(null);
          const row = tableData.find(r => r.id === t.id);
          if (row) handleEdit(row);
        }}
      />

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <ThingBulkActionBar
          selectedCount={selectedIds.size}
          locations={locations}
          containers={containers}
          onMoveToLocation={handleBulkMoveToLocation}
          onMoveToContainer={handleBulkMoveToContainer}
          onClearSelection={() => { setSelectedIds(new Set()); setIsSelectMode(false); }}
        />
      )}

    </Box>
  );
}
