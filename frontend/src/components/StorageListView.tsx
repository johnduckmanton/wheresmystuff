import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Storage as StorageIcon,
  AttachMoney as MoneyIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import type { Container } from '../types/entities';
import api from '../services/api';
import StorageManagementDialog from './StorageManagementDialog';

interface StorageContainer {
  container: Container;
  storageRecord: any;
  duration: {
    days: number;
    weeks: number;
    months: number;
    years: number;
  };
  currentCost: number;
  warnings: Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

interface StorageListViewProps {
  inventoryId: string;
}

const StorageListView: React.FC<StorageListViewProps> = ({ inventoryId }) => {
  const [containers, setContainers] = useState<StorageContainer[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [minDuration, setMinDuration] = useState<number | ''>('');
  const [maxDuration, setMaxDuration] = useState<number | ''>('');
  const [minCost, setMinCost] = useState<number | ''>('');
  const [maxCost, setMaxCost] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState('storageStartDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Dialog state
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadStorageContainers();
  }, [inventoryId, minDuration, maxDuration, minCost, maxCost, sortBy, sortOrder]);

  const loadStorageContainers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params: any = { inventoryId, sortBy, sortOrder };
      
      if (minDuration !== '') params.minDuration = minDuration;
      if (maxDuration !== '') params.maxDuration = maxDuration;
      if (minCost !== '') params.minCost = minCost;
      if (maxCost !== '') params.maxCost = maxCost;
      
      const response = await api.listStorageContainers(inventoryId, params);
      
      setContainers(response.containers);
      setSummary(response.summary);
    } catch (err: any) {
      console.error('Error loading storage containers:', err);
      setError(err.response?.data?.error || 'Failed to load storage containers');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (container: Container) => {
    setSelectedContainer(container);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedContainer(null);
  };

  const handleStorageUpdated = () => {
    loadStorageContainers();
  };

  const formatDuration = (duration: any) => {
    if (duration.years > 0) {
      return `${duration.years}y ${duration.months % 12}m`;
    } else if (duration.months > 0) {
      return `${duration.months}m ${duration.days % 30}d`;
    } else if (duration.weeks > 0) {
      return `${duration.weeks}w ${duration.days % 7}d`;
    } else {
      return `${duration.days}d`;
    }
  };

  const getWarningIcon = (warnings: any[]) => {
    if (warnings.length === 0) return null;
    
    const highSeverity = warnings.some(w => w.severity === 'high');
    const mediumSeverity = warnings.some(w => w.severity === 'medium');
    
    if (highSeverity) {
      return <WarningIcon color="error" fontSize="small" />;
    } else if (mediumSeverity) {
      return <WarningIcon color="warning" fontSize="small" />;
    } else {
      return <WarningIcon color="info" fontSize="small" />;
    }
  };

  return (
    <Box>
      {/* Summary Cards */}
      {summary && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <Box>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <StorageIcon color="primary" />
                  <Typography variant="h6">Total Containers</Typography>
                </Box>
                <Typography variant="h4">{summary.totalContainers}</Typography>
              </CardContent>
            </Card>
          </Box>
          
          <Box>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <MoneyIcon color="primary" />
                  <Typography variant="h6">Total Cost</Typography>
                </Box>
                <Typography variant="h4">${summary.totalCurrentCost.toFixed(2)}</Typography>
              </CardContent>
            </Card>
          </Box>
          
          <Box>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <ScheduleIcon color="primary" />
                  <Typography variant="h6">Avg Duration</Typography>
                </Box>
                <Typography variant="h4">{summary.averageDuration} days</Typography>
              </CardContent>
            </Card>
          </Box>
          
          <Box>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <WarningIcon color="warning" />
                  <Typography variant="h6">With Warnings</Typography>
                </Box>
                <Typography variant="h4">{summary.containersWithWarnings}</Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
            <Box>
              <TextField
                fullWidth
                label="Min Duration (days)"
                type="number"
                value={minDuration}
                onChange={(e) => setMinDuration(e.target.value ? parseInt(e.target.value) : '')}
                slotProps={{ htmlInput: { min: 0 } }}
                size="small"
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label="Max Duration (days)"
                type="number"
                value={maxDuration}
                onChange={(e) => setMaxDuration(e.target.value ? parseInt(e.target.value) : '')}
                slotProps={{ htmlInput: { min: 0 } }}
                size="small"
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label="Min Cost ($)"
                type="number"
                value={minCost}
                onChange={(e) => setMinCost(e.target.value ? parseFloat(e.target.value) : '')}
                slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                size="small"
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label="Max Cost ($)"
                type="number"
                value={maxCost}
                onChange={(e) => setMaxCost(e.target.value ? parseFloat(e.target.value) : '')}
                slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                size="small"
              />
            </Box>
            <Box>
              <FormControl fullWidth size="small">
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <MenuItem value="storageStartDate">Start Date</MenuItem>
                  <MenuItem value="duration">Duration</MenuItem>
                  <MenuItem value="cost">Cost</MenuItem>
                  <MenuItem value="containerName">Container Name</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box>
              <FormControl fullWidth size="small">
                <InputLabel>Sort Order</InputLabel>
                <Select
                  value={sortOrder}
                  label="Sort Order"
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                >
                  <MenuItem value="asc">Ascending</MenuItem>
                  <MenuItem value="desc">Descending</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadStorageContainers}
                disabled={loading}
              >
                Refresh
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Containers Table */}
      {!loading && containers.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Container</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell align="right">Rate/Month</TableCell>
                <TableCell align="right">Current Cost</TableCell>
                <TableCell>Warnings</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {containers.map((item) => (
                <TableRow key={item.container.id}>
                  <TableCell>
                    <Typography variant="body1" fontWeight="bold">
                      {item.container.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.container.type}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {new Date(item.storageRecord.storageStartDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={formatDuration(item.duration)} 
                      size="small"
                      color={item.duration.months >= 12 ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    ${item.storageRecord.storageRate.toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body1" fontWeight="bold">
                      ${item.currentCost.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {getWarningIcon(item.warnings)}
                      {item.warnings.length > 0 && (
                        <Tooltip title={item.warnings.map(w => w.message).join(', ')}>
                          <Typography variant="body2">
                            {item.warnings.length} warning{item.warnings.length > 1 ? 's' : ''}
                          </Typography>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View Details">
                      <IconButton 
                        size="small"
                        onClick={() => handleOpenDialog(item.container)}
                      >
                        <InfoIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Empty State */}
      {!loading && containers.length === 0 && (
        <Card>
          <CardContent>
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <StorageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No containers in storage
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start tracking storage for containers to see them here
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Storage Management Dialog */}
      <StorageManagementDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        container={selectedContainer}
        inventoryId={inventoryId}
        onStorageUpdated={handleStorageUpdated}
      />
    </Box>
  );
};

export default StorageListView;