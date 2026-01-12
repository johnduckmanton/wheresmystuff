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
  Box
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import type { Thing } from '../types';
import apiClient from '../services/api';

interface ThingAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (thingIds: string[]) => Promise<void>;
  projectId: string;
  inventoryId: string;
}

const ThingAssignmentDialog: React.FC<ThingAssignmentDialogProps> = ({
  open,
  onClose,
  onSave,
  projectId,
  inventoryId
}) => {
  const [things, setThings] = useState<Thing[]>([]);
  const [selectedThings, setSelectedThings] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadAvailableThings();
    }
  }, [open]);

  const loadAvailableThings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get available things for this project (things not assigned to any project)
      const availableThings = await apiClient.getAvailableThingsForProject(inventoryId);
      setThings(Array.isArray(availableThings) ? availableThings : []);
    } catch (err) {
      console.error('Error loading available things:', err);
      setError(err instanceof Error ? err.message : 'Failed to load available things');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleThing = (thingId: string) => {
    const newSelected = new Set(selectedThings);
    if (newSelected.has(thingId)) {
      newSelected.delete(thingId);
    } else {
      newSelected.add(thingId);
    }
    setSelectedThings(newSelected);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(Array.from(selectedThings));
      setSelectedThings(new Set());
      onClose();
    } catch (err) {
      console.error('Error saving thing assignments:', err);
      setError(err instanceof Error ? err.message : 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const filteredThings = things.filter(thing =>
    thing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (thing.description && thing.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign Things to Project</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          placeholder="Search things..."
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
        ) : filteredThings.length === 0 ? (
          <Alert severity="info">
            No available things to assign.
          </Alert>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredThings.map((thing) => (
              <ListItem
                key={thing.id}
                disablePadding
                secondaryAction={
                  <Checkbox
                    edge="end"
                    checked={selectedThings.has(thing.id)}
                    onChange={() => handleToggleThing(thing.id)}
                  />
                }
              >
                <ListItemButton
                  onClick={() => handleToggleThing(thing.id)}
                  dense
                >
                  <ListItemText
                    primary={thing.name}
                    secondary={thing.description}
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
          disabled={selectedThings.size === 0 || saving}
        >
          {saving ? 'Saving...' : `Assign (${selectedThings.size})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ThingAssignmentDialog;
