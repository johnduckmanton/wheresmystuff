import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Stack,
  Divider,
  Card,
  CardContent,
  Tooltip,
  CircularProgress,
  InputAdornment,

} from '@mui/material';
import {
  Close as CloseIcon,
  Share as ShareIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,

  Security as SecurityIcon,
  Link as LinkIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { useNotification } from '../contexts/NotificationContext';
import apiClient from '../services/api';
import type { Container } from '../types';

interface SharingLink {
  shareId: string;
  shareUrl: string;
  description?: string;
  createdAt: string;
  expiresAt?: string;
  accessCount: number;
  maxAccesses?: number;
  isActive: boolean;
  privacySettings: {
    includeItemDetails: boolean;
    includePhotos: boolean;
    includeSensitiveData: boolean;
  };
  lastAccessedAt?: string;
}

interface ContainerSharingDialogProps {
  open: boolean;
  onClose: () => void;
  container: Container;
  inventoryId: string;
}

/**
 * ContainerSharingDialog Component
 * Manages sharing links for containers with privacy controls
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */
const ContainerSharingDialog: React.FC<ContainerSharingDialogProps> = ({
  open,
  onClose,
  container,
  inventoryId
}) => {
  const { showError, showSuccess } = useNotification();
  
  const [sharingLinks, setSharingLinks] = useState<SharingLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Create form state
  const [description, setDescription] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [includeItemDetails, setIncludeItemDetails] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(false);
  const [includeSensitiveData, setIncludeSensitiveData] = useState(false);
  const [maxAccesses, setMaxAccesses] = useState<number | ''>('');

  useEffect(() => {
    if (open) {
      loadSharingLinks();
    }
  }, [open, container.id, inventoryId]);

  const loadSharingLinks = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getSharingLinks(container.id, inventoryId);
      setSharingLinks(response.sharingLinks);
    } catch (error) {
      console.error('Error loading sharing links:', error);
      showError('Failed to load sharing links');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSharingLink = async () => {
    try {
      setCreating(true);
      
      const options = {
        inventoryId,
        includeItemDetails,
        includePhotos,
        includeSensitiveData,
        ...(description && { description }),
        ...(expiresAt && { expiresAt: expiresAt.toISOString() }),
        ...(maxAccesses && typeof maxAccesses === 'number' && { maxAccesses })
      };

      const newLink = await apiClient.createSharingLink(container.id, options);
      
      // Copy URL to clipboard
      await navigator.clipboard.writeText(newLink.shareUrl);
      
      showSuccess('Sharing link created and copied to clipboard!');
      
      // Reset form
      setDescription('');
      setExpiresAt(null);
      setIncludeItemDetails(true);
      setIncludePhotos(false);
      setIncludeSensitiveData(false);
      setMaxAccesses('');
      setShowCreateForm(false);
      
      // Reload links
      await loadSharingLinks();
    } catch (error) {
      console.error('Error creating sharing link:', error);
      showError(error instanceof Error ? error.message : 'Failed to create sharing link');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showSuccess('Link copied to clipboard!');
    } catch (error) {
      showError('Failed to copy link');
    }
  };

  const handleDeactivateLink = async (shareId: string) => {
    try {
      await apiClient.deactivateSharingLink(shareId);
      showSuccess('Sharing link deactivated');
      await loadSharingLinks();
    } catch (error) {
      console.error('Error deactivating sharing link:', error);
      showError('Failed to deactivate sharing link');
    }
  };

  const handleDeleteLink = async (shareId: string) => {
    if (!confirm('Are you sure you want to permanently delete this sharing link?')) {
      return;
    }

    try {
      await apiClient.deleteSharingLink(shareId);
      showSuccess('Sharing link deleted');
      await loadSharingLinks();
    } catch (error) {
      console.error('Error deleting sharing link:', error);
      showError('Failed to delete sharing link');
    }
  };

  const getExpirationStatus = (expiresAt?: string) => {
    if (!expiresAt) return null;
    
    const expiration = new Date(expiresAt);
    const now = new Date();
    
    if (expiration < now) {
      return { status: 'expired', color: 'error' as const };
    } else if (expiration.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
      return { status: 'expiring_soon', color: 'warning' as const };
    }
    
    return { status: 'active', color: 'success' as const };
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: { minHeight: '60vh' }
        }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <ShareIcon />
            <Box flex={1}>
              <Typography variant="h6">
                Share Container: {container.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create secure links to share container information
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={3}>
              {/* Create New Link Section */}
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6" color="primary">
                      <AddIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Create New Sharing Link
                    </Typography>
                    <Button
                      variant={showCreateForm ? 'outlined' : 'contained'}
                      onClick={() => setShowCreateForm(!showCreateForm)}
                      startIcon={showCreateForm ? <CloseIcon /> : <AddIcon />}
                    >
                      {showCreateForm ? 'Cancel' : 'New Link'}
                    </Button>
                  </Stack>

                  {showCreateForm && (
                    <Stack spacing={3}>
                      <TextField
                        label="Description (optional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g., For moving company, For family members"
                        fullWidth
                        inputProps={{ maxLength: 500 }}
                      />

                      <DateTimePicker
                        label="Expiration Date (optional)"
                        value={expiresAt}
                        onChange={(date) => setExpiresAt(date)}
                        minDateTime={new Date()}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            helperText: 'Leave empty for no expiration'
                          }
                        }}
                      />

                      <TextField
                        label="Max Access Count (optional)"
                        type="number"
                        value={maxAccesses}
                        onChange={(e) => setMaxAccesses(e.target.value ? parseInt(e.target.value) : '')}
                        inputProps={{ min: 1, max: 1000 }}
                        helperText="Maximum number of times this link can be accessed"
                        fullWidth
                      />

                      <Box>
                        <Typography variant="subtitle1" gutterBottom>
                          <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                          Privacy Settings
                        </Typography>
                        
                        <Stack spacing={1}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={includeItemDetails}
                                onChange={(e) => setIncludeItemDetails(e.target.checked)}
                              />
                            }
                            label="Include item details (names, categories, descriptions)"
                          />
                          
                          <FormControlLabel
                            control={
                              <Switch
                                checked={includePhotos}
                                onChange={(e) => setIncludePhotos(e.target.checked)}
                              />
                            }
                            label="Include item photos"
                          />
                          
                          <FormControlLabel
                            control={
                              <Switch
                                checked={includeSensitiveData}
                                onChange={(e) => setIncludeSensitiveData(e.target.checked)}
                              />
                            }
                            label="Include sensitive data (values, serial numbers, etc.)"
                          />
                        </Stack>

                        <Alert severity="info" sx={{ mt: 2 }}>
                          <Typography variant="body2">
                            <strong>Privacy Tip:</strong> Only enable sensitive data sharing when necessary. 
                            Recipients will see exactly what information is included.
                          </Typography>
                        </Alert>
                      </Box>

                      <Stack direction="row" spacing={2} justifyContent="flex-end">
                        <Button
                          onClick={() => setShowCreateForm(false)}
                          disabled={creating}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="contained"
                          onClick={handleCreateSharingLink}
                          disabled={creating}
                          startIcon={creating ? <CircularProgress size={16} /> : <ShareIcon />}
                        >
                          {creating ? 'Creating...' : 'Create Link'}
                        </Button>
                      </Stack>
                    </Stack>
                  )}
                </CardContent>
              </Card>

              {/* Existing Links Section */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  <LinkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Existing Sharing Links ({sharingLinks.length})
                </Typography>

                {sharingLinks.length === 0 ? (
                  <Alert severity="info">
                    No sharing links have been created for this container yet.
                  </Alert>
                ) : (
                  <List>
                    {sharingLinks.map((link, index) => {
                      const expirationStatus = getExpirationStatus(link.expiresAt);
                      
                      return (
                        <React.Fragment key={link.shareId}>
                          <ListItem alignItems="flex-start">
                            <ListItemText
                              primary={
                                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                                  <Typography variant="subtitle1">
                                    {link.description || 'Untitled Link'}
                                  </Typography>
                                  <Chip
                                    size="small"
                                    label={link.isActive ? 'Active' : 'Inactive'}
                                    color={link.isActive ? 'success' : 'default'}
                                  />
                                  {expirationStatus && (
                                    <Chip
                                      size="small"
                                      label={
                                        expirationStatus.status === 'expired' ? 'Expired' :
                                        expirationStatus.status === 'expiring_soon' ? 'Expires Soon' :
                                        'Active'
                                      }
                                      color={expirationStatus.color}
                                    />
                                  )}
                                </Stack>
                              }
                              secondary={
                                <Stack spacing={1}>
                                  <Typography variant="body2" color="text.secondary">
                                    Created: {format(new Date(link.createdAt), 'PPp')}
                                  </Typography>
                                  
                                  {link.expiresAt && (
                                    <Typography variant="body2" color="text.secondary">
                                      Expires: {format(new Date(link.expiresAt), 'PPp')}
                                    </Typography>
                                  )}
                                  
                                  <Typography variant="body2" color="text.secondary">
                                    Accessed: {link.accessCount} time{link.accessCount !== 1 ? 's' : ''}
                                    {link.maxAccesses && ` (max: ${link.maxAccesses})`}
                                    {link.lastAccessedAt && ` • Last: ${format(new Date(link.lastAccessedAt), 'PPp')}`}
                                  </Typography>

                                  <Stack direction="row" spacing={1} flexWrap="wrap">
                                    <Chip
                                      size="small"
                                      icon={link.privacySettings.includeItemDetails ? <VisibilityIcon /> : <VisibilityOffIcon />}
                                      label="Item Details"
                                      color={link.privacySettings.includeItemDetails ? 'success' : 'default'}
                                    />
                                    <Chip
                                      size="small"
                                      icon={link.privacySettings.includePhotos ? <VisibilityIcon /> : <VisibilityOffIcon />}
                                      label="Photos"
                                      color={link.privacySettings.includePhotos ? 'success' : 'default'}
                                    />
                                    <Chip
                                      size="small"
                                      icon={link.privacySettings.includeSensitiveData ? <VisibilityIcon /> : <VisibilityOffIcon />}
                                      label="Sensitive Data"
                                      color={link.privacySettings.includeSensitiveData ? 'warning' : 'default'}
                                    />
                                  </Stack>

                                  <TextField
                                    size="small"
                                    value={link.shareUrl}
                                    InputProps={{
                                      readOnly: true,
                                      endAdornment: (
                                        <InputAdornment position="end">
                                          <Tooltip title="Copy link">
                                            <IconButton
                                              onClick={() => handleCopyLink(link.shareUrl)}
                                              size="small"
                                            >
                                              <CopyIcon />
                                            </IconButton>
                                          </Tooltip>
                                        </InputAdornment>
                                      )
                                    }}
                                    sx={{ mt: 1 }}
                                  />
                                </Stack>
                              }
                            />
                            <ListItemSecondaryAction>
                              <Stack direction="row" spacing={1}>
                                {link.isActive && (
                                  <Tooltip title="Deactivate link">
                                    <IconButton
                                      onClick={() => handleDeactivateLink(link.shareId)}
                                      size="small"
                                      color="warning"
                                    >
                                      <VisibilityOffIcon />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                <Tooltip title="Delete link">
                                  <IconButton
                                    onClick={() => handleDeleteLink(link.shareId)}
                                    size="small"
                                    color="error"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </ListItemSecondaryAction>
                          </ListItem>
                          {index < sharingLinks.length - 1 && <Divider />}
                        </React.Fragment>
                      );
                    })}
                  </List>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default ContainerSharingDialog;