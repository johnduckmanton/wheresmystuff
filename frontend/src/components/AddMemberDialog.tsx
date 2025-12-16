import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
} from '@mui/material';

interface AddMemberDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (userId: string) => void;
  existingMemberIds: string[];
}

/**
 * Add Member Dialog Component
 * Allows adding new members to an inventory by User ID
 * Validates: Requirements 1.4
 */
export default function AddMemberDialog({
  open,
  onClose,
  onSubmit,
  existingMemberIds,
}: AddMemberDialogProps) {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedUserId = userId.trim();
    
    // Validation
    if (!trimmedUserId) {
      setError('User ID is required');
      return;
    }

    // Check if user is already a member
    if (existingMemberIds.includes(trimmedUserId)) {
      setError('This user is already a member of this inventory');
      return;
    }

    // Basic UUID format validation (optional but helpful)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedUserId)) {
      setError('Please enter a valid User ID (UUID format)');
      return;
    }

    onSubmit(trimmedUserId);
  };

  const handleClose = () => {
    setUserId('');
    setError('');
    onClose();
  };

  const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserId(e.target.value);
    if (error) {
      setError('');
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        component: 'form',
        onSubmit: handleSubmit,
      }}
    >
      <DialogTitle>
        Add Member to Inventory
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Alert severity="info">
            To add a member, you need their User ID. They can find this in their profile settings.
          </Alert>
          
          <TextField
            label="User ID"
            value={userId}
            onChange={handleUserIdChange}
            error={!!error}
            helperText={error || 'Enter the UUID of the user you want to add'}
            required
            fullWidth
            autoFocus
            placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
          />
          
          <Typography variant="body2" color="text.secondary">
            Once added, the user will have access to view and manage all items in this inventory.
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button type="submit" variant="contained">
          Add Member
        </Button>
      </DialogActions>
    </Dialog>
  );
}