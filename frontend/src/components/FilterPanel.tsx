import { useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  IconButton,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import type { EntityTableColumn } from './EntityTable';
import SearchBar from './SearchBar';
import type { SearchQuery } from './SearchBar';

interface FilterPanelProps {
  columns: EntityTableColumn[];
  globalSearch: string;
  onGlobalSearchChange: (value: string) => void;
  columnFilters: Record<string, string>;
  onColumnFilterChange: (field: string, value: string) => void;
  filteredCount: number;
  totalCount: number;
  dropdownFilters?: Record<string, FilterOption[]>;
  // New props for tag search integration
  inventoryId?: string;
  enableTagSearch?: boolean;
  onTagSearch?: (query: SearchQuery) => void;
  currentSearchQuery?: SearchQuery;
}

export default function FilterPanel({
  columns,
  globalSearch,
  onGlobalSearchChange,
  inventoryId,
  enableTagSearch = false,
  onTagSearch,
  currentSearchQuery,
}: FilterPanelProps) {
  // Handle tag search
  const handleTagSearch = (query: SearchQuery) => {
    if (onTagSearch) {
      onTagSearch(query);
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      {/* Enhanced SearchBar with tag support */}
      {enableTagSearch && inventoryId && onTagSearch ? (
        <SearchBar
          onSearch={handleTagSearch}
          inventoryId={inventoryId}
          placeholder="Search things by name, description, or tags..."
          showTagSearch={true}
          initialQuery={currentSearchQuery}
        />
      ) : (
        /* Fallback to simple search interface */
        <Paper sx={{ overflow: 'hidden' }}>
          <Box sx={{ p: 1.5 }}>
            <TextField
              fullWidth
              label="Search all columns"
              variant="outlined"
              value={globalSearch}
              onChange={(e) => onGlobalSearchChange(e.target.value)}
              size="small"
              inputProps={{
                'aria-label': 'Search all columns',
              }}
              InputProps={{
                endAdornment: globalSearch && (
                  <IconButton
                    size="small"
                    onClick={() => onGlobalSearchChange('')}
                    aria-label="Clear search"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                ),
              }}
            />
          </Box>
        </Paper>
      )}
    </Box>
  );
}