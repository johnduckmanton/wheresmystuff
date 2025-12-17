import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
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
}

export default function EntityTable({
  columns,
  data,
  onEdit,
  onDelete,
  onRowClick,
  loading = false,
  dropdownFilters = {},
}: EntityTableProps) {
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  // Filter data based on global search and column filters
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Apply global search
    if (globalSearch) {
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
  }, [data, globalSearch, columnFilters, columns]);

  // Handle column filter change
  const handleColumnFilterChange = (field: string, value: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
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
      />

      {/* DataGrid */}
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
          }}
          autoHeight
          aria-label="Data table"
        />
      </Paper>
    </Box>
  );
}
