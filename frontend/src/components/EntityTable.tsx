import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Typography,
  useTheme,
  useMediaQuery,
  List,
} from '@mui/material';
import {
  DataGrid,
  GridActionsCellItem,
} from '@mui/x-data-grid';
import type {
  GridColDef,
  GridRowParams,
  GridSortModel,
  GridPaginationModel,
} from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FilterPanel from './FilterPanel';
import type { SearchQuery } from './SearchBar';

export interface EntityTableColumn {
  field: string;
  headerName: string;
  flex?: number;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  renderCell?: (params: any) => React.ReactNode;
}

interface FilterOption {
  value: string;
  label: string;
}

export interface EntityTableProps {
  columns: EntityTableColumn[];
  data: any[];
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onRowClick?: (row: any) => void;
  loading?: boolean;
  dropdownFilters?: Record<string, FilterOption[]>;
  // New props for tag search integration
  inventoryId?: string;
  enableTagSearch?: boolean;
  onTagSearch?: (query: SearchQuery) => void;
  currentSearchQuery?: SearchQuery;
}

export default function EntityTable({
  columns,
  data,
  onEdit,
  onDelete,
  onRowClick,
  loading = false,
  dropdownFilters = {},
  inventoryId,
  enableTagSearch = false,
  onTagSearch,
  currentSearchQuery,
}: EntityTableProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });
  const [internalSearchQuery, setInternalSearchQuery] = useState<SearchQuery>({
    tagMode: 'and',
  });

  // Filter data based on global search and column filters
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Apply global search (only if not using tag search)
    if (!enableTagSearch && globalSearch) {
      const searchLower = globalSearch.toLowerCase();
      filtered = filtered.filter((row) => {
        return columns.some((col) => {
          const value = row[col.field];
          if (value == null) return false;
          return String(value).toLowerCase().includes(searchLower);
        });
      });
    }

    // Apply column-specific filters
    Object.entries(columnFilters).forEach(([field, filterValue]) => {
      if (filterValue) {
        // Check if this field has dropdown options (exact match) or text filter (contains)
        const hasDropdownOptions = dropdownFilters[field];
        
        if (hasDropdownOptions) {
          // Exact match for dropdown filters
          filtered = filtered.filter((row) => {
            const value = row[field];
            if (value == null) return false;
            return String(value) === filterValue;
          });
        } else {
          // Contains match for text filters
          const filterLower = filterValue.toLowerCase();
          filtered = filtered.filter((row) => {
            const value = row[field];
            if (value == null) return false;
            return String(value).toLowerCase().includes(filterLower);
          });
        }
      }
    });

    return filtered;
  }, [data, globalSearch, columnFilters, columns, enableTagSearch]);

  // Handle column filter change
  const handleColumnFilterChange = (field: string, value: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle tag search
  const handleTagSearch = (query: SearchQuery) => {
    setInternalSearchQuery(query);
    if (onTagSearch) {
      onTagSearch(query);
    }
  };

  // Build DataGrid columns with actions
  const gridColumns: GridColDef[] = useMemo(() => {
    const cols: GridColDef[] = columns.map((col) => ({
      field: col.field,
      headerName: col.headerName,
      flex: col.flex,
      width: col.width,
      sortable: col.sortable !== false,
      renderCell: col.renderCell,
    }));

    // Add actions column if onEdit or onDelete are provided
    if (onEdit || onDelete) {
      cols.push({
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 100,
        getActions: (params: GridRowParams) => {
          const actions = [];
          if (onEdit) {
            actions.push(
              <GridActionsCellItem
                icon={<EditIcon />}
                label="Edit"
                onClick={() => onEdit(params.row)}
                color="primary"
              />
            );
          }
          if (onDelete) {
            actions.push(
              <GridActionsCellItem
                icon={<DeleteIcon color="error" />}
                label="Delete"
                onClick={() => onDelete(params.row)}
              />
            );
          }
          return actions;
        },
      });
    }

    return cols;
  }, [columns, onEdit, onDelete]);

  return (
    <Box sx={{ width: '100%' }}>
      {/* Filter Panel */}
      <FilterPanel
        columns={columns}
        globalSearch={globalSearch}
        onGlobalSearchChange={setGlobalSearch}
        columnFilters={columnFilters}
        onColumnFilterChange={handleColumnFilterChange}
        filteredCount={filteredData.length}
        totalCount={data.length}
        dropdownFilters={dropdownFilters}
        inventoryId={inventoryId}
        enableTagSearch={enableTagSearch}
        onTagSearch={handleTagSearch}
        currentSearchQuery={currentSearchQuery || internalSearchQuery}
      />

      {/* Mobile Card View */}
      {isMobile ? (
        <Box sx={{ mt: 2 }}>
          {filteredData.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No items found
              </Typography>
            </Paper>
          ) : (
            <List sx={{ p: 0 }}>
              {filteredData
                .slice(
                  paginationModel.page * paginationModel.pageSize,
                  (paginationModel.page + 1) * paginationModel.pageSize
                )
                .map((row) => (
                  <React.Fragment key={row.id}>
                    <Card 
                      sx={{ 
                        mb: 1.5,
                        cursor: onRowClick ? 'pointer' : 'default',
                      }}
                      onClick={() => onRowClick && onRowClick(row)}
                    >
                      <CardContent sx={{ p: 2, pb: 1, '&:last-child': { pb: 1 } }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          {/* Thumbnail on the left */}
                          {columns.find(col => col.field === 'thumbnail') && (
                            <Box sx={{ flexShrink: 0 }}>
                              {columns.find(col => col.field === 'thumbnail')?.renderCell?.({ row })}
                            </Box>
                          )}
                          
                          {/* Content on the right */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            {columns.map((col) => {
                              if (col.field === 'thumbnail') return null;
                              const value = row[col.field];
                              if (!value) return null;
                              
                              // Make the name field prominent
                              if (col.field === 'name') {
                                return (
                                  <Typography 
                                    key={col.field} 
                                    variant="subtitle1" 
                                    fontWeight="medium"
                                    sx={{ mb: 0.5, wordBreak: 'break-word' }}
                                  >
                                    {col.renderCell ? col.renderCell({ row }) : value}
                                  </Typography>
                                );
                              }
                              
                              return (
                                <Box key={col.field} sx={{ display: 'flex', gap: 1, mb: 0.25 }}>
                                  <Typography 
                                    variant="caption" 
                                    color="text.secondary"
                                    sx={{ minWidth: 70, flexShrink: 0 }}
                                  >
                                    {col.headerName}:
                                  </Typography>
                                  <Typography 
                                    variant="body2"
                                    sx={{ wordBreak: 'break-word' }}
                                  >
                                    {col.renderCell ? col.renderCell({ row }) : value}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                          
                          {/* Action buttons on the right */}
                          {(onEdit || onDelete) && (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
                              {onEdit && (
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(row);
                                  }}
                                  aria-label="Edit"
                                  sx={{ p: 0.5 }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              )}
                              {onDelete && (
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(row);
                                  }}
                                  aria-label="Delete"
                                  color="error"
                                  sx={{ p: 0.5 }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              )}
                            </Box>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </React.Fragment>
                ))}
            </List>
          )}
          {/* Mobile Pagination Info */}
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {paginationModel.page * paginationModel.pageSize + 1}-
              {Math.min((paginationModel.page + 1) * paginationModel.pageSize, filteredData.length)} of {filteredData.length}
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center', gap: 1 }}>
              <IconButton
                size="small"
                disabled={paginationModel.page === 0}
                onClick={() => setPaginationModel({ ...paginationModel, page: paginationModel.page - 1 })}
              >
                ←
              </IconButton>
              <IconButton
                size="small"
                disabled={(paginationModel.page + 1) * paginationModel.pageSize >= filteredData.length}
                onClick={() => setPaginationModel({ ...paginationModel, page: paginationModel.page + 1 })}
              >
                →
              </IconButton>
            </Box>
          </Box>
        </Box>
      ) : (
        /* Desktop DataGrid */
        <Paper sx={{ p: { xs: 1, sm: 2 } }}>
          <DataGrid
            rows={filteredData}
            columns={gridColumns}
            loading={loading}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[5, 10, 25, 50]}
            disableRowSelectionOnClick
            onRowClick={(params) => {
              if (onRowClick) {
                onRowClick(params.row);
              }
            }}
            sx={{
              minHeight: 400,
              '& .MuiDataGrid-row': {
                cursor: onRowClick ? 'pointer' : 'default',
              },
              '& .MuiDataGrid-cell': {
                display: 'flex',
                alignItems: 'center',
              },
            }}
            autoHeight
            aria-label="Data table"
          />
        </Paper>
      )}
    </Box>
  );
}
