import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Tabs,
  Tab,

  TextField,
  Button,
  Chip,
  LinearProgress,

  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  TrendingUp,
  Assessment,
  Storage,

  Warning,
  CheckCircle,
  Info,
  Timeline,

  Lightbulb,
  Speed,
  Inventory,
  MonetizationOn,
} from '@mui/icons-material';

import { useNotification } from '../contexts/NotificationContext';
import apiClient from '../services/api';

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
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface AnalyticsDashboardProps {
  inventoryId: string;
  projectId?: string;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ inventoryId, projectId }) => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Analytics data state
  const [packingMetrics, setPackingMetrics] = useState<any>(null);
  const [utilization, setUtilization] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [storageCosts, setStorageCosts] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any>(null);
  
  // Filter state
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [selectedProject, setSelectedProject] = useState(projectId || '');
  
  const { showError } = useNotification();

  useEffect(() => {
    loadAnalyticsData();
  }, [inventoryId, selectedProject, dateRange]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const options = {
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
        projectId: selectedProject || undefined,
      };

      // Load all analytics data in parallel
      const [
        packingData,
        utilizationData,
        progressData,
        costsData,
        recommendationsData,
      ] = await Promise.all([
        apiClient.getPackingMetrics(inventoryId, options),
        apiClient.getContainerUtilization(inventoryId),
        apiClient.getMovingProgress(inventoryId, selectedProject || undefined),
        apiClient.getStorageCosts(inventoryId, options),
        apiClient.getRecommendations(inventoryId),
      ]);

      setPackingMetrics(packingData);
      setUtilization(utilizationData);
      setProgress(progressData);
      setStorageCosts(costsData);
      setRecommendations(recommendationsData);
    } catch (err) {
      console.error('Error loading analytics data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
      showError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDateRangeChange = (field: 'startDate' | 'endDate', value: string) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setDateRange({ startDate: '', endDate: '' });
    setSelectedProject('');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading analytics...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <Button onClick={loadAnalyticsData} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
          Analytics & Insights
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track your packing progress, container utilization, and get optimization recommendations
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' }, gap: 2, alignItems: 'center' }}>
            <TextField
              label="Start Date"
              type="date"
              value={dateRange.startDate}
              onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
            <TextField
              label="End Date"
              type="date"
              value={dateRange.endDate}
              onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
            <TextField
              label="Project ID"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              placeholder="Optional project filter"
              fullWidth
              size="small"
            />
            <Button onClick={clearFilters} variant="outlined" size="small">
              Clear Filters
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="analytics tabs">
          <Tab label="Overview" icon={<Assessment />} />
          <Tab label="Packing Metrics" icon={<Inventory />} />
          <Tab label="Container Utilization" icon={<Storage />} />
          <Tab label="Progress Tracking" icon={<Timeline />} />
          <Tab label="Storage Costs" icon={<MonetizationOn />} />
          <Tab label="Recommendations" icon={<Lightbulb />} />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <OverviewPanel
          packingMetrics={packingMetrics}
          utilization={utilization}
          progress={progress}
          storageCosts={storageCosts}
        />
      </TabPanel>

      {/* Packing Metrics Tab */}
      <TabPanel value={tabValue} index={1}>
        <PackingMetricsPanel metrics={packingMetrics} />
      </TabPanel>

      {/* Container Utilization Tab */}
      <TabPanel value={tabValue} index={2}>
        <UtilizationPanel utilization={utilization} />
      </TabPanel>

      {/* Progress Tracking Tab */}
      <TabPanel value={tabValue} index={3}>
        <ProgressPanel progress={progress} />
      </TabPanel>

      {/* Storage Costs Tab */}
      <TabPanel value={tabValue} index={4}>
        <StorageCostsPanel costs={storageCosts} />
      </TabPanel>

      {/* Recommendations Tab */}
      <TabPanel value={tabValue} index={5}>
        <RecommendationsPanel recommendations={recommendations} />
      </TabPanel>
    </Box>
  );
};

// Overview Panel Component
const OverviewPanel: React.FC<{
  packingMetrics: any;
  utilization: any;
  progress: any;
  storageCosts: any;
}> = ({ packingMetrics, utilization, progress, storageCosts }) => {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3 }}>
      {/* Key Metrics Cards */}
      <Box>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" mb={1}>
              <Inventory color="primary" />
              <Typography variant="h6" sx={{ ml: 1 }}>
                Total Containers
              </Typography>
            </Box>
            <Typography variant="h3" color="primary">
              {packingMetrics?.metrics?.totalContainers || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {packingMetrics?.metrics?.totalItems || 0} items packed
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" mb={1}>
              <Timeline color="success" />
              <Typography variant="h6" sx={{ ml: 1 }}>
                Progress
              </Typography>
            </Box>
            <Typography variant="h3" color="success.main">
              {progress?.progress?.completionPercentage || 0}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {progress?.progress?.packedItems || 0} of {progress?.progress?.totalItems || 0} items
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" mb={1}>
              <Speed color="warning" />
              <Typography variant="h6" sx={{ ml: 1 }}>
                Utilization
              </Typography>
            </Box>
            <Typography variant="h3" color="warning.main">
              {utilization?.utilization?.utilizationScore || 0}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Container efficiency score
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" mb={1}>
              <MonetizationOn color="info" />
              <Typography variant="h6" sx={{ ml: 1 }}>
                Total Value
              </Typography>
            </Box>
            <Typography variant="h3" color="info.main">
              £{packingMetrics?.metrics?.totalValue?.toFixed(0) || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Across all containers
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Packing Velocity */}
      <Box sx={{ gridColumn: { xs: '1', md: '1 / 3' } }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
              Packing Velocity
            </Typography>
            <Box display="flex" alignItems="center" mb={2}>
              <Typography variant="h4" color="primary">
                {packingMetrics?.metrics?.packingVelocity?.containersPerDay?.toFixed(1) || 0}
              </Typography>
              <Typography variant="body1" sx={{ ml: 1 }}>
                containers/day
              </Typography>
              <Chip
                label={packingMetrics?.metrics?.packingVelocity?.trend || 'stable'}
                color={
                  packingMetrics?.metrics?.packingVelocity?.trend === 'increasing' ? 'success' :
                  packingMetrics?.metrics?.packingVelocity?.trend === 'decreasing' ? 'error' : 'default'
                }
                size="small"
                sx={{ ml: 2 }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Average containers created per day
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Storage Costs Summary */}
      <Box sx={{ gridColumn: { xs: '1', md: '3 / 5' } }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <MonetizationOn sx={{ mr: 1, verticalAlign: 'middle' }} />
              Storage Costs
            </Typography>
            <Box display="flex" alignItems="center" mb={2}>
              <Typography variant="h4" color="warning.main">
                £{storageCosts?.costs?.totalMonthlyCost?.toFixed(2) || 0}
              </Typography>
              <Typography variant="body1" sx={{ ml: 1 }}>
                /month
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {storageCosts?.costs?.totalContainers || 0} containers in storage
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total cost to date: £{storageCosts?.costs?.totalCost?.toFixed(2) || 0}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

// Packing Metrics Panel Component
const PackingMetricsPanel: React.FC<{ metrics: any }> = ({ metrics }) => {
  if (!metrics?.metrics) return <Typography>No packing metrics available</Typography>;

  const { metrics: data, timeline } = metrics;

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      {/* Summary Stats */}
      <Box>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Packing Summary
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total Containers
                </Typography>
                <Typography variant="h5">{data.totalContainers}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total Items
                </Typography>
                <Typography variant="h5">{data.totalItems}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Avg Items/Container
                </Typography>
                <Typography variant="h5">{data.avgItemsPerContainer}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Avg Value/Container
                </Typography>
                <Typography variant="h5">£{data.avgValuePerContainer}</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Container Type Breakdown */}
      <Box sx={{ gridColumn: { xs: '1', md: '1 / 3' } }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Container Types
            </Typography>
            {Object.entries(data.typeBreakdown || {}).map(([type, count]) => (
              <Box key={type} sx={{ mb: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                    {type}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {count as number}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(count as number) / data.totalContainers * 100}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
            ))}
          </CardContent>
        </Card>
      </Box>

      {/* Status Breakdown */}
      <Box sx={{ gridColumn: { xs: '1', md: '3 / 5' } }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Container Status
            </Typography>
            {Object.entries(data.statusBreakdown || {}).map(([status, count]) => (
              <Box key={status} sx={{ mb: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                    {status.replace('_', ' ')}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {count as number}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(count as number) / data.totalContainers * 100}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
            ))}
          </CardContent>
        </Card>
      </Box>

      {/* Timeline */}
      {timeline && timeline.length > 0 && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Packing Timeline
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Daily packing activity over time
              </Typography>
              {/* Simple timeline display - in a real app, you'd use a charting library */}
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {timeline.map((day: any) => (
                  <Box key={day.date} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight="bold">
                        {new Date(day.date).toLocaleDateString()}
                      </Typography>
                      <Box display="flex" gap={2}>
                        <Typography variant="body2">
                          {day.containersCreated} containers
                        </Typography>
                        <Typography variant="body2">
                          {day.itemsPacked} items
                        </Typography>
                        <Typography variant="body2">
                          £{day.totalValue}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};

// Utilization Panel Component
const UtilizationPanel: React.FC<{ utilization: any }> = ({ utilization }) => {
  if (!utilization?.utilization) return <Typography>No utilization data available</Typography>;

  const { utilization: data, efficiency } = utilization;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
      {/* Utilization Score */}
      <Box>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Overall Utilization Score
            </Typography>
            <Box display="flex" alignItems="center" justifyContent="center" sx={{ py: 3 }}>
              <Box position="relative" display="inline-flex">
                <CircularProgress
                  variant="determinate"
                  value={data.utilizationScore}
                  size={120}
                  thickness={6}
                  color={
                    data.utilizationScore >= 80 ? 'success' :
                    data.utilizationScore >= 60 ? 'warning' : 'error'
                  }
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="h4" component="div" color="text.secondary">
                    {data.utilizationScore}%
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Container utilization efficiency
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Utilization Breakdown */}
      <Box>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Container Distribution
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="Well Packed"
                  secondary={`${data.wellPacked} containers (6-20 items)`}
                />
                <Typography variant="h6">{data.wellPacked}</Typography>
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Info color="info" />
                </ListItemIcon>
                <ListItemText
                  primary="Lightly Packed"
                  secondary={`${data.lightlyPacked} containers (1-5 items)`}
                />
                <Typography variant="h6">{data.lightlyPacked}</Typography>
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Warning color="warning" />
                </ListItemIcon>
                <ListItemText
                  primary="Over Packed"
                  secondary={`${data.overPacked} containers (20+ items)`}
                />
                <Typography variant="h6">{data.overPacked}</Typography>
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Warning color="error" />
                </ListItemIcon>
                <ListItemText
                  primary="Empty"
                  secondary={`${data.emptyContainers} containers (0 items)`}
                />
                <Typography variant="h6">{data.emptyContainers}</Typography>
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Box>

      {/* Efficiency Metrics */}
      {efficiency && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Packing Efficiency
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Efficiency Score
                  </Typography>
                  <Typography variant="h4" color={efficiency.efficiency >= 70 ? 'success.main' : 'warning.main'}>
                    {efficiency.efficiency}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Optimal Containers
                  </Typography>
                  <Typography variant="h4">{efficiency.optimalContainers}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Potential Savings
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {efficiency.wastedSpace} containers
                  </Typography>
                </Box>
              </Box>
              {efficiency.recommendations && efficiency.recommendations.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Recommendations:
                  </Typography>
                  {efficiency.recommendations.map((rec: string, index: number) => (
                    <Alert key={index} severity="info" sx={{ mb: 1 }}>
                      {rec}
                    </Alert>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};

// Progress Panel Component
const ProgressPanel: React.FC<{ progress: any }> = ({ progress }) => {
  if (!progress?.progress) return <Typography>No progress data available</Typography>;

  const { progress: data, completionTimeline } = progress;

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      {/* Progress Overview */}
      <Box>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Moving Progress Overview
            </Typography>
            <Box sx={{ mb: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2">
                  Overall Completion
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {data.completionPercentage}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={data.completionPercentage}
                sx={{ height: 10, borderRadius: 5 }}
              />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Packed Items
                </Typography>
                <Typography variant="h5" color="success.main">
                  {data.packedItems}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Unpacked Items
                </Typography>
                <Typography variant="h5" color="warning.main">
                  {data.unpackedItems}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Packed Containers
                </Typography>
                <Typography variant="h5" color="primary.main">
                  {data.packedContainers}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Empty Containers
                </Typography>
                <Typography variant="h5" color="grey.500">
                  {data.emptyContainers}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Container Status Breakdown */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3, gridColumn: '1 / -1' }}>
        <Box>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Container Status
            </Typography>
            {Object.entries(data.containersByStatus || {}).map(([status, count]) => (
              <Box key={status} sx={{ mb: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                    {status.replace('_', ' ')}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {count as number}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(count as number) / data.totalContainers * 100}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            ))}
          </CardContent>
        </Card>
        </Box>

        {/* Packing Rate */}
        <Box>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Packing Rate
            </Typography>
            <Box display="flex" alignItems="center" justifyContent="center" sx={{ py: 3 }}>
              <Box position="relative" display="inline-flex">
                <CircularProgress
                  variant="determinate"
                  value={data.packingRate}
                  size={120}
                  thickness={6}
                  color={
                    data.packingRate >= 80 ? 'success' :
                    data.packingRate >= 50 ? 'warning' : 'error'
                  }
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="h4" component="div" color="text.secondary">
                    {data.packingRate}%
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Items packed vs total items
            </Typography>
          </CardContent>
        </Card>
        </Box>
      </Box>

      {/* Completion Timeline */}
      {completionTimeline && completionTimeline.length > 0 && (
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Completion Timeline
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Container status changes over time
              </Typography>
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {completionTimeline.map((day: any) => (
                  <Box key={day.date} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      {new Date(day.date).toLocaleDateString()}
                    </Typography>
                    <Box display="flex" gap={2} flexWrap="wrap">
                      {Object.entries(day).filter(([key]) => key !== 'date').map(([status, count]) => (
                        <Chip
                          key={status}
                          label={`${status}: ${count}`}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};

// Storage Costs Panel Component
const StorageCostsPanel: React.FC<{ costs: any }> = ({ costs }) => {
  if (!costs?.costs) return <Typography>No storage cost data available</Typography>;

  const { costs: data, projections } = costs;

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      {/* Cost Summary */}
      <Box>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Storage Cost Summary
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Monthly Cost
                </Typography>
                <Typography variant="h4" color="primary.main">
                  ${data.totalMonthlyCost}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total Cost to Date
                </Typography>
                <Typography variant="h4" color="warning.main">
                  ${data.totalCost}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Containers in Storage
                </Typography>
                <Typography variant="h4" color="info.main">
                  {data.totalContainers}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Avg Duration
                </Typography>
                <Typography variant="h4" color="success.main">
                  {data.avgDuration} days
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Cost Projections */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3, gridColumn: '1 / -1' }}>
        {projections && (
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cost Projections
              </Typography>
              <List>
                <ListItem>
                  <ListItemText primary="Next Month" />
                  <Typography variant="h6">${projections.nextMonth}</Typography>
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="Next 3 Months" />
                  <Typography variant="h6">${projections.next3Months}</Typography>
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="Next 6 Months" />
                  <Typography variant="h6">${projections.next6Months}</Typography>
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="Next Year" />
                  <Typography variant="h6">${projections.nextYear}</Typography>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Box>
        )}

        {/* Cost Breakdown */}
        <Box>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Container Cost Breakdown
            </Typography>
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {data.costBreakdown && data.costBreakdown.map((container: any) => (
                <Box key={container.containerId} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {container.containerName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Storage Duration: {container.durationDays} days ({container.durationMonths} months)
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Monthly Rate: ${container.monthlyRate}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" color="primary.main">
                    Total Cost: ${container.totalCost}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
        </Box>
      </Box>
    </Box>
  );
};

// Recommendations Panel Component
const RecommendationsPanel: React.FC<{ recommendations: any }> = ({ recommendations }) => {
  if (!recommendations?.recommendations) return <Typography>No recommendations available</Typography>;

  const { recommendations: recs } = recommendations;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const getPriorityIcon = (type: string) => {
    switch (type) {
      case 'efficiency': return <Speed />;
      case 'utilization': return <Storage />;
      case 'progress': return <Timeline />;
      case 'velocity': return <TrendingUp />;
      case 'security': return <Warning />;
      default: return <Lightbulb />;
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box>
        <Typography variant="h6" gutterBottom>
          <Lightbulb sx={{ mr: 1, verticalAlign: 'middle' }} />
          Optimization Recommendations
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Based on your current packing metrics, container utilization, and progress data
        </Typography>
      </Box>

      {recs.length === 0 ? (
        <Box>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="center" py={4}>
                <CheckCircle color="success" sx={{ fontSize: 48, mr: 2 }} />
                <Box>
                  <Typography variant="h6" color="success.main">
                    Great job! No recommendations at this time.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Your packing process is optimized and efficient.
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      ) : (
        recs.map((rec: any, index: number) => (
          <Box key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="flex-start" mb={2}>
                  <Box sx={{ mr: 2, mt: 0.5 }}>
                    {getPriorityIcon(rec.type)}
                  </Box>
                  <Box flex={1}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Typography variant="h6" sx={{ mr: 2 }}>
                        {rec.title}
                      </Typography>
                      <Chip
                        label={rec.priority}
                        color={getPriorityColor(rec.priority) as any}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body1" color="text.secondary" paragraph>
                      {rec.description}
                    </Typography>
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="body2" fontWeight="bold">
                        Recommended Action:
                      </Typography>
                      <Typography variant="body2">
                        {rec.action}
                      </Typography>
                    </Alert>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
        ))
      )}
    </Box>
  );
};

export default AnalyticsDashboard;