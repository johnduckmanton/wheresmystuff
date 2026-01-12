import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon
} from '@mui/icons-material';
import type { MovingProject } from '../types';
import apiClient from '../services/api';
import ProjectAnalytics from './ProjectAnalytics';
import MilestoneTimeline from './MilestoneTimeline';
import TaskManagement from './TaskManagement';
import BudgetTracking from './BudgetTracking';
import ThingAssignmentDialog from './ThingAssignmentDialog';
import ContainerAssignmentDialog from './ContainerAssignmentDialog';
import ProjectSharing from './ProjectSharing';

interface ProjectDetailViewProps {
  project: MovingProject;
  inventoryId: string;
  onBack: () => void;
  onEditProject: (project: MovingProject) => void;
}

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
      id={`project-detail-tabpanel-${index}`}
      aria-labelledby={`project-detail-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  inventoryId,
  onBack,
  onEditProject
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [tasks, setTasks] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [assignedThings, setAssignedThings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [thingAssignmentDialogOpen, setThingAssignmentDialogOpen] = useState(false);
  const [containerAssignmentDialogOpen, setContainerAssignmentDialogOpen] = useState(false);

  useEffect(() => {
    loadProjectData();
  }, [project.id]);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [tasksData, milestonesData, budgetData, thingsData] = await Promise.all([
        apiClient.getProjectTasks(project.id, inventoryId).catch(() => []),
        apiClient.getProjectMilestones(project.id, inventoryId).catch(() => []),
        apiClient.getProjectBudget(project.id, inventoryId).catch(() => []),
        apiClient.getProjectThings(project.id, inventoryId).catch(() => [])
      ]);

      setTasks(tasksData || []);
      setMilestones(milestonesData || []);
      setBudgetItems(budgetData || []);
      setAssignedThings(thingsData || []);
    } catch (err) {
      console.error('Error loading project data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load project data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDeleteProject = async () => {
    try {
      await apiClient.deleteProject(project.id);
      setDeleteDialogOpen(false);
      onBack();
    } catch (err) {
      console.error('Error deleting project:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const handleAssignThings = async (thingIds: string[]) => {
    try {
      await apiClient.assignThingsToProject(project.id, {
        thingIds,
        inventoryId
      });
      setThingAssignmentDialogOpen(false);
      loadProjectData();
    } catch (err) {
      console.error('Error assigning things:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign things');
    }
  };

  const handleAssignContainers = async (containerIds: string[]) => {
    try {
      await apiClient.assignContainersToProject(project.id, {
        containerIds,
        inventoryId
      });
      setContainerAssignmentDialogOpen(false);
      loadProjectData();
    } catch (err) {
      console.error('Error assigning containers:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign containers');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={onBack} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {project.name}
          </Typography>
          <Chip label={project.status} size="small" />
        </Box>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={() => onEditProject(project)}
          sx={{ mr: 1 }}
        >
          Edit
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="project detail tabs">
          <Tab label="Timeline" />
          <Tab label="Tasks" />
          <Tab label="Budget" />
          <Tab label="Containers" />
          <Tab label="Things" />
          <Tab label="Sharing" />
          <Tab label="Analytics" />
        </Tabs>
      </Box>

      {/* Timeline Tab */}
      <TabPanel value={tabValue} index={0}>
        <MilestoneTimeline
          projectId={project.id}
          inventoryId={inventoryId}
          milestones={milestones}
          onMilestonesChange={setMilestones}
        />
      </TabPanel>

      {/* Tasks Tab */}
      <TabPanel value={tabValue} index={1}>
        <TaskManagement
          projectId={project.id}
          inventoryId={inventoryId}
          tasks={tasks}
          onTasksChange={setTasks}
        />
      </TabPanel>

      {/* Budget Tab */}
      <TabPanel value={tabValue} index={2}>
        <BudgetTracking
          projectId={project.id}
          inventoryId={inventoryId}
          budgetItems={budgetItems}
          onBudgetItemsChange={setBudgetItems}
        />
      </TabPanel>

      {/* Containers Tab */}
      <TabPanel value={tabValue} index={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Assigned Containers ({project.containerCount})
              </Typography>
              <Button
                startIcon={<AddIcon />}
                size="small"
                onClick={() => setContainerAssignmentDialogOpen(true)}
              >
                Assign Container
              </Button>
            </Box>
            {project.containerCount === 0 ? (
              <Alert severity="info">
                No containers assigned. Assign containers to organize items.
              </Alert>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {project.containerCount} containers assigned to this project
              </Typography>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Things Tab */}
      <TabPanel value={tabValue} index={4}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Assigned Things ({assignedThings.length})
              </Typography>
              <Button
                startIcon={<AddIcon />}
                size="small"
                onClick={() => setThingAssignmentDialogOpen(true)}
              >
                Assign Thing
              </Button>
            </Box>
            {assignedThings.length === 0 ? (
              <Alert severity="info">
                No things assigned. Assign things to track items in this project.
              </Alert>
            ) : (
              <Box>
                {assignedThings.map((thing) => (
                  <Box key={thing.id} sx={{ p: 1, border: '1px solid #e0e0e0', borderRadius: 1, mb: 1 }}>
                    <Typography variant="subtitle2">{thing.name}</Typography>
                    {thing.description && (
                      <Typography variant="body2" color="text.secondary">
                        {thing.description}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Sharing Tab */}
      <TabPanel value={tabValue} index={5}>
        <ProjectSharing project={project} />
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={tabValue} index={6}>
        <ProjectAnalytics project={project} inventoryId={inventoryId} />
      </TabPanel>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{project.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteProject} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Thing Assignment Dialog */}
      <ThingAssignmentDialog
        open={thingAssignmentDialogOpen}
        onClose={() => setThingAssignmentDialogOpen(false)}
        onSave={handleAssignThings}
        projectId={project.id}
        inventoryId={inventoryId}
      />

      {/* Container Assignment Dialog */}
      <ContainerAssignmentDialog
        open={containerAssignmentDialogOpen}
        onClose={() => setContainerAssignmentDialogOpen(false)}
        onSave={handleAssignContainers}
        projectId={project.id}
        inventoryId={inventoryId}
      />
    </Box>
  );
};

export default ProjectDetailView;
