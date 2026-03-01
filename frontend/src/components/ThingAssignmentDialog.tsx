import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Checkbox,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Box,
  IconButton,
  Tooltip,
  Typography,
  Chip,
} from '@mui/material';
import { 
  Search as SearchIcon,
  FilterList as FilterListIcon,
  SelectAll as SelectAllIcon,
  DeselectOutlined as DeselectIcon,
} from '@mui/icons-material';
import type { Thing, Category, Location, Room, Person } from '../types';
import QuickFilters from './QuickFilters';
import PhotoThumbnail from './PhotoThumbnail';
import apiClient from '../services/api';

interface ThingAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (thingIds: string[]) => Promise<void>;
  inventoryId: string;
}

const ThingAssignmentDialog: React.FC<ThingAssignmentDialogProps> = ({
  open,
  onClose,
  onSave,
  inventoryId
}) => {
  const [allThings, setAllThings] = useState<Thing[]>([]);
  const [filteredThings, setFilteredThings] = useState<Thing[]>([]);
  const [selectedThings, setSelectedThings] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Filter-related state
  const [showQuickFilters, setShowQuickFilters] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(undefined);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [nameFilter, setNameFilter] = useState<string>('');

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  // Apply filters whenever filter state changes
  useEffect(() => {
    applyFilters();
  }, [allThings, searchQuery, selectedCategoryId, selectedLocationId, selectedRoomId, selectedOwnerId, selectedTags, nameFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all necessary data
      const [availableThings, categoriesData, locationsData, roomsData, peopleData] = await Promise.all([
        apiClient.getAvailableThingsForProject(inventoryId),
        apiClient.getCategories(inventoryId),
        apiClient.getLocations(inventoryId),
        apiClient.getRooms(undefined, inventoryId),
        apiClient.getPeople(inventoryId),
      ]);

      setAllThings(Array.isArray(availableThings) ? availableThings : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setLocations(Array.isArray(locationsData) ? locationsData : []);
      setRooms(Array.isArray(roomsData) ? roomsData : []);
      setPeople(Array.isArray(peopleData) ? peopleData : []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allThings];

    // Apply name filter
    if (nameFilter.trim()) {
      const nameLower = nameFilter.toLowerCase();
      filtered = filtered.filter(thing =>
        thing.name.toLowerCase().includes(nameLower)
      );
    }

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

    setFilteredThings(filtered);
  };

  const handleToggleThing = (thingId: string) => {
    const newSelected = new Set(selectedThings);
    if (newSelected.has(thingId)) {
      newSelected.delete(thingId);
    } else {
      newSelected.add(thingId);
    }
    setSelectedThings(newSelected);
  };

  const handleSelectAll = () => {
    const allIds = new Set(filteredThings.map(t => t.id));
    setSelectedThings(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedThings(new Set());
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(Array.from(selectedThings));
      setSelectedThings(new Set());
      onClose();
    } catch (err) {
      console.error('Error saving thing assignments:', err);
      setError(err instanceof Error ? err.message : 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const handleClearFilters = () => {
    setSelectedCategoryId(undefined);
    setSelectedLocationId(undefined);
    setSelectedRoomId(undefined);
    setSelectedOwnerId(undefined);
    setSelectedTags([]);
    setNameFilter('');
    setSearchQuery('');
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { height: '80vh', display: 'flex', flexDirection: 'column' }
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Typography variant="h6">Assign Things to Project</Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flex: 1, overflow: 'hidden' }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
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
                  onCategoryFilter={setSelectedCategoryId}
                  onLocationFilter={setSelectedLocationId}
                  onRoomFilter={setSelectedRoomId}
                  onOwnerFilter={setSelectedOwnerId}
                  onTagFilter={setSelectedTags}
                  onNameFilter={setNameFilter}
                  onClearFilters={handleClearFilters}
                />
              </Box>
            )}
          </Box>

          {/* Things List */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {/* Search Bar and Controls */}
            <Box sx={{ p: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
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
                  placeholder="Search things..."
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
                {selectedThings.size > 0 ? (
                  <Chip
                    label={`${selectedThings.size} selected`}
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
                    disabled={filteredThings.length === 0}
                    size="small"
                    startIcon={<SelectAllIcon />}
                  >
                    Select All
                  </Button>
                  <Button
                    onClick={handleDeselectAll}
                    disabled={selectedThings.size === 0}
                    size="small"
                    startIcon={<DeselectIcon />}
                  >
                    Deselect
                  </Button>
                </Box>
              </Box>
            </Box>

            {/* Things List */}
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress />
              </Box>
            ) : filteredThings.length === 0 ? (
              <Alert severity="info" sx={{ m: 2 }}>
                {allThings.length === 0 
                  ? 'No available things to assign.'
                  : 'No things match the current filters.'}
              </Alert>
            ) : (
              <List sx={{ flex: 1, overflow: 'auto', px: 1 }}>
                {filteredThings.map((thing) => (
                  <ListItem
                    key={thing.id}
                    disablePadding
                    sx={{ mb: 0.5 }}
                  >
                    <ListItemButton
                      onClick={() => handleToggleThing(thing.id)}
                      dense
                      selected={selectedThings.has(thing.id)}
                      sx={{
                        borderRadius: 1,
                        '&.Mui-selected': {
                          backgroundColor: 'primary.50',
                          '&:hover': {
                            backgroundColor: 'primary.100',
                          },
                        },
                      }}
                    >
                      <PhotoThumbnail
                        photoKey={thing.photos && thing.photos.length > 0 ? thing.photos[0] : undefined}
                        altText={thing.name}
                      />
                      <ListItemText
                        primary={thing.name}
                        secondary={thing.description}
                        primaryTypographyProps={{
                          sx: { fontWeight: selectedThings.has(thing.id) ? 600 : 400 }
                        }}
                      />
                      <Checkbox
                        edge="end"
                        checked={selectedThings.has(thing.id)}
                        tabIndex={-1}
                        disableRipple
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={selectedThings.size === 0 || saving}
        >
          {saving ? 'Saving...' : `Assign (${selectedThings.size})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ThingAssignmentDialog;
