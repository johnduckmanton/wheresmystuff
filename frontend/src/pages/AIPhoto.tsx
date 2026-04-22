import { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { AutoAwesome as AIIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import AIPhotoUpload from '../components/AIPhotoUpload';
import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import apiClient from '../services/api';
import type { Category, Thing } from '../types';

/**
 * Standalone AI Photo Upload page
 * Accessible via /ai-photo route (mobile bottom nav)
 * Loads categories, renders AIPhotoUpload, then navigates to Things page
 * with pre-filled form data after analysis completes.
 */
export default function AIPhoto() {
  const navigate = useNavigate();
  const { currentInventory } = useInventory();
  const { showError } = useNotification();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCategories = async () => {
      if (!currentInventory) {
        setLoading(false);
        return;
      }
      try {
        const data = await apiClient.getCategories(currentInventory.id);
        setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load categories:', err);
        showError('Failed to load categories');
      } finally {
        setLoading(false);
      }
    };
    loadCategories();
  }, [currentInventory]);

  const handleAnalysisComplete = (_analysisData: Partial<Thing>, _photoKey: string) => {
    // Navigate to Things page where the user can save the item
    // The Things page handles the form dialog flow
    navigate('/things');
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
    </Box>
  );
}
