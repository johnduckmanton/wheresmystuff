import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Chip,
  Stack,
  Divider,
  Avatar,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Verified as VerifiedIcon,
  PhotoCamera as PhotoCameraIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import apiClient from '../services/api';
import PhotoThumbnail from './PhotoThumbnail';
import type { UserProfile } from '../types';

interface UserProfileViewProps {
  userId?: string; // If not provided, shows current user's profile
  editable?: boolean;
  onProfileUpdate?: (profile: UserProfile) => void;
}

/**
 * User Profile View Component
 * Displays user profile information with copyable User ID
 * Validates: Requirements 4.1, 4.3, 4.4, 4.5
 */
export default function UserProfileView({
  userId,
  editable = true,
  onProfileUpdate
}: UserProfileViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedDisplayName, setEditedDisplayName] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiClient.getUserProfile(userId);
      setProfile(data);
      setEditedDisplayName(data.displayName);
    } catch (err) {
      console.error('Error loading user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUserId = async () => {
    if (!profile?.userId) return;

    try {
      await navigator.clipboard.writeText(profile.userId);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy User ID:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = profile.userId;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleStartEdit = () => {
    setEditing(true);
    setEditedDisplayName(profile?.displayName || '');
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditedDisplayName(profile?.displayName || '');
  };

  const handleSaveEdit = async () => {
    if (!profile?.userId || !editedDisplayName.trim()) return;

    try {
      setSaving(true);
      const updatedProfile = await apiClient.updateUserProfile(profile.userId, {
        displayName: editedDisplayName.trim()
      });
      
      setProfile(updatedProfile);
      setEditing(false);
      
      if (onProfileUpdate) {
        onProfileUpdate(updatedProfile);
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setAvatarUploading(true);
    try {
      const key = await apiClient.uploadAvatar(file);
      setLocalPreviewUrl(URL.createObjectURL(file));
      const updatedProfile = await apiClient.updateUserProfile(profile.userId, { avatarUrl: key });
      setProfile(updatedProfile);
      if (onProfileUpdate) onProfileUpdate(updatedProfile);
    } catch (err) {
      console.error('Error uploading avatar:', err);
      setError('Failed to upload photo');
      setLocalPreviewUrl(null);
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile) return;
    setLocalPreviewUrl(null);
    try {
      const updatedProfile = await apiClient.updateUserProfile(profile.userId, { avatarUrl: '' });
      setProfile(updatedProfile);
      if (onProfileUpdate) onProfileUpdate(updatedProfile);
    } catch (err) {
      console.error('Error removing avatar:', err);
      setError('Failed to remove photo');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    loadProfile();
  }, [userId]);

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
          <Button color="inherit" size="small" onClick={loadProfile}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (!profile) {
    return (
      <Alert severity="info">
        User profile not found.
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        {/* Avatar Section */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
          {avatarUploading ? (
            <Avatar sx={{ width: 80, height: 80, mb: 1 }}>
              <CircularProgress size={32} />
            </Avatar>
          ) : localPreviewUrl ? (
            <Avatar
              sx={{ width: 80, height: 80, mb: 1 }}
              src={localPreviewUrl}
              alt={profile.displayName}
            />
          ) : profile.avatarUrl ? (
            <PhotoThumbnail
              photoKey={profile.avatarUrl}
              altText={profile.displayName}
              variant="avatar"
              size={80}
              showPopup={false}
            />
          ) : (
            <Avatar sx={{ width: 80, height: 80, mb: 1, bgcolor: 'primary.main' }}>
              <PersonIcon sx={{ fontSize: 40 }} />
            </Avatar>
          )}
          {editable && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button
                size="small"
                startIcon={<PhotoCameraIcon />}
                component="label"
                disabled={avatarUploading}
              >
                {profile.avatarUrl ? 'Change' : 'Add Photo'}
                <input type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
              </Button>
              {profile.avatarUrl && (
                <IconButton size="small" onClick={handleRemoveAvatar} disabled={avatarUploading} aria-label="Remove photo">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          )}
          <Typography variant="h6" sx={{ mt: 1 }}>
            User Profile
          </Typography>
        </Box>

        <Stack spacing={3}>
          {/* Display Name */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Display Name
            </Typography>
            {editing ? (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  value={editedDisplayName}
                  onChange={(e) => setEditedDisplayName(e.target.value)}
                  size="small"
                  fullWidth
                  autoFocus
                  disabled={saving}
                />
                <IconButton 
                  onClick={handleSaveEdit} 
                  disabled={saving || !editedDisplayName.trim()}
                  color="primary"
                  size="small"
                >
                  {saving ? <CircularProgress size={16} /> : <SaveIcon />}
                </IconButton>
                <IconButton 
                  onClick={handleCancelEdit} 
                  disabled={saving}
                  size="small"
                >
                  <CancelIcon />
                </IconButton>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1">
                  {profile.displayName}
                </Typography>
                {editable && (
                  <IconButton onClick={handleStartEdit} size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            )}
          </Box>

          {/* Email */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Email Address
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmailIcon fontSize="small" color="action" />
              <Typography variant="body1">
                {profile.email}
              </Typography>
              {profile.emailVerified && (
                <Chip
                  icon={<VerifiedIcon />}
                  label="Verified"
                  color="success"
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>

          {/* User ID */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              User ID
            </Typography>
            <Alert severity="info" sx={{ mb: 1 }}>
              <Typography variant="body2">
                <strong>Share this ID with others</strong> so they can add you to their inventories. 
                This is your unique identifier in the system.
              </Typography>
            </Alert>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              p: 1,
              bgcolor: 'grey.50',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'grey.300'
            }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace',
                  flex: 1,
                  wordBreak: 'break-all'
                }}
              >
                {profile.userId}
              </Typography>
              <Tooltip title={copySuccess ? "Copied!" : "Copy User ID"}>
                <IconButton 
                  onClick={handleCopyUserId}
                  size="small"
                  color={copySuccess ? "success" : "default"}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Divider />

          {/* Account Information */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Account Information
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Username:
                </Typography>
                <Typography variant="body2">
                  {profile.username}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Status:
                </Typography>
                <Chip
                  label={profile.userStatus}
                  color={profile.userStatus === 'CONFIRMED' ? 'success' : 'default'}
                  size="small"
                  variant="outlined"
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Account Created:
                </Typography>
                <Typography variant="body2">
                  {formatDate(profile.createdAt)}
                </Typography>
              </Box>
              {profile.lastLoginAt && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Last Login:
                  </Typography>
                  <Typography variant="body2">
                    {formatDate(profile.lastLoginAt)}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}