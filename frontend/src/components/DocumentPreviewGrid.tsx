import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Tooltip,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  Image as ImageIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';
import apiClient from '../services/api';

interface DocumentPreviewGridProps {
  documentKeys: string[];
  onRemove: (key: string) => void;
  disabled?: boolean;
  documentType: 'receipt' | 'warranty';
}

interface DocumentPreview {
  key: string;
  name: string;
  type: 'pdf' | 'image' | 'doc';
  url?: string;
  loading: boolean;
  error?: string;
}

export default function DocumentPreviewGrid({
  documentKeys,
  onRemove,
  disabled = false,
  documentType,
}: DocumentPreviewGridProps) {
  const { showError } = useNotification();
  const [documents, setDocuments] = useState<DocumentPreview[]>([]);

  useEffect(() => {
    // Initialize documents from keys
    const initialDocs: DocumentPreview[] = documentKeys.map(key => {
      const fileName = key.split('/').pop() || key;
      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      
      let type: 'pdf' | 'image' | 'doc' = 'doc';
      if (extension === 'pdf') {
        type = 'pdf';
      } else if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(extension)) {
        type = 'image';
      }

      return {
        key,
        name: fileName,
        type,
        loading: true,
      };
    });

    setDocuments(initialDocs);

    // Load download URLs for each document
    const loadUrls = async () => {
      for (const doc of initialDocs) {
        try {
          const response = await apiClient.generateDocumentDownloadUrl(doc.key);
          setDocuments(prev => prev.map(d => 
            d.key === doc.key 
              ? { ...d, url: response.downloadUrl, loading: false }
              : d
          ));
        } catch (error) {
          console.error(`Error loading document ${doc.key}:`, error);
          setDocuments(prev => prev.map(d => 
            d.key === doc.key 
              ? { ...d, loading: false, error: 'Failed to load' }
              : d
          ));
        }
      }
    };

    if (initialDocs.length > 0) {
      loadUrls();
    }
  }, [documentKeys]);

  const handleRemove = (key: string) => {
    if (disabled) return;
    onRemove(key);
  };

  const handleDownload = async (doc: DocumentPreview) => {
    if (!doc.url) return;

    try {
      // Open in new tab for viewing/downloading
      window.open(doc.url, '_blank');
    } catch (error) {
      console.error('Error downloading document:', error);
      showError('Failed to download document');
    }
  };

  const getIcon = (type: 'pdf' | 'image' | 'doc') => {
    switch (type) {
      case 'pdf':
        return <PdfIcon sx={{ fontSize: 48, color: '#d32f2f' }} />;
      case 'image':
        return <ImageIcon sx={{ fontSize: 48, color: '#1976d2' }} />;
      case 'doc':
        return <DocIcon sx={{ fontSize: 48, color: '#2e7d32' }} />;
    }
  };

  if (documents.length === 0) {
    return null;
  }

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
        {documentType === 'receipt' ? 'Receipts' : 'Warranties'} ({documents.length})
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 2,
        }}
      >
        {documents.map((doc) => (
          <Paper
            key={doc.key}
            elevation={2}
            sx={{
              position: 'relative',
              aspectRatio: '1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 1,
              bgcolor: 'background.paper',
              borderRadius: 1,
              overflow: 'hidden',
              '&:hover .action-buttons': {
                opacity: 1,
              },
            }}
          >
            {doc.loading ? (
              <CircularProgress size={24} />
            ) : doc.error ? (
              <>
                <DocIcon sx={{ fontSize: 48, color: 'error.main' }} />
                <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                  {doc.error}
                </Typography>
              </>
            ) : (
              <>
                {/* Document Icon */}
                {getIcon(doc.type)}
                
                {/* File Name */}
                <Typography
                  variant="caption"
                  sx={{
                    mt: 1,
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    wordBreak: 'break-word',
                    fontSize: '0.7rem',
                  }}
                >
                  {doc.name}
                </Typography>

                {/* Action Buttons */}
                <Box
                  className="action-buttons"
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    display: 'flex',
                    gap: 0.5,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: 1,
                    p: 0.5,
                  }}
                >
                  <Tooltip title="Download/View">
                    <IconButton
                      size="small"
                      onClick={() => handleDownload(doc)}
                      disabled={!doc.url}
                      sx={{ p: 0.5 }}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove">
                    <IconButton
                      size="small"
                      onClick={() => handleRemove(doc.key)}
                      disabled={disabled}
                      color="error"
                      sx={{ p: 0.5 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </>
            )}
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
