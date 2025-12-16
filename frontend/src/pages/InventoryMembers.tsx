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
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';
import { useLoading } from '../contexts/LoadingContext';
import apiClient from '../services/api';
import type { Inventory, InventoryMembership } from '../types';
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
      const [inventoryData, membersData] = await Promise.all([
        apiClient.getInventory(inventoryId),
        apiClient.getInventoryMembers(inventoryId),
      ]);
      
      setInventory(inventoryData);
      setMembers(membersData);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load inventory data');
      navigate('/inventories');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!inventoryId) return;

    try {
      setLoading(true);
      await apiClient.addInventoryMember(inventoryId, userId);
      showSuccess('Member added successfully');
      setIsAddDialogOpen(false);
      loadInventoryAndMembers();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to add member');
    } finally {
      setLoading(false);
    }
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

  if (!inventory) {
    return null; // Loading handled by LoadingContext
  }

  const ownerMember = members.find(m => m.role === 'owner');
  const regularMembers = members.filter(m => m.role === 'member');

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
                    <TableCell>User ID</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Added</TableCell>
                    <TableCell>Added By</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Owner */}
                  {ownerMember && (
                    <TableRow>
                      <TableCell sx={{ fontFamily: 'monospace' }}>
                        {ownerMember.userId}
                      </TableCell>
                      <TableCell>
                        <Chip label="Owner" color="primary" size="small" />
                      </TableCell>
                      <TableCell>
                        {new Date(ownerMember.addedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {ownerMember.addedBy}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">
                          Cannot remove owner
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  
                  {/* Regular Members */}
                  {regularMembers.map((member) => (
                    <TableRow key={member.userId}>
                      <TableCell sx={{ fontFamily: 'monospace' }}>
                        {member.userId}
                      </TableCell>
                      <TableCell>
                        <Chip label="Member" color="default" size="small" />
                      </TableCell>
                      <TableCell>
                        {new Date(member.addedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {member.addedBy}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          color="error"
                          onClick={() => handleRemoveMember(member)}
                          aria-label={`Remove member ${member.userId}`}
                        >
                          <DeleteIcon />
                        </IconButton>
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
        existingMemberIds={members.map(m => m.userId)}
      />
    </Box>
  );
}