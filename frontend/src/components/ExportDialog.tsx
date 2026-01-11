import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  CircularProgress,
  RadioGroup,
  Radio,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  ViewColumn as ViewColumnIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import EnhancedTagInput from './EnhancedTagInput';
import type { SearchQuery } from './SearchBar';
import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import apiClient from '../services/api';
import type { Thing, Category, Location, Room, Person } from '../types';

export interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ExportOptions {
  filename: string;
  format: 'csv' | 'tsv';
  fields: string[];
  includeHeaders: boolean;
  dateFormat: 'iso' | 'uk' | 'us';
  encoding: 'utf8' | 'utf8-bom';
}

interface FilterOptions {
  searchQuery: SearchQuery;
  categories: string[];
  locations: string[];
  owners: string[];
  dateRange: {
    field: 'dateAdded' | 'datePurchased' | 'nextReviewDate';
    from: string;
    to: string;
  };
  includeWithoutPhotos: boolean;
  includeWithPhotos: boolean;
}

const FIELD_OPTIONS = [
  { key: 'name', label: 'Name', category: 'basic' },
  { key: 'description', label: 'Description', category: 'basic' },
  { key: 'make', label: 'Make/Brand', category: 'basic' },
  { key: 'model', label: 'Model', category: 'basic' },
  { key: 'serialNumber', label: 'Serial Number', category: 'basic' },
  { key: 'category', label: 'Category', category: 'basic' },
  { key: 'location', label: 'Location', category: 'location' },
  { key: 'room', label: 'Room', category: 'location' },
  { key: 'owner', label: 'Owner', category: 'location' },
  { key: 'tags', label: 'Tags', category: 'basic' },
  { key: 'dateAdded', label: 'Date Added', category: 'dates' },
  { key: 'datePurchased', label: 'Date Purchased', category: 'purchase' },
  { key: 'purchasePrice', label: 'Purchase Price', category: 'purchase' },
  { key: 'purchasedFrom', label: 'Purchased From', category: 'purchase' },
  { key: 'warrantyDetails', label: 'Warranty Details', category: 'purchase' },
  { key: 'notes', label: 'Notes', category: 'additional' },
  { key: 'nextReviewDate', label: 'Next Review Date', category: 'dates' },
  { key: 'disposalDate', label: 'Disposal Date', category: 'dates' },
  { key: 'photoCount', label: 'Photo Count', category: 'additional' },
  { key: 'hasPhotos', label: 'Has Photos', category: 'additional' },
];

const FIELD_PRESETS = {
  basic: ['name', 'description', 'category', 'location', 'tags'],
  detailed: ['name', 'description', 'make', 'model', 'serialNumber', 'category', 'location', 'room', 'owner', 'tags', 'dateAdded'],
  complete: FIELD_OPTIONS.map(f => f.key),
  inventory: ['name', 'description', 'make', 'model', 'serialNumber', 'category', 'location', 'room', 'tags', 'photoCount'],
  purchase: ['name', 'datePurchased', 'purchasePrice', 'purchasedFrom', 'warrantyDetails', 'nextReviewDate'],
};

export default function ExportDialog({ open, onClose }: ExportDialogProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    filename: '',
    format: 'csv',
    fields: FIELD_PRESETS.detailed,
    includeHeaders: true,
    dateFormat: 'iso',
    encoding: 'utf8-bom',
  });

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    searchQuery: { tagMode: 'and' },
    categories: [],
    locations: [],
    owners: [],
    dateRange: {
      field: 'dateAdded',
      from: '',
      to: '',
    },
    includeWithoutPhotos: true,
    includeWithPhotos: true,
  });

  const [fieldPreset, setFieldPreset] = useState<string>('detailed');
  const [things, setThings] = useState<Thing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const { currentInventory } = useInventory();
  const { showSuccess, showError } = useNotification();

  // Load data when dialog opens
  useEffect(() => {
    if (open && currentInventory) {
      loadData();
      // Set default filename
      const date = new Date().toISOString().split('T')[0];
      setExportOptions(prev => ({
        ...prev,
        filename: `${currentInventory.name.replace(/[^a-zA-Z0-9]/g, '_')}_export_${date}`,
      }));
    }
  }, [open, currentInventory]);

  const loadData = async () => {
    if (!currentInventory) return;

    setLoading(true);
    try {
      const [thingsData, categoriesData, locationsData, roomsData, peopleData] = await Promise.all([
        apiClient.getThings(currentInventory.id),
        apiClient.getCategories(currentInventory.id),
        apiClient.getLocations(currentInventory.id),
        apiClient.getRooms(undefined, currentInventory.id),
        apiClient.getPeople(currentInventory.id),
      ]);

      setThings(Array.isArray(thingsData) ? thingsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setLocations(Array.isArray(locationsData) ? locationsData : []);
      setRooms(Array.isArray(roomsData) ? roomsData : []);
      setPeople(Array.isArray(peopleData) ? peopleData : []);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Failed to load data for export');
    } finally {
      setLoading(false);
    }
  };

  // Filter things based on current filter options
  const filteredThings = useMemo(() => {
    let filtered = [...things];

    // Apply text and tag search
    if (filterOptions.searchQuery.text || (filterOptions.searchQuery.tags && filterOptions.searchQuery.tags.length > 0)) {
      if (filterOptions.searchQuery.text) {
        const searchLower = filterOptions.searchQuery.text.toLowerCase();
        filtered = filtered.filter(thing => 
          thing.name.toLowerCase().includes(searchLower) ||
          (thing.description && thing.description.toLowerCase().includes(searchLower)) ||
          (thing.notes && thing.notes.toLowerCase().includes(searchLower)) ||
          (thing.serialNumber && thing.serialNumber.toLowerCase().includes(searchLower))
        );
      }

      if (filterOptions.searchQuery.tags && filterOptions.searchQuery.tags.length > 0) {
        if (filterOptions.searchQuery.tagMode === 'and') {
          filtered = filtered.filter(thing => {
            if (!thing.tags || thing.tags.length === 0) return false;
            return filterOptions.searchQuery.tags!.every(searchTag => 
              thing.tags!.some(thingTag => 
                thingTag.toLowerCase().includes(searchTag.toLowerCase())
              )
            );
          });
        } else {
          filtered = filtered.filter(thing => {
            if (!thing.tags || thing.tags.length === 0) return false;
            return filterOptions.searchQuery.tags!.some(searchTag => 
              thing.tags!.some(thingTag => 
                thingTag.toLowerCase().includes(searchTag.toLowerCase())
              )
            );
          });
        }
      }
    }

    // Apply category filter
    if (filterOptions.categories.length > 0) {
      filtered = filtered.filter(thing => 
        thing.categoryId && filterOptions.categories.includes(thing.categoryId)
      );
    }

    // Apply location filter
    if (filterOptions.locations.length > 0) {
      filtered = filtered.filter(thing => 
        thing.locationId && filterOptions.locations.includes(thing.locationId)
      );
    }

    // Apply owner filter
    if (filterOptions.owners.length > 0) {
      filtered = filtered.filter(thing => 
        thing.ownerId && filterOptions.owners.includes(thing.ownerId)
      );
    }

    // Apply photo filter
    if (!filterOptions.includeWithPhotos || !filterOptions.includeWithoutPhotos) {
      filtered = filtered.filter(thing => {
        const hasPhotos = thing.photos && thing.photos.length > 0;
        return (hasPhotos && filterOptions.includeWithPhotos) || 
               (!hasPhotos && filterOptions.includeWithoutPhotos);
      });
    }

    // Apply date range filter
    if (filterOptions.dateRange.from || filterOptions.dateRange.to) {
      filtered = filtered.filter(thing => {
        const dateValue = thing[filterOptions.dateRange.field];
        if (!dateValue) return false;
        
        const itemDate = new Date(dateValue);
        const fromDate = filterOptions.dateRange.from ? new Date(filterOptions.dateRange.from) : null;
        const toDate = filterOptions.dateRange.to ? new Date(filterOptions.dateRange.to) : null;
        
        if (fromDate && itemDate < fromDate) return false;
        if (toDate && itemDate > toDate) return false;
        
        return true;
      });
    }

    return filtered;
  }, [things, filterOptions]);

  // Generate preview data
  useEffect(() => {
    if (filteredThings.length > 0) {
      const preview = filteredThings.slice(0, 5).map(thing => {
        const row: any = {};
        exportOptions.fields.forEach(field => {
          row[field] = formatFieldValue(thing, field);
        });
        return row;
      });
      setPreviewData(preview);
    } else {
      setPreviewData([]);
    }
  }, [filteredThings, exportOptions.fields]);

  const formatFieldValue = (thing: Thing, field: string): string => {
    switch (field) {
      case 'category':
        return categories.find(c => c.id === thing.categoryId)?.name || '';
      case 'location':
        return locations.find(l => l.id === thing.locationId)?.name || '';
      case 'room':
        return rooms.find(r => r.id === thing.roomId)?.name || '';
      case 'owner':
        return people.find(p => p.id === thing.ownerId)?.name || '';
      case 'tags':
        return thing.tags ? thing.tags.join(', ') : '';
      case 'photoCount':
        return thing.photos ? thing.photos.length.toString() : '0';
      case 'hasPhotos':
        return thing.photos && thing.photos.length > 0 ? 'Yes' : 'No';
      case 'dateAdded':
      case 'datePurchased':
      case 'nextReviewDate':
      case 'disposalDate':
        const dateValue = thing[field as keyof Thing] as string;
        if (!dateValue) return '';
        return formatDate(dateValue, exportOptions.dateFormat);
      case 'purchasePrice':
        return thing.purchasePrice ? `£${thing.purchasePrice.toFixed(2)}` : '';
      default:
        const value = thing[field as keyof Thing];
        return value ? String(value) : '';
    }
  };

  const formatDate = (dateString: string, format: string): string => {
    const date = new Date(dateString);
    switch (format) {
      case 'uk':
        return date.toLocaleDateString('en-GB');
      case 'us':
        return date.toLocaleDateString('en-US');
      default:
        return date.toISOString().split('T')[0];
    }
  };

  const handleFieldPresetChange = (preset: string) => {
    setFieldPreset(preset);
    if (preset !== 'custom') {
      setExportOptions(prev => ({
        ...prev,
        fields: FIELD_PRESETS[preset as keyof typeof FIELD_PRESETS] || [],
      }));
    }
  };

  const handleFieldToggle = (field: string) => {
    setFieldPreset('custom');
    setExportOptions(prev => ({
      ...prev,
      fields: prev.fields.includes(field)
        ? prev.fields.filter(f => f !== field)
        : [...prev.fields, field],
    }));
  };

  const generateCSV = (): string => {
    const delimiter = exportOptions.format === 'tsv' ? '\t' : ',';
    const lines: string[] = [];

    // Add headers if requested
    if (exportOptions.includeHeaders) {
      const headers = exportOptions.fields.map(field => {
        const fieldOption = FIELD_OPTIONS.find(f => f.key === field);
        return fieldOption ? fieldOption.label : field;
      });
      lines.push(headers.map(h => `"${h}"`).join(delimiter));
    }

    // Add data rows
    filteredThings.forEach(thing => {
      const row = exportOptions.fields.map(field => {
        const value = formatFieldValue(thing, field);
        // Escape quotes and wrap in quotes
        return `"${value.replace(/"/g, '""')}"`;
      });
      lines.push(row.join(delimiter));
    });

    return lines.join('\n');
  };

  const handleExport = async () => {
    if (exportOptions.fields.length === 0) {
      showError('Please select at least one field to export');
      return;
    }

    if (!exportOptions.filename.trim()) {
      showError('Please enter a filename');
      return;
    }

    setExporting(true);
    try {
      const csvContent = generateCSV();
      
      // Create blob with appropriate encoding
      const bom = exportOptions.encoding === 'utf8-bom' ? '\uFEFF' : '';
      const blob = new Blob([bom + csvContent], { 
        type: `text/${exportOptions.format};charset=utf-8` 
      });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${exportOptions.filename}.${exportOptions.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSuccess(`Exported ${filteredThings.length} items to ${exportOptions.filename}.${exportOptions.format}`);
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      showError('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      scroll="paper"
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DownloadIcon />
          <Typography variant="h6">Export Things</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Summary */}
          <Alert severity="info">
            <Typography variant="body2">
              {loading ? 'Loading...' : `${filteredThings.length} items will be exported`}
              {filteredThings.length !== things.length && ` (filtered from ${things.length} total)`}
            </Typography>
          </Alert>

          {/* Filters */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterIcon />
                <Typography variant="subtitle1">Filters</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Search and Tags */}
                <Box>
                  <TextField
                    fullWidth
                    label="Search Text"
                    value={filterOptions.searchQuery.text || ''}
                    onChange={(e) => setFilterOptions(prev => ({
                      ...prev,
                      searchQuery: { ...prev.searchQuery, text: e.target.value }
                    }))}
                    placeholder="Search in name, description, notes, serial number..."
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  <EnhancedTagInput
                    tags={filterOptions.searchQuery.tags || []}
                    onTagsChange={(tags) => setFilterOptions(prev => ({
                      ...prev,
                      searchQuery: { ...prev.searchQuery, tags }
                    }))}
                    label="Filter by Tags"
                    placeholder="Add tags to filter by..."
                    enableApiSuggestions={true}
                    size="small"
                  />
                  <FormControl component="fieldset" sx={{ mt: 1 }}>
                    <RadioGroup
                      row
                      value={filterOptions.searchQuery.tagMode}
                      onChange={(e) => setFilterOptions(prev => ({
                        ...prev,
                        searchQuery: { ...prev.searchQuery, tagMode: e.target.value as 'and' | 'or' }
                      }))}
                    >
                      <FormControlLabel value="and" control={<Radio size="small" />} label="All tags (AND)" />
                      <FormControlLabel value="or" control={<Radio size="small" />} label="Any tag (OR)" />
                    </RadioGroup>
                  </FormControl>
                </Box>

                {/* Photo Filter */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Photo Filter</Typography>
                  <FormGroup row>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={filterOptions.includeWithPhotos}
                          onChange={(e) => setFilterOptions(prev => ({
                            ...prev,
                            includeWithPhotos: e.target.checked
                          }))}
                        />
                      }
                      label="Include items with photos"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={filterOptions.includeWithoutPhotos}
                          onChange={(e) => setFilterOptions(prev => ({
                            ...prev,
                            includeWithoutPhotos: e.target.checked
                          }))}
                        />
                      }
                      label="Include items without photos"
                    />
                  </FormGroup>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Field Selection */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ViewColumnIcon />
                <Typography variant="subtitle1">Fields to Export</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Field Presets */}
                <FormControl size="small">
                  <InputLabel>Field Preset</InputLabel>
                  <Select
                    value={fieldPreset}
                    label="Field Preset"
                    onChange={(e) => handleFieldPresetChange(e.target.value)}
                  >
                    <MenuItem value="basic">Basic (Name, Description, Category, Location, Tags)</MenuItem>
                    <MenuItem value="detailed">Detailed (Basic + Make, Model, Serial, Room, Owner, Date Added)</MenuItem>
                    <MenuItem value="complete">Complete (All Fields)</MenuItem>
                    <MenuItem value="inventory">Inventory Focus (Basic + Make, Model, Serial, Photo Count)</MenuItem>
                    <MenuItem value="purchase">Purchase Focus (Purchase Details)</MenuItem>
                    <MenuItem value="custom">Custom Selection</MenuItem>
                  </Select>
                </FormControl>

                {/* Field Checkboxes */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Selected Fields ({exportOptions.fields.length})
                  </Typography>
                  <FormGroup>
                    {Object.entries(
                      FIELD_OPTIONS.reduce((acc, field) => {
                        if (!acc[field.category]) acc[field.category] = [];
                        acc[field.category].push(field);
                        return acc;
                      }, {} as Record<string, typeof FIELD_OPTIONS>)
                    ).map(([category, fields]) => (
                      <Box key={category} sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                          {category}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                          {fields.map(field => (
                            <FormControlLabel
                              key={field.key}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={exportOptions.fields.includes(field.key)}
                                  onChange={() => handleFieldToggle(field.key)}
                                />
                              }
                              label={field.label}
                              sx={{ mr: 2 }}
                            />
                          ))}
                        </Box>
                      </Box>
                    ))}
                  </FormGroup>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Export Options */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon />
                <Typography variant="subtitle1">Export Options</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Filename"
                  value={exportOptions.filename}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, filename: e.target.value }))}
                  size="small"
                  helperText="File extension will be added automatically"
                />
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Format</InputLabel>
                    <Select
                      value={exportOptions.format}
                      label="Format"
                      onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as 'csv' | 'tsv' }))}
                    >
                      <MenuItem value="csv">CSV (Comma-separated)</MenuItem>
                      <MenuItem value="tsv">TSV (Tab-separated)</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Date Format</InputLabel>
                    <Select
                      value={exportOptions.dateFormat}
                      label="Date Format"
                      onChange={(e) => setExportOptions(prev => ({ ...prev, dateFormat: e.target.value as any }))}
                    >
                      <MenuItem value="iso">ISO (YYYY-MM-DD)</MenuItem>
                      <MenuItem value="uk">UK (DD/MM/YYYY)</MenuItem>
                      <MenuItem value="us">US (MM/DD/YYYY)</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Encoding</InputLabel>
                    <Select
                      value={exportOptions.encoding}
                      label="Encoding"
                      onChange={(e) => setExportOptions(prev => ({ ...prev, encoding: e.target.value as any }))}
                    >
                      <MenuItem value="utf8">UTF-8</MenuItem>
                      <MenuItem value="utf8-bom">UTF-8 with BOM</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={exportOptions.includeHeaders}
                      onChange={(e) => setExportOptions(prev => ({ ...prev, includeHeaders: e.target.checked }))}
                    />
                  }
                  label="Include column headers"
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Preview */}
          {previewData.length > 0 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Preview (First 5 rows)
              </Typography>
              <Box sx={{ 
                border: 1, 
                borderColor: 'divider', 
                borderRadius: 1, 
                overflow: 'auto',
                maxHeight: 200,
                fontSize: '0.75rem'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      {exportOptions.fields.map(field => {
                        const fieldOption = FIELD_OPTIONS.find(f => f.key === field);
                        return (
                          <th key={field} style={{ 
                            padding: '8px', 
                            textAlign: 'left', 
                            borderBottom: '1px solid #ddd',
                            fontWeight: 600
                          }}>
                            {fieldOption?.label || field}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => (
                      <tr key={index}>
                        {exportOptions.fields.map(field => (
                          <td key={field} style={{ 
                            padding: '8px', 
                            borderBottom: '1px solid #eee',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {row[field]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={exporting || loading || exportOptions.fields.length === 0}
          startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
        >
          {exporting ? 'Exporting...' : `Export ${filteredThings.length} Items`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}