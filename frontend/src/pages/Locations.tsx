import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
} from '@mui/material';
import { useState, useEffect, useMemo } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useLoading } from '../contexts/LoadingContext';
import { useNotification } from '../contexts/NotificationContext';
import { useInventory } from '../contexts/InventoryContext';
import apiClient from '../services/api';
import type { Location } from '../types';
import LocationFormDialog from '../components/LocationFormDialog';

interface LocationTableRow {
  id: string;
  name: string;
  addressLine1: string;
  town: string;
  country: string;
}

export default function Locations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalSearch, setGlobalSearch] = useState('');
  
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<LocationTableRow | null>(null);

  // Contexts
  const { setLoading: setGlobalLoading } = useLoading();
  const { showSuccess, showError } = useNotification();
  const { currentInventory } = useInventory();

  // Fetch all data when inventory changes
  useEffect(() => {
    if (currentInventory) {
      loadData();
    }
  }, [currentInventory]);

  const loadData = async () => {
    if (!currentInventory) {
      setLoading(false);
      setGlobalLoading(false);
      return;
    }

    try {
      setLoading(true);
      setGlobalLoading(true);
      const locationsData = await apiClient.getLocations(currentInventory.id);
      setLocations(locationsData);
    } catch (error) {
      console.error('Error loading data:', error);
      showError(error instanceof Error ? error.message : 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  // Transform Locations data for table display
  const tableData: LocationTableRow[] = useMemo(() => {
    return locations.map(location => ({
      id: location.id,
      name: location.name,
      addressLine1: location.addressLine1 || '',
      town: location.town || '',
      country: location.country || '',
    }));
  }, [locations]);

  // Filter data based on global search
  const filteredData = useMemo(() => {
    if (!globalSearch) return tableData;
    
    const searchLower = globalSearch.toLowerCase();
    return tableData.filter((row) => {
      return (
        row.name.toLowerCase().includes(searchLower) ||
        row.addressLine1.toLowerCase().includes(searchLower) ||
        row.town.toLowerCase().includes(searchLower) ||
        row.country.toLowerCase().includes(searchLower)
      );
    });
  }, [tableData, globalSearch]);



  const handleAdd = () => {
    setEditingLocation(undefined);
    setFormDialogOpen(true);
  };

  const handleEdit = (row: LocationTableRow) => {
    const location = locations.find(l => l.id === row.id);
    if (location) {
      setEditingLocation(location);
      setFormDialogOpen(true);
    }
  };

  const handleDelete = (row: LocationTableRow) => {
    setLocationToDelete(row);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!locationToDelete || !currentInventory) return;

    try {
      setGlobalLoading(true);
      await apiClient.deleteLocation(locationToDelete.id, currentInventory.id);
      setDeleteDialogOpen(false);
      setLocationToDelete(null);
      showSuccess('Location deleted successfully');
      await loadData();
    } catch (error) {
      console.error('Error deleting location:', error);
      showError(error instanceof Error ? error.message : 'Failed to delete location. Please try again.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setLocationToDelete(null);
  };

  const handleFormSubmit = async (data: Partial<Location>) => {
    try {
      setGlobalLoading(true);
      if (editingLocation) {
        await apiClient.updateLocation(editingLocation.id, data);
        showSuccess('Location updated successfully');
      } else {
        await apiClient.createLocation(data as Omit<Location, 'id' | 'dateAdded'>);
        showSuccess('Location created successfully');
      }
      
      setFormDialogOpen(false);
      setEditingLocation(undefined);
      await loadData();
    } catch (error) {
      console.error('Error saving location:', error);
      showError(error instanceof Error ? error.message : 'Failed to save location. Please try again.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleFormClose = () => {
    setFormDialogOpen(false);
    setEditingLocation(undefined);
  };

  // Show message if no inventory is selected
  if (!currentInventory) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          Locations
        </Typography>
        <Alert severity="info">
          Please select an inventory to view locations. You can create a new inventory from the Inventories page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Locations - {currentInventory.name}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Location
        </Button>
      </Box>

      <Paper sx={{ width: '100%', p: 2 }}>
        {/* Global Search */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label="Search locations"
            variant="outlined"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            size="small"
          />
        </Box>

        {/* Item Count */}
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Showing {filteredData.length} of {tableData.length} locations
          </Typography>
        </Box>

        {/* Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={50} />
                <TableCell>Name</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Town</TableCell>
                <TableCell>Country</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No locations found
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((row) => {
                  return (
                      <TableRow key={row.id} hover>
                        <TableCell></TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.addressLine1}</TableCell>
                        <TableCell>{row.town}</TableCell>
                        <TableCell>{row.country}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(row)}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(row)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Location Form Dialog */}
      <LocationFormDialog
        open={formDialogOpen}
        location={editingLocation}
        locations={locations}
        onSubmit={handleFormSubmit}
        onClose={handleFormClose}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete "{locationToDelete?.name}"? This action cannot be undone.
            Things associated with this location will not be deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
