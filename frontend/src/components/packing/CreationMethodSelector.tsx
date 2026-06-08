import { Box, Button } from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  QrCodeScanner as QrCodeScannerIcon,
  Edit as EditIcon,
  FlashOn as FlashOnIcon,
} from '@mui/icons-material';

export interface CreationMethodSelectorProps {
  onMethodSelect: (method: 'ai' | 'barcode' | 'manual' | 'quickpack') => void;
  disabled?: boolean;
}

export default function CreationMethodSelector({
  onMethodSelect,
  disabled = false,
}: CreationMethodSelectorProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: { xs: 1, sm: 2 },
        width: '100%',
      }}
    >
      <Button
        variant="outlined"
        size="large"
        startIcon={<PhotoCameraIcon />}
        onClick={() => onMethodSelect('ai')}
        disabled={disabled}
        fullWidth
        sx={{
          minHeight: '56px',
          justifyContent: 'flex-start',
          px: 3,
          py: 2,
          fontSize: '1rem',
          textTransform: 'none',
          fontWeight: 'medium',
        }}
        aria-label="create item with AI photo upload"
      >
        AI Photo Upload
      </Button>

      <Button
        variant="outlined"
        size="large"
        startIcon={<QrCodeScannerIcon />}
        onClick={() => onMethodSelect('barcode')}
        disabled={disabled}
        fullWidth
        sx={{
          minHeight: '56px',
          justifyContent: 'flex-start',
          px: 3,
          py: 2,
          fontSize: '1rem',
          textTransform: 'none',
          fontWeight: 'medium',
        }}
        aria-label="create item with barcode scan"
      >
        Barcode Scan
      </Button>

      <Button
        variant="outlined"
        size="large"
        startIcon={<EditIcon />}
        onClick={() => onMethodSelect('manual')}
        disabled={disabled}
        fullWidth
        sx={{
          minHeight: '56px',
          justifyContent: 'flex-start',
          px: 3,
          py: 2,
          fontSize: '1rem',
          textTransform: 'none',
          fontWeight: 'medium',
        }}
        aria-label="create item with manual entry"
      >
        Manual Entry
      </Button>

      <Button
        variant="outlined"
        size="large"
        startIcon={<FlashOnIcon />}
        onClick={() => onMethodSelect('quickpack')}
        disabled={disabled}
        fullWidth
        sx={{
          minHeight: '56px',
          justifyContent: 'flex-start',
          px: 3,
          py: 2,
          fontSize: '1rem',
          textTransform: 'none',
          fontWeight: 'medium',
        }}
        aria-label="enter quick pack mode"
      >
        Quick Pack
      </Button>
    </Box>
  );
}
