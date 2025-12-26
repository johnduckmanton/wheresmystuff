import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  Divider,
  Badge,
  Collapse,
  CircularProgress
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  Lightbulb as LightbulbIcon
} from '@mui/icons-material';
import api from '../services/api';

interface StorageAlert {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  containerId?: string;
  containerName?: string;
  action?: string;
  costImpact?: number;
  isRead: boolean;
  isResolved: boolean;
  createdAt: string;
}

interface StorageRecommendation {
  type: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  action: string;
  estimatedSavings?: number;
  affectedContainers?: number;
  containerId?: string;
  containerName?: string;
}

interface AlertSummary {
  totalContainersInStorage: number;
  containersWithAlerts: number;
  highPriorityAlerts: number;
  totalAlertCost: number;
  totalStorageCost: number;
  averageDuration: number;
}

interface StorageAlertsPanelProps {
  inventoryId: string;
  onAlertAction?: (action: string, containerId?: string) => void;
}

const StorageAlertsPanel: React.FC<StorageAlertsPanelProps> = ({
  inventoryId,
  onAlertAction
}) => {
  const [alerts, setAlerts] = useState<StorageAlert[]>([]);
  const [recommendations, setRecommendations] = useState<StorageRecommendation[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['alerts']));
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<StorageAlert | null>(null);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    if (inventoryId) {
      checkStorageAlerts();
      loadStorageAlerts();
    }
  }, [inventoryId]);

  const checkStorageAlerts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.checkStorageAlerts(inventoryId);
      
      setSummary(response.summary);
      setRecommendations(response.recommendations);
    } catch (err: any) {
      console.error('Error checking storage alerts:', err);
      setError(err.response?.data?.error || 'Failed to check storage alerts');
    } finally {
      setLoading(false);
    }
  };

  const loadStorageAlerts = async () => {
    try {
      const response = await api.getStorageAlerts(inventoryId, {
        isResolved: false,
        limit: 50
      });
      
      setAlerts(response.alerts);
    } catch (err: any) {
      console.error('Error loading storage alerts:', err);
      // Don't show error for alerts loading as it's secondary to the check
    }
  };

  const handleMarkAsRead = async (alert: StorageAlert) => {
    try {
      await api.markStorageAlertAsRead(alert.id, inventoryId);
      
      // Update local state
      setAlerts(prev => prev.map(a => 
        a.id === alert.id ? { ...a, isRead: true } : a
      ));
    } catch (err: any) {
      console.error('Error marking alert as read:', err);
      setError(err.response?.data?.error || 'Failed to mark alert as read');
    }
  };

  const handleResolveAlert = async () => {
    if (!selectedAlert || !resolution.trim()) return;
    
    try {
      await api.resolveStorageAlert(selectedAlert.id, inventoryId, resolution.trim());
      
      // Update local state
      setAlerts(prev => prev.filter(a => a.id !== selectedAlert.id));
      setResolveDialogOpen(false);
      setSelectedAlert(null);
      setResolution('');
      
      // Refresh data
      checkStorageAlerts();
    } catch (err: any) {
      console.error('Error resolving alert:', err);
      setError(err.response?.data?.error || 'Failed to resolve alert');
    }
  };

  const handleAlertClick = (alert: StorageAlert) => {
    if (!alert.isRead) {
      handleMarkAsRead(alert);
    }
    
    if (alert.action && onAlertAction) {
      onAlertAction(alert.action, alert.containerId);
    }
  };

  const handleRecommendationClick = (recommendation: StorageRecommendation) => {
    if (recommendation.action && onAlertAction) {
      onAlertAction(recommendation.action, recommendation.containerId);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <ErrorIcon color="error" />;
      case 'medium': return <WarningIcon color="warning" />;
      case 'low': return <InfoIcon color="info" />;
      default: return <InfoIcon />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const unreadAlertsCount = alerts.filter(alert => !alert.isRead).length;

  return (
    <Box>
      {/* Summary Cards */}
      {summary && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <Box>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <WarningIcon color="warning" />
                  <Typography variant="h6">Alerts</Typography>
                  {unreadAlertsCount > 0 && (
                    <Badge badgeContent={unreadAlertsCount} color="error" />
                  )}
                </Box>
                <Typography variant="h4">{summary.containersWithAlerts}</Typography>
                <Typography variant="body2" color="text.secondary">
                  of {summary.totalContainersInStorage} containers
                </Typography>
              </CardContent>
            </Card>
          </Box>
          
          <Box>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <ErrorIcon color="error" />
                  <Typography variant="h6">High Priority</Typography>
                </Box>
                <Typography variant="h4">{summary.highPriorityAlerts}</Typography>
                <Typography variant="body2" color="text.secondary">
                  urgent alerts
                </Typography>
              </CardContent>
            </Card>
          </Box>
          
          <Box>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <MoneyIcon color="primary" />
                  <Typography variant="h6">Alert Cost</Typography>
                </Box>
                <Typography variant="h4">${summary.totalAlertCost.toFixed(0)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  of ${summary.totalStorageCost.toFixed(0)} total
                </Typography>
              </CardContent>
            </Card>
          </Box>
          
          <Box>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <ScheduleIcon color="primary" />
                  <Typography variant="h6">Avg Duration</Typography>
                </Box>
                <Typography variant="h4">{summary.averageDuration}</Typography>
                <Typography variant="body2" color="text.secondary">
                  days in storage
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress />
        </Box>
      )}

      {/* Refresh Button */}
      <Box display="flex" justifyContent="flex-end" mb={2}>
        <Button
          startIcon={<RefreshIcon />}
          onClick={() => {
            checkStorageAlerts();
            loadStorageAlerts();
          }}
          disabled={loading}
        >
          Refresh Alerts
        </Button>
      </Box>

      {/* Active Alerts Section */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box 
            display="flex" 
            alignItems="center" 
            justifyContent="space-between"
            sx={{ cursor: 'pointer' }}
            onClick={() => toggleSection('alerts')}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <WarningIcon color="warning" />
              <Typography variant="h6">
                Active Alerts ({alerts.length})
              </Typography>
              {unreadAlertsCount > 0 && (
                <Chip 
                  label={`${unreadAlertsCount} unread`} 
                  size="small" 
                  color="error" 
                />
              )}
            </Box>
            <IconButton>
              {expandedSections.has('alerts') ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.has('alerts')}>
            <Box mt={2}>
              {alerts.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={2}>
                  No active alerts
                </Typography>
              ) : (
                <List>
                  {alerts.map((alert, index) => (
                    <React.Fragment key={alert.id}>
                      <ListItem
                        onClick={() => handleAlertClick(alert)}
                        sx={{
                          backgroundColor: alert.isRead ? 'transparent' : 'action.hover',
                          borderRadius: 1,
                          mb: 1,
                          cursor: 'pointer'
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={1} mr={2}>
                          {getPriorityIcon(alert.priority)}
                        </Box>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body1" fontWeight={alert.isRead ? 'normal' : 'bold'}>
                                {alert.title}
                              </Typography>
                              <Chip 
                                label={alert.priority} 
                                size="small" 
                                color={getPriorityColor(alert.priority) as any}
                              />
                              {alert.containerName && (
                                <Chip 
                                  label={alert.containerName} 
                                  size="small" 
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {alert.message}
                              </Typography>
                              {alert.costImpact && alert.costImpact > 0 && (
                                <Typography variant="body2" color="error">
                                  Cost Impact: ${alert.costImpact.toFixed(2)}
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {new Date(alert.createdAt).toLocaleDateString()}
                              </Typography>
                            </Box>
                          }
                        />
                        <Box sx={{ ml: 'auto' }}>
                          <Tooltip title="Resolve Alert">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAlert(alert);
                                setResolveDialogOpen(true);
                              }}
                            >
                              <CheckCircleIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </ListItem>
                      {index < alerts.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Recommendations Section */}
      <Card>
        <CardContent>
          <Box 
            display="flex" 
            alignItems="center" 
            justifyContent="space-between"
            sx={{ cursor: 'pointer' }}
            onClick={() => toggleSection('recommendations')}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <LightbulbIcon color="primary" />
              <Typography variant="h6">
                Recommendations ({recommendations.length})
              </Typography>
            </Box>
            <IconButton>
              {expandedSections.has('recommendations') ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.has('recommendations')}>
            <Box mt={2}>
              {recommendations.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={2}>
                  No recommendations available
                </Typography>
              ) : (
                <List>
                  {recommendations.map((recommendation, index) => (
                    <React.Fragment key={`${recommendation.type}-${index}`}>
                      <ListItem
                        onClick={() => handleRecommendationClick(recommendation)}
                        sx={{ borderRadius: 1, mb: 1, cursor: 'pointer' }}
                      >
                        <Box display="flex" alignItems="center" gap={1} mr={2}>
                          <TrendingUpIcon color="primary" />
                        </Box>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body1" fontWeight="medium">
                                {recommendation.title}
                              </Typography>
                              <Chip 
                                label={recommendation.priority} 
                                size="small" 
                                color={getPriorityColor(recommendation.priority) as any}
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {recommendation.description}
                              </Typography>
                              {recommendation.estimatedSavings && recommendation.estimatedSavings > 0 && (
                                <Typography variant="body2" color="success.main">
                                  Potential Savings: ${recommendation.estimatedSavings.toFixed(2)}
                                </Typography>
                              )}
                              {recommendation.affectedContainers && (
                                <Typography variant="body2" color="text.secondary">
                                  Affects {recommendation.affectedContainers} containers
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < recommendations.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Resolve Alert Dialog */}
      <Dialog open={resolveDialogOpen} onClose={() => setResolveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Resolve Alert</DialogTitle>
        <DialogContent>
          {selectedAlert && (
            <Box mb={2}>
              <Typography variant="body1" gutterBottom>
                <strong>{selectedAlert.title}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {selectedAlert.message}
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Resolution Notes"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Describe how this alert was resolved..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleResolveAlert}
            variant="contained"
            disabled={!resolution.trim()}
          >
            Resolve Alert
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StorageAlertsPanel;