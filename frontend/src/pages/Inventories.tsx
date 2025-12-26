import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';
import { useLoading } from '../contexts/LoadingContext';
import apiClient from '../services/api';
import type { Inventory } from '../types';
import InventoryFormDialog from '../components/InventoryFormDialog';

/**
 * Inventories Page Component
 * Displays list of user's inventories with create, edit, delete functionality
 * Validates: Requirements 1.1
 */
export default function Inventories() {
  const navigate = useNavigate();
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuInventoryId, setMenuInventoryId] = useState<string | null>(null);
  
  const { showSuccess, showError } = useNotification();
  const { setLoading } = useLoading();

  // Load inventories on component mount
  useEffect(() => {
    loadInventories();
  }, []);

  const loadInventories = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getInventories();
      // Ensure we have an array, fallback to empty array if not
      setInventories(Array.isArray(data) ? data : []);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load inventories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInventory = () => {
    setSelectedInventory(null);
    setIsFormOpen(true);
  };

  const handleEditInventory = (inventory: Inventory) => {
    setSelectedInventory(inventory);
    setIsFormOpen(true);
    handleCloseMenu();
  };

  const handleDeleteInventory = async (inventory: Inventory) => {
    if (!window.confirm(`Are you sure you want to delete "${inventory.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.deleteInventory(inventory.id);
      showSuccess('Inventory deleted successfully');
      loadInventories();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete inventory');
    } finally {
      setLoading(false);
    }
    handleCloseMenu();
  };

  const handleFormSubmit = async (data: Omit<Inventory, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true);
      if (selectedInventory) {
        await apiClient.updateInventory(selectedInventory.id, data);
        showSuccess('Inventory updated successfully');
      } else {
        await apiClient.createInventory(data);
        showSuccess('Inventory created successfully');
      }
      setIsFormOpen(false);
      loadInventories();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to save inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, inventoryId: string) => {
    setAnchorEl(event.currentTarget);
    setMenuInventoryId(inventoryId);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuInventoryId(null);
  };

  const getMenuInventory = () => {
    return inventories.find(inv => inv.id === menuInventoryId);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Inventories
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateInventory}
        >
          Create Inventory
        </Button>
      </Box>

      {/* Inventories Grid */}
      {inventories.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 4 }}>
          <CardContent>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No inventories found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create your first inventory to start organizing your items
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateInventory}
            >
              Create Inventory
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {inventories.map((inventory) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={inventory.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" component="h2" noWrap>
                      {inventory.name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuClick(e, inventory.id)}
                      aria-label={`More actions for ${inventory.name}`}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                  
                  {inventory.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {inventory.description}
                    </Typography>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      size="small"
                      label="Owner"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                </CardContent>
                
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<PeopleIcon />}
                    onClick={() => navigate(`/inventories/${inventory.id}/members`)}
                  >
                    Manage Members
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
      >
        <MenuItem onClick={() => {
          const inventory = getMenuInventory();
          if (inventory) handleEditInventory(inventory);
        }}>
          <EditIcon sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => {
          const inventory = getMenuInventory();
          if (inventory) handleDeleteInventory(inventory);
        }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Form Dialog */}
      <InventoryFormDialog
        open={isFormOpen}
        inventory={selectedInventory}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
      />
    </Box>
  );
}