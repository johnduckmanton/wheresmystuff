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
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import { Email as EmailIcon, Send as SendIcon } from '@mui/icons-material';
import apiClient from '../services/api';
import type { Invitation } from '../types';
import { validateEmail, validateUserRole, getErrorMessage } from '../utils/validation';

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  onInvitationSent: (invitation: Invitation) => void;
  inventoryId: string;
  inventoryName: string;
  inviterName: string;
}

/**
 * Invite User Dialog Component
 * Allows sending invitations to users by email address
 * Validates: Requirements 1.3, 1.4, 1.5
 */
export default function InviteUserDialog({
  open,
  onClose,
  onInvitationSent,
  inventoryId,
  inventoryName,
  inviterName
}: InviteUserDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'administrator' | 'read_only'>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);



  const handleSendInvitation = async () => {
    const trimmedEmail = email.trim();
    
    // Enhanced client-side validation using shared utilities
    const emailValidation = validateEmail(trimmedEmail);
    if (!emailValidation.valid) {
      setError(emailValidation.error || 'Please enter a valid email address');
      return;
    }

    const roleValidation = validateUserRole(role);
    if (!roleValidation.valid) {
      setError(roleValidation.error || 'Please select a valid role');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const invitation = await apiClient.createInvitation(inventoryId, {
        email: emailValidation.normalizedEmail || trimmedEmail,
        role,
        inventoryName,
        inviterName
      });

      setSuccess(true);
      onInvitationSent(invitation);
      
      // Auto-close after success
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error('Error sending invitation:', err);
      
      // Use shared error message utility
      const errorMessage = getErrorMessage(err, 'send invitation');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('member');
    setError('');
    setSuccess(false);
    setLoading(false);
    onClose();
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) {
      setError('');
    }
    if (success) {
      setSuccess(false);
    }
  };

  const handleRoleChange = (e: any) => {
    setRole(e.target.value);
    if (error) {
      setError('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && !success) {
      handleSendInvitation();
    }
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
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmailIcon />
          Invite User to Inventory
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Send an invitation to add a new user to "{inventoryName}". They will receive an email 
            with instructions to join your inventory.
          </Typography>

          {success && (
            <Alert severity="success">
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                Invitation Sent Successfully!
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                An invitation email has been sent to {email}. They will receive instructions 
                on how to join your inventory.
              </Typography>
            </Alert>
          )}

          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}

          <TextField
            label="Email Address"
            value={email}
            onChange={handleEmailChange}
            onKeyPress={handleKeyPress}
            error={!!error && !success}
            helperText="Enter the email address of the person you want to invite"
            required
            fullWidth
            autoFocus
            placeholder="user@example.com"
            type="email"
            disabled={loading || success}
          />

          <FormControl fullWidth required disabled={loading || success}>
            <InputLabel>Role</InputLabel>
            <Select
              value={role}
              label="Role"
              onChange={handleRoleChange}
            >
              <MenuItem value="member">Member</MenuItem>
              <MenuItem value="administrator">Administrator</MenuItem>
              <MenuItem value="read_only">Read Only</MenuItem>
            </Select>
            <FormHelperText>
              {getRoleDescription(role)}
            </FormHelperText>
          </FormControl>

          <Alert severity="info">
            <Typography variant="body2">
              <strong>What happens next:</strong>
            </Typography>
            <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
              <li>The user will receive an email invitation</li>
              <li>If they don't have an account, they'll be prompted to create one</li>
              <li>Once they accept, they'll automatically be added to your inventory</li>
              <li>Invitations expire after 7 days</li>
            </Box>
          </Alert>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {success ? 'Close' : 'Cancel'}
        </Button>
        {!success && (
          <Button 
            variant="contained" 
            onClick={handleSendInvitation}
            disabled={loading || !email.trim() || !role}
            startIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
          >
            {loading ? 'Sending...' : 'Send Invitation'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}