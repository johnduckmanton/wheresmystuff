import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Alert, Button } from '@mui/material';
import BarcodeScanner from '../components/BarcodeScanner';

export default function ScanPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleBarcodeScanned = (value: string) => {
    if (!value || value.length < 8) {
      setError(`Invalid QR code: "${value}". Please try scanning again.`);
      return;
    }
    navigate(`/containers?highlight=${encodeURIComponent(value)}`);
  };

  const handleClose = () => {
    navigate(-1);
  };

  const handleTryAgain = () => {
    setError(null);
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ p: 2 }}>
        Scan QR Code
      </Typography>

      {error && (
        <Box sx={{ px: 2, pb: 2 }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={handleTryAgain}>
                Try again
              </Button>
            }
          >
            {error}
          </Alert>
        </Box>
      )}

      <BarcodeScanner
        open={true}
        onClose={handleClose}
        onBarcodeScanned={handleBarcodeScanned}
      />
    </Box>
  );
}
