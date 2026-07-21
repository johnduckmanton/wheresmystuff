import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Alert } from '@mui/material';
import { useState, useEffect } from 'react';
import AddIcon from '@mui/icons-material/Add';
import UploadIcon from '@mui/icons-material/Upload';
import EntityTable from '../components/EntityTable';
import type { EntityTableColumn } from '../components/EntityTable';
import CategoryFormDialog from '../components/CategoryFormDialog';
import CategoryImportDialog from '../components/CategoryImportDialog';
import { useLoading } from '../contexts/LoadingContext';
import { useNotification } from '../contexts/NotificationContext';
import { useInventory } from '../contexts/InventoryContext';
import apiClient from '../services/api';
import type { Category } from '../types';
import { sortByDateDesc } from '../utils/sortByDateDesc';

const columns: EntityTableColumn[] = [
  { 
    field: 'name', 
    headerName: 'Name', 
    flex: 1,
    renderCell: (params) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: params.row.color || '#9E9E9E',
            border: '2px solid #fff',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
            flexShrink: 0,
          }}
          title={`Color: ${params.row.color || 'Default'}`}
        />
        <span style={{ flexGrow: 1 }}>{params.value}</span>
      </Box>
    )
  },
  { 
    field: 'description', 
    headerName: 'Description', 
    flex: 2
  },
  { field: 'dateAdded', headerName: 'Date Added', width: 120 },
];

interface CategoryTableRow {
  id: string;
  name: string;
  description: string;
  color?: string;
  dateAdded: string;
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
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
      // Ensure we have an array, fallback to empty array if not
      const safeCategoriesData = Array.isArray(categoriesData) ? categoriesData : [];
      setCategories(sortByDateDesc(safeCategoriesData));
    } catch (error) {
      console.error('Error loading categories:', error);
      showError(error instanceof Error ? error.message : 'Failed to load categories. Please try again.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  // Transform Categories data for table display
  const tableData: CategoryTableRow[] = Array.isArray(categories) ? categories.map(category => {
    // Clean description by removing color/icon metadata
    let cleanDescription = category.description || '';
    
    // Remove color and icon metadata lines that appear in the description
    cleanDescription = cleanDescription
      .split('\n')
      .filter(line => 
        !line.toLowerCase().includes('color:') && 
        !line.toLowerCase().includes('icon:') &&
        line.trim() !== ''
      )
      .join('\n')
      .trim();
    
    return {
      id: category.id,
      name: category.name,
      description: cleanDescription,
      color: category.color || '#9E9E9E', // Default gray color if none set
      dateAdded: category.dateAdded ? new Date(category.dateAdded).toLocaleDateString() : '',
    };
  }) : [];

  const handleAdd = () => {
    setEditingCategory(undefined);
    setFormDialogOpen(true);
  };

  const handleImport = () => {
    setImportDialogOpen(true);
  };

  const handleImportCSV = async (csvData: string) => {
    if (!currentInventory) {
      throw new Error('No inventory selected');
    }

    try {
      const results = await apiClient.importCategoriesFromCSV(csvData, currentInventory.id);
      
      // Show success message
      if (results.failed === 0) {
        showSuccess(`Successfully imported ${results.imported} new and updated ${results.updated} categories`);
      } else {
        showSuccess(`Import completed: ${results.imported} new, ${results.updated} updated, ${results.failed} failed`);
      }
      
      // Refresh the categories list
      await loadData();
      
      return results;
    } catch (error) {
      console.error('Error importing categories:', error);
      throw error;
    }
  };

  const handleImportClose = () => {
    setImportDialogOpen(false);
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
        const created = await apiClient.createCategory(data as Omit<Category, 'id' | 'dateAdded'>);
        showSuccess('Category created successfully', {
          label: 'View',
          onClick: () => {
            setEditingCategory(created);
            setFormDialogOpen(true);
          },
        });
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<UploadIcon />} onClick={handleImport}>
            Import CSV
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Category
          </Button>
        </Box>
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

      {/* Category Import Dialog */}
      <CategoryImportDialog
        open={importDialogOpen}
        onClose={handleImportClose}
        onImport={handleImportCSV}
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
