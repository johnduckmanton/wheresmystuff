import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Stack
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/lab';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import apiClient from '../services/api';

interface Milestone {
  id: string;
  name: string;
  description?: string;
  date: string;
  completed: boolean;
}

interface MilestoneTimelineProps {
  projectId: string;
  inventoryId: string;
  milestones: Milestone[];
  onMilestonesChange: (milestones: Milestone[]) => void;
}

const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({
  projectId,
  inventoryId,
  milestones,
  onMilestonesChange
}) => {
  const [formOpen, setFormOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', date: '' });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [validationError, setValidationError] = useState<string>('');

  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const handleAddMilestone = () => {
    setEditingMilestone(null);
    setFormData({ name: '', description: '', date: '' });
    setValidationError('');
    setFormOpen(true);
  };

  const handleEditMilestone = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setFormData({
      name: milestone.name,
      description: milestone.description || '',
      date: milestone.date.split('T')[0]
    });
    setValidationError('');
    setFormOpen(true);
    setAnchorEl(null);
  };

  const handleSaveMilestone = async () => {
    if (!formData.name.trim()) {
      setValidationError('Milestone name is required');
      return;
    }
    
    if (!formData.date) {
      setValidationError('Due date is required');
      return;
    }

    setValidationError('');

    try {
      if (editingMilestone) {
        const updatedMilestone = await apiClient.updateMilestone(editingMilestone.id, {
          name: formData.name,
          description: formData.description,
          date: new Date(formData.date).toISOString(),
          projectId,
          inventoryId
        });
        onMilestonesChange(milestones.map(m => m.id === editingMilestone.id ? updatedMilestone : m));
      } else {
        const newMilestone = await apiClient.createMilestone(projectId, {
          name: formData.name,
          description: formData.description,
          date: new Date(formData.date).toISOString(),
          inventoryId
        });
        onMilestonesChange([...milestones, newMilestone]);
      }
      setFormOpen(false);
    } catch (err) {
      console.error('Error saving milestone:', err);
      setValidationError('Failed to save milestone. Please try again.');
    }
  };

  const handleDeleteMilestone = async (milestone: Milestone) => {
    try {
      await apiClient.deleteMilestone(milestone.id, projectId, inventoryId);
      onMilestonesChange(milestones.filter(m => m.id !== milestone.id));
      setAnchorEl(null);
    } catch (err) {
      console.error('Error deleting milestone:', err);
    }
  };

  const handleCompleteMilestone = async (milestone: Milestone) => {
    try {
      await apiClient.completeMilestone(milestone.id, projectId, inventoryId);
      onMilestonesChange(milestones.map(m => 
        m.id === milestone.id ? { ...m, completed: true } : m
      ));
    } catch (err) {
      console.error('Error completing milestone:', err);
    }
  };

  const isOverdue = (date: string) => {
    return new Date(date) < new Date() && new Date().toDateString() !== new Date(date).toDateString();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Milestones ({milestones.length})</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={handleAddMilestone}>
          Add Milestone
        </Button>
      </Box>

      {milestones.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">No milestones yet. Create milestones to track project progress.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Timeline position="alternate">
          {sortedMilestones.map((milestone, index) => (
            <TimelineItem key={milestone.id}>
              <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.3 }}>
                {format(new Date(milestone.date), 'MMM d, yyyy')}
              </TimelineOppositeContent>
              <TimelineSeparator>
                <TimelineDot
                  sx={{
                    bgcolor: milestone.completed ? 'success.main' : 'primary.main',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleCompleteMilestone(milestone)}
                >
                  {milestone.completed ? <CheckCircleIcon /> : <ScheduleIcon />}
                </TimelineDot>
                {index < sortedMilestones.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent sx={{ flex: 0.7 }}>
                <Card
                  sx={{
                    borderLeft: isOverdue(milestone.date) ? '4px solid' : 'none',
                    borderLeftColor: 'error.main'
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2">{milestone.name}</Typography>
                        {milestone.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {milestone.description}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <Chip
                            label={milestone.completed ? 'completed' : 'pending'}
                            size="small"
                            color={milestone.completed ? 'success' : 'default'}
                          />
                          {isOverdue(milestone.date) && !milestone.completed && (
                            <Chip label="Overdue" size="small" color="error" />
                          )}
                        </Stack>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          setAnchorEl(e.currentTarget);
                          setSelectedMilestone(milestone);
                        }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      )}

      {/* Milestone Form Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMilestone ? 'Edit Milestone' : 'Add Milestone'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {validationError && (
              <Typography color="error" variant="body2">
                {validationError}
              </Typography>
            )}
            <TextField
              label="Milestone Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              error={validationError.includes('name')}
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            <TextField
              label="Due Date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              fullWidth
              required
              error={validationError.includes('date')}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveMilestone} variant="contained">
            {editingMilestone ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => selectedMilestone && handleEditMilestone(selectedMilestone)}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => selectedMilestone && handleDeleteMilestone(selectedMilestone)} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default MilestoneTimeline;
