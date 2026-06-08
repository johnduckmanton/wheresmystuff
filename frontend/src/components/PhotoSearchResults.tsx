import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Skeleton,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  Photo as PhotoIcon,
  Refresh as RefreshIcon,
  TextFields as TextSearchIcon,
} from '@mui/icons-material';
import apiClient from '../services/api';
import type { Thing } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhotoSearchResult {
  thing: Thing;
  score: number;
  photoKey: string;
}

export interface PhotoSearchResultsProps {
  queryPhotoKey: string;
  results: PhotoSearchResult[];
  onSelectResult: (thingId: string) => void;
  onNavigateToContainer: (containerId: string) => void;
  onClose: () => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch a presigned download URL and return it.
 * Falls back to null on any error so missing photos degrade gracefully.
 */
async function fetchPhotoUrl(photoKey: string): Promise<string | null> {
  try {
    const { downloadUrl } = await apiClient.generateDownloadUrl(photoKey);
    return downloadUrl;
  } catch {
    return null;
  }
}

// ─── Single photo cell ────────────────────────────────────────────────────────

interface PhotoCellProps {
  photoKey: string | undefined;
  alt: string;
  size?: number;
}

function PhotoCell({ photoKey, alt, size = 72 }: PhotoCellProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!photoKey) return;
    setLoading(true);
    fetchPhotoUrl(photoKey).then((u) => {
      setUrl(u);
      setLoading(false);
    });
  }, [photoKey]);

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'grey.100',
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {loading ? (
        <CircularProgress size={20} />
      ) : url ? (
        <Box
          component="img"
          src={url}
          alt={alt}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <PhotoIcon sx={{ color: 'grey.400', fontSize: size * 0.45 }} aria-label="No photo available" />
      )}
    </Box>
  );
}

// ─── Skeleton result card ─────────────────────────────────────────────────────

function ResultCardSkeleton() {
  return (
    <Card variant="outlined" sx={{ mb: 1.5 }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <Skeleton variant="rectangular" width={72} height={72} sx={{ borderRadius: 1, flexShrink: 0 }} />
          <Skeleton variant="rectangular" width={72} height={72} sx={{ borderRadius: 1, flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="40%" />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Result action dialog ─────────────────────────────────────────────────────

interface ResultActionDialogProps {
  result: PhotoSearchResult;
  onViewThing: (thingId: string) => void;
  onViewContainer: (containerId: string) => void;
  onClose: () => void;
}

function ResultActionDialog({
  result,
  onViewThing,
  onViewContainer,
  onClose,
}: ResultActionDialogProps) {
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="result-action-title"
    >
      <DialogTitle id="result-action-title" sx={{ pr: 6 }}>
        {result.thing.name}
        <IconButton
          onClick={onClose}
          aria-label="Close actions"
          sx={{ position: 'absolute', right: 8, top: 8 }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {Math.round(result.score * 100)}% visual similarity match
        </Typography>
      </DialogContent>

      <DialogActions sx={{ flexDirection: 'column', gap: 1, px: 3, pb: 2, alignItems: 'stretch' }}>
        <Button
          variant="contained"
          startIcon={<OpenInNewIcon />}
          onClick={() => {
            onViewThing(result.thing.id);
            onClose();
          }}
          fullWidth
          aria-label={`View Thing details for ${result.thing.name}`}
        >
          View Thing
        </Button>

        {result.thing.containerId && (
          <Button
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            onClick={() => {
              onViewContainer(result.thing.containerId!);
              onClose();
            }}
            fullWidth
            aria-label={`View Container for ${result.thing.name}`}
          >
            View Container
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ─── Single result card ───────────────────────────────────────────────────────

interface ResultCardProps {
  result: PhotoSearchResult;
  queryPhotoKey: string;
  onTap: (result: PhotoSearchResult) => void;
}

function ResultCard({ result, queryPhotoKey, onTap }: ResultCardProps) {
  const { thing, score } = result;
  const scorePercent = Math.round(score * 100);

  // Derive display fields
  const primaryPhoto = thing.photos?.[0] ?? result.photoKey;

  return (
    <Card variant="outlined" sx={{ mb: 1.5 }}>
      <CardActionArea
        onClick={() => onTap(result)}
        aria-label={`${thing.name} — ${scorePercent}% match`}
      >
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            {/* Side-by-side photo comparison */}
            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
              {/* Query photo (small reference) */}
              <Box sx={{ position: 'relative' }}>
                <PhotoCell photoKey={queryPhotoKey} alt="Your query photo" size={72} />
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    bottom: 2,
                    left: 2,
                    bgcolor: 'rgba(0,0,0,0.55)',
                    color: 'white',
                    px: 0.5,
                    borderRadius: 0.5,
                    fontSize: '0.6rem',
                    lineHeight: 1.5,
                  }}
                  aria-hidden="true"
                >
                  Query
                </Typography>
              </Box>

              {/* Matched item photo */}
              <Box sx={{ position: 'relative' }}>
                <PhotoCell photoKey={primaryPhoto} alt={`${thing.name} photo`} size={72} />
                {/* Similarity badge */}
                <Chip
                  label={`${scorePercent}%`}
                  size="small"
                  color={scorePercent >= 80 ? 'success' : scorePercent >= 65 ? 'primary' : 'default'}
                  sx={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    height: 18,
                    fontSize: '0.6rem',
                    fontWeight: 'bold',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                  aria-label={`${scorePercent}% visual similarity`}
                />
              </Box>
            </Box>

            {/* Thing details */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle2"
                fontWeight="bold"
                noWrap
                aria-label={`Item name: ${thing.name}`}
              >
                {thing.name}
              </Typography>

              {thing.locationId && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  noWrap
                  aria-label={`Location: ${thing.locationId}`}
                >
                  📍 Location ID: {thing.locationId}
                </Typography>
              )}

              {thing.containerId ? (
                <Typography
                  variant="caption"
                  color="primary.main"
                  display="block"
                  noWrap
                  aria-label={`Container: ${thing.containerId}`}
                >
                  📦 In container
                </Typography>
              ) : (
                <Typography
                  variant="caption"
                  color="text.disabled"
                  display="block"
                  noWrap
                >
                  Not in a container
                </Typography>
              )}

              {thing.categoryId && (
                <Chip
                  label={thing.categoryId}
                  size="small"
                  variant="outlined"
                  sx={{ mt: 0.5, height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
                />
              )}
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * PhotoSearchResults
 *
 * Displays visual similarity search results with a side-by-side query vs matched photo
 * comparison, similarity score badge, Thing name, location, and container assignment.
 * Supports loading skeletons, empty state, error state with retry, and tap-to-action.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.5
 */
export default function PhotoSearchResults({
  queryPhotoKey,
  results,
  onSelectResult,
  onNavigateToContainer,
  onClose,
  isLoading = false,
  error = null,
  onRetry,
}: PhotoSearchResultsProps) {
  const [actionTarget, setActionTarget] = useState<PhotoSearchResult | null>(null);

  const handleResultTap = (result: PhotoSearchResult) => {
    setActionTarget(result);
  };

  const handleViewThing = (thingId: string) => {
    onSelectResult(thingId);
    onClose();
  };

  const handleViewContainer = (containerId: string) => {
    onNavigateToContainer(containerId);
    onClose();
  };

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      role="region"
      aria-label="Photo search results"
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
        component="header"
      >
        <Typography variant="h6" sx={{ flex: 1 }}>
          Photo Search Results
        </Typography>
        <IconButton onClick={onClose} aria-label="Close photo search results" size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* ── Query photo reference ────────────────────────────────────────────── */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: 'grey.50',
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <PhotoCell photoKey={queryPhotoKey} alt="Your search photo" size={56} />
        <Box>
          <Typography variant="body2" fontWeight="medium">
            Your search photo
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isLoading
              ? 'Searching for similar items…'
              : error
              ? 'Search failed'
              : results.length > 0
              ? `${results.length} match${results.length === 1 ? '' : 'es'} found`
              : 'No matches found'}
          </Typography>
        </Box>
      </Box>

      {/* ── Results area ────────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5 }}>
        {/* Error state */}
        {error && !isLoading && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              onRetry && (
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={onRetry}
                  aria-label="Retry photo search"
                  color="inherit"
                >
                  Retry
                </Button>
              )
            }
          >
            {error}
          </Alert>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <>
            {[0, 1, 2].map((i) => (
              <ResultCardSkeleton key={i} />
            ))}
          </>
        )}

        {/* Results list */}
        {!isLoading && !error && results.length > 0 && (
          <>
            {results.map((result) => (
              <ResultCard
                key={result.thing.id}
                result={result}
                queryPhotoKey={queryPhotoKey}
                onTap={handleResultTap}
              />
            ))}
          </>
        )}

        {/* Empty state */}
        {!isLoading && !error && results.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 6,
              gap: 2,
              textAlign: 'center',
            }}
            role="status"
            aria-live="polite"
          >
            <PhotoIcon sx={{ fontSize: 56, color: 'grey.300' }} aria-hidden="true" />
            <Typography variant="body1" color="text.secondary" fontWeight="medium">
              No matching items found.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try text-based search instead.
            </Typography>
            <Divider sx={{ width: '100%', my: 0.5 }} />
            <Button
              variant="outlined"
              startIcon={<TextSearchIcon />}
              onClick={onClose}
              aria-label="Close photo search and use text search"
            >
              Use Text Search
            </Button>
          </Box>
        )}
      </Box>

      {/* ── Action dialog for tapped result ─────────────────────────────────── */}
      {actionTarget && (
        <ResultActionDialog
          result={actionTarget}
          onViewThing={handleViewThing}
          onViewContainer={handleViewContainer}
          onClose={() => setActionTarget(null)}
        />
      )}
    </Box>
  );
}
