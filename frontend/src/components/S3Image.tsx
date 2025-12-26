import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Typography, Link } from '@mui/material';
import { Image as ImageIcon } from '@mui/icons-material';

interface S3ImageProps {
  src: string;
  alt: string;
  style?: React.CSSProperties;
  maxWidth?: string | number;
  maxHeight?: string | number;
  fallbackText?: string;
}

/**
 * S3Image Component
 * Handles loading images from S3 presigned URLs with CORS fallback
 * Automatically handles CORS issues by fetching as blob if direct load fails
 */
const S3Image: React.FC<S3ImageProps> = ({
  src,
  alt,
  style,
  maxWidth = '200px',
  maxHeight = '200px',
  fallbackText = 'Image generated successfully!'
}) => {
  const [imageUrl, setImageUrl] = useState<string>(src);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    setImageUrl(src);
    setError(false);
    setLoading(false);
  }, [src]);

  const handleImageError = async () => {
    console.log('Direct image load failed, trying fetch method...');
    setLoading(true);
    
    try {
      // Try to fetch the image as a blob to bypass CORS issues
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setImageUrl(blobUrl);
      setLoading(false);
      console.log('Successfully loaded image via fetch method');
    } catch (fetchError) {
      console.error('Failed to fetch image:', fetchError);
      setError(true);
      setLoading(false);
    }
  };

  const handleImageLoad = () => {
    setLoading(false);
    setError(false);
  };

  if (error) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          p: 3,
          border: '1px dashed #ccc',
          borderRadius: 1,
          bgcolor: 'grey.50',
          minHeight: '150px'
        }}
      >
        <ImageIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
        <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
          {fallbackText}
        </Typography>
        <Link 
          href={src} 
          target="_blank" 
          rel="noopener noreferrer"
          sx={{ color: 'primary.main', textDecoration: 'none' }}
        >
          Click here to view image
        </Link>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', display: 'inline-block' }}>
      {loading && (
        <Box 
          sx={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            zIndex: 1
          }}
        >
          <CircularProgress size={24} />
        </Box>
      )}
      <img
        src={imageUrl}
        alt={alt}
        style={{
          maxWidth,
          maxHeight,
          border: '1px solid #ddd',
          borderRadius: '4px',
          opacity: loading ? 0.5 : 1,
          ...style
        }}
        onError={handleImageError}
        onLoad={handleImageLoad}
        crossOrigin="anonymous"
      />
    </Box>
  );
};

export default S3Image;