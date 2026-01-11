import { useState, useEffect } from 'react';
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
  Chip,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  ListItemIcon,
  TextField,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  LocalOffer as TagIcon,
} from '@mui/icons-material';
import EnhancedTagInput from './EnhancedTagInput';
import apiClient from '../services/api';
import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import type { Thing } from '../types';

export interface BulkTagOperationsDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface BulkOperationResult {
  operation: string;
  totalRequested: number;
  successful: number;
  failed: number;
  errors: string[];
  updatedThings: Array<{
    id: string;
    name: string;
    previousTags: string[];
    newTags: string[];
  }>;
}

export default function BulkTagOperationsDialog({
  open,
  onClose,
  onSuccess,
}: BulkTagOperationsDialogProps) {
  const [operation, setOperation] = useState<'add' | 'remove' | 'replace'>('add');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedThings, setSelectedThings] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableThings, setAvailableThings] = useState<Thing[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<BulkOperationResult | null>(null);
  
  const { currentInventory } = useInventory();
  const { showSuccess, showError } = useNotification();

  // Load available things when dialog opens
  useEffect(() => {
    if (open && currentInventory) {
      loadThings();
    }
  }, [open, currentInventory]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setOperation('add');
      setTags([]);
      setSelectedThings([]);
      setSearchQuery('');
      setResult(null);
    }
  }, [open]);

  const loadThings = async () => {
    if (!currentInventory) return;

    setSearching(true);
    try {
      const things = await apiClient.getThings(currentInventory.id);
      setAvailableThings(things);
    } catch (error) {
      console.error('Error loading things:', error);
      showError('Failed to load things');
    } finally {
      setSearching(false);
    }
  };

  // Filter things based on search query
  const filteredThings = availableThings.filter(thing =>
    thing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (thing.description && thing.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (thing.tags && thing.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const handleThingToggle = (thingId: string) => {
    setSelectedThings(prev => 
      prev.includes(thingId) 
        ? prev.filter(id => id !== thingId)
        : [...prev, thingId]
    );
  };

  const handleSelectAll = () => {
    if (selectedThings.length === filteredThings.length) {
      setSelectedThings([]);
    } else {
      setSelectedThings(filteredThings.map(thing => thing.id));
    }
  };

  const handleSubmit = async () => {
    if (!currentInventory || selectedThings.length === 0 || tags.length === 0) {
      return;
    }

    setLoading(true);
    try {
      const result = await apiClient.bulkTagOperation(currentInventory.id, {
        operation,
        thingIds: selectedThings,
        tags,
      });

      setResult(result);
      
      if (result.successful > 0) {
        showSuccess(`Successfully ${operation === 'add' ? 'added tags to' : operation === 'remove' ? 'removed tags from' : 'replaced tags on'} ${result.successful} item${result.successful !== 1 ? 's' : ''}`);
        if (onSuccess) {
          onSuccess();
        }
      }

      if (result.failed > 0) {
        showError(`Failed to update ${result.failed} item${result.failed !== 1 ? 's' : ''}. Check the details below.`);
      }

    } catch (error) {
      console.error('Error performing bulk tag operation:', error);
      showError('Failed to perform bulk tag operation');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  const getOperationDescription = () => {
    switch (operation) {
      case 'add':
        return 'Add the specified tags to selected items (existing tags will be preserved)';
      case 'remove':
        return 'Remove the specified tags from selected items (other tags will be preserved)';
      case 'replace':
        return 'Replace all tags on selected items with the specified tags';
      default:
        return '';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TagIcon />
          <Typography variant="h6">Bulk Tag Operations</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {result ? (
          // Show results
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity={result.failed === 0 ? 'success' : 'warning'}>
              <Typography variant="subtitle2" gutterBottom>
                Operation Complete
              </Typography>
              <Typography variant="body2">
                {result.successful} of {result.totalRequested} items updated successfully
                {result.failed > 0 && ` (${result.failed} failed)`}
              </Typography>
            </Alert>

            {result.errors.length > 0 && (
              <Alert severity="error">
                <Typography variant="subtitle2" gutterBottom>
                  Errors:
                </Typography>
                <Box component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
                  {result.errors.map((error, index) => (
                    <li key={index}>
                      <Typography variant="body2">{error}</Typography>
                    </li>
                  ))}
                </Box>
              </Alert>
            )}

            {result.updatedThings.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Updated Items:
                </Typography>
                <List dense>
                  {result.updatedThings.slice(0, 10).map((thing) => (
                    <ListItem key={thing.id}>
                      <ListItemText
                        primary={thing.name}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              Previous: {thing.previousTags.length > 0 ? thing.previousTags.join(', ') : 'No tags'}
                            </Typography>
                            <Typography variant="caption" display="block">
                              New: {thing.newTags.length > 0 ? thing.newTags.join(', ') : 'No tags'}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                  {result.updatedThings.length > 10 && (
                    <ListItem>
                      <ListItemText
                        secondary={`... and ${result.updatedThings.length - 10} more items`}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            )}
          </Box>
        ) : (
          // Show operation form
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Operation Selection */}
            <Box>
              <FormControl fullWidth>
                <InputLabel>Operation</InputLabel>
                <Select
                  value={operation}
                  label="Operation"
                  onChange={(e) => setOperation(e.target.value as 'add' | 'remove' | 'replace')}
                >
                  <MenuItem value="add">Add Tags</MenuItem>
                  <MenuItem value="remove">Remove Tags</MenuItem>
                  <MenuItem value="replace">Replace All Tags</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {getOperationDescription()}
              </Typography>
            </Box>

            {/* Tag Selection */}
            <Box>
              <EnhancedTagInput
                tags={tags}
                onTagsChange={setTags}
                label="Tags"
                placeholder={`Enter tags to ${operation}...`}
                enableApiSuggestions={true}
                maxTags={20}
              />
            </Box>

            <Divider />

            {/* Thing Selection */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Select Items ({selectedThings.length} selected)
              </Typography>
              
              {/* Search */}
              <TextField
                fullWidth
                size="small"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
                sx={{ mb: 2 }}
              />

              {/* Select All */}
              <Box sx={{ mb: 1 }}>
                <Button
                  size="small"
                  onClick={handleSelectAll}
                  disabled={filteredThings.length === 0}
                >
                  {selectedThings.length === filteredThings.length ? 'Deselect All' : 'Select All'}
                  {filteredThings.length > 0 && ` (${filteredThings.length})`}
                </Button>
              </Box>

              {/* Things List */}
              <Box sx={{ maxHeight: 300, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                {searching ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : filteredThings.length === 0 ? (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {searchQuery ? 'No items match your search' : 'No items available'}
                    </Typography>
                  </Box>
                ) : (
                  <List dense>
                    {filteredThings.map((thing) => (
                      <ListItem
                        key={thing.id}
                        component="div"
                        onClick={() => handleThingToggle(thing.id)}
                        sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                      >
                        <ListItemIcon>
                          <Checkbox
                            edge="start"
                            checked={selectedThings.includes(thing.id)}
                            tabIndex={-1}
                            disableRipple
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={thing.name}
                          secondary={
                            <Box>
                              {thing.description && (
                                <Typography variant="caption" display="block">
                                  {thing.description}
                                </Typography>
                              )}
                              {thing.tags && thing.tags.length > 0 && (
                                <Box sx={{ mt: 0.5 }}>
                                  {thing.tags.slice(0, 3).map((tag) => (
                                    <Chip
                                      key={tag}
                                      label={tag}
                                      size="small"
                                      sx={{ mr: 0.5, mb: 0.5, fontSize: '0.7rem', height: 20 }}
                                    />
                                  ))}
                                  {thing.tags.length > 3 && (
                                    <Chip
                                      label={`+${thing.tags.length - 3} more`}
                                      size="small"
                                      variant="outlined"
                                      sx={{ mr: 0.5, mb: 0.5, fontSize: '0.7rem', height: 20 }}
                                    />
                                  )}
                                </Box>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {!result && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || selectedThings.length === 0 || tags.length === 0}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            {loading ? 'Processing...' : `${operation.charAt(0).toUpperCase() + operation.slice(1)} Tags`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}