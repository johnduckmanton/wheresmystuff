import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { useState, useEffect } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EntityTable from '../components/EntityTable';
import type { EntityTableColumn } from '../components/EntityTable';
import PersonFormDialog from '../components/PersonFormDialog';
import { useLoading } from '../contexts/LoadingContext';
import { useNotification } from '../contexts/NotificationContext';
import apiClient from '../services/api';
import type { Person } from '../types';

const columns: EntityTableColumn[] = [
  { field: 'name', headerName: 'Name', flex: 1 },
  { field: 'description', headerName: 'Description', flex: 2 },
  { field: 'dateAdded', headerName: 'Date Added', width: 120 },
];

interface PersonTableRow {
  id: string;
  name: string;
  description: string;
  dateAdded: string;
}

export default function People() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<PersonTableRow | null>(null);

  // Contexts
  const { setLoading: setGlobalLoading } = useLoading();
  const { showSuccess, showError } = useNotification();

  // Fetch all data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setGlobalLoading(true);
      const peopleData = await apiClient.getPeople();
      setPeople(peopleData);
    } catch (error) {
      console.error('Error loading people:', error);
      showError(error instanceof Error ? error.message : 'Failed to load people. Please try again.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  // Transform People data for table display
  const tableData: PersonTableRow[] = people.map(person => ({
    id: person.id,
    name: person.name,
    description: person.description || '',
    dateAdded: person.dateAdded ? new Date(person.dateAdded).toLocaleDateString() : '',
  }));

  const handleAdd = () => {
    setEditingPerson(undefined);
    setFormDialogOpen(true);
  };

  const handleEdit = (row: PersonTableRow) => {
    // Find the full Person object
    const person = people.find(p => p.id === row.id);
    if (person) {
      setEditingPerson(person);
      setFormDialogOpen(true);
    }
  };

  const handleDelete = (row: PersonTableRow) => {
    setPersonToDelete(row);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!personToDelete) return;

    try {
      setGlobalLoading(true);
      await apiClient.deletePerson(personToDelete.id);
      setDeleteDialogOpen(false);
      setPersonToDelete(null);
      showSuccess('Person deleted successfully');
      // Refresh the table
      await loadData();
    } catch (error) {
      console.error('Error deleting person:', error);
      showError(error instanceof Error ? error.message : 'Failed to delete person. Please try again.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setPersonToDelete(null);
  };

  const handleFormSubmit = async (data: Partial<Person>) => {
    try {
      setGlobalLoading(true);
      if (editingPerson) {
        // Update existing person
        await apiClient.updatePerson(editingPerson.id, data);
        showSuccess('Person updated successfully');
      } else {
        // Create new person
        await apiClient.createPerson(data as Omit<Person, 'id' | 'dateAdded'>);
        showSuccess('Person created successfully');
      }
      
      setFormDialogOpen(false);
      setEditingPerson(undefined);
      // Refresh the table
      await loadData();
    } catch (error) {
      console.error('Error saving person:', error);
      showError(error instanceof Error ? error.message : 'Failed to save person. Please try again.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleFormClose = () => {
    setFormDialogOpen(false);
    setEditingPerson(undefined);
  };

  const handleRowClick = (row: PersonTableRow) => {
    // Open edit dialog when row is clicked
    handleEdit(row);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          People
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Person
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

      {/* Person Form Dialog */}
      <PersonFormDialog
        open={formDialogOpen}
        person={editingPerson}
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
            Are you sure you want to delete "{personToDelete?.name}"? This action cannot be undone.
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
