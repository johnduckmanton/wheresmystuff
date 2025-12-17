import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  Button,
  Alert,
  CircularProgress,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import apiClient from '../services/api';
import type { Invitation } from '../types';

interface InvitationStatusManagerProps {
  inventoryId: string;
  onInvitationChange?: () => void;
}

/**
 * Invitation Status Manager Component
 * Displays and manages pending invitations for an inventory
 * Validates: Requirements 1.4, 1.5
 */
export default function InvitationStatusManager({
  inventoryId,
  onInvitationChange
}: InvitationStatusManagerProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiClient.getInvitations(inventoryId);
      setInvitations(data);
    } catch (err) {
      console.error('Error loading invitations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      setCancellingId(invitationId);
      await apiClient.cancelInvitation(inventoryId, invitationId);
      
      // Remove from local state
      setInvitations(prev => prev.filter(inv => inv.invitationId !== invitationId));
      
      if (onInvitationChange) {
        onInvitationChange();
      }
    } catch (err) {
      console.error('Error cancelling invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel invitation');
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ScheduleIcon fontSize="small" />;
      case 'accepted':
        return <CheckCircleIcon fontSize="small" />;
      case 'cancelled':
        return <CancelIcon fontSize="small" />;
      case 'expired':
        return <ErrorIcon fontSize="small" />;
      default:
        return <ScheduleIcon fontSize="small" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'accepted':
        return 'success';
      case 'cancelled':
        return 'default';
      case 'expired':
        return 'error';
      default:
        return 'default';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'administrator':
        return 'error';
      case 'member':
        return 'primary';
      case 'read_only':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  useEffect(() => {
    loadInvitations();
  }, [inventoryId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={loadInvitations}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (invitations.length === 0) {
    return (
      <Alert severity="info">
        No pending invitations. Use the "Invite User" button to send invitations to new members.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Pending Invitations ({invitations.length})
        </Typography>
        <Tooltip title="Refresh invitations">
          <IconButton onClick={loadInvitations} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Stack spacing={2}>
        {invitations.map((invitation) => {
          const expired = isExpired(invitation.expiresAt);
          const daysLeft = getDaysUntilExpiry(invitation.expiresAt);
          
          return (
            <Card key={invitation.invitationId} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <EmailIcon fontSize="small" color="action" />
                      <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                        {invitation.email}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      <Chip
                        icon={getStatusIcon(invitation.status)}
                        label={invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                        color={getStatusColor(invitation.status) as any}
                        size="small"
                      />
                      <Chip
                        label={invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
                        color={getRoleColor(invitation.role) as any}
                        variant="outlined"
                        size="small"
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Sent: {formatDate(invitation.createdAt)}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary">
                      {expired ? (
                        <Box component="span" sx={{ color: 'error.main', fontWeight: 'medium' }}>
                          Expired on {formatDate(invitation.expiresAt)}
                        </Box>
                      ) : (
                        <>
                          Expires: {formatDate(invitation.expiresAt)}
                          {daysLeft <= 2 && (
                            <Box component="span" sx={{ color: 'warning.main', fontWeight: 'medium', ml: 1 }}>
                              ({daysLeft} day{daysLeft !== 1 ? 's' : ''} left)
                            </Box>
                          )}
                        </>
                      )}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {invitation.status === 'pending' && !expired && (
                      <Tooltip title="Cancel invitation">
                        <IconButton
                          onClick={() => handleCancelInvitation(invitation.invitationId)}
                          disabled={cancellingId === invitation.invitationId}
                          color="error"
                          size="small"
                        >
                          {cancellingId === invitation.invitationId ? (
                            <CircularProgress size={16} />
                          ) : (
                            <DeleteIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                {expired && invitation.status === 'pending' && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    This invitation has expired. You can send a new invitation to this email address.
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}