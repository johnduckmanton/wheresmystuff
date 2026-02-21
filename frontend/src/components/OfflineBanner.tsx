/**
 * Offline Banner Component
 * Displays a persistent banner when network connectivity is lost
 * Shows queued operations count and sync status
 */

import { Alert, Box, Button, Collapse, LinearProgress } from '@mui/material';
import { CloudOff as CloudOffIcon, CloudQueue as CloudQueueIcon } from '@mui/icons-material';

interface OfflineBannerProps {
  isOnline: boolean;
  queuedCount: number;
  isProcessing: boolean;
  onRetry?: () => void;
}

export default function OfflineBanner({
  isOnline,
  queuedCount,
  isProcessing,
  onRetry,
}: OfflineBannerProps) {
  // Show banner when offline or when there are queued operations
  const showBanner = !isOnline || queuedCount > 0;

  if (!showBanner) {
    return null;
  }

  return (
    <Collapse in={showBanner}>
      <Box sx={{ position: 'relative' }}>
        <Alert
          severity={!isOnline ? 'warning' : 'info'}
          icon={!isOnline ? <CloudOffIcon /> : <CloudQueueIcon />}
          sx={{
            borderRadius: 0,
            '& .MuiAlert-message': {
              width: '100%',
            },
          }}
          action={
            isOnline && queuedCount > 0 && !isProcessing && onRetry ? (
              <Button color="inherit" size="small" onClick={onRetry}>
                Retry Now
              </Button>
            ) : undefined
          }
        >
          <Box>
            {!isOnline ? (
              <>
                <strong>You are offline</strong>
                {queuedCount > 0 && (
                  <Box component="span" sx={{ ml: 1 }}>
                    • {queuedCount} operation{queuedCount !== 1 ? 's' : ''} queued
                  </Box>
                )}
              </>
            ) : isProcessing ? (
              <>
                <strong>Syncing...</strong>
                <Box component="span" sx={{ ml: 1 }}>
                  Processing {queuedCount} queued operation{queuedCount !== 1 ? 's' : ''}
                </Box>
              </>
            ) : (
              <>
                <strong>Operations queued</strong>
                <Box component="span" sx={{ ml: 1 }}>
                  {queuedCount} operation{queuedCount !== 1 ? 's' : ''} waiting to sync
                </Box>
              </>
            )}
          </Box>
        </Alert>
        {isProcessing && (
          <LinearProgress
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 2,
            }}
          />
        )}
      </Box>
    </Collapse>
  );
}
