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
  title: string;
  description?: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed';
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
  const [formData, setFormData] = useState({ title: '', description: '', dueDate: '' });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  const handleAddMilestone = () => {
    setEditingMilestone(null);
    setFormData({ title: '', description: '', dueDate: '' });
    setFormOpen(true);
  };

  const handleEditMilestone = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setFormData({
      title: milestone.title,
      description: milestone.description || '',
      dueDate: milestone.dueDate.split('T')[0]
    });
    setFormOpen(true);
    setAnchorEl(null);
  };

  const handleSaveMilestone = async () => {
    if (!formData.title.trim() || !formData.dueDate) return;

    try {
      if (editingMilestone) {
        await apiClient.updateMilestone(editingMilestone.id, {
          title: formData.title,
          description: formData.description,
          dueDate: new Date(formData.dueDate).toISOString(),
          inventoryId
        });
      } else {
        await apiClient.createMilestone(projectId, {
          title: formData.title,
          description: formData.description,
          dueDate: new Date(formData.dueDate).toISOString(),
          inventoryId
        });
      }
      setFormOpen(false);
    } catch (err) {
      console.error('Error saving milestone:', err);
    }
  };

  const handleDeleteMilestone = async (milestone: Milestone) => {
    try {
      await apiClient.deleteMilestone(milestone.id);
      onMilestonesChange(milestones.filter(m => m.id !== milestone.id));
      setAnchorEl(null);
    } catch (err) {
      console.error('Error deleting milestone:', err);
    }
  };

  const handleCompleteMilestone = async (milestone: Milestone) => {
    try {
      await apiClient.completeMilestone(milestone.id, inventoryId);
      onMilestonesChange(milestones.map(m => 
        m.id === milestone.id ? { ...m, status: 'completed' } : m
      ));
    } catch (err) {
      console.error('Error completing milestone:', err);
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && new Date().toDateString() !== new Date(dueDate).toDateString();
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
                {format(new Date(milestone.dueDate), 'MMM d, yyyy')}
              </TimelineOppositeContent>
              <TimelineSeparator>
                <TimelineDot
                  sx={{
                    bgcolor: milestone.status === 'completed' ? 'success.main' : 'primary.main',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleCompleteMilestone(milestone)}
                >
                  {milestone.status === 'completed' ? <CheckCircleIcon /> : <ScheduleIcon />}
                </TimelineDot>
                {index < sortedMilestones.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent sx={{ flex: 0.7 }}>
                <Card
                  sx={{
                    borderLeft: isOverdue(milestone.dueDate) ? '4px solid' : 'none',
                    borderLeftColor: 'error.main'
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2">{milestone.title}</Typography>
                        {milestone.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {milestone.description}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <Chip
                            label={milestone.status}
                            size="small"
                            color={milestone.status === 'completed' ? 'success' : 'default'}
                          />
                          {isOverdue(milestone.dueDate) && milestone.status !== 'completed' && (
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
            <TextField
              label="Milestone Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
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
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              fullWidth
              required
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
