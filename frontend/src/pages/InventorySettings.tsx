import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,

  Alert,
  Grid,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';
import { useLoading } from '../contexts/LoadingContext';
import apiClient from '../services/api';
import type { Inventory } from '../types';

/**
 * Inventory Settings Page Component
 * Allows editing inventory details and managing settings
 * Validates: Requirements 1.1
 */
export default function InventorySettings() {
  const { inventoryId } = useParams<{ inventoryId: string }>();
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  const { showSuccess, showError } = useNotification();
  const { setLoading } = useLoading();

  // Load inventory on component mount
  useEffect(() => {
    if (inventoryId) {
      loadInventory();
    }
  }, [inventoryId]);

  // Track changes
  useEffect(() => {
    if (inventory) {
      const hasNameChange = formData.name !== inventory.name;
      const hasDescriptionChange = formData.description !== (inventory.description || '');
      setHasChanges(hasNameChange || hasDescriptionChange);
    }
  }, [formData, inventory]);

  const loadInventory = async () => {
    if (!inventoryId) return;
    
    try {
      setLoading(true);
      const data = await apiClient.getInventory(inventoryId);
      setInventory(data);
      setFormData({
        name: data.name,
        description: data.description || '',
      });
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load inventory');
      navigate('/inventories');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Name must be 100 characters or less';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!inventory || !validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const updateData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      };
      
      const updatedInventory = await apiClient.updateInventory(inventory.id, updateData);
      setInventory(updatedInventory);
      setHasChanges(false);
      showSuccess('Inventory updated successfully');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to update inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!inventory) return;

    const confirmMessage = `Are you sure you want to delete "${inventory.name}"?\n\nThis will permanently delete:\n- The inventory\n- All items in this inventory\n- All associated data\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.deleteInventory(inventory.id);
      showSuccess('Inventory deleted successfully');
      navigate('/inventories');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value,
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  if (!inventory) {
    return null; // Loading handled by LoadingContext
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/inventories')}
          sx={{ mr: 2 }}
        >
          Back to Inventories
        </Button>
        <Typography variant="h4" component="h1">
          Inventory Settings
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Basic Information */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Name"
                  value={formData.name}
                  onChange={handleChange('name')}
                  error={!!errors.name}
                  helperText={errors.name}
                  required
                  fullWidth
                />
                
                <TextField
                  label="Description"
                  value={formData.description}
                  onChange={handleChange('description')}
                  error={!!errors.description}
                  helperText={errors.description}
                  multiline
                  rows={3}
                  fullWidth
                />
              </Box>

              {hasChanges && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  You have unsaved changes
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={!hasChanges}
                >
                  Save Changes
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          {/* Danger Zone */}
          <Card sx={{ border: '1px solid', borderColor: 'error.main' }}>
            <CardContent>
              <Typography variant="h6" color="error" gutterBottom>
                Danger Zone
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Once you delete an inventory, there is no going back. Please be certain.
              </Typography>
              
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
                fullWidth
              >
                Delete Inventory
              </Button>
            </CardContent>
          </Card>

          {/* Inventory Info */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Inventory Information
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body2">
                    {new Date(inventory.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Last Updated
                  </Typography>
                  <Typography variant="body2">
                    {new Date(inventory.updatedAt).toLocaleDateString()}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    ID
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {inventory.id}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}