import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Stack,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { useInventory } from '../contexts/InventoryContext';
import { useNotification } from '../contexts/NotificationContext';
import type { MovingProject, ProjectStatus, Location } from '../types';
import apiClient from '../services/api';
import ProjectList from '../components/ProjectList';
import ProjectFormDialog from '../components/ProjectFormDialog';
import ProjectDetailView from '../components/ProjectDetailView';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`project-tabpanel-${index}`}
      aria-labelledby={`project-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

/**
 * Projects Page Component
 * Main page for managing moving projects
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */
const Projects: React.FC = () => {
  const { currentInventory } = useInventory();
  const { showError, showSuccess } = useNotification();

  const [projects, setProjects] = useState<MovingProject[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<MovingProject | null>(null);
  
  // View states
  const [selectedProject, setSelectedProject] = useState<MovingProject | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (currentInventory) {
      loadProjects();
      loadLocations();
    }
  }, [currentInventory]);

  const loadProjects = async () => {
    if (!currentInventory) return;

    try {
      setLoading(true);
      setError(null);
      
      const projectsData = await apiClient.getProjects(currentInventory.id);
      // Ensure we have an array, fallback to empty array if not
      const safeProjectsData = Array.isArray(projectsData) ? projectsData : [];
      setProjects(safeProjectsData);
    } catch (err) {
      console.error('Error loading projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
      showError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    if (!currentInventory) return;

    try {
      const locationsData = await apiClient.getLocations(currentInventory.id);
      // Ensure we have an array, fallback to empty array if not
      const safeLocationsData = Array.isArray(locationsData) ? locationsData : [];
      setLocations(safeLocationsData);
    } catch (err) {
      console.error('Error loading locations:', err);
    }
  };

  const handleCreateProject = () => {
    setEditingProject(null);
    setFormDialogOpen(true);
  };

  const handleEditProject = (project: MovingProject) => {
    setEditingProject(project);
    setFormDialogOpen(true);
  };

  const handleSaveProject = async (project: MovingProject) => {
    try {
      if (editingProject) {
        // Update existing project
        const updatedProject = await apiClient.updateProject(project.id, project);
        setProjects(prev => prev.map(p => p.id === project.id ? updatedProject : p));
        showSuccess('Project updated successfully');
      } else {
        // Add new project
        const createdProject = await apiClient.createProject(project);
        setProjects(prev => [createdProject, ...prev]);
        showSuccess('Project created successfully');
      }
      
      setFormDialogOpen(false);
      setEditingProject(null);
    } catch (err) {
      console.error('Error saving project:', err);
      showError(err instanceof Error ? err.message : 'Failed to save project');
    }
  };

  const handleDeleteProject = async (project: MovingProject) => {
    if (!currentInventory) return;

    try {
      await apiClient.deleteProject(project.id);
      setProjects(prev => prev.filter(p => p.id !== project.id));
      showSuccess('Project deleted successfully');
    } catch (err) {
      console.error('Error deleting project:', err);
      showError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const handleUpdateProjectStatus = async (project: MovingProject, newStatus: ProjectStatus) => {
    if (!currentInventory) return;

    try {
      const updatedProject = await apiClient.updateProject(project.id, {
        status: newStatus,
        inventoryId: currentInventory.id
      });
      
      setProjects(prev => prev.map(p => p.id === project.id ? updatedProject : p));
      showSuccess(`Project status updated to ${newStatus}`);
    } catch (err) {
      console.error('Error updating project status:', err);
      showError(err instanceof Error ? err.message : 'Failed to update project status');
    }
  };

  const handleViewProject = (project: MovingProject) => {
    setSelectedProject(project);
  };

  const handleBackFromProject = () => {
    setSelectedProject(null);
  };



  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getFilteredProjects = (): MovingProject[] => {
    // Ensure projects is an array before filtering
    const safeProjects = Array.isArray(projects) ? projects : [];
    let filtered = safeProjects;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(query) ||
        (project.description && project.description.toLowerCase().includes(query))
      );
    }

    return filtered;
  };

  const getProjectsByStatus = () => {
    // Ensure projects is an array before filtering
    const safeProjects = Array.isArray(projects) ? projects : [];
    const statusGroups: Record<ProjectStatus | 'all', MovingProject[]> = {
      all: safeProjects,
      planning: safeProjects.filter(p => p.status === 'planning'),
      active: safeProjects.filter(p => p.status === 'active'),
      paused: safeProjects.filter(p => p.status === 'paused'),
      completed: safeProjects.filter(p => p.status === 'completed'),
      archived: safeProjects.filter(p => p.status === 'archived')
    };
    return statusGroups;
  };

  if (!currentInventory) {
    return (
      <Alert severity="warning">
        Please select an inventory to manage projects.
      </Alert>
    );
  }

  // Show project detail view if a project is selected
  if (selectedProject) {
    return (
      <ProjectDetailView
        project={selectedProject}
        inventoryId={currentInventory.id}
        onBack={handleBackFromProject}
        onEditProject={handleEditProject}
      />
    );
  }

  const filteredProjects = getFilteredProjects();
  const projectsByStatus = getProjectsByStatus();

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Moving Projects
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Organize and track your moving and storage projects
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateProject}
          size="large"
        >
          New Project
        </Button>
      </Box>

      {/* Filters and Search */}
      <Box sx={{ mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ minWidth: 250 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              },
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status Filter</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
              label="Status Filter"
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="planning">Planning</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="paused">Paused</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />
          
          <Stack direction="row" spacing={1}>
            <Chip 
              label={`${filteredProjects.length} projects`} 
              variant="outlined" 
              size="small" 
            />
          </Stack>
        </Stack>
      </Box>

      {/* Status Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="project status tabs">
          <Tab label={`All (${projectsByStatus.all.length})`} />
          <Tab label={`Active (${projectsByStatus.active.length})`} />
          <Tab label={`Planning (${projectsByStatus.planning.length})`} />
          <Tab label={`Completed (${projectsByStatus.completed.length})`} />
        </Tabs>
      </Box>

      {/* Content */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          <Button onClick={loadProjects} sx={{ ml: 2 }}>
            Retry
          </Button>
        </Alert>
      )}

      <TabPanel value={tabValue} index={0}>
        <ProjectList
          projects={filteredProjects}
          loading={loading}
          onEditProject={handleEditProject}
          onDeleteProject={handleDeleteProject}
          onUpdateProjectStatus={handleUpdateProjectStatus}
          onViewProject={handleViewProject}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <ProjectList
          projects={projectsByStatus.active.filter(p => 
            !searchQuery.trim() || 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
          )}
          loading={loading}
          onEditProject={handleEditProject}
          onDeleteProject={handleDeleteProject}
          onUpdateProjectStatus={handleUpdateProjectStatus}
          onViewProject={handleViewProject}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <ProjectList
          projects={projectsByStatus.planning.filter(p => 
            !searchQuery.trim() || 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
          )}
          loading={loading}
          onEditProject={handleEditProject}
          onDeleteProject={handleDeleteProject}
          onUpdateProjectStatus={handleUpdateProjectStatus}
          onViewProject={handleViewProject}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <ProjectList
          projects={projectsByStatus.completed.filter(p => 
            !searchQuery.trim() || 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
          )}
          loading={loading}
          onEditProject={handleEditProject}
          onDeleteProject={handleDeleteProject}
          onUpdateProjectStatus={handleUpdateProjectStatus}
          onViewProject={handleViewProject}
        />
      </TabPanel>

      {/* Project Form Dialog */}
      <ProjectFormDialog
        open={formDialogOpen}
        onClose={() => {
          setFormDialogOpen(false);
          setEditingProject(null);
        }}
        onSave={handleSaveProject}
        project={editingProject}
        inventoryId={currentInventory.id}
        locations={locations}
      />
    </Box>
  );
};

export default Projects;