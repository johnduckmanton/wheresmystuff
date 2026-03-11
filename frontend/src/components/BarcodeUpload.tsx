import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  Alert,
  Stack,
} from '@mui/material';
import {
  QrCodeScanner as BarcodeScanIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';
import { useInventory } from '../contexts/InventoryContext';
import BarcodeScanner from './BarcodeScanner';
import BarcodeItemPreview from './BarcodeItemPreview';
import type { Thing } from '../types';

interface BarcodeUploadProps {
  onBarcodeComplete: (itemData: Partial<Thing>) => void;
  onCancel?: () => void; // Optional callback when user cancels
}

export default function BarcodeUpload({ onBarcodeComplete, onCancel }: BarcodeUploadProps) {
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [barcodePreviewOpen, setBarcodePreviewOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');

  const { showError, showSuccess } = useNotification();
  const { currentInventory } = useInventory();

  const handleBarcodeScanned = (barcode: string) => {
    console.log('Barcode scanned:', barcode);
    setScannedBarcode(barcode);
    setBarcodeScannerOpen(false);
    setBarcodePreviewOpen(true);
  };

  const handleManualLookup = () => {
    if (!manualBarcode.trim()) {
      showError('Please enter a barcode');
      return;
    }
    setScannedBarcode(manualBarcode.trim());
    setBarcodePreviewOpen(true);
  };

  const handleBarcodeAccept = (itemData: any) => {
    setBarcodePreviewOpen(false);
    setManualBarcode('');
    setScannedBarcode('');
    onBarcodeComplete(itemData);
    showSuccess('Barcode data loaded! Review and save the item.');
  };

  const handlePreviewClose = () => {
    setBarcodePreviewOpen(false);
    setScannedBarcode('');
    // Call onCancel to close the entire barcode section
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <>
      <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarcodeScanIcon color="primary" />
                Barcode Lookup
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Scan or enter a barcode to automatically retrieve product information
              </Typography>
            </Box>

            {/* Scan Button */}
            <Button
              variant="contained"
              size="large"
              startIcon={<BarcodeScanIcon />}
              onClick={() => setBarcodeScannerOpen(true)}
              fullWidth
              sx={{ py: 1.5 }}
            >
              Scan Barcode with Camera
            </Button>

            {/* Manual Entry */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Or enter barcode manually:
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Enter UPC, EAN, or ISBN"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleManualLookup();
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={handleManualLookup}
                  disabled={!manualBarcode.trim()}
                  startIcon={<SearchIcon />}
                >
                  Lookup
                </Button>
              </Stack>
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              Supported formats: UPC, EAN, ISBN (books). Product information will be automatically filled in.
            </Alert>
          </Stack>
        </CardContent>
      </Card>

      {/* Barcode Scanner Dialog */}
      <BarcodeScanner
        open={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onBarcodeScanned={handleBarcodeScanned}
      />

      {/* Barcode Preview Dialog */}
      {currentInventory && (
        <BarcodeItemPreview
          open={barcodePreviewOpen}
          barcode={scannedBarcode}
          inventoryId={currentInventory.id}
          onClose={handlePreviewClose}
          onAccept={handleBarcodeAccept}
        />
      )}
    </>
  );
}
