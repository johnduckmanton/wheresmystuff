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

const CATEGORY_LABELS: Record<string, string> = {
  moving_company: 'Moving Company',
  truck_rental: 'Truck Rental',
  packing_supplies: 'Packing Supplies',
  utilities: 'Utilities',
  deposits: 'Deposits',
  travel: 'Travel',
  accommodation: 'Accommodation',
  insurance: 'Insurance',
  permits: 'Permits',
  repairs: 'Repairs',
  furniture: 'Furniture',
  miscellaneous: 'Miscellaneous',
};

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
    setFormData({ category: 'miscellaneous', description: '', estimatedCost: 0, actualCost: 0, status: 'pending' });
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
    if (!formData.category.trim() || !formData.description.trim() || formData.estimatedCost <= 0) {
      console.error('Validation failed:', { category: formData.category, description: formData.description, estimatedCost: formData.estimatedCost });
      return;
    }

    try {
      if (editingItem) {
        const updatedItem = await apiClient.updateBudgetItem(editingItem.id, {
          category: formData.category,
          description: formData.description,
          estimatedCost: formData.estimatedCost,
          actualCost: formData.actualCost,
          status: formData.status as 'pending' | 'approved' | 'paid',
          projectId,
          inventoryId
        });
        onBudgetChange(budgetItems.map(i => i.id === editingItem.id ? updatedItem : i));
      } else {
        const newItem = await apiClient.createBudgetItem(projectId, {
          category: formData.category,
          description: formData.description,
          estimatedCost: formData.estimatedCost,
          actualCost: formData.actualCost,
          status: formData.status as 'pending' | 'approved' | 'paid',
          inventoryId
        });
        onBudgetChange([...budgetItems, newItem]);
      }
      setFormOpen(false);
    } catch (err) {
      console.error('Error saving budget item:', err);
    }
  };

  const handleDeleteItem = async (item: BudgetItem) => {
    try {
      await apiClient.deleteBudgetItem(item.id, projectId, inventoryId);
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
              <TableRow sx={{ backgroundColor: 'background.paper' }}>
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
                  <TableCell>{CATEGORY_LABELS[item.category] || item.category}</TableCell>
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
              select
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              fullWidth
            >
              <MenuItem value="moving_company">Moving Company</MenuItem>
              <MenuItem value="truck_rental">Truck Rental</MenuItem>
              <MenuItem value="packing_supplies">Packing Supplies</MenuItem>
              <MenuItem value="utilities">Utilities</MenuItem>
              <MenuItem value="deposits">Deposits</MenuItem>
              <MenuItem value="travel">Travel</MenuItem>
              <MenuItem value="accommodation">Accommodation</MenuItem>
              <MenuItem value="insurance">Insurance</MenuItem>
              <MenuItem value="permits">Permits</MenuItem>
              <MenuItem value="repairs">Repairs</MenuItem>
              <MenuItem value="furniture">Furniture</MenuItem>
              <MenuItem value="miscellaneous">Miscellaneous</MenuItem>
            </TextField>
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
