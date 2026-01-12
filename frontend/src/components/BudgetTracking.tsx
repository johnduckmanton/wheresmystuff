import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import apiClient from '../services/api';

interface BudgetItem {
  id: string;
  category: string;
  description: string;
  estimatedCost: number;
  actualCost?: number;
  status: 'pending' | 'approved' | 'paid';
}

interface BudgetTrackingProps {
  projectId: string;
  inventoryId: string;
  budgetItems: BudgetItem[];
  onBudgetChange: (items: BudgetItem[]) => void;
}

const BudgetTracking: React.FC<BudgetTrackingProps> = ({
  projectId,
  inventoryId,
  budgetItems,
  onBudgetChange
}) => {
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    estimatedCost: 0,
    actualCost: 0,
    status: 'pending' as 'pending' | 'approved' | 'paid'
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedItem, setSelectedItem] = useState<BudgetItem | null>(null);

  const totalEstimated = budgetItems.reduce((sum, item) => sum + item.estimatedCost, 0);
  const totalActual = budgetItems.reduce((sum, item) => sum + (item.actualCost || 0), 0);
  const budgetUsed = totalEstimated > 0 ? (totalActual / totalEstimated) * 100 : 0;

  const handleAddItem = () => {
    setEditingItem(null);
    setFormData({ category: '', description: '', estimatedCost: 0, actualCost: 0, status: 'pending' });
    setFormOpen(true);
  };

  const handleEditItem = (item: BudgetItem) => {
    setEditingItem(item);
    setFormData({
      category: item.category,
      description: item.description,
      estimatedCost: item.estimatedCost,
      actualCost: item.actualCost || 0,
      status: item.status
    });
    setFormOpen(true);
    setAnchorEl(null);
  };

  const handleSaveItem = async () => {
    if (!formData.category.trim()) return;

    try {
      if (editingItem) {
        await apiClient.updateBudgetItem(editingItem.id, {
          category: formData.category,
          description: formData.description,
          estimatedCost: formData.estimatedCost,
          actualCost: formData.actualCost,
          status: formData.status as 'pending' | 'approved' | 'paid',
          inventoryId
        });
      } else {
        await apiClient.createBudgetItem(projectId, {
          category: formData.category,
          description: formData.description,
          estimatedCost: formData.estimatedCost,
          actualCost: formData.actualCost,
          status: formData.status as 'pending' | 'approved' | 'paid',
          inventoryId
        });
      }
      setFormOpen(false);
    } catch (err) {
      console.error('Error saving budget item:', err);
    }
  };

  const handleDeleteItem = async (item: BudgetItem) => {
    try {
      await apiClient.deleteBudgetItem(item.id);
      onBudgetChange(budgetItems.filter(i => i.id !== item.id));
      setAnchorEl(null);
    } catch (err) {
      console.error('Error deleting budget item:', err);
    }
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    switch (status) {
      case 'paid': return 'success';
      case 'approved': return 'primary';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Budget Items ({budgetItems.length})</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={handleAddItem}>
          Add Item
        </Button>
      </Box>

      {/* Budget Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Budget Usage</Typography>
                <Typography variant="body2" fontWeight="medium">
                  £{totalActual.toFixed(2)} / £{totalEstimated.toFixed(2)}
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={Math.min(budgetUsed, 100)} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Estimated</Typography>
                <Typography variant="h6">£{totalEstimated.toFixed(2)}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Actual</Typography>
                <Typography variant="h6">£{totalActual.toFixed(2)}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Remaining</Typography>
                <Typography variant="h6">£{Math.max(0, totalEstimated - totalActual).toFixed(2)}</Typography>
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Budget Items Table */}
      {budgetItems.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">No budget items yet. Track project expenses here.</Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Card}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell>Category</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Estimated</TableCell>
                <TableCell align="right">Actual</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {budgetItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell align="right">£{item.estimatedCost.toFixed(2)}</TableCell>
                  <TableCell align="right">£{(item.actualCost || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Chip label={item.status} size="small" color={getStatusColor(item.status)} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setAnchorEl(e.currentTarget);
                        setSelectedItem(item);
                      }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Budget Item Form Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? 'Edit Budget Item' : 'Add Budget Item'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Estimated Cost"
              type="number"
              value={formData.estimatedCost}
              onChange={(e) => setFormData({ ...formData, estimatedCost: parseFloat(e.target.value) })}
              fullWidth
              inputProps={{ step: '0.01' }}
            />
            <TextField
              label="Actual Cost"
              type="number"
              value={formData.actualCost}
              onChange={(e) => setFormData({ ...formData, actualCost: parseFloat(e.target.value) })}
              fullWidth
              inputProps={{ step: '0.01' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveItem} variant="contained">
            {editingItem ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => selectedItem && handleEditItem(selectedItem)}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => selectedItem && handleDeleteItem(selectedItem)} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default BudgetTracking;
