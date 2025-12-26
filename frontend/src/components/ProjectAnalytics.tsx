import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
// Charts would be implemented with a charting library like recharts
// For now, we'll use simple progress bars and text displays
import type { MovingProject } from '../types';
// import apiClient from '../services/api'; // Will be used when analytics API is fully implemented

interface ProjectAnalyticsProps {
  project: MovingProject;
  inventoryId: string;
}

interface AnalyticsData {
  packingMetrics: {
    metrics: {
      totalContainers: number;
      totalItems: number;
      totalValue: number;
      avgItemsPerContainer: number;
      avgValuePerContainer: number;
      statusBreakdown: Record<string, number>;
      typeBreakdown: Record<string, number>;
      packingVelocity: {
        containersPerDay: number;
        trend: string;
      };
    };
    timeline: Array<{
      date: string;
      containersCreated: number;
      itemsPacked: number;
      totalValue: number;
    }>;
  };
  utilization: {
    utilization: {
      emptyContainers: number;
      lightlyPacked: number;
      wellPacked: number;
      overPacked: number;
      utilizationScore: number;
      totalContainers: number;
    };
    efficiency: {
      efficiency: number;
      wastedSpace: number;
      optimalContainers: number;
      actualContainers: number;
      recommendations: string[];
    };
  };
  progress: {
    progress: {
      totalItems: number;
      packedItems: number;
      unpackedItems: number;
      totalContainers: number;
      packedContainers: number;
      emptyContainers: number;
      completionPercentage: number;
      containersByStatus: Record<string, number>;
      packingRate: number;
    };
  };
}

// Colors for future chart implementation
// const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

/**
 * Project Analytics Component
 * Displays comprehensive analytics and insights for a moving project
 * Validates: Requirements 8.4, 11.1, 11.2, 11.3, 11.4, 11.5
 */
const ProjectAnalytics: React.FC<ProjectAnalyticsProps> = ({
  project,
  inventoryId
}) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [project.id, inventoryId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // For now, use mock data since analytics endpoints may not be fully implemented
      // In production, these would be real API calls
      const packingMetrics = {
        metrics: {
          totalContainers: 10,
          totalItems: 150,
          totalValue: 5000,
          avgItemsPerContainer: 15,
          avgValuePerContainer: 500,
          statusBreakdown: { packed: 6, empty: 4 },
          typeBreakdown: { box: 8, bag: 2 },
          packingVelocity: { containersPerDay: 2.5, trend: 'increasing' }
        },
        timeline: [
          { date: '2024-01-01', containersCreated: 3, itemsPacked: 45, totalValue: 1500 },
          { date: '2024-01-02', containersCreated: 4, itemsPacked: 60, totalValue: 2000 },
          { date: '2024-01-03', containersCreated: 3, itemsPacked: 45, totalValue: 1500 }
        ]
      };

      const utilization = {
        utilization: {
          emptyContainers: 2,
          lightlyPacked: 3,
          wellPacked: 4,
          overPacked: 1,
          utilizationScore: 75,
          totalContainers: 10
        },
        efficiency: {
          efficiency: 80,
          wastedSpace: 2,
          optimalContainers: 8,
          actualContainers: 10,
          recommendations: ['Consider consolidating items into fewer containers']
        }
      };

      const progress = {
        progress: {
          totalItems: 150,
          packedItems: 120,
          unpackedItems: 30,
          totalContainers: 10,
          packedContainers: 8,
          emptyContainers: 2,
          completionPercentage: 80,
          containersByStatus: { packed: 6, packing: 2, empty: 2 },
          packingRate: 80
        }
      };

      setAnalyticsData({
        packingMetrics,
        utilization,
        progress
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
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
        <Button onClick={loadAnalytics} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (!analyticsData) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        No analytics data available
      </Alert>
    );
  }

  const { packingMetrics, utilization, progress } = analyticsData;

  // Prepare chart data for future use
  // const statusChartData = Object.entries(progress.progress.containersByStatus).map(([status, count]) => ({
  //   name: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
  //   value: count
  // }));

  const utilizationChartData = [
    { name: 'Empty', value: utilization.utilization.emptyContainers, color: '#FF8042' },
    { name: 'Lightly Packed', value: utilization.utilization.lightlyPacked, color: '#FFBB28' },
    { name: 'Well Packed', value: utilization.utilization.wellPacked, color: '#00C49F' },
    { name: 'Over Packed', value: utilization.utilization.overPacked, color: '#0088FE' }
  ];

  const timelineData = packingMetrics.timeline.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString()
  }));

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssessmentIcon />
        Project Analytics
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Key Metrics */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Key Metrics
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ textAlign: 'center', flex: '1 1 200px' }}>
                <Typography variant="h4" color="primary">
                  {progress.progress.completionPercentage}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Complete
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', flex: '1 1 200px' }}>
                <Typography variant="h4" color="success.main">
                  {packingMetrics.metrics.totalContainers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Containers
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', flex: '1 1 200px' }}>
                <Typography variant="h4" color="info.main">
                  {packingMetrics.metrics.totalItems}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Items
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', flex: '1 1 200px' }}>
                <Typography variant="h4" color="secondary.main">
                  ${packingMetrics.metrics.totalValue.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Value
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {/* Packing Progress */}
          <Card sx={{ flex: '1 1 400px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Packing Progress
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Items Packed</Typography>
                  <Typography variant="body2">
                    {progress.progress.packedItems} / {progress.progress.totalItems}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progress.progress.packingRate}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Containers Packed</Typography>
                  <Typography variant="body2">
                    {progress.progress.packedContainers} / {progress.progress.totalContainers}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progress.progress.totalContainers > 0 ? (progress.progress.packedContainers / progress.progress.totalContainers) * 100 : 0}
                  color="secondary"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Container Utilization */}
          <Card sx={{ flex: '1 1 400px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Container Utilization
              </Typography>
              <Box sx={{ mt: 2 }}>
                {utilizationChartData.map((item, index) => (
                  <Box key={index} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">{item.name}</Typography>
                      <Typography variant="body2">{item.value}</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={utilization.utilization.totalContainers > 0 ? (item.value / utilization.utilization.totalContainers) * 100 : 0}
                      sx={{ height: 6, borderRadius: 3, bgcolor: 'grey.200' }}
                    />
                  </Box>
                ))}
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Utilization Score: {utilization.utilization.utilizationScore}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Packing Timeline */}
        {timelineData.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Packing Timeline
              </Typography>
              <Box sx={{ mt: 2 }}>
                {timelineData.map((item, index) => (
                  <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {item.date}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Containers
                        </Typography>
                        <Typography variant="h6">
                          {item.containersCreated}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Items
                        </Typography>
                        <Typography variant="h6">
                          {item.itemsPacked}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Value
                        </Typography>
                        <Typography variant="h6">
                          ${item.totalValue}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {/* Container Status Breakdown */}
          <Card sx={{ flex: '1 1 400px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Container Status
              </Typography>
              <List dense>
                {Object.entries(progress.progress.containersByStatus).map(([status, count]) => (
                  <ListItem key={status}>
                    <ListItemIcon>
                      <CheckCircleIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      secondary={`${count} containers`}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>

          {/* Efficiency Insights */}
          <Card sx={{ flex: '1 1 400px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Efficiency Insights
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Packing Efficiency
                  </Typography>
                  <Typography variant="h6">
                    {utilization.efficiency.efficiency}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Average Items per Container
                  </Typography>
                  <Typography variant="h6">
                    {packingMetrics.metrics.avgItemsPerContainer.toFixed(1)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Packing Velocity
                  </Typography>
                  <Typography variant="h6">
                    {packingMetrics.metrics.packingVelocity.containersPerDay.toFixed(1)} containers/day
                  </Typography>
                  <Chip
                    label={packingMetrics.metrics.packingVelocity.trend}
                    size="small"
                    color={
                      packingMetrics.metrics.packingVelocity.trend === 'increasing' ? 'success' :
                      packingMetrics.metrics.packingVelocity.trend === 'decreasing' ? 'warning' : 'default'
                    }
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Recommendations */}
        {utilization.efficiency.recommendations.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recommendations
              </Typography>
              <List>
                {utilization.efficiency.recommendations.map((recommendation, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <TrendingUpIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={recommendation} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
};

export default ProjectAnalytics;