import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Stack,
  IconButton,
  Menu,
  MenuItem,
  TextField
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import apiClient from '../services/api';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
}

interface TaskManagementProps {
  projectId: string;
  inventoryId: string;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

const TaskManagement: React.FC<TaskManagementProps> = ({
  projectId,
  inventoryId,
  tasks,
  onTasksChange
}) => {
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({ title: '', description: '', priority: 'medium' });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const handleAddTask = () => {
    setEditingTask(null);
    setFormData({ title: '', description: '', priority: 'medium' });
    setFormOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setFormData({ title: task.title, description: task.description || '', priority: task.priority || 'medium' });
    setFormOpen(true);
    setAnchorEl(null);
  };

  const handleSaveTask = async () => {
    if (!formData.title.trim()) return;

    try {
      if (editingTask) {
        await apiClient.updateTask(editingTask.id, {
          title: formData.title,
          description: formData.description,
          priority: formData.priority as 'low' | 'medium' | 'high',
          projectId,
          inventoryId
        });
      } else {
        await apiClient.createTask(projectId, {
          title: formData.title,
          description: formData.description,
          priority: formData.priority as 'low' | 'medium' | 'high',
          inventoryId
        });
      }
      setFormOpen(false);
    } catch (err) {
      console.error('Error saving task:', err);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    try {
      await apiClient.deleteTask(task.id);
      onTasksChange(tasks.filter(t => t.id !== task.id));
      setAnchorEl(null);
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const handleToggleTask = (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    apiClient.updateTask(task.id, { status: newStatus }).catch((err: any) => console.error('Error updating task:', err));
  };

  const getPriorityColor = (priority?: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Tasks ({tasks.length})</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={handleAddTask}>
          Add Task
        </Button>
      </Box>

      {tasks.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">No tasks yet. Create tasks to organize project work.</Typography>
          </CardContent>
        </Card>
      ) : (
        <List>
          {tasks.map((task) => (
            <ListItem
              key={task.id}
              secondaryAction={
                <IconButton
                  edge="end"
                  onClick={(e) => {
                    setAnchorEl(e.currentTarget);
                    setSelectedTask(task);
                  }}
                >
                  <MoreVertIcon />
                </IconButton>
              }
              sx={{ mb: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}
            >
              <ListItemIcon>
                <Checkbox
                  checked={task.status === 'completed'}
                  onChange={() => handleToggleTask(task)}
                />
              </ListItemIcon>
              <ListItemText
                primary={task.title}
                secondary={
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    {task.priority && (
                      <Chip label={task.priority} size="small" color={getPriorityColor(task.priority)} />
                    )}
                    {task.dueDate && (
                      <Typography variant="caption" color="text.secondary">
                        Due: {task.dueDate}
                      </Typography>
                    )}
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
      )}

      {/* Task Form Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTask ? 'Edit Task' : 'Add Task'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Task Title"
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveTask} variant="contained">
            {editingTask ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => selectedTask && handleEditTask(selectedTask)}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => selectedTask && handleDeleteTask(selectedTask)} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default TaskManagement;
