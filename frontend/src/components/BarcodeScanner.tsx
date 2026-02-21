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
} from '@mui/icons-material';
import { Html5Qrcode } from 'html5-qrcode';

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
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);

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
    };
  }, [open, manualEntry]);

  const initializeScanner = async () => {
    try {
      setError('');
      const html5QrCode = new Html5Qrcode(scannerId);
      setScanner(html5QrCode);

      // Start scanning
      await html5QrCode.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps: 10,
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
      setError(
        err.message || 'Failed to access camera. Please check permissions.'
      );
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
            <Alert severity="error" onClose={() => setError('')}>
              {error}
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
                onKeyPress={(e) => {
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
