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
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import { Search as SearchIcon, PersonAdd as PersonAddIcon } from '@mui/icons-material';
import UserLookupDialog from './UserLookupDialog';
import InviteUserDialog from './InviteUserDialog';
import type { UserLookupResult, Invitation } from '../types';

interface AddMemberDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (userId: string, role?: string) => void;
  onInvitationSent?: (invitation: Invitation) => void;
  existingMemberIds: string[];
  inventoryId?: string;
  inventoryName?: string;
  inviterName?: string;
}

/**
 * Enhanced Add Member Dialog Component
 * Allows adding new members to an inventory by email lookup or User ID
 * Supports sending invitations to non-existent users
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */
export default function AddMemberDialog({
  open,
  onClose,
  onSubmit,
  onInvitationSent,
  existingMemberIds,
  inventoryId,
  inventoryName,
  inviterName,
}: AddMemberDialogProps) {
  const [tabValue, setTabValue] = useState(0);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');
  const [userLookupOpen, setUserLookupOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

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

    onSubmit(trimmedUserId, role);
  };

  const handleClose = () => {
    setTabValue(0);
    setUserId('');
    setRole('member');
    setError('');
    setUserLookupOpen(false);
    setInviteDialogOpen(false);
    onClose();
  };

  const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserId(e.target.value);
    if (error) {
      setError('');
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError('');
  };

  const handleUserSelect = (user: UserLookupResult) => {
    if (user.found && user.userId) {
      // Check if user is already a member
      if (existingMemberIds.includes(user.userId)) {
        setError('This user is already a member of this inventory');
        return;
      }
      
      onSubmit(user.userId, role);
    }
    setUserLookupOpen(false);
  };

  const handleInvitationSent = (invitation: Invitation) => {
    if (onInvitationSent) {
      onInvitationSent(invitation);
    }
    setInviteDialogOpen(false);
    handleClose();
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'administrator':
        return 'Can manage inventory items, members, and settings';
      case 'member':
        return 'Can view and manage inventory items';
      case 'read_only':
        return 'Can only view inventory items (no editing)';
      default:
        return '';
    }
  };

  return (
    <>
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Add Member to Inventory
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth">
              <Tab label="Search by Email" />
              <Tab label="Add by User ID" />
            </Tabs>

            {tabValue === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                <Alert severity="info">
                  Search for users by their email address. If they don't have an account yet, 
                  you can send them an invitation.
                </Alert>
                
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={role}
                    label="Role"
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <MenuItem value="member">Member</MenuItem>
                    <MenuItem value="administrator">Administrator</MenuItem>
                    <MenuItem value="read_only">Read Only</MenuItem>
                  </Select>
                  <FormHelperText>
                    {getRoleDescription(role)}
                  </FormHelperText>
                </FormControl>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    startIcon={<SearchIcon />}
                    onClick={() => setUserLookupOpen(true)}
                    fullWidth
                  >
                    Search for User
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PersonAddIcon />}
                    onClick={() => setInviteDialogOpen(true)}
                    fullWidth
                  >
                    Send Invitation
                  </Button>
                </Box>
              </Box>
            )}

            {tabValue === 1 && (
              <Box 
                component="form"
                onSubmit={handleSubmit}
                sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}
              >
                <Alert severity="info">
                  To add a member by User ID, you need their unique identifier. 
                  They can find this in their profile settings.
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

                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={role}
                    label="Role"
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <MenuItem value="member">Member</MenuItem>
                    <MenuItem value="administrator">Administrator</MenuItem>
                    <MenuItem value="read_only">Read Only</MenuItem>
                  </Select>
                  <FormHelperText>
                    {getRoleDescription(role)}
                  </FormHelperText>
                </FormControl>
                
                <Typography variant="body2" color="text.secondary">
                  Once added, the user will have access based on their assigned role.
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleClose}>
            Cancel
          </Button>
          {tabValue === 1 && (
            <Button 
              onClick={handleSubmit} 
              variant="contained"
              disabled={!userId.trim()}
            >
              Add Member
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* User Lookup Dialog */}
      <UserLookupDialog
        open={userLookupOpen}
        onClose={() => setUserLookupOpen(false)}
        onUserSelect={handleUserSelect}
      />

      {/* Invite User Dialog */}
      {inventoryId && inventoryName && inviterName && (
        <InviteUserDialog
          open={inviteDialogOpen}
          onClose={() => setInviteDialogOpen(false)}
          onInvitationSent={handleInvitationSent}
          inventoryId={inventoryId}
          inventoryName={inventoryName}
          inviterName={inviterName}
        />
      )}
    </>
  );
}