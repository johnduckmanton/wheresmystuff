import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { useState, useEffect } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EntityTable from '../components/EntityTable';
import type { EntityTableColumn } from '../components/EntityTable';
import ThingFormDialog from '../components/ThingFormDialog';
import { useLoading } from '../contexts/LoadingContext';
import { useNotification } from '../contexts/NotificationContext';
import apiClient from '../services/api';
import type { Thing, Location, Room, Category, Person } from '../types';

const columns: EntityTableColumn[] = [
  { field: 'name', headerName: 'Name', flex: 1 },
  { field: 'description', headerName: 'Description', flex: 1 },
  { field: 'location', headerName: 'Location', flex: 1 },
  { field: 'room', headerName: 'Room', flex: 1 },
  { field: 'owner', headerName: 'Owner', flex: 1 },
  { field: 'category', headerName: 'Category', flex: 1 },
  { field: 'dateAdded', headerName: 'Date Added', width: 120 },
];

interface ThingTableRow {
  id: string;
  name: string;
  description: string;
  location: string;
  room: string;
  owner: string;
  category: string;
  dateAdded: string;
}

export default function Things() {
  const [things, setThings] = useState<Thing[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingThing, setEditingThing] = useState<Thing | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [thingToDelete, setThingToDelete] = useState<ThingTableRow | null>(null);

  // Contexts
  const { setLoading: setGlobalLoading } = useLoading();
  const { showSuccess, showError } = useNotification();

  // Fetch all data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setGlobalLoading(true);
      const [thingsData, locationsData, roomsData, categoriesData, peopleData] = await Promise.all([
        apiClient.getThings(),
        apiClient.getLocations(),
        apiClient.getRooms(),
        apiClient.getCategories(),
        apiClient.getPeople(),
      ]);
      
      setThings(thingsData);
      setLocations(locationsData);
      setRooms(roomsData);
      setCategories(categoriesData);
      setPeople(peopleData);
    } catch (error) {
      console.error('Error loading data:', error);
      showError(error instanceof Error ? error.message : 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  // Resolve entity names from IDs
  const getLocationName = (locationId?: string): string => {
    if (!locationId) return '';
    const location = locations.find(l => l.id === locationId);
    return location?.name || 'Unknown';
  };

  const getRoomName = (roomId?: string): string => {
    if (!roomId) return '';
    const room = rooms.find(r => r.id === roomId);
    return room?.name || 'Unknown';
  };

  const getOwnerName = (ownerId?: string): string => {
    if (!ownerId) return '';
    const owner = people.find(p => p.id === ownerId);
    return owner?.name || 'Unknown';
  };

  const getCategoryName = (categoryId?: string): string => {
    if (!categoryId) return '';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  // Transform Things data for table display
  const tableData: ThingTableRow[] = things.map(thing => ({
    id: thing.id,
    name: thing.name,
    description: thing.description || '',
    location: getLocationName(thing.locationId),
    room: getRoomName(thing.roomId),
    owner: getOwnerName(thing.ownerId),
    category: getCategoryName(thing.categoryId),
    dateAdded: thing.dateAdded ? new Date(thing.dateAdded).toLocaleDateString() : '',
  }));

  const handleAdd = () => {
    setEditingThing(undefined);
    setFormDialogOpen(true);
  };

  const handleEdit = (row: ThingTableRow) => {
    // Find the full Thing object
    const thing = things.find(t => t.id === row.id);
    if (thing) {
      setEditingThing(thing);
      setFormDialogOpen(true);
    }
  };

  const handleDelete = (row: ThingTableRow) => {
    setThingToDelete(row);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!thingToDelete) return;

    try {
      setGlobalLoading(true);
      await apiClient.deleteThing(thingToDelete.id);
      setDeleteDialogOpen(false);
      setThingToDelete(null);
      showSuccess('Thing deleted successfully');
      // Refresh the table
      await loadData();
    } catch (error) {
      console.error('Error deleting thing:', error);
      showError(error instanceof Error ? error.message : 'Failed to delete thing. Please try again.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setThingToDelete(null);
  };

  const handleFormSubmit = async (data: Partial<Thing>) => {
    try {
      setGlobalLoading(true);
      if (editingThing) {
        // Update existing thing
        await apiClient.updateThing(editingThing.id, data);
        showSuccess('Thing updated successfully');
      } else {
        // Create new thing
        await apiClient.createThing(data as Omit<Thing, 'id' | 'dateAdded'>);
        showSuccess('Thing created successfully');
      }
      
      setFormDialogOpen(false);
      setEditingThing(undefined);
      // Refresh the table
      await loadData();
    } catch (error) {
      console.error('Error saving thing:', error);
      showError(error instanceof Error ? error.message : 'Failed to save thing. Please try again.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleFormClose = () => {
    setFormDialogOpen(false);
    setEditingThing(undefined);
  };

  const handleRowClick = (row: ThingTableRow) => {
    // Open edit dialog when row is clicked
    handleEdit(row);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Things
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Thing
        </Button>
      </Box>

      <EntityTable
        columns={columns}
        data={tableData}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRowClick={handleRowClick}
        loading={loading}
      />

      {/* Thing Form Dialog */}
      <ThingFormDialog
        open={formDialogOpen}
        thing={editingThing}
        locations={locations}
        rooms={rooms}
        categories={categories}
        people={people}
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
            Are you sure you want to delete "{thingToDelete?.name}"? This action cannot be undone.
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
