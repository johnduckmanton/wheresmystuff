import { useState, useMemo } from 'react';
import {
  Box,
  TextField,
  Typography,
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

export interface EntityTableColumn {
  field: string;
  headerName: string;
  flex?: number;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
}

export interface EntityTableProps {
  columns: EntityTableColumn[];
  data: any[];
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onRowClick?: (row: any) => void;
  loading?: boolean;
}

export default function EntityTable({
  columns,
  data,
  onEdit,
  onDelete,
  onRowClick,
  loading = false,
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
        const filterLower = filterValue.toLowerCase();
        filtered = filtered.filter((row) => {
          const value = row[field];
          if (value == null) return false;
          return String(value).toLowerCase().includes(filterLower);
        });
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
    <Paper sx={{ width: '100%', p: { xs: 1, sm: 2 } }}>
      {/* Global Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          label="Search all columns"
          variant="outlined"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          size="small"
          inputProps={{
            'aria-label': 'Search all columns',
          }}
        />
      </Box>

      {/* Column Filters */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {columns
          .filter((col) => col.filterable !== false)
          .map((col) => (
            <TextField
              key={col.field}
              label={`Filter ${col.headerName}`}
              variant="outlined"
              size="small"
              value={columnFilters[col.field] || ''}
              onChange={(e) => handleColumnFilterChange(col.field, e.target.value)}
              sx={{ minWidth: { xs: '100%', sm: 200 } }}
              inputProps={{
                'aria-label': `Filter by ${col.headerName}`,
              }}
            />
          ))}
      </Box>

      {/* Filtered Item Count */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary" role="status" aria-live="polite">
          Showing {filteredData.length} of {data.length} items
        </Typography>
      </Box>

      {/* DataGrid */}
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
  );
}
