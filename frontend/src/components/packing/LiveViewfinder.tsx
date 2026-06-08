import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Fab, IconButton, Typography, useTheme } from '@mui/material';
import {
  Close as CloseIcon,
  CameraAlt as CameraAltIcon,
  PhotoLibrary as PhotoLibraryIcon,
} from '@mui/icons-material';
import {
  requestIOSCameraPermission,
  stopIOSCameraStream,
  getIOSCameraErrorMessage,
} from '../../utils/iosCamera';

export interface LiveViewfinderProps {
  onCapture: (imageBlob: Blob) => void;
  onClose: () => void;
  disabled?: boolean;
}

const MAX_DIMENSION = 1024;
const FLASH_DURATION_MS = 200;

/**
 * Resize a video frame to fit within MAX_DIMENSION while maintaining aspect ratio,
 * then export as a JPEG blob at 80% quality.
 */
function captureFrameAsBlob(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<Blob | null> {
  const { videoWidth, videoHeight } = video;
  if (videoWidth === 0 || videoHeight === 0) return Promise.resolve(null);

  let width = videoWidth;
  let height = videoHeight;

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width >= height) {
      height = Math.round((height * MAX_DIMENSION) / width);
      width = MAX_DIMENSION;
    } else {
      width = Math.round((width * MAX_DIMENSION) / height);
      height = MAX_DIMENSION;
    }
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);

  ctx.drawImage(video, 0, 0, width, height);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.8);
  });
}

export default function LiveViewfinder({
  onCapture,
  onClose,
  disabled = false,
}: LiveViewfinderProps) {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [isGalleryMode, setIsGalleryMode] = useState(false);

  // Initialise camera on mount
  useEffect(() => {
    let mounted = true;

    async function initCamera() {
      const result = await requestIOSCameraPermission();

      if (!mounted) return;

      if (result.success && result.stream) {
        setStream(result.stream);
        if (videoRef.current) {
          videoRef.current.srcObject = result.stream;
        }
      } else {
        const errorMsg = result.error
          ? getIOSCameraErrorMessage(result.error)
          : 'Camera unavailable';
        setCameraError(errorMsg);
        setIsGalleryMode(true);
      }
    }

    initCamera();

    return () => {
      mounted = false;
    };
  }, []);

  // Attach stream to video element when both are ready
  useEffect(() => {
    if (stream && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Stop stream on unmount
  useEffect(() => {
    return () => {
      stopIOSCameraStream(stream);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  const triggerFlash = useCallback(() => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), FLASH_DURATION_MS);
  }, []);

  const handleCapture = useCallback(async () => {
    if (disabled) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const blob = await captureFrameAsBlob(video, canvas);
    if (!blob) return;

    // Haptic feedback where supported
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Flash overlay — does not interrupt the preview
    triggerFlash();

    onCapture(blob);
  }, [disabled, onCapture, triggerFlash]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reset input so the same file can be selected again
      event.target.value = '';

      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;

          let { width, height } = img;
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width >= height) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) onCapture(blob);
            },
            'image/jpeg',
            0.8,
          );
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    },
    [onCapture],
  );

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: 'black',
        zIndex: theme.zIndex.modal + 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
      role="dialog"
      aria-label="Camera viewfinder"
      aria-modal="true"
    >
      {/* Close button — top-right */}
      <IconButton
        onClick={onClose}
        aria-label="Close camera"
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
          color: 'white',
          bgcolor: 'rgba(0,0,0,0.4)',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
        }}
        size="large"
      >
        <CloseIcon />
      </IconButton>

      {/* Camera view or gallery fallback */}
      {isGalleryMode ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            px: 4,
            textAlign: 'center',
          }}
        >
          <PhotoLibraryIcon sx={{ fontSize: 64, color: 'grey.400' }} />

          {cameraError && (
            <Typography
              variant="body2"
              sx={{
                color: 'grey.300',
                whiteSpace: 'pre-line',
                maxWidth: 320,
              }}
            >
              {cameraError}
            </Typography>
          )}

          <Typography variant="body1" sx={{ color: 'grey.400' }}>
            Select a photo from your gallery instead
          </Typography>

          <Fab
            variant="extended"
            color="primary"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Choose photo from gallery"
            sx={{ minWidth: 200 }}
          >
            <PhotoLibraryIcon sx={{ mr: 1 }} />
            Choose Photo
          </Fab>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            aria-hidden="true"
          />
        </Box>
      ) : (
        <>
          {/* Live video preview */}
          <Box
            component="video"
            ref={videoRef}
            autoPlay
            playsInline
            muted
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            aria-label="Camera preview"
          />

          {/* White flash overlay */}
          {showFlash && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'white',
                opacity: 0.8,
                zIndex: 5,
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />
          )}

          {/* Capture button — bottom-center, large for one-handed thumb access */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 48,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}
          >
            <Fab
              color="primary"
              size="large"
              onClick={handleCapture}
              disabled={disabled || !stream}
              aria-label="Capture photo"
              sx={{
                width: 72,
                height: 72,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                border: '3px solid white',
              }}
            >
              <CameraAltIcon sx={{ fontSize: 36 }} />
            </Fab>
          </Box>
        </>
      )}

      {/* Offscreen canvas for frame capture — never rendered visibly */}
      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true" />
    </Box>
  );
}
