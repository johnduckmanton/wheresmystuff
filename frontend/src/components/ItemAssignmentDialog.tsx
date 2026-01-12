import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress,
  Tabs,
  Tab
} from '@mui/material';
import {
  Search as SearchIcon,
  Inventory as InventoryIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon
} from '@mui/icons-material';
import type { Thing, MovingProject } from '../types';
import apiClient from '../services/api';

interface ItemAssignmentDialogProps {
  open: boolean;
  project: MovingProject;
  inventoryId: string;
  onClose: () => void;
  onAssignmentChange: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`item-assignment-tabpanel-${index}`}
      aria-labelledby={`item-assignment-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

/**
 * Item Assignment Dialog Component
 * Allows users to assign/unassign items to/from projects
 * Validates: Requirements 11.1, 12.1, 14.1
 */
const ItemAssignmentDialog: React.FC<ItemAssignmentDialogProps> = ({
  open,
  project,
  inventoryId,
  onClose,
  onAssignmentChange
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [allItems, setAllItems] = useState<Thing[]>([]);
  const [assignedItems, setAssignedItems] = useState<Thing[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load items when dialog opens
  useEffect(() => {
    if (open) {
      loadItems();
    }
  }, [open, inventoryId]);

  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all items for the inventory
      const itemsResponse = await apiClient.getThings(inventoryId);
      
      // Ensure we have an array
      const items: Thing[] = Array.isArray(itemsResponse) ? itemsResponse : [];
      
      setAllItems(items);
      
      // Separate assigned and unassigned items
      const assigned = items.filter(item => item.projectId === project.id);
      
      setAssignedItems(assigned);
      
    } catch (err) {
      console.error('Error loading items:', err);
      setError('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setSelectedItems(new Set()); // Clear selection when switching tabs
  };

  const handleItemToggle = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleAssignItems = async () => {
    if (selectedItems.size === 0) return;
    
    try {
      setSaving(true);
      setError(null);
      
      await apiClient.assignItemsToProject(project.id, {
        itemIds: Array.from(selectedItems),
        inventoryId
      });
      
      // Reload items to reflect changes
      await loadItems();
      setSelectedItems(new Set());
      onAssignmentChange();
      
    } catch (err) {
      console.error('Error assigning items:', err);
      setError('Failed to assign items to project');
    } finally {
      setSaving(false);
    }
  };

  const handleUnassignItems = async () => {
    if (selectedItems.size === 0) return;
    
    try {
      setSaving(true);
      setError(null);
      
      await apiClient.removeItemsFromProject(project.id, {
        itemIds: Array.from(selectedItems),
        inventoryId
      });
      
      // Reload items to reflect changes
      await loadItems();
      setSelectedItems(new Set());
      onAssignmentChange();
      
    } catch (err) {
      console.error('Error removing items:', err);
      setError('Failed to remove items from project');
    } finally {
      setSaving(false);
    }
  };

  const getFilteredItems = (items: Thing[]) => {
    if (!searchTerm) return items;
    
    return items.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.model?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getUnassignedItems = () => {
    return allItems.filter(item => !item.projectId || item.projectId !== project.id);
  };

  const renderItemList = (items: Thing[], showAssignButton: boolean) => {
    const filteredItems = getFilteredItems(items);
    
    if (filteredItems.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <InventoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {searchTerm ? 'No items match your search' : 'No items available'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {showAssignButton 
              ? 'All items are already assigned to projects or none match your search.'
              : 'No items are currently assigned to this project.'
            }
          </Typography>
        </Box>
      );
    }

    return (
      <List>
        {filteredItems.map((item) => (
          <ListItem
            key={item.id}
            component="div"
            onClick={() => handleItemToggle(item.id)}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              mb: 1,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <ListItemIcon>
              <Checkbox
                edge="start"
                checked={selectedItems.has(item.id)}
                tabIndex={-1}
                disableRipple
                icon={<CheckBoxOutlineBlankIcon />}
                checkedIcon={<CheckBoxIcon />}
              />
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {item.name}
                  </Typography>
                  {item.containerId && (
                    <Chip 
                      label="Containerized" 
                      size="small"
                      color="info"
                    />
                  )}
                  {item.projectId && item.projectId !== project.id && (
                    <Chip 
                      label="Other Project" 
                      size="small"
                      color="warning"
                    />
                  )}
                </Box>
              }
              secondary={
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {item.make && item.model ? `${item.make} ${item.model}` : (item.make || item.model || 'No make/model')}
                  </Typography>
                  {item.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {item.description}
                    </Typography>
                  )}
                </Box>
              }
            />
            <ListItemSecondaryAction>
              <Box sx={{ textAlign: 'right' }}>
                {item.purchasePrice && (
                  <Typography variant="body2" color="primary">
                    £{item.purchasePrice.toLocaleString()}
                  </Typography>
                )}
                {item.categoryId && (
                  <Typography variant="body2" color="text.secondary">
                    Category
                  </Typography>
                )}
              </Box>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: { minHeight: '600px', maxHeight: '90vh' }
        }
      }}
    >
      <DialogTitle>
        <Box>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
            Manage Item Assignments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Project: {project.name}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Search Bar */}
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                placeholder="Search items by name, description, make, or model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="item assignment tabs">
                <Tab 
                  label={`Available Items (${getUnassignedItems().length})`}
                  icon={<InventoryIcon />} 
                />
                <Tab 
                  label={`Assigned Items (${assignedItems.length})`}
                  icon={<CheckBoxIcon />} 
                />
              </Tabs>
            </Box>

            {/* Available Items Tab */}
            <TabPanel value={tabValue} index={0}>
              {renderItemList(getUnassignedItems(), true)}
            </TabPanel>

            {/* Assigned Items Tab */}
            <TabPanel value={tabValue} index={1}>
              {renderItemList(assignedItems, false)}
            </TabPanel>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Close
        </Button>
        
        {tabValue === 0 && selectedItems.size > 0 && (
          <Button 
            onClick={handleAssignItems}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <CheckBoxIcon />}
          >
            {saving ? 'Assigning...' : `Assign ${selectedItems.size} Item${selectedItems.size > 1 ? 's' : ''}`}
          </Button>
        )}
        
        {tabValue === 1 && selectedItems.size > 0 && (
          <Button 
            onClick={handleUnassignItems}
            variant="outlined"
            color="error"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <CheckBoxOutlineBlankIcon />}
          >
            {saving ? 'Removing...' : `Remove ${selectedItems.size} Item${selectedItems.size > 1 ? 's' : ''}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ItemAssignmentDialog;