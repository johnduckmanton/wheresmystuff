import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  CardActions,

  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  LinearProgress,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  QrCode as QrCodeIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Inventory as ContainerIcon,
  SelectAll as SelectAllIcon,
} from '@mui/icons-material';
import type { Container } from '../types';
import apiClient from '../services/api';

interface BatchQRCodeGeneratorProps {
  open: boolean;
  onClose: () => void;
  containers: Container[];
  onBatchGenerated?: (results: any) => void;
}

interface BatchResult {
  successful: Array<{
    qrCodeId: string;
    s3Key: string;
    size: string;
    containerId: string;
    generatedAt: string;
    downloadUrl: string;
  }>;
  failed: Array<{
    containerId: string;
    error: string;
  }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

interface BatchLabelResult {
  type: 'sheet' | 'individual';
  s3Key?: string;
  downloadUrl?: string;
  containerCount?: number;
  successful?: Array<{
    containerId: string;
    s3Key: string;
    size: string;
    downloadUrl: string;
    generatedAt: string;
  }>;
  failed?: Array<{
    containerId: string;
    error: string;
  }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  size: string;
  generatedAt: string;
}

/**
 * Batch QR Code Generator Component
 * Generates QR codes and labels for multiple containers
 * Validates: Requirements 4.4, 4.5
 */
const BatchQRCodeGenerator: React.FC<BatchQRCodeGeneratorProps> = ({
  open,
  onClose,
  containers,
  onBatchGenerated,
}) => {
  const [selectedContainers, setSelectedContainers] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [sheetFormat, setSheetFormat] = useState(false);
  const [qrResults, setQrResults] = useState<BatchResult | null>(null);
  const [labelResults, setLabelResults] = useState<BatchLabelResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentOperation, setCurrentOperation] = useState<'qr' | 'labels' | null>(null);

  const sizeOptions = [
    { value: 'small', label: 'Small (2x2 inches)', description: '150x150 pixels' },
    { value: 'medium', label: 'Medium (3x3 inches)', description: '200x200 pixels' },
    { value: 'large', label: 'Large (4x4 inches)', description: '300x300 pixels' },
  ];

  // Initialize with all containers selected
  useEffect(() => {
    if (containers.length > 0 && selectedContainers.length === 0) {
      setSelectedContainers(containers.map(c => c.id));
    }
  }, [containers, selectedContainers.length]);

  const handleSelectAll = () => {
    setSelectedContainers(containers.map(c => c.id));
  };

  const handleDeselectAll = () => {
    setSelectedContainers([]);
  };

  const handleContainerToggle = (containerId: string) => {
    setSelectedContainers(prev => 
      prev.includes(containerId)
        ? prev.filter(id => id !== containerId)
        : [...prev, containerId]
    );
  };

  const handleGenerateBatchQRCodes = async () => {
    if (selectedContainers.length === 0) {
      setError('Please select at least one container');
      return;
    }

    setLoading(true);
    setCurrentOperation('qr');
    setError(null);
    setProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await apiClient.generateBatchQRCodes(selectedContainers, selectedSize);
      
      clearInterval(progressInterval);
      setProgress(100);
      setQrResults(result);
      
      if (onBatchGenerated) {
        onBatchGenerated(result);
      }
    } catch (err) {
      console.error('Error generating batch QR codes:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate batch QR codes');
    } finally {
      setLoading(false);
      setCurrentOperation(null);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handleGenerateBatchLabels = async () => {
    if (selectedContainers.length === 0) {
      setError('Please select at least one container');
      return;
    }

    setLoading(true);
    setCurrentOperation('labels');
    setError(null);
    setProgress(0);

    try {
      // Prepare container data for label generation
      const containerData = selectedContainers.map(id => {
        const container = containers.find(c => c.id === id);
        return {
          id: container!.id,
          name: container!.name,
          type: container!.type,
          createdAt: container!.createdAt,
        };
      });

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 300);

      const result = await apiClient.generateBatchLabels(containerData, selectedSize, sheetFormat);
      
      clearInterval(progressInterval);
      setProgress(100);
      setLabelResults(result);
    } catch (err) {
      console.error('Error generating batch labels:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate batch labels');
    } finally {
      setLoading(false);
      setCurrentOperation(null);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handleDownloadAll = (results: BatchResult) => {
    results.successful.forEach((item, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = item.downloadUrl;
        link.download = `qr-code-${getContainerName(item.containerId)}-${item.size}.png`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 100); // Stagger downloads
    });
  };

  const handleDownloadSheet = (downloadUrl: string) => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `label-sheet-${selectedSize}-${new Date().toISOString().split('T')[0]}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintSheet = (downloadUrl: string) => {
    const printWindow = window.open(downloadUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const getContainerName = (containerId: string) => {
    const container = containers.find(c => c.id === containerId);
    return container ? container.name : containerId;
  };

  const handleClose = () => {
    setSelectedContainers([]);
    setQrResults(null);
    setLabelResults(null);
    setError(null);
    setCurrentOperation(null);
    setProgress(0);
    onClose();
  };



  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QrCodeIcon />
          <Typography variant="h6">
            Batch QR Code & Label Generation
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Container Selection */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1">
              Select Containers ({selectedContainers.length} of {containers.length} selected)
            </Typography>
            <Box>
              <Button
                size="small"
                startIcon={<SelectAllIcon />}
                onClick={handleSelectAll}
                sx={{ mr: 1 }}
              >
                Select All
              </Button>
              <Button
                size="small"
                onClick={handleDeselectAll}
              >
                Deselect All
              </Button>
            </Box>
          </Box>

          <Box sx={{ maxHeight: '200px', overflow: 'auto' }}>
            <List dense>
              {containers.map((container) => (
                <ListItem
                  key={container.id}
                  onClick={() => handleContainerToggle(container.id)}
                  sx={{ py: 0.5, cursor: 'pointer' }}
                >
                  <ListItemIcon>
                    <Checkbox
                      checked={selectedContainers.includes(container.id)}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemIcon>
                    <ContainerIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={container.name}
                    secondary={`${container.type} • ${container.itemCount} items • ${container.status}`}
                  />
                  <Chip label={container.status} size="small" />
                </ListItem>
              ))}
            </List>
          </Box>
        </Paper>

        {/* Generation Options */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3, mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel>Size</InputLabel>
            <Select
              value={selectedSize}
              label="Size"
              onChange={(e) => setSelectedSize(e.target.value as 'small' | 'medium' | 'large')}
              disabled={loading}
            >
              {sizeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Box>
                    <Typography variant="body1">{option.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={sheetFormat}
                  onChange={(e) => setSheetFormat(e.target.checked)}
                  disabled={loading}
                />
              }
              label="Generate as single sheet (labels only)"
            />
            <Typography variant="caption" display="block" color="text.secondary">
              Combine multiple labels on one printable sheet
            </Typography>
          </Box>
        </Box>

        {/* Progress */}
        {loading && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" gutterBottom>
              {currentOperation === 'qr' ? 'Generating QR codes...' : 'Generating labels...'}
            </Typography>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary">
              Processing {selectedContainers.length} containers
            </Typography>
          </Box>
        )}

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Generation Buttons */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 3 }}>
          <Button
            variant="contained"
            fullWidth
            startIcon={loading && currentOperation === 'qr' ? <CircularProgress size={20} /> : <QrCodeIcon />}
            onClick={handleGenerateBatchQRCodes}
            disabled={loading || selectedContainers.length === 0}
            sx={{ py: 1.5 }}
          >
            Generate QR Codes ({selectedContainers.length})
          </Button>
          <Button
            variant="outlined"
            fullWidth
            startIcon={loading && currentOperation === 'labels' ? <CircularProgress size={20} /> : <PrintIcon />}
            onClick={handleGenerateBatchLabels}
            disabled={loading || selectedContainers.length === 0}
            sx={{ py: 1.5 }}
          >
            Generate Labels ({selectedContainers.length})
          </Button>
        </Box>

        {/* QR Code Results */}
        {qrResults && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <QrCodeIcon />
                QR Code Generation Results
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, mb: 2 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {qrResults.successCount}
                  </Typography>
                  <Typography variant="caption">Successful</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="error.main">
                    {qrResults.failureCount}
                  </Typography>
                  <Typography variant="caption">Failed</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4">
                    {qrResults.totalProcessed}
                  </Typography>
                  <Typography variant="caption">Total</Typography>
                </Box>
              </Box>

              {qrResults.successful.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Successfully Generated:
                  </Typography>
                  <Box sx={{ maxHeight: '150px', overflow: 'auto' }}>
                    {qrResults.successful.map((item) => (
                      <Box key={item.containerId} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                        <CheckCircleIcon color="success" fontSize="small" />
                        <Typography variant="body2">
                          {getContainerName(item.containerId)}
                        </Typography>
                        <Chip label={item.size} size="small" />
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {qrResults.failed.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="error">
                    Failed:
                  </Typography>
                  <Box sx={{ maxHeight: '100px', overflow: 'auto' }}>
                    {qrResults.failed.map((item) => (
                      <Box key={item.containerId} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                        <ErrorIcon color="error" fontSize="small" />
                        <Typography variant="body2">
                          {getContainerName(item.containerId)}: {item.error}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
            <CardActions>
              <Button
                startIcon={<DownloadIcon />}
                onClick={() => handleDownloadAll(qrResults)}
                disabled={qrResults.successCount === 0}
              >
                Download All ({qrResults.successCount})
              </Button>
            </CardActions>
          </Card>
        )}

        {/* Label Results */}
        {labelResults && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PrintIcon />
                Label Generation Results
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, mb: 2 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {labelResults.successCount}
                  </Typography>
                  <Typography variant="caption">Successful</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="error.main">
                    {labelResults.failureCount}
                  </Typography>
                  <Typography variant="caption">Failed</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4">
                    {labelResults.totalProcessed}
                  </Typography>
                  <Typography variant="caption">Total</Typography>
                </Box>
              </Box>

              <Typography variant="body2" gutterBottom>
                <strong>Format:</strong> {labelResults.type === 'sheet' ? 'Single Sheet' : 'Individual Labels'}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Size:</strong> {labelResults.size}
              </Typography>
              <Typography variant="body2">
                <strong>Generated:</strong> {new Date(labelResults.generatedAt).toLocaleString()}
              </Typography>

              {labelResults.type === 'sheet' && labelResults.downloadUrl && (
                <Box sx={{ mt: 2, textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <img
                    src={labelResults.downloadUrl}
                    alt="Label Sheet Preview"
                    style={{
                      maxWidth: '300px',
                      maxHeight: '200px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                </Box>
              )}
            </CardContent>
            <CardActions>
              {labelResults.type === 'sheet' && labelResults.downloadUrl ? (
                <>
                  <Button
                    startIcon={<DownloadIcon />}
                    onClick={() => handleDownloadSheet(labelResults.downloadUrl!)}
                  >
                    Download Sheet
                  </Button>
                  <Button
                    startIcon={<PrintIcon />}
                    onClick={() => handlePrintSheet(labelResults.downloadUrl!)}
                    variant="contained"
                  >
                    Print Sheet
                  </Button>
                </>
              ) : (
                <Button
                  startIcon={<DownloadIcon />}
                  onClick={() => {
                    labelResults.successful?.forEach((item, index) => {
                      setTimeout(() => {
                        const link = document.createElement('a');
                        link.href = item.downloadUrl;
                        link.download = `label-${getContainerName(item.containerId)}-${item.size}.png`;
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }, index * 100);
                    });
                  }}
                  disabled={!labelResults.successful || labelResults.successful.length === 0}
                >
                  Download All Labels ({labelResults.successCount})
                </Button>
              )}
            </CardActions>
          </Card>
        )}

        {/* Instructions */}
        {!qrResults && !labelResults && !loading && (
          <Paper sx={{ p: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
            <Typography variant="body2">
              <strong>Batch Generation Instructions:</strong>
            </Typography>
            <Typography variant="body2" component="ul" sx={{ mt: 1, pl: 2 }}>
              <li>Select the containers you want to generate QR codes/labels for</li>
              <li>Choose your preferred size (affects both QR codes and labels)</li>
              <li>For labels, optionally enable sheet format to combine multiple labels</li>
              <li>Generate QR codes for digital scanning or labels for printing</li>
              <li>Download individual files or use batch download</li>
              <li>Maximum 50 containers per batch operation</li>
            </Typography>
          </Paper>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchQRCodeGenerator;