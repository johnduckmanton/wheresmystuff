import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Checkbox,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Box,
  Chip,
  Stack
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import type { Container } from '../types';
import apiClient from '../services/api';

interface ContainerAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (containerIds: string[]) => Promise<void>;
  inventoryId: string;
}

const ContainerAssignmentDialog: React.FC<ContainerAssignmentDialogProps> = ({
  open,
  onClose,
  onSave,
  inventoryId
}) => {
  const [containers, setContainers] = useState<Container[]>([]);
  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadAvailableContainers();
    }
  }, [open]);

  const loadAvailableContainers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all containers for the inventory
      const allContainers = await apiClient.getContainers(inventoryId);
      // Filter to only unassigned containers
      const availableContainers = Array.isArray(allContainers)
        ? allContainers.filter(c => !c.projectId)
        : [];
      setContainers(availableContainers);
    } catch (err) {
      console.error('Error loading available containers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load available containers');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleContainer = (containerId: string) => {
    const newSelected = new Set(selectedContainers);
    if (newSelected.has(containerId)) {
      newSelected.delete(containerId);
    } else {
      newSelected.add(containerId);
    }
    setSelectedContainers(newSelected);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(Array.from(selectedContainers));
      setSelectedContainers(new Set());
      onClose();
    } catch (err) {
      console.error('Error saving container assignments:', err);
      setError(err instanceof Error ? err.message : 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const filteredContainers = containers.filter(container =>
    container.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (container.description && container.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign Containers to Project</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          placeholder="Search containers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2, mt: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : filteredContainers.length === 0 ? (
          <Alert severity="info">
            No available containers to assign.
          </Alert>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredContainers.map((container) => (
              <ListItem
                key={container.id}
                disablePadding
                secondaryAction={
                  <Checkbox
                    edge="end"
                    checked={selectedContainers.has(container.id)}
                    onChange={() => handleToggleContainer(container.id)}
                  />
                }
              >
                <ListItemButton
                  onClick={() => handleToggleContainer(container.id)}
                  dense
                >
                  <ListItemText
                    primary={container.name}
                    secondary={
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        <Chip label={container.type} size="small" variant="outlined" />
                        <Chip
                          label={`${container.itemCount} items`}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={selectedContainers.size === 0 || saving}
        >
          {saving ? 'Saving...' : `Assign (${selectedContainers.size})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ContainerAssignmentDialog;
