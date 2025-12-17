import { useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  Collapse,
  IconButton,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import type { EntityTableColumn } from './EntityTable';

interface FilterPanelProps {
  columns: EntityTableColumn[];
  globalSearch: string;
  onGlobalSearchChange: (value: string) => void;
  columnFilters: Record<string, string>;
  onColumnFilterChange: (field: string, value: string) => void;
  filteredCount: number;
  totalCount: number;
}

export default function FilterPanel({
  columns,
  globalSearch,
  onGlobalSearchChange,
  columnFilters,
  onColumnFilterChange,
  filteredCount,
  totalCount,
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
      {/* Always visible search box */}
      <Paper sx={{ p: 2, mb: 2 }}>
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
      </Paper>

      {/* Collapsible advanced filters */}
      <Paper sx={{ overflow: 'hidden' }}>
        {/* Header with expand/collapse button */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            p: 2,
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <FilterListIcon sx={{ mr: 1, color: hasActiveFilters ? 'primary.main' : 'text.secondary' }} />
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
            Advanced Filters
            {Object.values(columnFilters).filter(v => v).length > 0 && (
              <Typography component="span" variant="body2" color="primary" sx={{ ml: 1 }}>
                ({Object.values(columnFilters).filter(v => v).length} active)
              </Typography>
            )}
          </Typography>
          
          {/* Results count */}
          <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
            {filteredCount} of {totalCount} items
          </Typography>

          {/* Clear all button */}
          {hasActiveFilters && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                clearAllFilters();
              }}
              sx={{ mr: 1 }}
              aria-label="Clear all filters"
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          )}

          {/* Expand/collapse icon */}
          <IconButton size="small" aria-label={expanded ? 'Collapse filters' : 'Expand filters'}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        {/* Collapsible filter content */}
        <Collapse in={expanded}>
          <Divider />
          <Box sx={{ p: 2, pt: 3 }}>
            {/* Column Filters */}
            {filterableColumns.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                  Filter by Column
                </Typography>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
                  {filterableColumns.map((col) => (
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
                  ))}
                </Box>
              </>
            )}

            {/* Clear column filters button */}
            {Object.values(columnFilters).some(v => v) && (
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
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