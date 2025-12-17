import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Alert,
  Select,
  MenuItem,
  FormControl,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Security as SecurityIcon,
  Visibility as VisibilityIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';
import { useLoading } from '../contexts/LoadingContext';
import apiClient from '../services/api';
import type { Inventory, InventoryMembership, Invitation } from '../types';
import AddMemberDialog from '../components/AddMemberDialog';

/**
 * Inventory Members Page Component
 * Manages inventory membership - adding and removing members
 * Validates: Requirements 1.4, 1.8
 */
export default function InventoryMembers() {
  const { inventoryId } = useParams<{ inventoryId: string }>();
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [members, setMembers] = useState<InventoryMembership[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [editingMember, setEditingMember] = useState<InventoryMembership | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<string>('');
  const [roleChangeReason, setRoleChangeReason] = useState<string>('');
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  
  const { showSuccess, showError } = useNotification();
  const { setLoading } = useLoading();

  // Load inventory and members on component mount
  useEffect(() => {
    if (inventoryId) {
      loadInventoryAndMembers();
    }
  }, [inventoryId]);

  const loadInventoryAndMembers = async () => {
    if (!inventoryId) return;
    
    try {
      setLoading(true);
      const [inventoryData, membersData, userProfile] = await Promise.all([
        apiClient.getInventory(inventoryId),
        apiClient.getInventoryMembers(inventoryId),
        apiClient.getUserProfile(),
      ]);
      
      setInventory(inventoryData);
      setMembers(membersData);
      setCurrentUserProfile(userProfile);
      
      // Find current user's role
      const currentMember = membersData.find(m => m.userId === userProfile.userId);
      setCurrentUserRole(currentMember?.role || '');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load inventory data');
      navigate('/inventories');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId: string, role?: string) => {
    if (!inventoryId) return;

    try {
      setLoading(true);
      // Add member with the specified role (role parameter is used by AddMemberDialog)
      await apiClient.addInventoryMember(inventoryId, userId);
      
      // If a specific role was requested and it's not the default 'member', update the role
      if (role && role !== 'member') {
        await apiClient.updateMemberRole(inventoryId, userId, role, 'Initial role assignment');
      }
      
      showSuccess('Member added successfully');
      setIsAddDialogOpen(false);
      loadInventoryAndMembers();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleInvitationSent = (invitation: Invitation) => {
    showSuccess(`Invitation sent to ${invitation.email}`);
    setIsAddDialogOpen(false);
    // Optionally refresh invitations list if you want to show pending invitations
  };

  const handleRemoveMember = async (member: InventoryMembership) => {
    if (!inventoryId) return;

    if (!window.confirm(`Are you sure you want to remove this member? They will lose access to all items in this inventory.`)) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.removeInventoryMember(inventoryId, member.userId);
      showSuccess('Member removed successfully');
      loadInventoryAndMembers();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = (member: InventoryMembership) => {
    setEditingMember(member);
    setNewRole(member.role);
    setRoleChangeReason('');
    setIsRoleDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!inventoryId || !editingMember || !newRole) return;

    try {
      setLoading(true);
      await apiClient.updateMemberRole(inventoryId, editingMember.userId, newRole, roleChangeReason);
      showSuccess('Member role updated successfully');
      setIsRoleDialogOpen(false);
      setEditingMember(null);
      setNewRole('');
      setRoleChangeReason('');
      loadInventoryAndMembers();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to update member role');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for role management
  const getRoleColor = (role: string): 'primary' | 'secondary' | 'default' | 'error' | 'info' | 'success' | 'warning' => {
    switch (role) {
      case 'owner': return 'primary';
      case 'administrator': return 'secondary';
      case 'member': return 'default';
      case 'read_only': return 'warning';
      default: return 'default';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <SecurityIcon fontSize="small" />;
      case 'administrator': return <AdminIcon fontSize="small" />;
      case 'member': return <PersonIcon fontSize="small" />;
      case 'read_only': return <VisibilityIcon fontSize="small" />;
      default: return <PersonIcon fontSize="small" />;
    }
  };

  const getRoleDisplayName = (role: string): string => {
    switch (role) {
      case 'owner': return 'Owner';
      case 'administrator': return 'Administrator';
      case 'member': return 'Member';
      case 'read_only': return 'Read Only';
      default: return role;
    }
  };

  const getPermissionDescription = (role: string): string => {
    switch (role) {
      case 'owner': return 'Full access including inventory deletion and role management';
      case 'administrator': return 'Can manage items, members, and settings (except deletion)';
      case 'member': return 'Can view and manage items, view member list';
      case 'read_only': return 'Can only view items, no editing permissions';
      default: return 'Unknown role';
    }
  };

  const canEditRole = (memberRole: string): boolean => {
    if (currentUserRole === 'owner') {
      return true; // Owners can edit any role
    }
    if (currentUserRole === 'administrator') {
      return ['member', 'read_only'].includes(memberRole); // Admins can only edit member/read_only roles
    }
    return false; // Members and read_only cannot edit roles
  };

  const getAssignableRoles = (): string[] => {
    if (currentUserRole === 'owner') {
      return ['owner', 'administrator', 'member', 'read_only'];
    }
    if (currentUserRole === 'administrator') {
      return ['member', 'read_only'];
    }
    return [];
  };

  if (!inventory) {
    return null; // Loading handled by LoadingContext
  }

  // Sort members by role hierarchy (owner first, then by role level)
  const sortedMembers = [...members].sort((a, b) => {
    const roleOrder = { owner: 4, administrator: 3, member: 2, read_only: 1 };
    const aOrder = roleOrder[a.role as keyof typeof roleOrder] || 0;
    const bOrder = roleOrder[b.role as keyof typeof roleOrder] || 0;
    return bOrder - aOrder;
  });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/inventories')}
          sx={{ mr: 2 }}
        >
          Back to Inventories
        </Button>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1">
            Manage Members
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {inventory.name}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setIsAddDialogOpen(true)}
        >
          Add Member
        </Button>
      </Box>

      {/* Members List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Members ({members.length})
          </Typography>
          
          {members.length === 0 ? (
            <Alert severity="info">
              No members found. Add members to share this inventory with others.
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Role & Permissions</TableCell>
                    <TableCell>Added</TableCell>
                    <TableCell>Added By</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedMembers.map((member) => (
                    <TableRow key={member.userId}>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {member.userProfile?.displayName || member.userProfile?.username || 'Unknown User'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {member.userProfile?.email || member.userId}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Chip 
                            label={getRoleDisplayName(member.role)} 
                            color={getRoleColor(member.role)} 
                            size="small"
                            icon={getRoleIcon(member.role)}
                          />
                          <Tooltip title={getPermissionDescription(member.role)} arrow>
                            <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                              {getPermissionDescription(member.role)}
                            </Typography>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body2">
                            {new Date(member.addedAt).toLocaleDateString()}
                          </Typography>
                          {member.updatedAt && member.updatedAt !== member.addedAt && (
                            <Typography variant="caption" color="text.secondary">
                              Updated: {new Date(member.updatedAt).toLocaleDateString()}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body2">
                            {member.addedByProfile?.displayName || member.addedByProfile?.username || member.addedBy || 'Unknown'}
                          </Typography>
                          {member.addedByProfile?.email && (
                            <Typography variant="caption" color="text.secondary">
                              {member.addedByProfile.email}
                            </Typography>
                          )}
                          {member.updatedBy && member.updatedBy !== member.addedBy && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                              Updated by: {member.updatedByProfile?.displayName || member.updatedByProfile?.username || member.updatedBy}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          {canEditRole(member.role) && (
                            <Tooltip title="Edit role">
                              <IconButton
                                color="primary"
                                onClick={() => handleEditRole(member)}
                                aria-label={`Edit role for ${member.userId}`}
                                size="small"
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          {member.role !== 'owner' && (
                            <Tooltip title="Remove member">
                              <IconButton
                                color="error"
                                onClick={() => handleRemoveMember(member)}
                                aria-label={`Remove member ${member.userId}`}
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          {member.role === 'owner' && (
                            <Typography variant="caption" color="text.secondary">
                              Owner
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <AddMemberDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSubmit={handleAddMember}
        onInvitationSent={handleInvitationSent}
        existingMemberIds={members.map(m => m.userId)}
        inventoryId={inventoryId}
        inventoryName={inventory.name}
        inviterName={currentUserProfile?.displayName || currentUserProfile?.username || 'Unknown'}
      />

      {/* Edit Role Dialog */}
      <Dialog 
        open={isRoleDialogOpen} 
        onClose={() => setIsRoleDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Member Role</DialogTitle>
        <DialogContent>
          {editingMember && (
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity="info">
                Changing role for user: <strong>
                  {editingMember.userProfile?.displayName || editingMember.userProfile?.username || 'Unknown User'}
                </strong>
                {editingMember.userProfile?.email && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    {editingMember.userProfile.email}
                  </Typography>
                )}
              </Alert>
              
              <FormControl fullWidth>
                <Typography variant="subtitle2" gutterBottom>
                  Select New Role
                </Typography>
                <Select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  fullWidth
                >
                  {getAssignableRoles().map((role) => (
                    <MenuItem key={role} value={role}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getRoleIcon(role)}
                        <Box>
                          <Typography variant="body1">
                            {getRoleDisplayName(role)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {getPermissionDescription(role)}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Reason for Change (Optional)"
                multiline
                rows={3}
                value={roleChangeReason}
                onChange={(e) => setRoleChangeReason(e.target.value)}
                placeholder="Provide a reason for this role change for audit purposes..."
                fullWidth
              />

              {newRole !== editingMember.role && (
                <Alert severity="warning">
                  <Typography variant="body2">
                    <strong>Current role:</strong> {getRoleDisplayName(editingMember.role)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>New role:</strong> {getRoleDisplayName(newRole)}
                  </Typography>
                  <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                    This change will be logged for audit purposes.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsRoleDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateRole} 
            variant="contained"
            disabled={!newRole || newRole === editingMember?.role}
          >
            Update Role
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}