import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Card,
  CardMedia,
  CardContent,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Edit as EditIcon,
  CameraAlt as CameraIcon,
} from '@mui/icons-material';
import apiClient from '../services/api';

interface BarcodeItemPreviewProps {
  open: boolean;
  barcode: string;
  inventoryId: string;
  onClose: () => void;
  onAccept: (itemData: any) => void;
}

interface BarcodeResult {
  success: boolean;
  source: string;
  barcodeType: string;
  barcode: string;
  data: {
    itemName: string;
    description: string;
    suggestedCategory: string;
    brand: string | null;
    manufacturer: string | null;
    model: string | null;
    imageUrl: string | null;
    storedImageKey: string | null;
    metadata: any;
  };
}

export default function BarcodeItemPreview({
  open,
  barcode,
  inventoryId,
  onClose,
  onAccept,
}: BarcodeItemPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<BarcodeResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');

  // Lookup barcode when dialog opens
  useEffect(() => {
    if (open && barcode) {
      lookupBarcode();
    }
  }, [open, barcode]);

  const lookupBarcode = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setImageUrl('');

    try {
      const response = await apiClient.lookupBarcode(barcode, inventoryId);
      
      console.log('Barcode lookup result:', response);
      setResult(response);

      // If there's a stored image, get the presigned URL
      if (response.data.storedImageKey) {
        try {
          const urlResponse = await apiClient.generateDownloadUrl(
            response.data.storedImageKey
          );
          setImageUrl(urlResponse.downloadUrl);
        } catch (urlError) {
          console.error('Failed to get image URL:', urlError);
          // Continue without image
        }
      }
    } catch (err: any) {
      console.error('Barcode lookup failed:', err);
      setError(
        err.message ||
          'Failed to lookup barcode. The product may not be in our database.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (result) {
      // Prepare item data for the form
      const itemData = {
        name: result.data.itemName,
        description: result.data.description,
        category: result.data.suggestedCategory,
        barcode: result.barcode,
        photos: result.data.storedImageKey ? [result.data.storedImageKey] : [],
        metadata: {
          ...result.data.metadata,
          barcodeSource: result.source,
          barcodeType: result.barcodeType,
        },
      };

      onAccept(itemData);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError('');
    setImageUrl('');
    onClose();
  };

  const getBarcodeTypeLabel = (type: string) => {
    switch (type) {
      case 'isbn':
        return 'ISBN (Book)';
      case 'upc':
        return 'UPC';
      case 'ean':
        return 'EAN';
      default:
        return type.toUpperCase();
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'openlibrary':
        return 'Open Library';
      case 'upcdatabase':
        return 'UPC Database';
      default:
        return source;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="barcode-preview-dialog-title"
    >
      <DialogTitle
        id="barcode-preview-dialog-title"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6">Product Information</Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {loading && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              py: 4,
            }}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Looking up barcode...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {result && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Success indicator */}
            <Alert severity="success" icon={<CheckIcon />}>
              Product found in {getSourceLabel(result.source)}
            </Alert>

            {/* Product card */}
            <Card>
              {imageUrl && (
                <CardMedia
                  component="img"
                  height="200"
                  image={imageUrl}
                  alt={result.data.itemName}
                  sx={{ objectFit: 'contain', bgcolor: 'grey.100', p: 2 }}
                />
              )}
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {result.data.itemName}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip
                    label={getBarcodeTypeLabel(result.barcodeType)}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    label={result.data.suggestedCategory}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" paragraph>
                  {result.data.description}
                </Typography>

                {result.data.brand && (
                  <Typography variant="body2">
                    <strong>Brand:</strong> {result.data.brand}
                  </Typography>
                )}

                {result.data.model && (
                  <Typography variant="body2">
                    <strong>Model:</strong> {result.data.model}
                  </Typography>
                )}

                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Barcode:</strong> {result.barcode}
                </Typography>

                {/* Book-specific metadata */}
                {result.data.metadata?.authors &&
                  result.data.metadata.authors.length > 0 && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>Author(s):</strong>{' '}
                      {result.data.metadata.authors.join(', ')}
                    </Typography>
                  )}

                {result.data.metadata?.publisher && (
                  <Typography variant="body2">
                    <strong>Publisher:</strong> {result.data.metadata.publisher}
                  </Typography>
                )}

                {result.data.metadata?.publishDate && (
                  <Typography variant="body2">
                    <strong>Published:</strong>{' '}
                    {result.data.metadata.publishDate}
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* Info about adding photos */}
            <Alert severity="info" icon={<CameraIcon />}>
              You can add additional photos after accepting this item.
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {result && (
          <>
            <Button
              onClick={handleAccept}
              startIcon={<EditIcon />}
              variant="outlined"
            >
              Edit & Add
            </Button>
            <Button
              onClick={handleAccept}
              startIcon={<CheckIcon />}
              variant="contained"
            >
              Accept
            </Button>
          </>
        )}
        {error && (
          <Button onClick={lookupBarcode} variant="outlined">
            Retry
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
