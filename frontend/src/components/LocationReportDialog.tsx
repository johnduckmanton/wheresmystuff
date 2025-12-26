import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Checkbox,
  FormControlLabel,
  Typography,
  Box,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import apiClient from '../services/api';
import type { Location, Category } from '../types';

interface LocationReportDialogProps {
  open: boolean;
  onClose: () => void;
  location: Location | null;
  inventoryId: string;
  categories: Category[];
}

interface ReportFilters {
  categoryFilter?: string;
  containerTypeFilter?: string;
  statusFilter?: string;
  handlingFlagsFilter?: string[];
  dateRangeStart?: string;
  dateRangeEnd?: string;
  valueRangeMin?: number;
  valueRangeMax?: number;
  includeEmptyContainers: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  groupBy: string;
  template: string;
}

const containerTypes = ['box', 'bag', 'crate', 'bin', 'suitcase', 'trunk', 'custom'];
const containerStatuses = ['empty', 'packing', 'packed', 'in_transit', 'stored', 'unpacking', 'unpacked'];
const handlingFlags = ['fragile', 'heavy', 'valuable', 'priority', 'keep_upright', 'temperature_sensitive'];
const sortOptions = [
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Type' },
  { value: 'status', label: 'Status' },
  { value: 'itemCount', label: 'Item Count' },
  { value: 'value', label: 'Value' },
  { value: 'createdAt', label: 'Created Date' }
];
const groupOptions = [
  { value: 'container', label: 'No Grouping' },
  { value: 'type', label: 'By Type' },
  { value: 'status', label: 'By Status' },
  { value: 'handlingFlags', label: 'By Handling Flags' },
  { value: 'value', label: 'By Value Range' }
];
const templateOptions = [
  { value: 'standard', label: 'Standard' },
  { value: 'summary', label: 'Summary' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'moving', label: 'Moving' }
];

export default function LocationReportDialog({
  open,
  onClose,
  location,
  inventoryId,
  categories
}: LocationReportDialogProps) {
  const [filters, setFilters] = useState<ReportFilters>({
    includeEmptyContainers: true,
    sortBy: 'name',
    sortOrder: 'asc',
    groupBy: 'container',
    template: 'standard'
  });
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const handleFilterChange = (field: keyof ReportFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleHandlingFlagToggle = (flag: string) => {
    const currentFlags = filters.handlingFlagsFilter || [];
    const newFlags = currentFlags.includes(flag)
      ? currentFlags.filter(f => f !== flag)
      : [...currentFlags, flag];
    
    setFilters(prev => ({
      ...prev,
      handlingFlagsFilter: newFlags.length > 0 ? newFlags : undefined
    }));
  };

  const clearFilters = () => {
    setFilters({
      includeEmptyContainers: true,
      sortBy: 'name',
      sortOrder: 'asc',
      groupBy: 'container',
      template: 'standard'
    });
  };

  const generateReport = async () => {
    if (!location) return;

    setLoading(true);
    setError(null);

    try {
      const options = {
        ...filters
      };

      const data = await apiClient.generateLocationReport(location.id, inventoryId, options);
      setReportData(data);
    } catch (err) {
      console.error('Error generating report:', err);
      setError('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: 'csv' | 'pdf') => {
    if (!location) return;

    try {
      const options = {
        ...filters,
        format
      };

      if (format === 'csv') {
        const csvData = await apiClient.generateLocationReport(location.id, inventoryId, options);
        
        // Create and download CSV file
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `location-report-${location.name}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // PDF export would be handled similarly
        setError('PDF export not yet implemented');
      }
    } catch (err) {
      console.error('Error exporting report:', err);
      setError('Failed to export report. Please try again.');
    }
  };

  useEffect(() => {
    if (open && location) {
      generateReport();
    }
  }, [open, location]);

  const renderReportContent = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return <Alert severity="error">{error}</Alert>;
    }

    if (!reportData) {
      return <Typography>No report data available</Typography>;
    }

    return (
      <Box>
        {/* Report Summary */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Report Summary
          </Typography>
          <Box display="flex" justifyContent="space-around">
            <Box textAlign="center">
              <Typography variant="body2" color="textSecondary">
                Total Containers
              </Typography>
              <Typography variant="h6">
                {reportData.summary.totalContainers}
              </Typography>
            </Box>
            <Box textAlign="center">
              <Typography variant="body2" color="textSecondary">
                Total Items
              </Typography>
              <Typography variant="h6">
                {reportData.summary.totalItems}
              </Typography>
            </Box>
            <Box textAlign="center">
              <Typography variant="body2" color="textSecondary">
                Total Value
              </Typography>
              <Typography variant="h6">
                ${reportData.summary.totalValue.toFixed(2)}
              </Typography>
            </Box>
            <Box textAlign="center">
              <Typography variant="body2" color="textSecondary">
                Categories
              </Typography>
              <Typography variant="h6">
                {Object.keys(reportData.summary.categorySummary).length}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Category Summary */}
        {Object.keys(reportData.summary.categorySummary).length > 0 && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Category Breakdown
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Items</TableCell>
                    <TableCell align="right">Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(reportData.summary.categorySummary).map(([category, data]: [string, any]) => (
                    <TableRow key={category}>
                      <TableCell>{category}</TableCell>
                      <TableCell align="right">{data.count}</TableCell>
                      <TableCell align="right">${data.value.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* Container Details */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Container Details
          </Typography>
          {Array.isArray(reportData.containers) ? (
            // Ungrouped containers
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Container</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Items</TableCell>
                    <TableCell align="right">Value</TableCell>
                    <TableCell>Handling</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.containers.map((containerReport: any) => (
                    <TableRow key={containerReport.container.id}>
                      <TableCell>{containerReport.container.name}</TableCell>
                      <TableCell>{containerReport.container.type}</TableCell>
                      <TableCell>{containerReport.container.status}</TableCell>
                      <TableCell align="right">{containerReport.itemCount}</TableCell>
                      <TableCell align="right">${containerReport.estimatedValue.toFixed(2)}</TableCell>
                      <TableCell>
                        {containerReport.container.handlingFlags?.map((flag: string) => (
                          <Chip key={flag} label={flag} size="small" sx={{ mr: 0.5 }} />
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            // Grouped containers
            reportData.containers.map((group: any) => (
              <Accordion key={group.groupName} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">
                    {group.groupName} ({group.summary.containerCount} containers, {group.summary.totalItems} items)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Container</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Items</TableCell>
                          <TableCell align="right">Value</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {group.containers.map((containerReport: any) => (
                          <TableRow key={containerReport.container.id}>
                            <TableCell>{containerReport.container.name}</TableCell>
                            <TableCell>{containerReport.container.type}</TableCell>
                            <TableCell>{containerReport.container.status}</TableCell>
                            <TableCell align="right">{containerReport.itemCount}</TableCell>
                            <TableCell align="right">${containerReport.estimatedValue.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            ))
          )}
        </Paper>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            Location Report: {location?.name}
          </Typography>
          <Box>
            <Button
              startIcon={<DownloadIcon />}
              onClick={() => exportReport('csv')}
              disabled={!reportData}
              sx={{ mr: 1 }}
            >
              Export CSV
            </Button>
            <Button
              startIcon={<FilterListIcon />}
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              variant={filtersExpanded ? 'contained' : 'outlined'}
            >
              Filters
            </Button>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Filters Section */}
        <Accordion expanded={filtersExpanded} onChange={() => setFiltersExpanded(!filtersExpanded)}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Report Filters & Options</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box display="flex" flexDirection="column" gap={2}>
              {/* Basic Filters */}
              <FormControl fullWidth>
                <InputLabel>Category Filter</InputLabel>
                <Select
                  value={filters.categoryFilter || ''}
                  onChange={(e) => handleFilterChange('categoryFilter', e.target.value || undefined)}
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Container Type</InputLabel>
                <Select
                  value={filters.containerTypeFilter || ''}
                  onChange={(e) => handleFilterChange('containerTypeFilter', e.target.value || undefined)}
                >
                  <MenuItem value="">All Types</MenuItem>
                  {containerTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={filters.statusFilter || ''}
                  onChange={(e) => handleFilterChange('statusFilter', e.target.value || undefined)}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  {containerStatuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Date Range */}
              <TextField
                fullWidth
                label="Date Range Start"
                type="date"
                value={filters.dateRangeStart || ''}
                onChange={(e) => handleFilterChange('dateRangeStart', e.target.value || undefined)}
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                fullWidth
                label="Date Range End"
                type="date"
                value={filters.dateRangeEnd || ''}
                onChange={(e) => handleFilterChange('dateRangeEnd', e.target.value || undefined)}
                InputLabelProps={{ shrink: true }}
              />

              {/* Value Range */}
              <TextField
                fullWidth
                label="Minimum Value"
                type="number"
                value={filters.valueRangeMin || ''}
                onChange={(e) => handleFilterChange('valueRangeMin', e.target.value ? parseFloat(e.target.value) : undefined)}
              />

              <TextField
                fullWidth
                label="Maximum Value"
                type="number"
                value={filters.valueRangeMax || ''}
                onChange={(e) => handleFilterChange('valueRangeMax', e.target.value ? parseFloat(e.target.value) : undefined)}
              />

              {/* Handling Flags */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Handling Flags Filter
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {handlingFlags.map((flag) => (
                    <Chip
                      key={flag}
                      label={flag.replace('_', ' ')}
                      clickable
                      color={filters.handlingFlagsFilter?.includes(flag) ? 'primary' : 'default'}
                      onClick={() => handleHandlingFlagToggle(flag)}
                    />
                  ))}
                </Box>
              </Box>

              {/* Sorting and Grouping */}
              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                >
                  {sortOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Sort Order</InputLabel>
                <Select
                  value={filters.sortOrder}
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                >
                  <MenuItem value="asc">Ascending</MenuItem>
                  <MenuItem value="desc">Descending</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Group By</InputLabel>
                <Select
                  value={filters.groupBy}
                  onChange={(e) => handleFilterChange('groupBy', e.target.value)}
                >
                  {groupOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Template and Options */}
              <FormControl fullWidth>
                <InputLabel>Report Template</InputLabel>
                <Select
                  value={filters.template}
                  onChange={(e) => handleFilterChange('template', e.target.value)}
                >
                  {templateOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={filters.includeEmptyContainers}
                    onChange={(e) => handleFilterChange('includeEmptyContainers', e.target.checked)}
                  />
                }
                label="Include Empty Containers"
              />

              {/* Action Buttons */}
              <Box display="flex" gap={1}>
                <Button
                  variant="contained"
                  onClick={generateReport}
                  disabled={loading}
                >
                  Generate Report
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>

        <Divider sx={{ my: 2 }} />

        {/* Report Content */}
        {renderReportContent()}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}