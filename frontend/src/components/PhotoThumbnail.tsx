import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Avatar, Tooltip } from '@mui/material';
import { Photo as PhotoIcon } from '@mui/icons-material';
import apiClient from '../services/api';
import { photoQueue } from '../services/photoQueue';
import { toThumbnailKey } from '../utils/photoUtils';

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
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!photoKey) {
      setPhotoUrl(null);
      setError(false);
      return;
    }

    const thumbnailKey = toThumbnailKey(photoKey);

    const loadPhoto = async () => {
      try {
        setLoading(true);
        setError(false);
        const url = await photoQueue.loadPhoto(thumbnailKey, apiClient);
        setPhotoUrl(url);
        setLoading(false);
      } catch (error: any) {
        console.warn('Failed to load thumbnail, falling back to original:', error);
        // Fallback: try the original photo key if thumbnail fails
        try {
          const url = await photoQueue.loadPhoto(photoKey, apiClient);
          setPhotoUrl(url);
          setLoading(false);
        } catch (fallbackError: any) {
          console.warn('Failed to load photo:', fallbackError);
          setPhotoUrl(null);
          setError(true);
          setLoading(false);
        }
      }
    };

    loadPhoto();

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [photoKey]);

  // When the img tag itself 404s (thumbnail not yet processed), retry once after 3s
  const handleImgError = () => {
    if (retryTimerRef.current) return;
    setPhotoUrl(null);
    setLoading(true);
    retryTimerRef.current = setTimeout(async () => {
      retryTimerRef.current = null;
      try {
        const thumbnailKey = toThumbnailKey(photoKey!);
        const url = await photoQueue.loadPhoto(thumbnailKey, apiClient);
        setPhotoUrl(url);
        setLoading(false);
      } catch {
        setError(true);
        setLoading(false);
      }
    }, 3000);
  };

  const hasImage = photoUrl && !error;

  // Avatar variant — no popup
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

  const borderRadius = variant === 'circular' ? '50%' : 1;

  const thumbnail = (
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
        flexShrink: 0,
      }}
    >
      {loading ? (
        <Box sx={{ fontSize: 12, color: '#999' }}>⋯</Box>
      ) : hasImage ? (
        <img
          src={photoUrl}
          alt={altText}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={handleImgError}
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
            <Typography variant="caption" sx={{ fontSize: '8px', lineHeight: 1, color: '#999', fontWeight: 500, mt: 0.5 }}>
              No Photo
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );

  if (!hasImage || !showPopup) {
    return thumbnail;
  }

  return (
    <Tooltip
      title={
        <Box
          component="img"
          src={photoUrl}
          alt={altText}
          sx={{
            display: 'block',
            maxWidth: 280,
            maxHeight: 280,
            objectFit: 'contain',
            borderRadius: 1,
          }}
        />
      }
      placement="right"
      arrow={false}
      enterDelay={300}
      leaveDelay={0}
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: 'white',
            p: 0.5,
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            border: '1px solid #e0e0e0',
            borderRadius: 1,
            maxWidth: 'none',
          },
        },
      }}
    >
      {thumbnail}
    </Tooltip>
  );
}
