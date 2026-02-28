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
  FlashOn as FlashOnIcon,
  FlashOff as FlashOffIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
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
  const [, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');


  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize QR code reader
  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();
    
    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    };
  }, []);

  // Get available camera devices
  const getDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      
      if (videoDevices.length > 0 && !selectedDeviceId) {
        // Prefer back camera if available
        const backCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        );
        setSelectedDeviceId(backCamera?.deviceId || videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Error getting camera devices:', error);
      setHasCamera(false);
    }
  }, [selectedDeviceId]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    setIsScanning(false);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (readerRef.current) {
      readerRef.current.reset();
    }

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);

  // Handle successful QR code scan
  const handleScanResult = useCallback(async (qrCodeData: string) => {
    if (isProcessing) return;

    setIsProcessing(true);
    setScanError(null);
    setManualError(null);
    stopCamera();

    try {
      // Call API to scan QR code and get container contents
      // Pass inventoryId as optional - backend will find container across all user inventories
      const result = await apiClient.scanQRCode(qrCodeData, inventoryId) as ScanResult;
      onScanSuccess(result);
      onClose();

    } catch (error) {
      console.error('Error processing QR scan:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process QR code';
      
      // Set error based on which tab is active
      if (tabValue === 0) {
        setScanError(errorMessage);
      } else {
        setManualError(errorMessage);
      }
      
      setIsProcessing(false);
    }
  }, [isProcessing, inventoryId, onScanSuccess, onClose, tabValue, stopCamera]);

  // Start QR code scanning
  const startScanning = useCallback(() => {
    if (!readerRef.current || !videoRef.current || !isScanning) return;

    const codeReader = readerRef.current;
    const videoElement = videoRef.current;
    const deviceId = selectedDeviceId || null;

    console.log('Starting QR code scanning with device:', deviceId);

    // Use decodeFromVideoDevice for continuous scanning
    codeReader.decodeFromVideoDevice(
      deviceId,
      videoElement,
      (result, error) => {
        if (result) {
          // Successfully decoded a QR code
          const text = result.getText();
          console.log('QR code detected:', text);
          if (text) {
            handleScanResult(text);
          }
        }
        // Ignore NotFoundException - it's normal when no QR code is in frame
        if (error && !(error instanceof NotFoundException)) {
          console.error('Scanning error:', error);
        }
      }
    ).catch((err) => {
      console.error('Failed to start decoding:', err);
      setScanError('Failed to start QR code detection');
    });
  }, [isScanning, selectedDeviceId, handleScanResult]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    if (!videoRef.current || !readerRef.current) return;

    console.log('Starting camera...');

    try {
      setScanError(null);

      // Reset the reader first
      readerRef.current.reset();
      console.log('Reader reset');

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          facingMode: selectedDeviceId ? undefined : { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      };

      console.log('Camera constraints:', constraints);

      // Add flash constraint if supported
      if (flashEnabled) {
        (constraints.video as MediaTrackConstraints & { torch?: boolean }).torch = true;
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      console.log('Camera stream obtained');

      // Wait for video to be ready and start scanning
      await videoRef.current.play();
      console.log('Video playing');
      
      // Set scanning state after video is playing
      setIsScanning(true);
      
      // Start scanning after a short delay to ensure video is ready
      setTimeout(() => {
        console.log('Calling startScanning...');
        startScanning();
      }, 100);

    } catch (error) {
      console.error('Error starting camera:', error);
      setIsScanning(false);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setScanError('Camera permission denied. Please allow camera access and try again.');
        } else if (error.name === 'NotFoundError') {
          setScanError('No camera found. Please connect a camera and try again.');
          setHasCamera(false);
        } else if (error.name === 'NotReadableError') {
          setScanError('Camera is being used by another application. Please close other apps and try again.');
        } else {
          setScanError(`Camera error: ${error.message}`);
        }
      } else {
        setScanError('Failed to access camera. Please check your camera permissions.');
      }
    }
  }, [selectedDeviceId, flashEnabled, startScanning]);

  // Toggle flash
  const toggleFlash = useCallback(async () => {
    if (!streamRef.current) return;

    try {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
      
      if (capabilities.torch) {
        await track.applyConstraints({
          advanced: [{ torch: !flashEnabled } as MediaTrackConstraints & { torch?: boolean }]
        });
        setFlashEnabled(!flashEnabled);
      }
    } catch (error) {
      console.error('Error toggling flash:', error);
    }
  }, [flashEnabled]);

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (newValue === 0) {
      // Switching to camera tab
      setScanError(null);
      setManualError(null);
    } else {
      // Switching to manual tab
      stopCamera();
      setManualError(null);
    }
  };

  // Initialize devices when dialog opens
  useEffect(() => {
    if (open) {
      getDevices();
      setTabValue(0);
      setScanError(null);
      setManualError(null);
      setManualCode('');
      setIsProcessing(false);
    } else {
      stopCamera();
    }
  }, [open, getDevices, stopCamera]);

  // Start camera when switching to camera tab
  useEffect(() => {
    if (open && tabValue === 0 && hasCamera && !isScanning) {
      const timer = setTimeout(() => {
        startCamera();
      }, 500); // Small delay to ensure video element is ready

      return () => clearTimeout(timer);
    }
  }, [open, tabValue, hasCamera, isScanning, startCamera]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
            onClick={onClose} 
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
                  <video
                    ref={videoRef}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    playsInline
                    muted
                  />
                  
                  {/* Scanning overlay */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      border: '2px solid transparent',
                      borderImage: 'linear-gradient(45deg, #2196f3, #21cbf3) 1',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '200px',
                        height: '200px',
                        transform: 'translate(-50%, -50%)',
                        border: '2px solid #2196f3',
                        borderRadius: '8px',
                        animation: isScanning ? 'pulse 2s infinite' : 'none',
                      },
                      '@keyframes pulse': {
                        '0%': { opacity: 0.5 },
                        '50%': { opacity: 1 },
                        '100%': { opacity: 0.5 },
                      },
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
                    onClick={isScanning ? stopCamera : startCamera}
                    disabled={isProcessing}
                    startIcon={isScanning ? <RefreshIcon /> : <CameraIcon />}
                    fullWidth={isMobile}
                    className={isMobile ? 'mobile-touch-button' : ''}
                    sx={{ minHeight: isMobile ? 48 : 36 }}
                  >
                    {isScanning ? 'Stop' : 'Start'} Camera
                  </Button>

                  {devices.length > 0 && (
                    <IconButton
                      onClick={toggleFlash}
                      disabled={!isScanning}
                      title={flashEnabled ? 'Turn off flash' : 'Turn on flash'}
                      className={isMobile ? 'mobile-touch-icon-button' : ''}
                      sx={{
                        bgcolor: flashEnabled ? 'primary.main' : 'transparent',
                        color: flashEnabled ? 'primary.contrastText' : 'inherit',
                        '&:hover': {
                          bgcolor: flashEnabled ? 'primary.dark' : 'action.hover',
                        },
                      }}
                    >
                      {flashEnabled ? <FlashOffIcon /> : <FlashOnIcon />}
                    </IconButton>
                  )}
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
          onClick={onClose} 
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