import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  Chip,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  Divider,

  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  History as HistoryIcon,
  Star as StarIcon,

} from '@mui/icons-material';
import type { Thing, Category, Location, Room } from '../types/entities';

interface PackingItemSearchProps {
  items: Thing[];
  categories: Category[];
  locations: Location[];
  rooms: Room[];
  onFilteredItemsChange: (filteredItems: Thing[]) => void;
  onSearchTermChange?: (searchTerm: string) => void;
}

interface SearchFilters {
  searchTerm: string;
  categoryIds: string[];
  locationIds: string[];
  roomIds: string[];
  priceRange: {
    min: number | null;
    max: number | null;
  };
  showOnlyUnpacked: boolean;
  showOnlyWithPhotos: boolean;
  sortBy: 'name' | 'category' | 'location' | 'price' | 'dateAdded';
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_FILTERS: SearchFilters = {
  searchTerm: '',
  categoryIds: [],
  locationIds: [],
  roomIds: [],
  priceRange: { min: null, max: null },
  showOnlyUnpacked: true,
  showOnlyWithPhotos: false,
  sortBy: 'name',
  sortOrder: 'asc',
};

export default function PackingItemSearch({
  items,
  categories,
  locations,
  rooms,
  onFilteredItemsChange,
  onSearchTermChange,
}: PackingItemSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [expandedFilters, setExpandedFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<Set<string>>(new Set());

  // Load recent searches and favorites from localStorage
  useEffect(() => {
    const savedRecentSearches = localStorage.getItem('packing-recent-searches');
    if (savedRecentSearches) {
      setRecentSearches(JSON.parse(savedRecentSearches));
    }

    const savedFavorites = localStorage.getItem('packing-favorite-items');
    if (savedFavorites) {
      setFavoriteItems(new Set(JSON.parse(savedFavorites)));
    }
  }, []);

  // Save recent searches to localStorage
  const addRecentSearch = (searchTerm: string) => {
    if (!searchTerm.trim() || recentSearches.includes(searchTerm)) return;
    
    const newRecentSearches = [searchTerm, ...recentSearches.slice(0, 4)]; // Keep only 5 recent searches
    setRecentSearches(newRecentSearches);
    localStorage.setItem('packing-recent-searches', JSON.stringify(newRecentSearches));
  };

  // Toggle favorite item
  const toggleFavorite = (itemId: string) => {
    const newFavorites = new Set(favoriteItems);
    if (newFavorites.has(itemId)) {
      newFavorites.delete(itemId);
    } else {
      newFavorites.add(itemId);
    }
    setFavoriteItems(newFavorites);
    localStorage.setItem('packing-favorite-items', JSON.stringify(Array.from(newFavorites)));
  };

  // Create lookup maps for efficient filtering
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

  // Filter and sort items based on current filters
  const filteredAndSortedItems = useMemo(() => {
    let filtered = items.filter(item => {
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch = 
          item.name.toLowerCase().includes(searchLower) ||
          (item.description && item.description.toLowerCase().includes(searchLower)) ||
          (item.serialNumber && item.serialNumber.toLowerCase().includes(searchLower)) ||
          (item.notes && item.notes.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Category filter
      if (filters.categoryIds.length > 0 && item.categoryId) {
        if (!filters.categoryIds.includes(item.categoryId)) return false;
      }

      // Location filter
      if (filters.locationIds.length > 0 && item.locationId) {
        if (!filters.locationIds.includes(item.locationId)) return false;
      }

      // Room filter
      if (filters.roomIds.length > 0 && item.roomId) {
        if (!filters.roomIds.includes(item.roomId)) return false;
      }

      // Price range filter
      if (filters.priceRange.min !== null && item.purchasePrice) {
        if (item.purchasePrice < filters.priceRange.min) return false;
      }
      if (filters.priceRange.max !== null && item.purchasePrice) {
        if (item.purchasePrice > filters.priceRange.max) return false;
      }

      // Show only unpacked filter
      if (filters.showOnlyUnpacked) {
        const extendedItem = item as any;
        if (extendedItem.containerId) return false;
      }

      // Show only with photos filter
      if (filters.showOnlyWithPhotos) {
        if (!item.photos || item.photos.length === 0) return false;
      }

      return true;
    });

    // Sort items
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'category':
          const aCat = a.categoryId ? categoryMap.get(a.categoryId)?.name || '' : '';
          const bCat = b.categoryId ? categoryMap.get(b.categoryId)?.name || '' : '';
          comparison = aCat.localeCompare(bCat);
          break;
        case 'location':
          const aLoc = a.locationId ? locationMap.get(a.locationId)?.name || '' : '';
          const bLoc = b.locationId ? locationMap.get(b.locationId)?.name || '' : '';
          comparison = aLoc.localeCompare(bLoc);
          break;
        case 'price':
          comparison = (a.purchasePrice || 0) - (b.purchasePrice || 0);
          break;
        case 'dateAdded':
          comparison = new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
          break;
      }

      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    // Prioritize favorite items
    const favoriteFiltered = filtered.filter(item => favoriteItems.has(item.id));
    const nonFavoriteFiltered = filtered.filter(item => !favoriteItems.has(item.id));
    
    return [...favoriteFiltered, ...nonFavoriteFiltered];
  }, [items, filters, categoryMap, locationMap, roomMap, favoriteItems]);

  // Update parent component when filtered items change
  useEffect(() => {
    onFilteredItemsChange(filteredAndSortedItems);
  }, [filteredAndSortedItems, onFilteredItemsChange]);

  // Update parent component when search term changes
  useEffect(() => {
    if (onSearchTermChange) {
      onSearchTermChange(filters.searchTerm);
    }
  }, [filters.searchTerm, onSearchTermChange]);

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearchSubmit = () => {
    if (filters.searchTerm.trim()) {
      addRecentSearch(filters.searchTerm.trim());
    }
  };

  const clearAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const hasActiveFilters = 
    filters.searchTerm ||
    filters.categoryIds.length > 0 ||
    filters.locationIds.length > 0 ||
    filters.roomIds.length > 0 ||
    filters.priceRange.min !== null ||
    filters.priceRange.max !== null ||
    !filters.showOnlyUnpacked ||
    filters.showOnlyWithPhotos;

  const activeFilterCount = [
    filters.searchTerm,
    filters.categoryIds.length > 0,
    filters.locationIds.length > 0,
    filters.roomIds.length > 0,
    filters.priceRange.min !== null || filters.priceRange.max !== null,
    !filters.showOnlyUnpacked,
    filters.showOnlyWithPhotos,
  ].filter(Boolean).length;

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      {/* Main Search Bar */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search items by name, description, serial number, or notes..."
          value={filters.searchTerm}
          onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit()}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: filters.searchTerm && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => handleFilterChange('searchTerm', '')}
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {/* Recent Searches */}
        {recentSearches.length > 0 && !filters.searchTerm && (
          <Box sx={{ mt: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <HistoryIcon fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              Recent:
            </Typography>
            {recentSearches.map((search, index) => (
              <Chip
                key={index}
                label={search}
                size="small"
                variant="outlined"
                onClick={() => handleFilterChange('searchTerm', search)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Filter Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterIcon color={hasActiveFilters ? 'primary' : 'action'} />
          <Typography variant="subtitle2">
            Advanced Filters
            {activeFilterCount > 0 && (
              <Chip
                label={activeFilterCount}
                size="small"
                color="primary"
                sx={{ ml: 1, minWidth: 24, height: 20 }}
              />
            )}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {filteredAndSortedItems.length} of {items.length} items
          </Typography>
          
          {hasActiveFilters && (
            <Button
              size="small"
              onClick={clearAllFilters}
              startIcon={<ClearIcon />}
            >
              Clear All
            </Button>
          )}

          <IconButton
            size="small"
            onClick={() => setExpandedFilters(!expandedFilters)}
          >
            {expandedFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Expanded Filters */}
      <Collapse in={expandedFilters}>
        <Divider sx={{ mb: 2 }} />
        
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
          {/* Category Filter */}
          <FormControl size="small">
            <InputLabel>Categories</InputLabel>
            <Select
              multiple
              value={filters.categoryIds}
              onChange={(e) => handleFilterChange('categoryIds', e.target.value)}
              label="Categories"
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((value) => {
                    const category = categoryMap.get(value);
                    return (
                      <Chip
                        key={value}
                        label={category?.name || 'Unknown'}
                        size="small"
                        style={{ backgroundColor: category?.color }}
                      />
                    );
                  })}
                </Box>
              )}
            >
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  <Checkbox checked={filters.categoryIds.includes(category.id)} />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {category.color && (
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          backgroundColor: category.color,
                          borderRadius: '50%',
                        }}
                      />
                    )}
                    {category.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Location Filter */}
          <FormControl size="small">
            <InputLabel>Locations</InputLabel>
            <Select
              multiple
              value={filters.locationIds}
              onChange={(e) => handleFilterChange('locationIds', e.target.value)}
              label="Locations"
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((value) => {
                    const location = locationMap.get(value);
                    return (
                      <Chip
                        key={value}
                        label={location?.name || 'Unknown'}
                        size="small"
                      />
                    );
                  })}
                </Box>
              )}
            >
              {locations.map((location) => (
                <MenuItem key={location.id} value={location.id}>
                  <Checkbox checked={filters.locationIds.includes(location.id)} />
                  {location.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Room Filter */}
          <FormControl size="small">
            <InputLabel>Rooms</InputLabel>
            <Select
              multiple
              value={filters.roomIds}
              onChange={(e) => handleFilterChange('roomIds', e.target.value)}
              label="Rooms"
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((value) => {
                    const room = roomMap.get(value);
                    return (
                      <Chip
                        key={value}
                        label={room?.name || 'Unknown'}
                        size="small"
                      />
                    );
                  })}
                </Box>
              )}
            >
              {rooms.map((room) => (
                <MenuItem key={room.id} value={room.id}>
                  <Checkbox checked={filters.roomIds.includes(room.id)} />
                  {room.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Price Range */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              label="Min Price"
              type="number"
              value={filters.priceRange.min || ''}
              onChange={(e) => handleFilterChange('priceRange', {
                ...filters.priceRange,
                min: e.target.value ? parseFloat(e.target.value) : null
              })}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
            <Typography variant="body2">to</Typography>
            <TextField
              size="small"
              label="Max Price"
              type="number"
              value={filters.priceRange.max || ''}
              onChange={(e) => handleFilterChange('priceRange', {
                ...filters.priceRange,
                max: e.target.value ? parseFloat(e.target.value) : null
              })}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
          </Box>

          {/* Sort Options */}
          <FormControl size="small">
            <InputLabel>Sort By</InputLabel>
            <Select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              label="Sort By"
            >
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="category">Category</MenuItem>
              <MenuItem value="location">Location</MenuItem>
              <MenuItem value="price">Price</MenuItem>
              <MenuItem value="dateAdded">Date Added</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small">
            <InputLabel>Sort Order</InputLabel>
            <Select
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
              label="Sort Order"
            >
              <MenuItem value="asc">Ascending</MenuItem>
              <MenuItem value="desc">Descending</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Additional Options */}
        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={filters.showOnlyUnpacked}
                onChange={(e) => handleFilterChange('showOnlyUnpacked', e.target.checked)}
              />
            }
            label="Show only unpacked items"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={filters.showOnlyWithPhotos}
                onChange={(e) => handleFilterChange('showOnlyWithPhotos', e.target.checked)}
              />
            }
            label="Show only items with photos"
          />
        </Box>
      </Collapse>

      {/* Quick Access to Favorites */}
      {favoriteItems.size > 0 && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StarIcon color="primary" />
            Quick Access - Favorite Items ({favoriteItems.size})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {Array.from(favoriteItems).slice(0, 10).map(itemId => {
              const item = items.find(i => i.id === itemId);
              if (!item) return null;
              
              return (
                <Chip
                  key={itemId}
                  label={item.name}
                  size="small"
                  icon={<StarIcon />}
                  onClick={() => handleFilterChange('searchTerm', item.name)}
                  onDelete={() => toggleFavorite(itemId)}
                  deleteIcon={<ClearIcon />}
                  sx={{ cursor: 'pointer' }}
                />
              );
            })}
          </Box>
        </Box>
      )}
    </Paper>
  );
}

// Export utility function to toggle favorites from other components
export const useFavoriteItems = () => {
  const [favoriteItems, setFavoriteItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const savedFavorites = localStorage.getItem('packing-favorite-items');
    if (savedFavorites) {
      setFavoriteItems(new Set(JSON.parse(savedFavorites)));
    }
  }, []);

  const toggleFavorite = (itemId: string) => {
    const newFavorites = new Set(favoriteItems);
    if (newFavorites.has(itemId)) {
      newFavorites.delete(itemId);
    } else {
      newFavorites.add(itemId);
    }
    setFavoriteItems(newFavorites);
    localStorage.setItem('packing-favorite-items', JSON.stringify(Array.from(newFavorites)));
    return !favoriteItems.has(itemId); // Return new state
  };

  const isFavorite = (itemId: string) => favoriteItems.has(itemId);

  return { favoriteItems, toggleFavorite, isFavorite };
};