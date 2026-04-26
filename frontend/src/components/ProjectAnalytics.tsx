import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Inventory as ContainerIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import type { MovingProject, Container } from '../types';
import apiClient from '../services/api';
import { format, differenceInDays } from 'date-fns';

interface ProjectAnalyticsProps {
  project: MovingProject;
  inventoryId: string;
}

interface ProjectStats {
  milestones: { total: number; completed: number; overdue: number; nextDue?: string; nextName?: string };
  tasks: { total: number; completed: number; inProgress: number };
  budget: { estimated: number; actual: number; remaining: number; itemCount: number };
  containers: { total: number; totalItems: number; totalValue: number; byStatus: Record<string, number> };
  timeline: { daysActive: number; daysUntilNextMilestone: number | null };
}

const ProjectAnalytics: React.FC<ProjectAnalyticsProps> = ({ project, inventoryId }) => {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, [project.id, inventoryId]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const [tasksData, milestonesData, budgetData, containersResponse] = await Promise.all([
        apiClient.getProjectTasks(project.id, inventoryId).catch(() => []),
        apiClient.getProjectMilestones(project.id, inventoryId).catch(() => []),
        apiClient.getProjectBudget(project.id, inventoryId).catch(() => []),
        apiClient.getContainers(inventoryId).catch(() => ({ containers: [] })),
      ]);

      const tasks = tasksData || [];
      const milestones = milestonesData || [];
      const budget = budgetData || [];
      const projectContainers: Container[] = (containersResponse.containers || []).filter(
        (c: Container) => c.projectId === project.id
      );

      const now = new Date();
      const completedMilestones = milestones.filter((m: any) => m.completed);
      const overdueMilestones = milestones.filter(
        (m: any) => !m.completed && new Date(m.date) < now
      );
      const upcomingMilestones = milestones
        .filter((m: any) => !m.completed && new Date(m.date) >= now)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const completedTasks = tasks.filter((t: any) => t.status === 'completed' || t.completed);
      const inProgressTasks = tasks.filter((t: any) => t.status === 'in_progress' || t.status === 'in-progress');

      const totalEstimated = budget.reduce((sum: number, item: any) => sum + (item.estimatedCost || 0), 0);
      const totalActual = budget.reduce((sum: number, item: any) => sum + (item.actualCost || 0), 0);

      const containersByStatus: Record<string, number> = {};
      let totalItems = 0;
      let totalValue = 0;
      for (const c of projectContainers) {
        const status = c.status || 'unknown';
        containersByStatus[status] = (containersByStatus[status] || 0) + 1;
        totalItems += c.itemCount || 0;
        totalValue += c.estimatedValue || 0;
      }

      const createdAt = project.createdAt ? new Date(project.createdAt) : now;
      const daysActive = Math.max(0, differenceInDays(now, createdAt));
      const nextMilestone = upcomingMilestones[0];
      const daysUntilNext = nextMilestone
        ? differenceInDays(new Date(nextMilestone.date), now)
        : null;

      setStats({
        milestones: {
          total: milestones.length,
          completed: completedMilestones.length,
          overdue: overdueMilestones.length,
          nextDue: nextMilestone ? nextMilestone.date : undefined,
          nextName: nextMilestone ? nextMilestone.name : undefined,
        },
        tasks: {
          total: tasks.length,
          completed: completedTasks.length,
          inProgress: inProgressTasks.length,
        },
        budget: {
          estimated: totalEstimated,
          actual: totalActual,
          remaining: Math.max(0, totalEstimated - totalActual),
          itemCount: budget.length,
        },
        containers: {
          total: projectContainers.length,
          totalItems,
          totalValue,
          byStatus: containersByStatus,
        },
        timeline: {
          daysActive,
          daysUntilNextMilestone: daysUntilNext,
        },
      });
    } catch (err) {
      console.error('Error loading project analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!stats) {
    return <Alert severity="info">No data available yet.</Alert>;
  }

  const milestonePercent = stats.milestones.total > 0
    ? Math.round((stats.milestones.completed / stats.milestones.total) * 100)
    : 0;
  const taskPercent = stats.tasks.total > 0
    ? Math.round((stats.tasks.completed / stats.tasks.total) * 100)
    : 0;
  const budgetPercent = stats.budget.estimated > 0
    ? Math.round((stats.budget.actual / stats.budget.estimated) * 100)
    : 0;

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssessmentIcon />
        Project Overview
      </Typography>

      {/* Summary Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" color="primary">{stats.timeline.daysActive}</Typography>
            <Typography variant="body2" color="text.secondary">Days Active</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" color="secondary.main">{stats.containers.total}</Typography>
            <Typography variant="body2" color="text.secondary">Containers</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" color="secondary.main">{stats.containers.totalItems}</Typography>
            <Typography variant="body2" color="text.secondary">Items Tracked</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" color="secondary.main">
              £{stats.containers.totalValue.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">Total Value</Typography>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {/* Milestone Progress */}
        <Card sx={{ flex: '1 1 300px' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScheduleIcon /> Milestones
            </Typography>
            {stats.milestones.total === 0 ? (
              <Typography variant="body2" color="text.secondary">No milestones defined.</Typography>
            ) : (
              <Stack spacing={2}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Progress</Typography>
                    <Typography variant="body2">
                      {stats.milestones.completed} / {stats.milestones.total}
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={milestonePercent} sx={{ height: 8, borderRadius: 4 }} />
                </Box>
                {stats.milestones.overdue > 0 && (
                  <Chip
                    icon={<WarningIcon />}
                    label={`${stats.milestones.overdue} overdue`}
                    color="error"
                    size="small"
                  />
                )}
                {stats.milestones.nextName && stats.milestones.nextDue && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">Next milestone</Typography>
                    <Typography variant="subtitle2">{stats.milestones.nextName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {format(new Date(stats.milestones.nextDue), 'MMM d, yyyy')}
                      {stats.timeline.daysUntilNextMilestone !== null && (
                        <> ({stats.timeline.daysUntilNextMilestone} days)</>
                      )}
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Task Progress */}
        <Card sx={{ flex: '1 1 300px' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon /> Tasks
            </Typography>
            {stats.tasks.total === 0 ? (
              <Typography variant="body2" color="text.secondary">No tasks defined.</Typography>
            ) : (
              <Stack spacing={2}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Completed</Typography>
                    <Typography variant="body2">
                      {stats.tasks.completed} / {stats.tasks.total}
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={taskPercent} color="secondary" sx={{ height: 8, borderRadius: 4 }} />
                </Box>
                {stats.tasks.inProgress > 0 && (
                  <Chip label={`${stats.tasks.inProgress} in progress`} size="small" color="primary" />
                )}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Budget */}
        <Card sx={{ flex: '1 1 300px' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MoneyIcon /> Budget
            </Typography>
            {stats.budget.itemCount === 0 ? (
              <Typography variant="body2" color="text.secondary">No budget items defined.</Typography>
            ) : (
              <Stack spacing={2}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Spent</Typography>
                    <Typography variant="body2">
                      £{stats.budget.actual.toFixed(2)} / £{stats.budget.estimated.toFixed(2)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(budgetPercent, 100)}
                    color={budgetPercent > 100 ? 'error' : 'primary'}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Remaining</Typography>
                  <Typography variant="subtitle2" color={stats.budget.remaining > 0 ? 'success.main' : 'error.main'}>
                    £{stats.budget.remaining.toFixed(2)}
                  </Typography>
                </Box>
                {budgetPercent > 90 && budgetPercent <= 100 && (
                  <Chip icon={<WarningIcon />} label="Approaching budget limit" color="warning" size="small" />
                )}
                {budgetPercent > 100 && (
                  <Chip icon={<WarningIcon />} label="Over budget" color="error" size="small" />
                )}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Container Breakdown */}
        <Card sx={{ flex: '1 1 300px' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ContainerIcon /> Containers
            </Typography>
            {stats.containers.total === 0 ? (
              <Typography variant="body2" color="text.secondary">No containers assigned.</Typography>
            ) : (
              <Stack spacing={1}>
                <Typography variant="body2">
                  {stats.containers.total} containers · {stats.containers.totalItems} items · £{stats.containers.totalValue.toLocaleString()} value
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {Object.entries(stats.containers.byStatus).map(([status, count]) => (
                    <Chip
                      key={status}
                      label={`${status}: ${count}`}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default ProjectAnalytics;
