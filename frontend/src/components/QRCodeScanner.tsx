import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  QrCodeScanner as QrCodeScannerIcon,
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Html5Qrcode } from 'html5-qrcode';
import type { Container, ThingWithContainer } from '../types';
import apiClient from '../services/api';
import { useMobileDetection } from '../hooks/useMobileDetection';
import AlternativeQRInput from './accessibility/AlternativeQRInput';

interface QRCodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScanSuccess: (result: ScanResult) => void;
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
  inventoryId: string; // The actual inventory ID where the container was found
  scannedAt: string;
}

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
      id={`scanner-tabpanel-${index}`}
      aria-labelledby={`scanner-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

/**
 * QR Code Scanner Component
 * Implements camera-based QR code scanning with manual entry fallback
 * Validates: Requirements 6.1, 6.3, 6.4
 */
const QRCodeScanner: React.FC<QRCodeScannerProps> = ({
  open,
  onClose,
  onScanSuccess,
  inventoryId,
}) => {
  const { isMobile } = useMobileDetection();
  const [tabValue, setTabValue] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = 'qr-reader';

  // Initialize scanner
  useEffect(() => {
    if (open && tabValue === 0) {
      initializeScanner();
    }

    return () => {
      cleanupScanner();
    };
  }, [open, tabValue]);

  // Get available camera devices
  const getDevices = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      
      if (devices.length > 0 && !selectedDeviceId) {
        // Prefer back camera if available
        const backCamera = devices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        );
        setSelectedDeviceId(backCamera?.id || devices[0].id);
      }
      
      if (devices.length === 0) {
        setHasCamera(false);
        setScanError('No camera found on this device');
      }
    } catch (error) {
      console.error('Error getting camera devices:', error);
      setHasCamera(false);
      setScanError('Unable to access camera devices');
    }
  }, [selectedDeviceId]);

  // Initialize the scanner
  const initializeScanner = useCallback(async () => {
    try {
      // Wait for DOM element to be available
      const element = document.getElementById(scannerDivId);
      if (!element) {
        console.error('Scanner div not found, retrying...');
        setTimeout(() => initializeScanner(), 100);
        return;
      }

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerDivId);
      }
      
      await getDevices();
    } catch (error) {
      console.error('Error initializing scanner:', error);
      setScanError('Failed to initialize camera');
    }
  }, [getDevices]);

  // Start scanning
  const startScanning = useCallback(async () => {
    if (!scannerRef.current || isScanning) return;

    try {
      setScanError(null);
      setIsScanning(true);

      const deviceId = selectedDeviceId || { facingMode: 'environment' };
      
      await scannerRef.current.start(
        deviceId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Success callback - QR code detected
          handleScanResult(decodedText);
        },
        () => {
          // Error callback - ignore, this fires constantly when no QR code is visible
        }
      );
    } catch (error) {
      console.error('Error starting scanner:', error);
      setIsScanning(false);
      
      if (error instanceof Error) {
        if (error.message.includes('NotAllowedError') || error.message.includes('Permission')) {
          setScanError('Camera permission denied. Please allow camera access and try again.');
        } else if (error.message.includes('NotFoundError')) {
          setScanError('No camera found. Please connect a camera and try again.');
          setHasCamera(false);
        } else if (error.message.includes('NotReadableError')) {
          setScanError('Camera is being used by another application.');
        } else {
          setScanError(`Camera error: ${error.message}`);
        }
      } else {
        setScanError('Failed to access camera');
      }
    }
  }, [isScanning, selectedDeviceId]);

  // Stop scanning
  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        // Check if scanner is actually running before trying to stop
        const state = scannerRef.current.getState();
        if (state === 2) { // 2 = SCANNING state
          await scannerRef.current.stop();
          console.log('✅ Camera stopped successfully');
        }
        setIsScanning(false);
      } catch (error) {
        console.error('Error stopping scanner:', error);
        // Force state update even if stop fails
        setIsScanning(false);
      }
    } else {
      setIsScanning(false);
    }
  }, []);

  // Cleanup scanner
  const cleanupScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        // Check if scanner is running and stop it
        const state = scannerRef.current.getState();
        if (state === 2) { // 2 = SCANNING state
          await scannerRef.current.stop();
          console.log('✅ Camera stopped during cleanup');
        }
        
        // Clear the scanner instance
        await scannerRef.current.clear();
        console.log('✅ Scanner cleared');
      } catch (error) {
        console.error('Error during cleanup:', error);
        // Continue cleanup even if there's an error
      }
      
      scannerRef.current = null;
    }
    
    setIsScanning(false);
  }, []);

  // Handle successful QR code scan
  const handleScanResult = useCallback(async (qrCodeData: string) => {
    if (isProcessing) return;

    setIsProcessing(true);
    setScanError(null);
    setManualError(null);
    
    // Stop scanning immediately
    await stopScanning();

    try {
      const result = await apiClient.scanQRCode(qrCodeData, inventoryId) as ScanResult;
      onScanSuccess(result);
      onClose();
    } catch (error) {
      console.error('Error processing QR scan:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process QR code';
      
      if (tabValue === 0) {
        setScanError(errorMessage);
      } else {
        setManualError(errorMessage);
      }
      
      setIsProcessing(false);
      // Don't auto-restart scanning - let user manually restart if needed
    }
  }, [isProcessing, inventoryId, onScanSuccess, onClose, tabValue, stopScanning]);

  // Handle tab change
  const handleTabChange = async (_event: React.SyntheticEvent, newValue: number) => {
    if (newValue === 0 && tabValue !== 0) {
      // Switching to camera tab
      setTabValue(newValue);
      setTimeout(() => initializeScanner(), 500);
    } else if (newValue !== 0 && tabValue === 0) {
      // Switching away from camera tab
      await cleanupScanner();
      setTabValue(newValue);
    } else {
      setTabValue(newValue);
    }
  };

  // Handle dialog close
  const handleClose = async () => {
    await cleanupScanner();
    onClose();
  };

  // Initialize scanner when dialog opens
  useEffect(() => {
    if (open && tabValue === 0) {
      // Delay initialization to ensure DOM is ready
      const timer = setTimeout(async () => {
        await initializeScanner();
        // Auto-start scanning after initialization if we have a device
        if (selectedDeviceId) {
          setTimeout(() => startScanning(), 500);
        }
      }, 300);
      
      return () => {
        clearTimeout(timer);
        cleanupScanner();
      };
    } else if (!open) {
      cleanupScanner();
    }
  }, [open, tabValue, selectedDeviceId, initializeScanner, startScanning, cleanupScanner]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={isMobile ? false : "sm"}
      fullWidth
      fullScreen={isMobile}
      sx={{
        '& .MuiDialog-paper': {
          minHeight: isMobile ? '100vh' : '500px',
          margin: isMobile ? 0 : undefined,
          borderRadius: isMobile ? 0 : undefined,
        }
      }}
      className={isMobile ? 'mobile-qr-scanner' : ''}
    >
      <DialogTitle sx={{ 
        p: isMobile ? 2 : 3,
        borderBottom: 1,
        borderColor: 'divider',
      }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <QrCodeScannerIcon />
            <Typography variant={isMobile ? 'h6' : 'h6'}>
              Scan QR Code
            </Typography>
          </Box>
          <IconButton 
            onClick={handleClose} 
            size="small"
            className={isMobile ? 'mobile-touch-icon-button' : ''}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ 
        p: isMobile ? 1 : 3,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant={isMobile ? 'fullWidth' : 'standard'}
            sx={{
              '& .MuiTab-root': {
                minHeight: isMobile ? 56 : 48,
                fontSize: isMobile ? '0.875rem' : '0.875rem',
              }
            }}
          >
            <Tab 
              icon={<CameraIcon />} 
              label={isMobile ? "Camera" : "Camera Scan"}
              disabled={!hasCamera}
            />
            <Tab 
              icon={<EditIcon />} 
              label={isMobile ? "Manual" : "Manual Entry"}
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          {/* Camera Scanning Tab */}
          <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            {!hasCamera ? (
              <Alert severity="warning">
                No camera detected. Please use manual entry or connect a camera.
              </Alert>
            ) : (
              <>
                <Paper
                  elevation={2}
                  sx={{
                    width: '100%',
                    maxWidth: isMobile ? '100%' : 400,
                    height: isMobile ? 'calc(100vh - 300px)' : 300,
                    minHeight: isMobile ? 250 : 300,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative',
                    bgcolor: 'black',
                    borderRadius: isMobile ? 2 : 1,
                  }}
                >
                  <div
                    id={scannerDivId}
                    style={{
                      width: '100%',
                      height: '100%',
                    }}
                  />

                  {/* Loading indicator */}
                  {isProcessing && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        bgcolor: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <CircularProgress color="primary" />
                      <Typography color="white">Processing QR code...</Typography>
                    </Box>
                  )}
                </Paper>

                {/* Camera controls */}
                <Box 
                  display="flex" 
                  gap={isMobile ? 2 : 1} 
                  alignItems="center"
                  flexDirection={isMobile ? 'column' : 'row'}
                  width={isMobile ? '100%' : 'auto'}
                >
                  <Button
                    variant="outlined"
                    onClick={isScanning ? stopScanning : startScanning}
                    disabled={isProcessing}
                    startIcon={isScanning ? <RefreshIcon /> : <CameraIcon />}
                    fullWidth={isMobile}
                    className={isMobile ? 'mobile-touch-button' : ''}
                    sx={{ minHeight: isMobile ? 48 : 36 }}
                  >
                    {isScanning ? 'Stop' : 'Start'} Camera
                  </Button>
                </Box>

                {scanError && (
                  <Alert severity="error" sx={{ width: '100%' }}>
                    {scanError}
                  </Alert>
                )}

                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  textAlign="center"
                  sx={{ 
                    px: isMobile ? 2 : 0,
                    fontSize: isMobile ? '0.875rem' : '0.875rem',
                  }}
                >
                  Position the QR code within the scanning area. The camera will automatically detect and scan the code.
                </Typography>
              </>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Manual Entry Tab */}
          {manualError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {manualError}
            </Alert>
          )}
          <AlternativeQRInput
            onQRCodeEntered={handleScanResult}
            onError={(error) => setManualError(error)}
            disabled={isProcessing}
          />
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ 
        p: isMobile ? 2 : 3,
        borderTop: 1,
        borderColor: 'divider',
      }}>
        <Button 
          onClick={handleClose} 
          disabled={isProcessing}
          fullWidth={isMobile}
          className={isMobile ? 'mobile-touch-button' : ''}
          sx={{ minHeight: isMobile ? 48 : 36 }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QRCodeScanner;