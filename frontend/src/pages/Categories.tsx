import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Alert } from '@mui/material';
import { useState, useEffect } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EntityTable from '../components/EntityTable';
import type { EntityTableColumn } from '../components/EntityTable';
import CategoryFormDialog from '../components/CategoryFormDialog';
import { useLoading } from '../contexts/LoadingContext';
import { useNotification } from '../contexts/NotificationContext';
import { useInventory } from '../contexts/InventoryContext';
import apiClient from '../services/api';
import type { Category } from '../types';

const columns: EntityTableColumn[] = [
  { field: 'name', headerName: 'Name', flex: 1 },
  { field: 'description', headerName: 'Description', flex: 2 },
  { field: 'dateAdded', headerName: 'Date Added', width: 120 },
];

interface CategoryTableRow {
  id: string;
  name: string;
  description: string;
  dateAdded: string;
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryTableRow | null>(null);

  // Contexts
  const { setLoading: setGlobalLoading } = useLoading();
  const { showSuccess, showError } = useNotification();
  const { currentInventory } = useInventory();

  // Fetch all data when inventory changes
  useEffect(() => {
    if (currentInventory) {
      loadData();
    }
  }, [currentInventory]);

  const loadData = async () => {
    if (!currentInventory) {
      setLoading(false);
      setGlobalLoading(false);
      return;
    }

    try {
      setLoading(true);
      setGlobalLoading(true);
      const categoriesData = await apiClient.getCategories(currentInventory.id);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
      showError(error instanceof Error ? error.message : 'Failed to load categories. Please try again.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  // Transform Categories data for table display
  const tableData: CategoryTableRow[] = categories.map(category => ({
    id: category.id,
    name: category.name,
    description: category.description || '',
    dateAdded: category.dateAdded ? new Date(category.dateAdded).toLocaleDateString() : '',
  }));

  const handleAdd = () => {
    setEditingCategory(undefined);
    setFormDialogOpen(true);
  };

  const handleEdit = (row: CategoryTableRow) => {
    // Find the full Category object
    const category = categories.find(c => c.id === row.id);
    if (category) {
      setEditingCategory(category);
      setFormDialogOpen(true);
    }
  };

  const handleDelete = (row: CategoryTableRow) => {
    setCategoryToDelete(row);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete || !currentInventory) return;

    try {
      setGlobalLoading(true);
      await apiClient.deleteCategory(categoryToDelete.id, currentInventory.id);
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      showSuccess('Category deleted successfully');
      // Refresh the table
      await loadData();
    } catch (error) {
      console.error('Error deleting category:', error);
      showError(error instanceof Error ? error.message : 'Failed to delete category. Please try again.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const handleFormSubmit = async (data: Partial<Category>) => {
    try {
      setGlobalLoading(true);
      if (editingCategory) {
        // Update existing category
        await apiClient.updateCategory(editingCategory.id, data);
        showSuccess('Category updated successfully');
      } else {
        // Create new category
        await apiClient.createCategory(data as Omit<Category, 'id' | 'dateAdded'>);
        showSuccess('Category created successfully');
      }
      
      setFormDialogOpen(false);
      setEditingCategory(undefined);
      // Refresh the table
      await loadData();
    } catch (error) {
      console.error('Error saving category:', error);
      showError(error instanceof Error ? error.message : 'Failed to save category. Please try again.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleFormClose = () => {
    setFormDialogOpen(false);
    setEditingCategory(undefined);
  };

  const handleRowClick = (row: CategoryTableRow) => {
    // Open edit dialog when row is clicked
    handleEdit(row);
  };

  // Show message if no inventory is selected
  if (!currentInventory) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          Categories
        </Typography>
        <Alert severity="info">
          Please select an inventory to view categories. You can create a new inventory from the Inventories page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Categories - {currentInventory.name}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Category
        </Button>
      </Box>

      <EntityTable
        columns={columns}
        data={tableData}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRowClick={handleRowClick}
        loading={loading}
      />

      {/* Category Form Dialog */}
      <CategoryFormDialog
        open={formDialogOpen}
        category={editingCategory}
        onSubmit={handleFormSubmit}
        onClose={handleFormClose}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete "{categoryToDelete?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
