import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  LinearProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CalendarToday as CalendarIcon,
  Inventory as InventoryIcon,
  Assignment as AssignmentIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';
import type { MovingProject, ProjectStatus, Container } from '../types';
import ContainerAssignmentDialog from './ContainerAssignmentDialog';
import ItemAssignmentDialog from './ItemAssignmentDialog';
import apiClient from '../services/api';

interface ProjectDetailDialogProps {
  open: boolean;
  project: MovingProject;
  inventoryId: string;
  onClose: () => void;
  onEdit: (project: MovingProject) => void;
  onDelete: (projectId: string) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`project-tabpanel-${index}`}
      aria-labelledby={`project-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

/**
 * Project Detail Dialog Component
 * Displays comprehensive project information with tabbed interface
 * Validates: Requirements 7.5, 2.1, 6.1
 */
const ProjectDetailDialog: React.FC<ProjectDetailDialogProps> = ({
  open,
  project,
  inventoryId,
  onClose,
  onEdit,
  onDelete
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [itemAssignmentDialogOpen, setItemAssignmentDialogOpen] = useState(false);

  // Load project containers when dialog opens
  useEffect(() => {
    if (open && project.id) {
      loadProjectContainers();
    }
  }, [open, project.id]);

  const loadProjectContainers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all containers and filter by project assignment
      const containersResponse = await apiClient.getContainers(inventoryId);
      
      // Filter containers assigned to this project
      const projectContainers = containersResponse.containers.filter(c => c.projectId === project.id);
      setContainers(projectContainers);
    } catch (err) {
      console.error('Error loading project containers:', err);
      setError('Failed to load project containers');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case 'planning': return 'default';
      case 'active': return 'primary';
      case 'paused': return 'warning';
      case 'completed': return 'success';
      case 'archived': return 'secondary';
      default: return 'default';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEdit = () => {
    onEdit(project);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the project "${project.name}"? This action cannot be undone.`)) {
      onDelete(project.id);
    }
  };

  const handleManageContainers = () => {
    setAssignmentDialogOpen(true);
  };

  const handleManageItems = () => {
    setItemAssignmentDialogOpen(true);
  };

  const handleAssignmentChange = () => {
    // Reload containers when assignments change
    loadProjectContainers();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px', maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
              {project.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Chip 
                label={project.status.charAt(0).toUpperCase() + project.status.slice(1)} 
                color={getStatusColor(project.status)}
                size="small"
              />
              <Typography variant="body2" color="text.secondary">
                Created {formatDate(project.createdAt)}
              </Typography>
            </Box>
          </Box>
          <Box>
            <IconButton onClick={handleEdit} aria-label="Edit project">
              <EditIcon />
            </IconButton>
            <IconButton onClick={handleDelete} aria-label="Delete project" color="error">
              <DeleteIcon />
            </IconButton>
            <IconButton onClick={onClose} aria-label="Close dialog">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Project Overview */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              {project.description && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body1">
                    {project.description}
                  </Typography>
                </Box>
              )}
              
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
                    {project.containerCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Containers
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>
                    {project.itemCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Items
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main" sx={{ fontWeight: 700 }}>
                    {project.completionPercentage}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Complete
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <CalendarIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(project.targetDate)}
                  </Typography>
                </Box>
              </Box>
            </Box>
            
            <Box sx={{ minWidth: { md: 300 } }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Project Timeline
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Progress
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {project.completionPercentage}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={project.completionPercentage} 
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                  
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <CalendarIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Start Date" 
                        secondary={formatDate(project.startDate)}
                      />
                    </ListItem>
                    {project.targetDate && (
                      <ListItem>
                        <ListItemIcon>
                          <CalendarIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Target Date" 
                          secondary={formatDate(project.targetDate)}
                        />
                      </ListItem>
                    )}
                    {project.completionDate && (
                      <ListItem>
                        <ListItemIcon>
                          <CalendarIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Completed" 
                          secondary={formatDate(project.completionDate)}
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Box>

        {/* Tabbed Content */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="project detail tabs">
            <Tab label="Containers" icon={<InventoryIcon />} />
            <Tab label="Items" icon={<AssignmentIcon />} />
            <Tab label="Timeline" icon={<CalendarIcon />} />
            <Tab label="Tasks" icon={<AssignmentIcon />} />
            <Tab label="Budget" icon={<MoneyIcon />} />
          </Tabs>
        </Box>

        {/* Containers Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Project Containers ({containers.length})
            </Typography>
            <Button
              variant="outlined"
              startIcon={<InventoryIcon />}
              onClick={handleManageContainers}
            >
              Manage Containers
            </Button>
          </Box>
          
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography>Loading containers...</Typography>
            </Box>
          ) : containers.length > 0 ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
              {containers.map((container) => (
                <Card variant="outlined" key={container.id}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {container.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {container.type.charAt(0).toUpperCase() + container.type.slice(1)}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                      <Typography variant="body2">
                        {container.itemCount || 0} items
                      </Typography>
                      <Chip 
                        label={container.status?.replace('_', ' ').toUpperCase() || 'EMPTY'} 
                        size="small"
                        color={container.status === 'packed' ? 'success' : 'default'}
                      />
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <InventoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No Containers Assigned
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Assign containers to this project to track your moving progress.
              </Typography>
              <Button
                variant="contained"
                startIcon={<InventoryIcon />}
                onClick={handleManageContainers}
              >
                Assign Containers
              </Button>
            </Box>
          )}
        </TabPanel>

        {/* Items Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Project Items
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AssignmentIcon />}
              onClick={handleManageItems}
            >
              Manage Items
            </Button>
          </Box>
          
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Item Management
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Assign individual items to this project for detailed tracking.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AssignmentIcon />}
              onClick={handleManageItems}
            >
              Assign Items
            </Button>
          </Box>
        </TabPanel>

        {/* Timeline Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CalendarIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Timeline Coming Soon
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Milestone tracking and timeline visualization will be available in a future update.
            </Typography>
          </Box>
        </TabPanel>

        {/* Tasks Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Tasks Coming Soon
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Task management and checklists will be available in a future update.
            </Typography>
          </Box>
        </TabPanel>

        {/* Budget Tab */}
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <MoneyIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Budget Tracking Coming Soon
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Budget management and expense tracking will be available in a future update.
            </Typography>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
        <Button onClick={handleEdit} variant="outlined" startIcon={<EditIcon />}>
          Edit Project
        </Button>
      </DialogActions>

      {/* Container Assignment Dialog */}
      <ContainerAssignmentDialog
        open={assignmentDialogOpen}
        inventoryId={inventoryId}
        onClose={() => setAssignmentDialogOpen(false)}
        onSave={async () => {
          handleAssignmentChange();
        }}
      />

      {/* Item Assignment Dialog */}
      <ItemAssignmentDialog
        open={itemAssignmentDialogOpen}
        project={project}
        inventoryId={inventoryId}
        onClose={() => setItemAssignmentDialogOpen(false)}
        onAssignmentChange={handleAssignmentChange}
      />
    </Dialog>
  );
};

export default ProjectDetailDialog;