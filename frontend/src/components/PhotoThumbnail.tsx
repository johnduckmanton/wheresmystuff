import { useState, useEffect } from 'react';
import { Box, Typography, Avatar } from '@mui/material';
import { Photo as PhotoIcon } from '@mui/icons-material';
import apiClient from '../services/api';

interface PhotoThumbnailProps {
  photoKey?: string;
  altText: string;
  size?: number;
  variant?: 'square' | 'circular' | 'avatar';
  showPopup?: boolean;
}

export default function PhotoThumbnail({ 
  photoKey, 
  altText, 
  size = 40,
  variant = 'square',
  showPopup = true,
}: PhotoThumbnailProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showHoverPopup, setShowHoverPopup] = useState(false);

  useEffect(() => {
    if (!photoKey) {
      setPhotoUrl(null);
      setError(false);
      return;
    }

    const loadPhoto = async () => {
      try {
        setLoading(true);
        setError(false);
        const response = await apiClient.generateDownloadUrl(photoKey);
        setPhotoUrl(response.downloadUrl);
      } catch (error) {
        console.warn('Failed to load photo:', error);
        setPhotoUrl(null);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadPhoto();
  }, [photoKey]);

  const hasImage = photoUrl && !error;

  // Avatar variant
  if (variant === 'avatar') {
    return (
      <Avatar
        sx={{ 
          bgcolor: hasImage ? 'transparent' : 'primary.main',
          width: size,
          height: size,
        }}
        src={hasImage ? photoUrl : undefined}
        alt={altText}
      >
        {!hasImage && <PhotoIcon />}
      </Avatar>
    );
  }

  // Square or circular variant
  const borderRadius = variant === 'circular' ? '50%' : 1;

  return (
    <>
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          border: '1px solid #e0e0e0',
          cursor: hasImage && showPopup ? 'pointer' : 'default',
          position: 'relative',
          '&:hover': hasImage && showPopup ? {
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transform: 'scale(1.05)',
            transition: 'all 0.2s ease-in-out',
          } : {},
        }}
        onMouseEnter={() => hasImage && showPopup && setShowHoverPopup(true)}
        onMouseLeave={() => setShowHoverPopup(false)}
      >
        {loading ? (
          <Box sx={{ fontSize: 12, color: '#999' }}>⋯</Box>
        ) : hasImage ? (
          <img
            src={photoUrl}
            alt={altText}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={() => setError(true)}
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#bbb',
              textAlign: 'center',
              width: '100%',
              height: '100%',
            }}
          >
            <PhotoIcon sx={{ fontSize: size * 0.5, color: '#ddd' }} />
            {size >= 40 && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: '8px',
                  lineHeight: 1,
                  color: '#999',
                  fontWeight: 500,
                  mt: 0.5,
                }}
              >
                No Photo
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Hover Popup for larger image */}
      {showHoverPopup && hasImage && showPopup && (
        <Box
          sx={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            backgroundColor: 'white',
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            border: '1px solid #e0e0e0',
            overflow: 'hidden',
            maxWidth: '400px',
            maxHeight: '400px',
            pointerEvents: 'none',
          }}
        >
          <img
            src={photoUrl}
            alt={altText}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </Box>
      )}
    </>
  );
}
