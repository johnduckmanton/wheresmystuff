import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material';
import {
  Storage as StorageIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import type { Container } from '../types/entities';
import api from '../services/api';

interface StorageInfo {
  isInStorage: boolean;
  storageInfo?: {
    storageStartDate: string;
    storageRate: number;
    currentDuration: {
      days: number;
      weeks: number;
      months: number;
      years: number;
    };
    currentCost: number;
    projectedMonthlyCost: number;
    projectedYearlyCost: number;
    warnings: Array<{
      type: string;
      message: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  };
}

interface StorageProjection {
  month: number;
  monthlyCost: number;
  cumulativeCost: number;
  totalDays: number;
}

interface StorageManagementDialogProps {
  open: boolean;
  onClose: () => void;
  container: Container | null;
  inventoryId: string;
  onStorageUpdated: () => void;
}

const StorageManagementDialog: React.FC<StorageManagementDialogProps> = ({
  open,
  onClose,
  container,
  inventoryId,
  onStorageUpdated
}) => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [projections, setProjections] = useState<StorageProjection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state for starting storage
  const [storageLocationId, setStorageLocationId] = useState('');
  const [storageRate, setStorageRate] = useState<number>(0);
  const [projectionMonths, setProjectionMonths] = useState(12);
  
  // Form state for updating rate
  const [newRate, setNewRate] = useState<number>(0);
  const [showRateUpdate, setShowRateUpdate] = useState(false);

  useEffect(() => {
    if (open && container) {
      loadStorageInfo();
    }
  }, [open, container]);

  const loadStorageInfo = async () => {
    if (!container) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.getStorageInfo(container.id, inventoryId);
      
      setStorageInfo(response);
      
      if (response.isInStorage) {
        setNewRate(response.storageInfo!.storageRate);
        loadProjections();
      }
    } catch (err: any) {
      console.error('Error loading storage info:', err);
      setError(err.response?.data?.error || 'Failed to load storage information');
    } finally {
      setLoading(false);
    }
  };

  const loadProjections = async () => {
    if (!container) return;
    
    try {
      const response = await api.getStorageCostProjections(container.id, inventoryId, projectionMonths);
      
      setProjections(response.projections);
    } catch (err: any) {
      console.error('Error loading projections:', err);
      // Don't show error for projections as it's not critical
    }
  };

  const handleStartStorage = async () => {
    if (!container || !storageLocationId) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await api.startStorageTracking(container.id, inventoryId, storageLocationId, storageRate);
      
      setSuccess('Storage tracking started successfully');
      onStorageUpdated();
      loadStorageInfo();
    } catch (err: any) {
      console.error('Error starting storage:', err);
      setError(err.response?.data?.error || 'Failed to start storage tracking');
    } finally {
      setLoading(false);
    }
  };

  const handleEndStorage = async () => {
    if (!container) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await api.endStorageTracking(container.id, inventoryId);
      
      setSuccess(`Storage ended. Total cost: £{response.totalCost.toFixed(2)} for ${response.duration.days} days`);
      onStorageUpdated();
      loadStorageInfo();
    } catch (err: any) {
      console.error('Error ending storage:', err);
      setError(err.response?.data?.error || 'Failed to end storage tracking');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRate = async () => {
    if (!container) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await api.updateStorageRate(container.id, inventoryId, newRate);
      
      setSuccess('Storage rate updated successfully');
      setShowRateUpdate(false);
      onStorageUpdated();
      loadStorageInfo();
    } catch (err: any) {
      console.error('Error updating rate:', err);
      setError(err.response?.data?.error || 'Failed to update storage rate');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (duration: any) => {
    if (duration.years > 0) {
      return `${duration.years} year${duration.years > 1 ? 's' : ''}, ${duration.months % 12} month${duration.months % 12 !== 1 ? 's' : ''}`;
    } else if (duration.months > 0) {
      return `${duration.months} month${duration.months > 1 ? 's' : ''}, ${duration.days % 30} day${duration.days % 30 !== 1 ? 's' : ''}`;
    } else if (duration.weeks > 0) {
      return `${duration.weeks} week${duration.weeks > 1 ? 's' : ''}, ${duration.days % 7} day${duration.days % 7 !== 1 ? 's' : ''}`;
    } else {
      return `${duration.days} day${duration.days !== 1 ? 's' : ''}`;
    }
  };

  const getWarningColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  if (!container) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <StorageIcon />
          Storage Management - {container.name}
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {loading && (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {storageInfo && !loading && (
          <>
            {!storageInfo.isInStorage ? (
              // Start Storage Form
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Start Storage Tracking
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 2 }}>
                    <TextField
                      fullWidth
                      label="Storage Location ID"
                      value={storageLocationId}
                      onChange={(e) => setStorageLocationId(e.target.value)}
                      placeholder="Enter storage location ID"
                      required
                    />
                    <Box>
                      <TextField
                        fullWidth
                        label="Monthly Storage Rate ($)"
                        type="number"
                        value={storageRate}
                        onChange={(e) => setStorageRate(parseFloat(e.target.value) || 0)}
                        slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ) : (
              // Storage Information Display
              <Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                  {/* Current Storage Status */}
                  <Box>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                          <ScheduleIcon color="primary" />
                          <Typography variant="h6">Storage Duration</Typography>
                        </Box>
                        <Typography variant="body1" gutterBottom>
                          Started: {new Date(storageInfo.storageInfo!.storageStartDate).toLocaleDateString()}
                        </Typography>
                        <Typography variant="h5" color="primary">
                          {formatDuration(storageInfo.storageInfo!.currentDuration)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ({storageInfo.storageInfo!.currentDuration.days} total days)
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>

                  {/* Current Cost */}
                  <Box>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                          <MoneyIcon color="primary" />
                          <Typography variant="h6">Storage Costs</Typography>
                        </Box>
                        <Typography variant="h4" color="primary" gutterBottom>
                          £{storageInfo.storageInfo!.currentCost.toFixed(2)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Current total cost
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2">
                          Monthly rate: £{storageInfo.storageInfo!.storageRate.toFixed(2)}
                        </Typography>
                        <Typography variant="body2">
                          Projected yearly: £{storageInfo.storageInfo!.projectedYearlyCost.toFixed(2)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>
                </Box>

                  {/* Warnings */}
                  {storageInfo.storageInfo!.warnings.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Card>
                        <CardContent>
                          <Box display="flex" alignItems="center" gap={1} mb={2}>
                            <WarningIcon color="warning" />
                            <Typography variant="h6">Warnings</Typography>
                          </Box>
                          {storageInfo.storageInfo!.warnings.map((warning, index) => (
                            <Alert 
                              key={index} 
                              severity={getWarningColor(warning.severity) as any}
                              sx={{ mb: 1 }}
                            >
                              {warning.message}
                            </Alert>
                          ))}
                        </CardContent>
                      </Card>
                    </Box>
                  )}

                  {/* Cost Projections */}
                  {projections.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Card>
                        <CardContent>
                          <Box display="flex" alignItems="center" gap={1} mb={2}>
                            <TrendingUpIcon color="primary" />
                            <Typography variant="h6">Cost Projections</Typography>
                            <FormControl size="small" sx={{ ml: 'auto', minWidth: 120 }}>
                              <InputLabel>Months</InputLabel>
                              <Select
                                value={projectionMonths}
                                label="Months"
                                onChange={(e) => {
                                  setProjectionMonths(e.target.value as number);
                                  loadProjections();
                                }}
                              >
                                <MenuItem value={6}>6 months</MenuItem>
                                <MenuItem value={12}>12 months</MenuItem>
                                <MenuItem value={24}>24 months</MenuItem>
                                <MenuItem value={36}>36 months</MenuItem>
                              </Select>
                            </FormControl>
                          </Box>
                          <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                            {projections.slice(0, 6).map((projection) => (
                              <Box 
                                key={projection.month}
                                display="flex" 
                                justifyContent="space-between" 
                                alignItems="center"
                                py={0.5}
                              >
                                <Typography variant="body2">
                                  Month {projection.month}
                                </Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  £{projection.cumulativeCost.toFixed(2)}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                  )}

                  {/* Rate Update Form */}
                  {showRateUpdate && (
                    <Box sx={{ mt: 2 }}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Update Storage Rate
                          </Typography>
                          <TextField
                            fullWidth
                            label="New Monthly Rate ($)"
                            type="number"
                            value={newRate}
                            onChange={(e) => setNewRate(parseFloat(e.target.value) || 0)}
                            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                            sx={{ mb: 2 }}
                          />
                          <Box display="flex" gap={1}>
                            <Button 
                              variant="contained" 
                              onClick={handleUpdateRate}
                              disabled={loading}
                            >
                              Update Rate
                            </Button>
                            <Button 
                              variant="outlined" 
                              onClick={() => setShowRateUpdate(false)}
                            >
                              Cancel
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                  )}
              </Box>
            )}
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        {storageInfo?.isInStorage ? (
          <>
            <Button 
              onClick={() => setShowRateUpdate(!showRateUpdate)}
              disabled={loading}
            >
              {showRateUpdate ? 'Cancel Rate Update' : 'Update Rate'}
            </Button>
            <Button 
              onClick={handleEndStorage}
              color="warning"
              disabled={loading}
            >
              End Storage
            </Button>
          </>
        ) : (
          <Button 
            onClick={handleStartStorage}
            variant="contained"
            disabled={loading || !storageLocationId}
          >
            Start Storage Tracking
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default StorageManagementDialog;