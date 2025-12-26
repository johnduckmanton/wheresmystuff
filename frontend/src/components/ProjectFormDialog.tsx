import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  CircularProgress,
  Typography
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import type { MovingProject, ProjectStatus, Location } from '../types';
import apiClient from '../services/api';

interface ProjectFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (project: MovingProject) => void;
  project?: MovingProject | null;
  inventoryId: string;
  locations: Location[];
}

const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' }
];

/**
 * Project Form Dialog Component
 * Handles creation and editing of moving projects
 * Validates: Requirements 8.1, 8.2
 */
const ProjectFormDialog: React.FC<ProjectFormDialogProps> = ({
  open,
  onClose,
  onSave,
  project,
  inventoryId,
  locations
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: new Date(),
    targetDate: null as Date | null,
    status: 'planning' as ProjectStatus,
    sourceLocation: '',
    destinationLocation: '',
    metadata: {}
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form data when dialog opens or project changes
  useEffect(() => {
    if (open) {
      if (project) {
        // Editing existing project
        setFormData({
          name: project.name,
          description: project.description || '',
          startDate: new Date(project.startDate),
          targetDate: project.targetDate ? new Date(project.targetDate) : null,
          status: project.status,
          sourceLocation: project.sourceLocation || '',
          destinationLocation: project.destinationLocation || '',
          metadata: project.metadata || {}
        });
      } else {
        // Creating new project
        setFormData({
          name: '',
          description: '',
          startDate: new Date(),
          targetDate: null,
          status: 'planning',
          sourceLocation: '',
          destinationLocation: '',
          metadata: {}
        });
      }
      setError(null);
    }
  }, [open, project]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'Project name is required';
    }

    if (formData.name.length > 100) {
      return 'Project name must be 100 characters or less';
    }

    if (formData.description && formData.description.length > 1000) {
      return 'Description must be 1000 characters or less';
    }

    if (formData.targetDate && formData.targetDate <= formData.startDate) {
      return 'Target date must be after start date';
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const projectData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        inventoryId,
        startDate: formData.startDate.toISOString(),
        targetDate: formData.targetDate?.toISOString(),
        status: formData.status,
        sourceLocation: formData.sourceLocation || undefined,
        destinationLocation: formData.destinationLocation || undefined,
        metadata: formData.metadata
      };

      let savedProject: MovingProject;

      if (project) {
        // Update existing project
        savedProject = await apiClient.updateProject(project.id, {
          ...projectData,
          inventoryId
        });
      } else {
        // Create new project
        savedProject = await apiClient.createProject(projectData);
      }

      onSave(savedProject);
      onClose();
    } catch (err) {
      console.error('Error saving project:', err);
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const isEditing = !!project;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '500px' }
        }}
      >
        <DialogTitle>
          {isEditing ? 'Edit Moving Project' : 'Create New Moving Project'}
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'grid', gap: 2 }}>
              <Box>
                <TextField
                  label="Project Name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  fullWidth
                  required
                  disabled={loading}
                  slotProps={{
                    htmlInput: { maxLength: 100 }
                  }}
                  helperText={`${formData.name.length}/100 characters`}
                />
              </Box>

              <Box>
                <TextField
                  label="Description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  disabled={loading}
                  slotProps={{
                    htmlInput: { maxLength: 1000 }
                  }}
                  helperText={`${formData.description.length}/1000 characters`}
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
                <DatePicker
                  label="Start Date"
                  value={formData.startDate}
                  onChange={(date) => handleInputChange('startDate', date || new Date())}
                  disabled={loading}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true
                    }
                  }}
                />

                <DatePicker
                  label="Target Completion Date"
                  value={formData.targetDate}
                  onChange={(date) => handleInputChange('targetDate', date)}
                  disabled={loading}
                  minDate={formData.startDate}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      helperText: 'Optional target completion date'
                    }
                  }}
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    label="Status"
                    disabled={loading}
                  >
                    {PROJECT_STATUSES.map((status) => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Source Location</InputLabel>
                  <Select
                    value={formData.sourceLocation}
                    onChange={(e) => handleInputChange('sourceLocation', e.target.value)}
                    label="Source Location"
                    disabled={loading}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {locations.map((location) => (
                      <MenuItem key={location.id} value={location.id}>
                        {location.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <FormControl fullWidth>
                  <InputLabel>Destination Location</InputLabel>
                  <Select
                    value={formData.destinationLocation}
                    onChange={(e) => handleInputChange('destinationLocation', e.target.value)}
                    label="Destination Location"
                    disabled={loading}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {locations.map((location) => (
                      <MenuItem key={location.id} value={location.id}>
                        {location.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {isEditing && project && (
                <Box>
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Project Statistics
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Containers
                        </Typography>
                        <Typography variant="h6">
                          {project.containerCount}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Items
                        </Typography>
                        <Typography variant="h6">
                          {project.itemCount}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Progress
                        </Typography>
                        <Typography variant="h6">
                          {project.completionPercentage}%
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Created
                        </Typography>
                        <Typography variant="body2">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button 
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Saving...' : (isEditing ? 'Update Project' : 'Create Project')}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default ProjectFormDialog;