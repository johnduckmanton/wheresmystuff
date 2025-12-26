import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Menu,
  MenuItem,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Stack
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Archive as ArchiveIcon,
  Folder as FolderIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import type { MovingProject, ProjectStatus } from '../types';
import { formatDistanceToNow, format } from 'date-fns';

interface ProjectListProps {
  projects: MovingProject[];
  loading: boolean;
  onEditProject: (project: MovingProject) => void;
  onDeleteProject: (project: MovingProject) => void;
  onUpdateProjectStatus: (project: MovingProject, newStatus: ProjectStatus) => void;
  onViewProject: (project: MovingProject) => void;
}

const STATUS_CONFIG: Record<ProjectStatus, { 
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  label: string;
  icon?: React.ReactNode;
}> = {
  planning: { color: 'info', label: 'Planning', icon: <FolderIcon fontSize="small" /> },
  active: { color: 'primary', label: 'Active', icon: <PlayIcon fontSize="small" /> },
  paused: { color: 'warning', label: 'Paused', icon: <PauseIcon fontSize="small" /> },
  completed: { color: 'success', label: 'Completed', icon: <StopIcon fontSize="small" /> },
  archived: { color: 'default', label: 'Archived', icon: <ArchiveIcon fontSize="small" /> }
};

/**
 * Project List Component
 * Displays a grid of moving project cards with actions
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */
const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  loading,
  onEditProject,
  onDeleteProject,
  onUpdateProjectStatus,
  onViewProject
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProject, setSelectedProject] = useState<MovingProject | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<MovingProject | null>(null);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState<string | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, project: MovingProject) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedProject(project);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedProject(null);
  };

  const handleEdit = () => {
    if (selectedProject) {
      onEditProject(selectedProject);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    if (selectedProject) {
      setProjectToDelete(selectedProject);
      setDeleteDialogOpen(true);
    }
    handleMenuClose();
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      onDeleteProject(projectToDelete);
    }
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };

  const handleStatusUpdate = async (newStatus: ProjectStatus) => {
    if (selectedProject) {
      setStatusUpdateLoading(selectedProject.id);
      try {
        await onUpdateProjectStatus(selectedProject, newStatus);
      } finally {
        setStatusUpdateLoading(null);
      }
    }
    handleMenuClose();
  };

  const getStatusActions = (project: MovingProject): { status: ProjectStatus; label: string }[] => {
    const actions: { status: ProjectStatus; label: string }[] = [];
    
    switch (project.status) {
      case 'planning':
        actions.push({ status: 'active', label: 'Start Project' });
        actions.push({ status: 'archived', label: 'Archive' });
        break;
      case 'active':
        actions.push({ status: 'paused', label: 'Pause Project' });
        actions.push({ status: 'completed', label: 'Mark Complete' });
        actions.push({ status: 'planning', label: 'Back to Planning' });
        break;
      case 'paused':
        actions.push({ status: 'active', label: 'Resume Project' });
        actions.push({ status: 'archived', label: 'Archive' });
        break;
      case 'completed':
        actions.push({ status: 'archived', label: 'Archive' });
        break;
      case 'archived':
        // No status changes allowed from archived
        break;
    }
    
    return actions;
  };

  const getProgressColor = (percentage: number): 'primary' | 'secondary' | 'success' => {
    if (percentage >= 100) return 'success';
    if (percentage >= 50) return 'primary';
    return 'secondary';
  };

  const formatDate = (dateString: string): string => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const getTimeToTarget = (targetDate: string): string => {
    const target = new Date(targetDate);
    const now = new Date();
    
    if (target < now) {
      return `Overdue by ${formatDistanceToNow(target)}`;
    } else {
      return `Due in ${formatDistanceToNow(target)}`;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Ensure projects is an array before checking length
  const safeProjects = Array.isArray(projects) ? projects : [];

  if (safeProjects.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No moving projects found. Create your first project to get started with organizing your move.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 3 }}>
        {safeProjects.map((project) => {
          const statusConfig = STATUS_CONFIG[project.status];
          const isOverdue = project.targetDate && new Date(project.targetDate) < new Date() && project.status !== 'completed';
          
          return (
            <Box key={project.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4
                  },
                  ...(isOverdue && {
                    borderLeft: '4px solid',
                    borderLeftColor: 'error.main'
                  })
                }}
                onClick={() => onViewProject(project)}
              >
                <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" component="h3" sx={{ flexGrow: 1, mr: 1 }}>
                      {project.name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, project)}
                      disabled={statusUpdateLoading === project.id}
                    >
                      {statusUpdateLoading === project.id ? (
                        <CircularProgress size={20} />
                      ) : (
                        <MoreVertIcon />
                      )}
                    </IconButton>
                  </Box>

                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Chip
                      icon={statusConfig.icon as React.ReactElement}
                      label={statusConfig.label}
                      color={statusConfig.color}
                      size="small"
                    />
                    {isOverdue && (
                      <Chip
                        label="Overdue"
                        color="error"
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Stack>

                  {project.description && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {project.description}
                    </Typography>
                  )}

                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Progress
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {project.completionPercentage}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={project.completionPercentage}
                      color={getProgressColor(project.completionPercentage)}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>

                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mb: 2 }}>
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
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CalendarIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      Started: {formatDate(project.startDate)}
                    </Typography>
                  </Box>

                  {project.targetDate && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <TrendingUpIcon fontSize="small" color="action" />
                      <Typography 
                        variant="body2" 
                        color={isOverdue ? 'error.main' : 'text.secondary'}
                      >
                        {getTimeToTarget(project.targetDate)}
                      </Typography>
                    </Box>
                  )}

                  {project.completionDate && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StopIcon fontSize="small" color="success" />
                      <Typography variant="body2" color="success.main">
                        Completed: {formatDate(project.completionDate)}
                      </Typography>
                    </Box>
                  )}
                </CardContent>

                <CardActions sx={{ pt: 0 }}>
                  <Button 
                    size="small" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewProject(project);
                    }}
                  >
                    View Details
                  </Button>
                  <Button 
                    size="small" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditProject(project);
                    }}
                  >
                    Edit
                  </Button>
                </CardActions>
              </Card>
            </Box>
          );
        })}
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit Project
        </MenuItem>
        
        {selectedProject && getStatusActions(selectedProject).map((action) => (
          <MenuItem 
            key={action.status}
            onClick={() => handleStatusUpdate(action.status)}
          >
            {STATUS_CONFIG[action.status].icon && (
              <Box sx={{ mr: 1, display: 'flex' }}>
                {STATUS_CONFIG[action.status].icon}
              </Box>
            )}
            {action.label}
          </MenuItem>
        ))}
        
        {selectedProject?.status !== 'archived' && (
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete Project
          </MenuItem>
        )}
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the project "{projectToDelete?.name}"? 
            This action cannot be undone.
          </Typography>
          {(projectToDelete?.containerCount ?? 0) > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This project has {projectToDelete?.containerCount ?? 0} containers assigned. 
              You must remove all containers from the project before deleting it.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmDelete} 
            color="error"
            disabled={(projectToDelete?.containerCount ?? 0) > 0}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectList;