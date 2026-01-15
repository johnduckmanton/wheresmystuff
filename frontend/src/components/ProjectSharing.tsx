import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  CircularProgress,
  Stack,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { MovingProject } from '../types';

interface ShareLink {
  id: string;
  projectId: string;
  token: string;
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
  accessCount: number;
  lastAccessedAt?: string;
}

interface ProjectSharingProps {
  project: MovingProject;
}

const ProjectSharing: React.FC<ProjectSharingProps> = ({ project }) => {
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [accessLogOpen, setAccessLogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<ShareLink | null>(null);
  const [expirationDays, setExpirationDays] = useState(7);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  useEffect(() => {
    loadShareLinks();
  }, [project.id]);

  const loadShareLinks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Share links functionality would be implemented in the backend
      // For now, we'll show an empty list
      setShareLinks([]);
    } catch (err) {
      console.error('Error loading share links:', err);
      setError(err instanceof Error ? err.message : 'Failed to load share links');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShareLink = async () => {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      // Create mock share link - real implementation would call API
      const newLink: ShareLink = {
        id: `link-${Date.now()}`,
        projectId: project.id,
        token: `token-${Math.random().toString(36).substr(2, 9)}`,
        expiresAt: expirationDays === 0 ? undefined : expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: 'current-user',
        accessCount: 0
      };

      setShareLinks(prevLinks => [newLink, ...prevLinks]);
      setCreateDialogOpen(false);
      setExpirationDays(7);
    } catch (err) {
      console.error('Error creating share link:', err);
      setError(err instanceof Error ? err.message : 'Failed to create share link');
    }
  };

  const handleRevokeLink = async (linkId: string) => {
    try {
      // Real implementation would call API to revoke the link
      setShareLinks(prevLinks => prevLinks.filter(link => link.id !== linkId));
    } catch (err) {
      console.error('Error revoking share link:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke share link');
    }
  };

  const handleCopyLink = (link: ShareLink) => {
    const shareUrl = `${window.location.origin}/shared/${link.token}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLinkId(link.id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const handleViewAccessLog = (link: ShareLink) => {
    setSelectedLink(link);
    setAccessLogOpen(true);
  };

  const isLinkExpired = (link: ShareLink) => {
    if (!link.expiresAt) return false;
    return new Date(link.expiresAt) < new Date();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Share Project
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create shareable links to allow others to view this project
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Share Link
            </Button>
          </Box>

          {shareLinks.length === 0 ? (
            <Alert severity="info">
              No share links created yet. Create one to share this project with others.
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell>Created</TableCell>
                    <TableCell>Expires</TableCell>
                    <TableCell align="right">Accesses</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shareLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell>
                        {format(new Date(link.createdAt), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {link.expiresAt ? (
                            <>
                              {format(new Date(link.expiresAt), 'MMM d, yyyy')}
                              {isLinkExpired(link) && (
                                <Chip label="Expired" size="small" color="error" />
                              )}
                            </>
                          ) : (
                            <Typography variant="body2">Never</Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{link.accessCount}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <IconButton
                            size="small"
                            onClick={() => handleCopyLink(link)}
                            title={copiedLinkId === link.id ? 'Copied!' : 'Copy link'}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleViewAccessLog(link)}
                            title="View access log"
                          >
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRevokeLink(link.id)}
                            title="Revoke link"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Share Link Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Share Link</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Expiration</InputLabel>
              <Select
                value={expirationDays}
                onChange={(e) => setExpirationDays(e.target.value as number)}
                label="Expiration"
              >
                <MenuItem value={1}>1 day</MenuItem>
                <MenuItem value={7}>7 days</MenuItem>
                <MenuItem value={30}>30 days</MenuItem>
                <MenuItem value={90}>90 days</MenuItem>
                <MenuItem value={0}>Never expires</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              The share link will expire {expirationDays === 0 ? 'never' : `in ${expirationDays} day${expirationDays !== 1 ? 's' : ''}`}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateShareLink} variant="contained">
            Create Link
          </Button>
        </DialogActions>
      </Dialog>

      {/* Access Log Dialog */}
      <Dialog open={accessLogOpen} onClose={() => setAccessLogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Access Log</DialogTitle>
        <DialogContent>
          {selectedLink ? (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Total accesses: {selectedLink.accessCount}
              </Typography>
              {selectedLink.lastAccessedAt && (
                <Typography variant="body2" color="text.secondary">
                  Last accessed: {format(new Date(selectedLink.lastAccessedAt), 'MMM d, yyyy HH:mm')}
                </Typography>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccessLogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectSharing;
