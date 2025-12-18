import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Alert, Collapse } from '@mui/material';
import { useState, useEffect } from 'react';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EntityTable from '../components/EntityTable';
import type { EntityTableColumn } from '../components/EntityTable';
import ThingFormDialog from '../components/ThingFormDialog';
import AIPhotoUpload from '../components/AIPhotoUpload';
import { useLoading } from '../contexts/LoadingContext';
import { useNotification } from '../contexts/NotificationContext';
import { useInventory } from '../contexts/InventoryContext';
import apiClient from '../services/api';
import type { Thing, Location, Room, Category, Person } from '../types';

// Component to handle photo thumbnail display with URL generation and hover popup
function PhotoThumbnail({ photoKey, altText }: { photoKey?: string; altText: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    if (!photoKey) {
      setPhotoUrl(null);
      setError(false);
      return;
    }

    const loadPhoto = async () => {
      try {
        setLoading(true);
        setError(false);
        const response = await apiClient.generateDownloadUrl(photoKey);
        setPhotoUrl(response.downloadUrl);
      } catch (error) {
        console.warn('Failed to load photo:', error);
        setPhotoUrl(null);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadPhoto();
  }, [photoKey]);

  const hasImage = photoUrl && !error;

  return (
    <>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 1,
          backgroundColor: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          border: '1px solid #e0e0e0',
          cursor: hasImage ? 'pointer' : 'default',
          position: 'relative',
          '&:hover': hasImage ? {
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transform: 'scale(1.05)',
            transition: 'all 0.2s ease-in-out',
          } : {},
        }}
        onMouseEnter={() => hasImage && setShowPopup(true)}
        onMouseLeave={() => setShowPopup(false)}
      >
        {loading ? (
          <Box sx={{ fontSize: 12, color: '#999' }}>⋯</Box>
        ) : hasImage ? (
          <img
            src={photoUrl}
            alt={altText}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={() => setError(true)}
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#bbb',
              textAlign: 'center',
              width: '100%',
              height: '100%',
            }}
          >
            <Box
              component="span"
              className="material-icons"
              sx={{ 
                fontSize: 20, 
                color: '#ddd',
                mb: 0.5,
              }}
            >
              photo
            </Box>
            <Typography
              variant="caption"
              sx={{
                fontSize: '8px',
                lineHeight: 1,
                color: '#999',
                fontWeight: 500,
              }}
            >
              No Photo
            </Typography>
          </Box>
        )}
      </Box>

      {/* Hover Popup for larger image */}
      {showPopup && hasImage && (
        <Box
          sx={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            backgroundColor: 'white',
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            border: '1px solid #e0e0e0',
            overflow: 'hidden',
            maxWidth: '400px',
            maxHeight: '400px',
            pointerEvents: 'none',
          }}
        >
          <img
            src={photoUrl}
            alt={altText}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </Box>
      )}
    </>
  );
}

const columns: EntityTableColumn[] = [
  { 
    field: 'thumbnail', 
    headerName: '', 
    width: 60,
    sortable: false,
    renderCell: (params) => (
      <PhotoThumbnail 
        photoKey={params.row.firstPhotoKey} 
        altText={params.row.name} 
      />
    )
  },
  { field: 'name', headerName: 'Name', flex: 1 },
  { field: 'location', headerName: 'Location', flex: 1 },
  { field: 'room', headerName: 'Room', flex: 1 },
  { field: 'owner', headerName: 'Owner', flex: 1 },
  { field: 'category', headerName: 'Category', flex: 1 },
];

interface ThingTableRow {
  id: string;
  thumbnail: string;
  name: string;
  location: string;
  room: string;
  owner: string;
  category: string;
  firstPhotoKey?: string;
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
  
  // AI Upload states
  const [showAIUpload, setShowAIUpload] = useState(false);

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
      const [thingsData, locationsData, roomsData, categoriesData, peopleData] = await Promise.all([
        apiClient.getThings(currentInventory.id),
        apiClient.getLocations(currentInventory.id),
        apiClient.getRooms(undefined, currentInventory.id),
        apiClient.getCategories(currentInventory.id),
        apiClient.getPeople(currentInventory.id),
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
    thumbnail: '', // Placeholder for thumbnail column
    name: thing.name,
    location: getLocationName(thing.locationId),
    room: getRoomName(thing.roomId),
    owner: getOwnerName(thing.ownerId),
    category: getCategoryName(thing.categoryId),
    firstPhotoKey: thing.photos && thing.photos.length > 0 ? thing.photos[0] : undefined,
  }));

  // Create dropdown filter options
  const dropdownFilters = {
    location: locations.map(location => ({
      value: location.name,
      label: location.name,
    })),
    owner: people.map(person => ({
      value: person.name,
      label: person.name,
    })),
    category: categories.map(category => ({
      value: category.name,
      label: category.name,
    })),
  };

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
    if (!thingToDelete || !currentInventory) return;

    try {
      setGlobalLoading(true);
      await apiClient.deleteThing(thingToDelete.id, currentInventory.id);
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
        // Create new thing - include tempId if it exists (for photo uploads)
        const createData = { ...data } as Omit<Thing, 'dateAdded'>;
        await apiClient.createThing(createData);
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

  // Show message if no inventory is selected
  if (!currentInventory) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          Things
        </Typography>
        <Alert severity="info">
          Please select an inventory to view things. You can create a new inventory from the Inventories page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Things - {currentInventory.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button 
            variant="outlined" 
            startIcon={<AutoAwesomeIcon />} 
            onClick={() => setShowAIUpload(!showAIUpload)}
            color={showAIUpload ? 'primary' : 'inherit'}
          >
            AI Photo Upload
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Thing
          </Button>
        </Box>
      </Box>

      {/* AI Photo Upload Section */}
      <Collapse in={showAIUpload}>
        <Box sx={{ mb: 3 }}>
          <AIPhotoUpload 
            categories={categories}
            onThingCreated={(newThing) => {
              setThings(prev => [...prev, newThing]);
              setShowAIUpload(false);
            }}
          />
        </Box>
      </Collapse>

      <EntityTable
        columns={columns}
        data={tableData}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRowClick={handleRowClick}
        loading={loading}
        dropdownFilters={dropdownFilters}
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
