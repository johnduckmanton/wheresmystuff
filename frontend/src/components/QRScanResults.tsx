import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Alert,
  Collapse,
  Grid,
} from '@mui/material';
import {
  Close as CloseIcon,
  Inventory as InventoryIcon,
  Category as CategoryIcon,
  QrCode as QrCodeIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import HandlingFlagChip from './HandlingFlagChip';
import type { Container, ThingWithContainer } from '../types';
import apiClient from '../services/api';

interface QRScanResultsProps {
  open: boolean;
  onClose: () => void;
  scanResult: ScanResult | null;
  onNavigateToContainer: () => void;
  onNavigateToItem: (itemId: string) => void;
  inventoryId: string;
}

interface ScanResult {
  scanResult: {
    success: boolean;
    containerId: string;
    qrCodeId: string;
    generatedAt: string;
    timestamp: number;
  };
  container: Container;
  items: ThingWithContainer[];
  itemCount: number;
  scannedAt: string;
}

interface ScanHistoryEntry {
  containerId: string;
  containerName: string;
  timestamp: string;
  method: string;
  itemCount: number;
}

/**
 * QR Scan Results Component
 * Displays container contents after successful QR code scan
 * Validates: Requirements 6.2, 6.5
 */
const QRScanResults: React.FC<QRScanResultsProps> = ({
  open,
  onClose,
  scanResult,
  onNavigateToContainer,
  onNavigateToItem,
  inventoryId,
}) => {
  const [showAllItems, setShowAllItems] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanHistoryEntry[]>([]);

  const loadRecentScans = useCallback(async () => {
    try {
      const response = await apiClient.getRecentScans(inventoryId, 5);
      setRecentScans(response.recentScans || []);
    } catch (error) {
      console.error('Error loading recent scans:', error);
      // Don't show error to user as this is not critical
    }
  }, [inventoryId]);

  // Load recent scan history
  useEffect(() => {
    if (open && inventoryId) {
      loadRecentScans();
    }
  }, [open, inventoryId, loadRecentScans]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(value);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };



  const handleViewContainer = () => {
    if (scanResult?.container.id) {
      onNavigateToContainer();
      onClose();
    }
  };

  const handleViewItem = (itemId: string) => {
    onNavigateToItem(itemId);
    onClose();
  };

  const handleViewRecentContainer = () => {
    onNavigateToContainer();
    onClose();
  };

  if (!scanResult) {
    return null;
  }

  const { container, items, itemCount, scannedAt } = scanResult;
  const displayItems = showAllItems ? items : items.slice(0, 5);
  const totalValue = items.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px', maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <CheckCircleIcon color="success" />
            <Typography variant="h6">QR Code Scan Successful</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" gap={3}>
          {/* Container Information Card */}
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <InventoryIcon />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="h6" gutterBottom>
                    {container.name}
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip
                      size="small"
                      label={container.type}
                      color="primary"
                      variant="outlined"
                    />
                    {container.status && (
                      <Chip
                        size="small"
                        label={container.status}
                        color="secondary"
                        variant="outlined"
                      />
                    )}
                    {container.handlingFlags && container.handlingFlags.length > 0 && (
                      container.handlingFlags.map((flag) => (
                        <HandlingFlagChip
                          key={flag}
                          flag={flag}
                          size="small"
                          variant="outlined"
                          showIcon={true}
                          showLabel={true}
                        />
                      ))
                    )}
                  </Box>
                </Box>
              </Box>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary">
                      {itemCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Items
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">
                      {formatCurrency(totalValue)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Value
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="body1">
                      <QrCodeIcon sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                      {scanResult.scanResult.qrCodeId.split('_')[1] || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Container ID
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box textAlign="center">
                    <Typography variant="body1">
                      <ScheduleIcon sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                      {formatDate(scannedAt)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Scanned At
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {container.description && (
                <Box mt={2}>
                  <Typography variant="body2" color="text.secondary">
                    {container.description}
                  </Typography>
                </Box>
              )}
            </CardContent>

            <CardActions>
              <Button
                startIcon={<ViewIcon />}
                onClick={handleViewContainer}
                variant="contained"
              >
                View Container Details
              </Button>
              <Button
                startIcon={<EditIcon />}
                onClick={handleViewContainer}
                variant="outlined"
              >
                Manage Items
              </Button>
            </CardActions>
          </Card>

          {/* Container Items */}
          <Card elevation={1}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6">
                  Container Contents ({itemCount} items)
                </Typography>
                {items.length > 5 && (
                  <Button
                    size="small"
                    onClick={() => setShowAllItems(!showAllItems)}
                    endIcon={showAllItems ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  >
                    {showAllItems ? 'Show Less' : `Show All (${items.length})`}
                  </Button>
                )}
              </Box>

              {items.length === 0 ? (
                <Alert severity="info">
                  This container is empty.
                </Alert>
              ) : (
                <List>
                  {displayItems.map((item, index) => (
                    <React.Fragment key={item.id}>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'secondary.main' }}>
                            {item.categoryId ? (
                              <CategoryIcon />
                            ) : (
                              <InventoryIcon />
                            )}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={item.name}
                          secondary={
                            <Box>
                              {item.categoryId && (
                                <Typography variant="body2" color="text.secondary">
                                  Category ID: {item.categoryId}
                                </Typography>
                              )}
                              {item.purchasePrice && (
                                <Typography variant="body2" color="success.main">
                                  Value: {formatCurrency(item.purchasePrice)}
                                </Typography>
                              )}
                              {item.description && (
                                <Typography variant="body2" color="text.secondary" noWrap>
                                  {item.description}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={() => handleViewItem(item.id)}
                            size="small"
                          >
                            <ViewIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                      {index < displayItems.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}

              <Collapse in={showAllItems}>
                {showAllItems && items.length > 5 && (
                  <List>
                    {items.slice(5).map((item) => (
                      <React.Fragment key={item.id}>
                        <Divider />
                        <ListItem>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'secondary.main' }}>
                              {item.categoryId ? (
                                <CategoryIcon />
                              ) : (
                                <InventoryIcon />
                              )}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={item.name}
                            secondary={
                              <Box>
                                {item.categoryId && (
                                  <Typography variant="body2" color="text.secondary">
                                    Category ID: {item.categoryId}
                                  </Typography>
                                )}
                                {item.purchasePrice && (
                                  <Typography variant="body2" color="success.main">
                                    Value: {formatCurrency(item.purchasePrice)}
                                  </Typography>
                                )}
                                {item.description && (
                                  <Typography variant="body2" color="text.secondary" noWrap>
                                    {item.description}
                                  </Typography>
                                )}
                              </Box>
                            }
                          />
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              onClick={() => handleViewItem(item.id)}
                              size="small"
                            >
                              <ViewIcon />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </Collapse>
            </CardContent>
          </Card>

          {/* Recent Scans */}
          {recentScans.length > 0 && (
            <Card elevation={1}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <HistoryIcon />
                  <Typography variant="h6">Recent Scans</Typography>
                </Box>

                <List dense>
                  {recentScans.map((scan, index) => (
                    <React.Fragment key={`${scan.containerId}-${scan.timestamp}`}>
                      <ListItem
                        component="button"
                        onClick={() => handleViewRecentContainer()}
                        sx={{ cursor: 'pointer' }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'grey.300', width: 32, height: 32 }}>
                            <QrCodeIcon fontSize="small" />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={scan.containerName}
                          secondary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body2" color="text.secondary">
                                {scan.itemCount} items • {formatDate(scan.timestamp)}
                              </Typography>
                              <Chip
                                size="small"
                                label={scan.method}
                                variant="outlined"
                                sx={{ height: 16, fontSize: '0.7rem' }}
                              />
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewRecentContainer();
                            }}
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                      {index < recentScans.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
        <Button
          variant="contained"
          onClick={handleViewContainer}
          startIcon={<ViewIcon />}
        >
          View Container
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QRScanResults;