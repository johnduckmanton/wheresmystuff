import React, { useState } from 'react';
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
  Tooltip,
  Paper,
} from '@mui/material';
import {
  QrCode as QrCodeIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import type { Container } from '../types';
import apiClient from '../services/api';
import S3Image from './S3Image';

interface QRCodeGeneratorProps {
  open: boolean;
  onClose: () => void;
  container: Container;
  inventoryId: string;
  onQRCodeGenerated?: (qrCodeData: any) => void;
}

interface QRCodeData {
  qrCodeId: string;
  s3Key: string;
  size: string;
  containerId: string;
  generatedAt: string;
  downloadUrl: string;
}

/**
 * QR Code Generator Component
 * Generates QR codes for containers with size options and printable labels
 * Validates: Requirements 4.1, 4.2, 4.3, 4.5
 */
const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({
  open,
  onClose,
  container,
  inventoryId,
  onQRCodeGenerated,
}) => {
  const [selectedSize, setSelectedSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [qrCodeData, setQRCodeData] = useState<QRCodeData | null>(null);
  const [labelData, setLabelData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<'qr' | 'label' | null>(null);

  const sizeOptions = [
    { value: 'small', label: 'Small (2x2 inches)', description: '150x150 pixels' },
    { value: 'medium', label: 'Medium (3x3 inches)', description: '200x200 pixels' },
    { value: 'large', label: 'Large (4x4 inches)', description: '300x300 pixels' },
  ];

  const handleGenerateQRCode = async () => {
    setLoading(true);
    setGenerating('qr');
    setError(null);

    try {
      console.log('🔍 QR Code Generation Debug:');
      console.log('- Container ID:', container.id);
      console.log('- Inventory ID:', inventoryId);
      console.log('- Selected Size:', selectedSize);
      console.log('- API Client:', apiClient);
      
      const result = await apiClient.generateQRCode(container.id, inventoryId, selectedSize);
      
      console.log('✅ QR Code generation successful:', result);
      setQRCodeData(result);
      
      if (onQRCodeGenerated) {
        onQRCodeGenerated(result);
      }
    } catch (err) {
      console.error('❌ Error generating QR code:', err);
      console.error('Error type:', typeof err);
      
      // Enhanced error logging with proper type checking
      if (err && typeof err === 'object' && 'constructor' in err) {
        console.error('Error constructor:', (err as any).constructor.name);
      }
      if (err instanceof Error) {
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
      } else {
        console.error('Error message:', String(err));
      }
      console.error('Full error object:', err);
      
      setError(err instanceof Error ? err.message : 'Failed to generate QR code');
    } finally {
      setLoading(false);
      setGenerating(null);
    }
  };

  const handleGenerateLabel = async () => {
    setLoading(true);
    setGenerating('label');
    setError(null);

    try {
      const result = await apiClient.generateLabel(container.id, selectedSize, inventoryId);
      setLabelData(result);
    } catch (err) {
      console.error('Error generating label:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate printable label');
    } finally {
      setLoading(false);
      setGenerating(null);
    }
  };

  const handleDownload = (downloadUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = (downloadUrl: string) => {
    const printWindow = window.open(downloadUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleClose = () => {
    setQRCodeData(null);
    setLabelData(null);
    setError(null);
    setGenerating(null);
    onClose();
  };

  const getSizeDescription = (size: string) => {
    const option = sizeOptions.find(opt => opt.value === size);
    return option ? option.description : '';
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QrCodeIcon />
          <Typography variant="h6">
            Generate QR Code & Label
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Container Information */}
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle1" gutterBottom>
            Container Information
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Name: <strong>{container.name}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Type: <strong>{container.type}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Items: <strong>{container.itemCount}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Status: <Chip label={container.status} size="small" />
            </Typography>
          </Box>
        </Paper>

        {/* Size Selection */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>QR Code Size</InputLabel>
          <Select
            value={selectedSize}
            label="QR Code Size"
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
            startIcon={generating === 'qr' ? <CircularProgress size={20} /> : <QrCodeIcon />}
            onClick={handleGenerateQRCode}
            disabled={loading}
            sx={{ py: 1.5 }}
          >
            {generating === 'qr' ? 'Generating...' : 'Generate QR Code'}
          </Button>
          <Button
            variant="outlined"
            fullWidth
            startIcon={generating === 'label' ? <CircularProgress size={20} /> : <PrintIcon />}
            onClick={handleGenerateLabel}
            disabled={loading}
            sx={{ py: 1.5 }}
          >
            {generating === 'label' ? 'Generating...' : 'Generate Printable Label'}
          </Button>
        </Box>

        {/* QR Code Preview */}
        {qrCodeData && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <QrCodeIcon />
                QR Code Generated
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <S3Image
                    src={qrCodeData.downloadUrl}
                    alt="Generated QR Code"
                    maxWidth="200px"
                    maxHeight="200px"
                    fallbackText="QR Code generated successfully!"
                  />
                </Box>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    <strong>Size:</strong> {qrCodeData.size} ({getSizeDescription(qrCodeData.size)})
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>QR Code ID:</strong>
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {qrCodeData.qrCodeId}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Generated:</strong> {new Date(qrCodeData.generatedAt).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
            <CardActions>
              <Button
                startIcon={<DownloadIcon />}
                onClick={() => handleDownload(qrCodeData.downloadUrl, `qr-code-${container.name}-${qrCodeData.size}.png`)}
              >
                Download
              </Button>
              <Button
                startIcon={<PrintIcon />}
                onClick={() => handlePrint(qrCodeData.downloadUrl)}
              >
                Print
              </Button>
              <Tooltip title="Generate new QR code">
                <IconButton onClick={handleGenerateQRCode} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </CardActions>
          </Card>
        )}

        {/* Label Preview */}
        {labelData && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PrintIcon />
                Printable Label Generated
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <S3Image
                    src={labelData.downloadUrl}
                    alt="Generated Label"
                    maxWidth="250px"
                    maxHeight="250px"
                    fallbackText="Label generated successfully!"
                  />
                </Box>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    <strong>Size:</strong> {labelData.size} ({getSizeDescription(labelData.size)})
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Format:</strong> Print-optimized PNG
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Includes:</strong> QR Code, Container Name, Type, Creation Date
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Generated:</strong> {new Date(labelData.generatedAt).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
            <CardActions>
              <Button
                startIcon={<DownloadIcon />}
                onClick={() => handleDownload(labelData.downloadUrl, `label-${container.name}-${labelData.size}.png`)}
              >
                Download
              </Button>
              <Button
                startIcon={<PrintIcon />}
                onClick={() => handlePrint(labelData.downloadUrl)}
                variant="contained"
              >
                Print Label
              </Button>
              <Tooltip title="Generate new label">
                <IconButton onClick={handleGenerateLabel} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </CardActions>
          </Card>
        )}

        {/* Instructions */}
        {!qrCodeData && !labelData && !loading && (
          <Paper sx={{ p: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
            <Typography variant="body2">
              <strong>Instructions:</strong>
            </Typography>
            <Typography variant="body2" component="ul" sx={{ mt: 1, pl: 2 }}>
              <li>Select your preferred size for the QR code</li>
              <li>Generate a QR code for digital scanning</li>
              <li>Generate a printable label with container information</li>
              <li>Download or print directly from the preview</li>
              <li>Attach the printed label to your container</li>
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

export default QRCodeGenerator;