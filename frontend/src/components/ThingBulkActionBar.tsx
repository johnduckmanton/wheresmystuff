import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useMobileDetection } from '../hooks/useMobileDetection';
import type { Location, Container } from '../types/entities';

interface ThingBulkActionBarProps {
  selectedCount: number;
  locations: Location[];
  containers: Container[];
  onMoveToLocation: (locationId: string) => void;
  onMoveToContainer: (containerId: string) => void;
  onClearSelection: () => void;
}

export default function ThingBulkActionBar({
  selectedCount,
  locations,
  containers,
  onMoveToLocation,
  onMoveToContainer,
  onClearSelection,
}: ThingBulkActionBarProps) {
  const { isMobile } = useMobileDetection();
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [containerDialogOpen, setContainerDialogOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedContainerId, setSelectedContainerId] = useState('');

  const handleMoveToLocation = () => {
    if (selectedLocationId) {
      onMoveToLocation(selectedLocationId);
      setLocationDialogOpen(false);
      setSelectedLocationId('');
    }
  };

  const handleMoveToContainer = () => {
    if (selectedContainerId) {
      onMoveToContainer(selectedContainerId);
      setContainerDialogOpen(false);
      setSelectedContainerId('');
    }
  };

  const handleLocationDialogClose = () => {
    setLocationDialogOpen(false);
    setSelectedLocationId('');
  };

  const handleContainerDialogClose = () => {
    setContainerDialogOpen(false);
    setSelectedContainerId('');
  };

  return (
    <>
      <Box
        sx={{
          position: isMobile ? 'fixed' : 'relative',
          bottom: isMobile ? 128 : 'auto',
          left: isMobile ? 0 : 'auto',
          right: isMobile ? 0 : 'auto',
          zIndex: 1100,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 500, mr: 0.5 }}>
          {selectedCount} selected
        </Typography>

        <Button
          variant="outlined"
          size="small"
          onClick={() => setLocationDialogOpen(true)}
        >
          Move to Location
        </Button>

        <Button
          variant="outlined"
          size="small"
          onClick={() => setContainerDialogOpen(true)}
        >
          Move to Container
        </Button>

        <IconButton
          size="small"
          onClick={onClearSelection}
          aria-label="Clear selection"
          sx={{ ml: 'auto' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Move to Location Dialog */}
      <Dialog open={locationDialogOpen} onClose={handleLocationDialogClose} fullWidth maxWidth="xs">
        <DialogTitle>Move to Location</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel id="location-select-label">Location</InputLabel>
            <Select
              labelId="location-select-label"
              value={selectedLocationId}
              label="Location"
              onChange={(e) => setSelectedLocationId(e.target.value)}
            >
              {locations.map((loc) => (
                <MenuItem key={loc.id} value={loc.id}>
                  {loc.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLocationDialogClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleMoveToLocation}
            disabled={!selectedLocationId}
          >
            Move
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move to Container Dialog */}
      <Dialog open={containerDialogOpen} onClose={handleContainerDialogClose} fullWidth maxWidth="xs">
        <DialogTitle>Move to Container</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel id="container-select-label">Container</InputLabel>
            <Select
              labelId="container-select-label"
              value={selectedContainerId}
              label="Container"
              onChange={(e) => setSelectedContainerId(e.target.value)}
            >
              {containers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleContainerDialogClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleMoveToContainer}
            disabled={!selectedContainerId}
          >
            Move
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
