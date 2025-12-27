import { useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  Collapse,
  IconButton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import type { EntityTableColumn } from './EntityTable';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterPanelProps {
  columns: EntityTableColumn[];
  globalSearch: string;
  onGlobalSearchChange: (value: string) => void;
  columnFilters: Record<string, string>;
  onColumnFilterChange: (field: string, value: string) => void;
  filteredCount: number;
  totalCount: number;
  dropdownFilters?: Record<string, FilterOption[]>;
}

export default function FilterPanel({
  columns,
  globalSearch,
  onGlobalSearchChange,
  columnFilters,
  onColumnFilterChange,
  filteredCount,
  totalCount,
  dropdownFilters = {},
}: FilterPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const filterableColumns = columns.filter((col) => col.filterable !== false);
  const hasActiveFilters = globalSearch || Object.values(columnFilters).some(value => value);


  const clearAllFilters = () => {
    onGlobalSearchChange('');
    filterableColumns.forEach(col => {
      onColumnFilterChange(col.field, '');
    });
  };

  return (
    <Box sx={{ mb: 2 }}>
      {/* Compact search and filter header */}
      <Paper sx={{ overflow: 'hidden' }}>
        {/* Combined search and filter header */}
        <Box sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center' }}>
          {/* Search field */}
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

          {/* Filter toggle section */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              minWidth: 'fit-content',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
            onClick={() => setExpanded(!expanded)}
          >
            <FilterListIcon 
              sx={{ 
                mr: 0.5, 
                color: hasActiveFilters ? 'primary.main' : 'text.secondary',
                fontSize: '1.1rem'
              }} 
            />
            <Typography variant="body2" sx={{ mr: 1 }}>
              Filters
              {Object.values(columnFilters).filter(v => v).length > 0 && (
                <Typography component="span" variant="caption" color="primary" sx={{ ml: 0.5 }}>
                  ({Object.values(columnFilters).filter(v => v).length})
                </Typography>
              )}
            </Typography>
            
            {/* Results count */}
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
              {filteredCount}/{totalCount}
            </Typography>

            {/* Clear all button */}
            {hasActiveFilters && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  clearAllFilters();
                }}
                sx={{ mr: 0.5, p: 0.25 }}
                aria-label="Clear all filters"
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            )}

            {/* Expand/collapse icon */}
            <IconButton 
              size="small" 
              sx={{ p: 0.25 }}
              aria-label={expanded ? 'Collapse filters' : 'Expand filters'}
            >
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>

        {/* Collapsible filter content */}
        <Collapse in={expanded}>
          <Divider />
          <Box sx={{ p: 1.5, pt: 2 }}>
            {/* Column Filters */}
            {filterableColumns.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary' }}>
                  Filter by Column
                </Typography>
                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
                  {filterableColumns.map((col) => {
                    const hasDropdownOptions = dropdownFilters[col.field];
                    
                    if (hasDropdownOptions) {
                      return (
                        <FormControl key={col.field} size="small" variant="outlined">
                          <InputLabel>{`Filter ${col.headerName}`}</InputLabel>
                          <Select
                            value={columnFilters[col.field] || ''}
                            onChange={(e) => onColumnFilterChange(col.field, e.target.value)}
                            label={`Filter ${col.headerName}`}
                            endAdornment={columnFilters[col.field] && (
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onColumnFilterChange(col.field, '');
                                }}
                                aria-label={`Clear ${col.headerName} filter`}
                                sx={{ mr: 1 }}
                              >
                                <ClearIcon fontSize="small" />
                              </IconButton>
                            )}
                          >
                            <MenuItem value="">
                              <em>All {col.headerName}s</em>
                            </MenuItem>
                            {hasDropdownOptions.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      );
                    }
                    
                    return (
                      <TextField
                        key={col.field}
                        label={`Filter ${col.headerName}`}
                        variant="outlined"
                        size="small"
                        value={columnFilters[col.field] || ''}
                        onChange={(e) => onColumnFilterChange(col.field, e.target.value)}
                        inputProps={{
                          'aria-label': `Filter by ${col.headerName}`,
                        }}
                        InputProps={{
                          endAdornment: columnFilters[col.field] && (
                            <IconButton
                              size="small"
                              onClick={() => onColumnFilterChange(col.field, '')}
                              aria-label={`Clear ${col.headerName} filter`}
                            >
                              <ClearIcon fontSize="small" />
                            </IconButton>
                          ),
                        }}
                      />
                    );
                  })}
                </Box>
              </>
            )}

            {/* Clear column filters button */}
            {Object.values(columnFilters).some(v => v) && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <IconButton
                  onClick={() => {
                    filterableColumns.forEach(col => {
                      onColumnFilterChange(col.field, '');
                    });
                  }}
                  color="primary"
                  aria-label="Clear column filters"
                  sx={{ 
                    border: 1, 
                    borderColor: 'primary.main',
                    '&:hover': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                    }
                  }}
                >
                  <ClearIcon />
                </IconButton>
              </Box>
            )}
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
}