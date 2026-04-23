import { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { AutoAwesome as AIIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import AIPhotoUpload from '../components/AIPhotoUpload';
import ThingFormDialog from '../components/ThingFormDialog';
import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import apiClient from '../services/api';
import type { Category, Location, Room, Person, Thing } from '../types';

/**
 * Standalone AI Photo Upload page
 * Accessible via /ai-photo route (mobile bottom nav)
 * Loads supporting data, renders AIPhotoUpload, then opens
 * ThingFormDialog with pre-filled data after analysis completes.
 */
export default function AIPhoto() {
  const navigate = useNavigate();
  const { currentInventory } = useInventory();
  const { showSuccess, showError } = useNotification();

  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<Partial<Thing> | undefined>(undefined);

  useEffect(() => {
    const loadData = async () => {
      if (!currentInventory) {
        setLoading(false);
        return;
      }
      try {
        const [categoriesData, locationsData, roomsData, peopleData] = await Promise.all([
          apiClient.getCategories(currentInventory.id),
          apiClient.getLocations(currentInventory.id),
          apiClient.getRooms(currentInventory.id),
          apiClient.getPeople(currentInventory.id),
        ]);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setLocations(Array.isArray(locationsData) ? locationsData : []);
        setRooms(Array.isArray(roomsData) ? roomsData : []);
        setPeople(Array.isArray(peopleData) ? peopleData : []);
      } catch (err) {
        console.error('Failed to load data:', err);
        showError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentInventory]);

  const handleAnalysisComplete = (analysisData: Partial<Thing>, _photoKey: string) => {
    setPrefillData(analysisData);
    setFormDialogOpen(true);
  };

  const handleFormSubmit = async (data: Partial<Thing>) => {
    if (!currentInventory) return;
    try {
      await apiClient.createThing({ ...data, inventoryId: currentInventory.id } as Omit<Thing, 'dateAdded'>);
      showSuccess('Thing created successfully');
      setFormDialogOpen(false);
      setPrefillData(undefined);
      navigate('/things');
    } catch (err) {
      console.error('Error creating thing:', err);
      showError('Failed to create thing');
    }
  };

  const handleFormClose = () => {
    setFormDialogOpen(false);
    setPrefillData(undefined);
  };

  if (!currentInventory) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Please select an inventory first.
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AIIcon color="primary" />
        <Typography variant="h5" component="h1">
          AI Photo Upload
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Take a photo or upload an image and AI will identify the item and pre-fill the details for you.
      </Typography>
      <AIPhotoUpload
        categories={categories}
        onAnalysisComplete={handleAnalysisComplete}
      />
      <ThingFormDialog
        open={formDialogOpen}
        prefillData={prefillData}
        locations={locations}
        rooms={rooms}
        categories={categories}
        people={people}
        onSubmit={handleFormSubmit}
        onClose={handleFormClose}
      />
    </Box>
  );
}
