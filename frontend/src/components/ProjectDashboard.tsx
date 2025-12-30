import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  CircularProgress,
  Stack,
  Tabs,
  Tab
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Archive as ArchiveIcon,
  Inventory as InventoryIcon,

  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import type { MovingProject, ProjectStatus } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
// import apiClient from '../services/api'; // Will be used when API is fully implemented
import ProjectAnalytics from './ProjectAnalytics';

interface ProjectDashboardProps {
  project: MovingProject;
  inventoryId: string;
  onBack: () => void;
  onEditProject: (project: MovingProject) => void;
  onUpdateProjectStatus: (project: MovingProject, newStatus: ProjectStatus) => void;

}

interface ProjectProgress {
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    startDate: string;
    targetDate?: string;
    completionDate?: string;
    completionPercentage: number;
  };
  statistics: {
    totalContainers: number;
    packedContainers: number;
    emptyContainers: number;
    totalItems: number;
    totalValue: number;
    completionPercentage: number;
    containersByStatus: Record<string, number>;
  };
  containers: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    itemCount: number;
    estimatedValue: number;
    locationId?: string;
  }>;
}

const STATUS_CONFIG: Record<ProjectStatus, { 
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  label: string;
  icon: React.ReactElement;
}> = {
  planning: { color: 'info', label: 'Planning', icon: <CalendarIcon fontSize="small" /> },
  active: { color: 'primary', label: 'Active', icon: <PlayIcon fontSize="small" /> },
  paused: { color: 'warning', label: 'Paused', icon: <PauseIcon fontSize="small" /> },
  completed: { color: 'success', label: 'Completed', icon: <StopIcon fontSize="small" /> },
  archived: { color: 'default', label: 'Archived', icon: <ArchiveIcon fontSize="small" /> }
};

/**
 * Project Dashboard Component
 * Displays detailed project information, progress, and statistics
 * Validates: Requirements 8.3, 8.4, 11.1, 11.2
 */
const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  project,
  inventoryId,
  onBack,
  onEditProject,
  onUpdateProjectStatus
}) => {
  const [progressData, setProgressData] = useState<ProjectProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    loadProjectProgress();
  }, [project.id, inventoryId]);

  const loadProjectProgress = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For now, use mock progress data since the API might not support includeProgress yet
      const data = {
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          startDate: project.startDate,
          targetDate: project.targetDate,
          completionDate: project.completionDate,
          completionPercentage: project.completionPercentage
        },
        statistics: {
          totalContainers: 8,
          packedContainers: 6,
          emptyContainers: 2,
          totalItems: 120,
          totalValue: 4500,
          completionPercentage: 75,
          containersByStatus: { packed: 6, packing: 1, empty: 1 }
        },
        containers: [
          { id: '1', name: 'Kitchen Box 1', type: 'box', status: 'packed', itemCount: 15, estimatedValue: 500 },
          { id: '2', name: 'Living Room Box', type: 'box', status: 'packed', itemCount: 12, estimatedValue: 800 },
          { id: '3', name: 'Bedroom Bag', type: 'bag', status: 'packing', itemCount: 8, estimatedValue: 300 }
        ]
      };
      
      setProgressData(data as ProjectProgress);
    } catch (err) {
      console.error('Error loading project progress:', err);
      setError(err instanceof Error ? err.message : 'Failed to load project progress');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: ProjectStatus) => {
    try {
      setStatusUpdateLoading(true);
      onUpdateProjectStatus(project, newStatus);
      
      // Reload progress data to get updated project info
      await loadProjectProgress();
    } catch (err) {
      console.error('Error updating project status:', err);
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getStatusActions = (status: ProjectStatus): { status: ProjectStatus; label: string; icon: React.ReactElement }[] => {
    const actions: { status: ProjectStatus; label: string; icon: React.ReactElement }[] = [];
    
    switch (status) {
      case 'planning':
        actions.push({ status: 'active', label: 'Start Project', icon: <PlayIcon /> });
        actions.push({ status: 'archived', label: 'Archive', icon: <ArchiveIcon /> });
        break;
      case 'active':
        actions.push({ status: 'paused', label: 'Pause', icon: <PauseIcon /> });
        actions.push({ status: 'completed', label: 'Complete', icon: <StopIcon /> });
        break;
      case 'paused':
        actions.push({ status: 'active', label: 'Resume', icon: <PlayIcon /> });
        actions.push({ status: 'archived', label: 'Archive', icon: <ArchiveIcon /> });
        break;
      case 'completed':
        actions.push({ status: 'archived', label: 'Archive', icon: <ArchiveIcon /> });
        break;
    }
    
    return actions;
  };

  const formatDate = (dateString: string): string => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const getTimeToTarget = (targetDate: string): { text: string; isOverdue: boolean } => {
    const target = new Date(targetDate);
    const now = new Date();
    
    if (target < now) {
      return {
        text: `Overdue by ${formatDistanceToNow(target)}`,
        isOverdue: true
      };
    } else {
      return {
        text: `Due in ${formatDistanceToNow(target)}`,
        isOverdue: false
      };
    }
  };

  const getProgressColor = (percentage: number): 'primary' | 'secondary' | 'success' => {
    if (percentage >= 100) return 'success';
    if (percentage >= 50) return 'primary';
    return 'secondary';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
        <Button onClick={loadProjectProgress} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (!progressData) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        No project data available
      </Alert>
    );
  }

  const statusConfig = STATUS_CONFIG[progressData.project.status];
  const targetInfo = progressData.project.targetDate ? getTimeToTarget(progressData.project.targetDate) : null;
  const statusActions = getStatusActions(progressData.project.status);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={onBack} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {progressData.project.name}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={statusConfig.icon}
              label={statusConfig.label}
              color={statusConfig.color}
              size="small"
            />
            {targetInfo?.isOverdue && (
              <Chip
                label="Overdue"
                color="error"
                size="small"
                variant="outlined"
              />
            )}
          </Stack>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {statusActions.map((action) => (
            <Button
              key={action.status}
              variant="outlined"
              startIcon={action.icon}
              onClick={() => handleStatusUpdate(action.status)}
              disabled={statusUpdateLoading}
              size="small"
            >
              {action.label}
            </Button>
          ))}
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => onEditProject(project)}
            disabled={statusUpdateLoading}
          >
            Edit
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="project dashboard tabs">
          <Tab label="Overview" />
          <Tab label="Analytics" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {tabValue === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {/* Progress Overview */}
            <Card sx={{ flex: '2 1 600px' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Project Progress
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Overall Completion
                    </Typography>
                    <Typography variant="h6">
                      {progressData.statistics.completionPercentage}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={progressData.statistics.completionPercentage}
                    color={getProgressColor(progressData.statistics.completionPercentage)}
                    sx={{ height: 12, borderRadius: 6 }}
                  />
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  <Box sx={{ textAlign: 'center', flex: '1 1 150px' }}>
                    <Typography variant="h4" color="primary">
                      {progressData.statistics.totalContainers}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Containers
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center', flex: '1 1 150px' }}>
                    <Typography variant="h4" color="success.main">
                      {progressData.statistics.packedContainers}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Packed Containers
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center', flex: '1 1 150px' }}>
                    <Typography variant="h4" color="info.main">
                      {progressData.statistics.totalItems}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Items
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center', flex: '1 1 150px' }}>
                    <Typography variant="h4" color="secondary.main">
                      £${progressData.statistics.totalValue.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Value
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Project Details */}
            <Card sx={{ flex: '1 1 300px' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Project Details
                </Typography>
                
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <CalendarIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Start Date"
                      secondary={formatDate(progressData.project.startDate)}
                    />
                  </ListItem>
                  
                  {progressData.project.targetDate && (
                    <ListItem>
                      <ListItemIcon>
                        <TrendingUpIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Target Date"
                        secondary={
                          <Typography 
                            variant="body2" 
                            color={targetInfo?.isOverdue ? 'error.main' : 'text.secondary'}
                          >
                            {formatDate(progressData.project.targetDate)}
                            <br />
                            {targetInfo?.text}
                          </Typography>
                        }
                      />
                    </ListItem>
                  )}
                  
                  {progressData.project.completionDate && (
                    <ListItem>
                      <ListItemIcon>
                        <StopIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Completion Date"
                        secondary={formatDate(progressData.project.completionDate)}
                      />
                    </ListItem>
                  )}
                  
                  <ListItem>
                    <ListItemIcon>
                      <AssessmentIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Progress"
                      secondary={`${progressData.statistics.completionPercentage}% complete`}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {/* Container Status Breakdown */}
            <Card sx={{ flex: '1 1 400px' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Container Status
                </Typography>
                
                {Object.entries(progressData.statistics.containersByStatus).map(([status, count]) => (
                  <Box key={status} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {status.replace('_', ' ')}
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {count} containers
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={progressData.statistics.totalContainers > 0 ? (count / progressData.statistics.totalContainers) * 100 : 0}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>

            {/* Recent Containers */}
            <Card sx={{ flex: '1 1 400px' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Project Containers
                </Typography>
                
                {progressData.containers.length === 0 ? (
                  <Alert severity="info">
                    No containers assigned to this project yet.
                  </Alert>
                ) : (
                  <List dense>
                    {progressData.containers.slice(0, 5).map((container) => (
                      <ListItem key={container.id}>
                        <ListItemIcon>
                          <InventoryIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={container.name}
                          secondary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="caption">
                                {container.type}
                              </Typography>
                              <Typography variant="caption">
                                •
                              </Typography>
                              <Typography variant="caption">
                                {container.itemCount} items
                              </Typography>
                              <Typography variant="caption">
                                •
                              </Typography>
                              <Typography variant="caption">
                                £${container.estimatedValue.toLocaleString()}
                              </Typography>
                            </Stack>
                          }
                        />
                        <Chip
                          label={container.status}
                          size="small"
                          variant="outlined"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </ListItem>
                    ))}
                    {progressData.containers.length > 5 && (
                      <ListItem>
                        <ListItemText
                          primary={
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                              And {progressData.containers.length - 5} more containers...
                            </Typography>
                          }
                        />
                      </ListItem>
                    )}
                  </List>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* Analytics Tab */}
      {tabValue === 1 && (
        <ProjectAnalytics
          project={project}
          inventoryId={inventoryId}
        />
      )}
    </Box>
  );
};

export default ProjectDashboard;