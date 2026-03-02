import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import apiClient from '../services/api';
import { photoQueue } from '../services/photoQueue';

interface ContainerPhotoThumbnailProps {
  photoKey?: string;
  altText: string;
  size?: number;
  color?: string;
}

export default function ContainerPhotoThumbnail({ 
  photoKey, 
  altText, 
  size = 40,
  color 
}: ContainerPhotoThumbnailProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

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
        const url = await photoQueue.loadPhoto(photoKey, apiClient);
        setPhotoUrl(url);
        setLoading(false);
      } catch (error: any) {
        console.warn('Failed to load container photo:', error);
        setPhotoUrl(null);
        setError(true);
        setLoading(false);
      }
    };

    loadPhoto();
  }, [photoKey]);

  const hasImage = photoUrl && !error;

  return (
    <>
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: 1,
          backgroundColor: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          border: color ? `2px solid ${color}` : '1px solid #e0e0e0',
          cursor: hasImage ? 'pointer' : 'default',
          position: 'relative',
          '&:hover': hasImage ? {
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transform: 'scale(1.05)',
            transition: 'all 0.2s ease-in-out',
          } : {},
        }}
        onMouseEnter={() => hasImage && setShowPopup(true)}
        onMouseLeave={() => setShowPopup(false)}
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
            <Box
              component="span"
              className="material-icons"
              sx={{ 
                fontSize: size > 32 ? 20 : 16, 
                color: '#ddd',
                mb: size > 32 ? 0.5 : 0,
              }}
            >
              inventory_2
            </Box>
            {size > 32 && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: '8px',
                  lineHeight: 1,
                  color: '#999',
                  fontWeight: 500,
                }}
              >
                No Photo
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Hover Popup for larger image */}
      {showPopup && hasImage && (
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