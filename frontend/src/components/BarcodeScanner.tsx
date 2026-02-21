import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  Keyboard as KeyboardIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { Html5Qrcode } from 'html5-qrcode';
import {
  detectIOSContext,
  getIOSCameraConstraints,
  requestIOSCameraPermission,
  getIOSCameraDevices,
  selectPreferredIOSCamera,
  stopIOSCameraStream,
  getIOSCameraErrorMessage,
} from '../utils/iosCamera';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => void;
}

export default function BarcodeScanner({
  open,
  onClose,
  onBarcodeScanned,
}: BarcodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [error, setError] = useState<string>('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const scannerId = 'barcode-scanner-reader';

  // Initialize scanner when dialog opens
  useEffect(() => {
    if (open && !manualEntry && !scanner) {
      initializeScanner();
    }

    return () => {
      if (scanner) {
        stopScanning();
      }
      if (cameraStream) {
        stopIOSCameraStream(cameraStream);
        setCameraStream(null);
      }
    };
  }, [open, manualEntry]);

  const initializeScanner = async () => {
    try {
      setError('');
      setPermissionDenied(false);
      
      // Detect iOS context
      const iosContext = detectIOSContext();
      
      // For iOS, request camera permission with iOS-specific handling
      if (iosContext.isIOS) {
        // Get available cameras and select preferred one (back camera)
        const devices = await getIOSCameraDevices();
        const preferredDeviceId = selectPreferredIOSCamera(devices);
        
        // Request permission with iOS-optimized constraints
        const permissionResult = await requestIOSCameraPermission(preferredDeviceId);
        
        if (!permissionResult.success) {
          setPermissionDenied(true);
          setError(permissionResult.error || 'Camera access denied');
          return;
        }
        
        // Store the stream for cleanup
        if (permissionResult.stream) {
          setCameraStream(permissionResult.stream);
        }
      }

      const html5QrCode = new Html5Qrcode(scannerId);
      setScanner(html5QrCode);

      // Get iOS-optimized constraints or standard constraints
      const devices = await getIOSCameraDevices();
      const preferredDeviceId = selectPreferredIOSCamera(devices);
      // Note: constraints are used internally by the camera system
      getIOSCameraConstraints(preferredDeviceId);

      // Start scanning with appropriate constraints
      await html5QrCode.start(
        preferredDeviceId || { facingMode: 'environment' },
        {
          fps: iosContext.isIOS ? 30 : 10, // iOS performs better with 30fps
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.777778, // 16:9
        },
        (decodedText) => {
          // Barcode successfully scanned
          handleBarcodeDetected(decodedText);
        },
        (_errorMessage) => {
          // Scanning error (usually just "no barcode found")
          // Don't show these errors as they're normal during scanning
        }
      );

      setScanning(true);
    } catch (err: any) {
      console.error('Failed to initialize barcode scanner:', err);
      
      // Use iOS-specific error messages
      const errorMessage = getIOSCameraErrorMessage(err);
      
      // Check if this is a permission error
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        setPermissionDenied(true);
        setError(errorMessage);
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please connect a camera or use manual entry.');
      } else if (err.name === 'NotReadableError') {
        setError(errorMessage);
      } else {
        setError(errorMessage || 'Failed to access camera. Please check permissions or use manual entry.');
      }
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scanner && scanning) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      setScanning(false);
    }
    
    // Clean up iOS camera stream
    if (cameraStream) {
      stopIOSCameraStream(cameraStream);
      setCameraStream(null);
    }
  };

  const handleBarcodeDetected = async (barcode: string) => {
    console.log('Barcode detected:', barcode);
    
    // Stop scanning
    await stopScanning();
    
    // Pass barcode to parent
    onBarcodeScanned(barcode);
  };

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      onBarcodeScanned(manualBarcode.trim());
    }
  };

  const handleClose = async () => {
    await stopScanning();
    setManualEntry(false);
    setManualBarcode('');
    setError('');
    setPermissionDenied(false);
    onClose();
  };

  const toggleManualEntry = async () => {
    if (!manualEntry) {
      // Switching to manual entry - stop scanner
      await stopScanning();
      setManualEntry(true);
    } else {
      // Switching to camera - restart scanner
      setManualEntry(false);
      setManualBarcode('');
      initializeScanner();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="barcode-scanner-dialog-title"
    >
      <DialogTitle
        id="barcode-scanner-dialog-title"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6">
          {manualEntry ? 'Enter Barcode' : 'Scan Barcode'}
        </Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <Alert 
              severity={permissionDenied ? "warning" : "error"} 
              onClose={() => {
                setError('');
                setPermissionDenied(false);
              }}
              icon={permissionDenied ? <WarningIcon /> : undefined}
            >
              <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
                {error}
              </Typography>
              
              {permissionDenied && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    To enable camera access:
                  </Typography>
                  <Typography variant="body2" component="div" sx={{ pl: 2, mb: 1 }}>
                    <strong>Chrome/Edge:</strong> Click the camera icon in the address bar, then select "Allow"
                  </Typography>
                  <Typography variant="body2" component="div" sx={{ pl: 2, mb: 1 }}>
                    <strong>Safari:</strong> Go to Settings → Safari → Camera, then select "Allow"
                  </Typography>
                  <Typography variant="body2" component="div" sx={{ pl: 2, mb: 1 }}>
                    <strong>Firefox:</strong> Click the permissions icon in the address bar, then enable camera
                  </Typography>
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SettingsIcon />}
                      onClick={() => {
                        // Try to trigger browser settings (limited support)
                        window.open('about:preferences#privacy', '_blank');
                      }}
                    >
                      Browser Settings
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<KeyboardIcon />}
                      onClick={() => {
                        setError('');
                        setPermissionDenied(false);
                        toggleManualEntry();
                      }}
                    >
                      Use Manual Entry
                    </Button>
                  </Box>
                </Box>
              )}
            </Alert>
          )}

          {!manualEntry ? (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Position the barcode within the frame. Supports UPC, EAN, and
                ISBN barcodes.
              </Typography>

              {/* Scanner container */}
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  minHeight: 300,
                  bgcolor: 'black',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <div id={scannerId} style={{ width: '100%' }} />

                {!scanning && !error && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                    }}
                  >
                    <CircularProgress sx={{ color: 'white' }} />
                    <Typography
                      variant="body2"
                      sx={{ color: 'white', mt: 2 }}
                    >
                      Initializing camera...
                    </Typography>
                  </Box>
                )}
              </Box>

              <Button
                variant="outlined"
                startIcon={<KeyboardIcon />}
                onClick={toggleManualEntry}
                fullWidth
              >
                Enter Barcode Manually
              </Button>
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Enter the barcode number manually (UPC, EAN, or ISBN).
              </Typography>

              <TextField
                label="Barcode Number"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="e.g., 9780743273565"
                fullWidth
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleManualSubmit();
                  }
                }}
                helperText="Enter 10-13 digit barcode number"
              />

              <Button
                variant="outlined"
                startIcon={<CameraIcon />}
                onClick={toggleManualEntry}
                fullWidth
              >
                Use Camera Instead
              </Button>
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {manualEntry && (
          <Button
            onClick={handleManualSubmit}
            variant="contained"
            disabled={!manualBarcode.trim()}
          >
            Lookup Barcode
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
