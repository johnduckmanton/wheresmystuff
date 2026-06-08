import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  ErrorOutline as ErrorOutlineIcon,
  ExitToApp as ExitToAppIcon,
  HourglassEmpty as HourglassEmptyIcon,
  PhotoCamera as PhotoCameraIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  WifiOff as WifiOffIcon,
} from '@mui/icons-material';
import LiveViewfinder from './LiveViewfinder';
import ConfirmationCard from './ConfirmationCard';
import { useSnapQueue, type SnapQueueItem, type SnapQueueItemStatus } from '../../hooks/useSnapQueue';
import type { Category, Container, Thing } from '../../types';
import apiClient from '../../services/api';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface QuickPackModeProps {
  container: Container;
  inventoryId: string;
  categories: Category[];
  onExit: (stats: { captured: number; completed: number; failed: number }) => void;
  onContainerUpdated?: (container: Container) => void;
}

// ─── Thumbnail helpers ────────────────────────────────────────────────────────

/** Returns a stable object URL for the item's image blob. Caller manages cleanup. */
function getThumbnailSrc(item: SnapQueueItem): string {
  return URL.createObjectURL(item.imageBlob);
}

interface StatusIndicatorProps {
  status: SnapQueueItemStatus;
}

function StatusIndicator({ status }: StatusIndicatorProps) {
  switch (status) {
    case 'uploading':
      return (
        <CircularProgress
          size={18}
          sx={{ color: 'primary.main' }}
          aria-label="Uploading"
        />
      );
    case 'analyzing':
      return (
        <CircularProgress
          size={18}
          variant="indeterminate"
          sx={{ color: 'secondary.main' }}
          aria-label="Analyzing"
        />
      );
    case 'confirming':
      return (
        <Box
          sx={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            bgcolor: 'warning.main',
            border: '2px solid white',
          }}
          role="img"
          aria-label="Awaiting confirmation"
        />
      );
    case 'creating':
      return (
        <CircularProgress
          size={18}
          sx={{ color: 'success.light' }}
          aria-label="Creating"
        />
      );
    case 'complete':
      return (
        <CheckCircleIcon
          sx={{ fontSize: 20, color: 'success.main' }}
          aria-label="Complete"
        />
      );
    case 'failed':
      return (
        <ErrorOutlineIcon
          sx={{ fontSize: 20, color: 'error.main' }}
          aria-label="Failed"
        />
      );
    default:
      return (
        <HourglassEmptyIcon
          sx={{ fontSize: 18, color: 'grey.400' }}
          aria-label="Queued"
        />
      );
  }
}

// ─── Thumbnail component ──────────────────────────────────────────────────────

interface ThumbnailProps {
  item: SnapQueueItem;
  isActive: boolean;
  onClick: () => void;
}

function Thumbnail({ item, isActive, onClick }: ThumbnailProps) {
  const [src] = useState(() => getThumbnailSrc(item));

  return (
    <Box
      component="button"
      onClick={onClick}
      aria-label={`Item thumbnail — status: ${item.status}`}
      sx={{
        position: 'relative',
        flexShrink: 0,
        width: 64,
        height: 64,
        borderRadius: 1,
        overflow: 'hidden',
        border: isActive ? '2px solid' : '2px solid transparent',
        borderColor: isActive ? 'warning.main' : 'transparent',
        cursor: 'pointer',
        p: 0,
        bgcolor: 'transparent',
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      <Box
        component="img"
        src={src}
        alt=""
        aria-hidden="true"
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      {/* Status badge */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 2,
          right: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(0,0,0,0.55)',
          borderRadius: '50%',
          p: '2px',
        }}
        aria-hidden="true"
      >
        <StatusIndicator status={item.status} />
      </Box>
    </Box>
  );
}

// ─── Completed item detail panel ──────────────────────────────────────────────

interface DetailPanelProps {
  item: SnapQueueItem;
  categories: Category[];
  inventoryId: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DetailPanel({ item, categories, inventoryId, onClose, onDeleted }: DetailPanelProps) {
  const [name, setName] = useState(
    item.editedData?.name ?? item.analysisResult?.itemName ?? '',
  );
  const [description, setDescription] = useState(
    item.editedData?.description ?? item.analysisResult?.description ?? '',
  );
  const [categoryId, setCategoryId] = useState(
    item.editedData?.categoryId ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [thumbnailSrc] = useState(() => getThumbnailSrc(item));

  const handleSave = useCallback(async () => {
    if (!item.thingId) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.updateThing(item.thingId, {
        name,
        description: description || undefined,
        categoryId: categoryId || undefined,
        inventoryId,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [item.thingId, name, description, categoryId, inventoryId, onClose]);

  const handleDelete = useCallback(async () => {
    if (!item.thingId) return;
    setDeleting(true);
    setError(null);
    try {
      await apiClient.deleteThing(item.thingId, inventoryId);
      onDeleted(item.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      setDeleting(false);
    }
  }, [item.id, item.thingId, inventoryId, onDeleted, onClose]);

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="detail-panel-title"
    >
      <DialogTitle id="detail-panel-title">
        Edit Item
        <IconButton
          onClick={onClose}
          aria-label="Close detail panel"
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Photo */}
        <Box
          component="img"
          src={thumbnailSrc}
          alt="Captured item photo"
          sx={{
            width: '100%',
            maxHeight: 200,
            objectFit: 'contain',
            borderRadius: 1,
            mb: 2,
            bgcolor: 'grey.100',
          }}
        />

        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 1 }}>
            {error}
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            inputProps={{ 'aria-label': 'Item name' }}
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={2}
            inputProps={{ 'aria-label': 'Item description' }}
          />

          <FormControl fullWidth size="small">
            <InputLabel id="detail-category-label">Category</InputLabel>
            <Select
              labelId="detail-category-label"
              label="Category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              inputProps={{ 'aria-label': 'Item category' }}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        <Button
          onClick={handleDelete}
          color="error"
          disabled={deleting || saving || !item.thingId}
          aria-label="Delete item"
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={saving || deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || deleting || !item.thingId}
            aria-label="Save item changes"
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

// ─── Failed item action panel ─────────────────────────────────────────────────

interface FailedItemPanelProps {
  item: SnapQueueItem;
  categories: Category[];
  inventoryId: string;
  onRetry: () => void;
  onManualEntry: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

function FailedItemPanel({
  item,
  onRetry,
  onManualEntry,
  onDiscard,
  onClose,
}: FailedItemPanelProps) {
  const [thumbnailSrc] = useState(() => getThumbnailSrc(item));

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="failed-item-title"
    >
      <DialogTitle id="failed-item-title">
        Item Failed
        <IconButton
          onClick={onClose}
          aria-label="Close"
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box
          component="img"
          src={thumbnailSrc}
          alt="Failed item photo"
          sx={{
            width: '100%',
            maxHeight: 160,
            objectFit: 'contain',
            borderRadius: 1,
            mb: 2,
            bgcolor: 'grey.100',
          }}
        />

        {item.error && (
          <Typography variant="body2" color="error" sx={{ mb: 2 }}>
            {item.error}
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={onRetry}
            fullWidth
            aria-label="Retry automatic processing"
          >
            Retry Automatically
          </Button>

          <Button
            variant="outlined"
            startIcon={<SearchIcon />}
            onClick={onManualEntry}
            fullWidth
            aria-label="Open manual entry form"
          >
            Manual Entry
          </Button>

          <Button
            variant="outlined"
            color="error"
            startIcon={<CloseIcon />}
            onClick={onDiscard}
            fullWidth
            aria-label="Discard this photo"
          >
            Discard
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ─── Session summary dialog ───────────────────────────────────────────────────

interface SessionSummaryProps {
  stats: { captured: number; completed: number; failed: number };
  onClose: () => void;
}

function SessionSummary({ stats, onClose }: SessionSummaryProps) {
  return (
    <Dialog
      open
      maxWidth="xs"
      fullWidth
      aria-labelledby="session-summary-title"
    >
      <DialogTitle id="session-summary-title">Session Complete</DialogTitle>

      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            py: 1,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body1">Photos captured</Typography>
            <Chip label={stats.captured} size="small" />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body1" color="success.main">
              Items added
            </Typography>
            <Chip
              label={stats.completed}
              size="small"
              color="success"
            />
          </Box>
          {stats.failed > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body1" color="error.main">
                Failed
              </Typography>
              <Chip label={stats.failed} size="small" color="error" />
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button variant="contained" onClick={onClose} fullWidth>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QuickPackMode({
  container,
  inventoryId,
  categories,
  onExit,
}: QuickPackModeProps) {
  const {
    items,
    addPhoto,
    confirmItem,
    editItem,
    retryItem,
    discardItem,
    deleteCompletedItem,
    activeItemId,
    sessionStats,
    isPaused,
  } = useSnapQueue(inventoryId, container.id);

  // Which thumbnail was tapped
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Whether to show the session summary before actually calling onExit
  const [showSummary, setShowSummary] = useState(false);

  // Whether to show the manual entry hint for a failed item (just shows detail panel pre-filled)
  const [manualEntryItemId, setManualEntryItemId] = useState<string | null>(null);

  const activeItem = items.find((i) => i.id === activeItemId) ?? null;
  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;
  const manualEntryItem = items.find((i) => i.id === manualEntryItemId) ?? null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCapture = useCallback(
    (blob: Blob) => {
      addPhoto(blob);
    },
    [addPhoto],
  );

  const handleThumbnailClick = useCallback((item: SnapQueueItem) => {
    setSelectedItemId(item.id);
  }, []);

  const handleExitRequest = useCallback(() => {
    setShowSummary(true);
  }, []);

  const handleSummaryClose = useCallback(() => {
    setShowSummary(false);
    onExit(sessionStats);
  }, [onExit, sessionStats]);

  const handleDetailClose = useCallback(() => {
    setSelectedItemId(null);
  }, []);

  const handleItemDeleted = useCallback(
    async (id: string) => {
      try {
        await deleteCompletedItem(id);
      } catch {
        // item removal is best-effort
      }
      setSelectedItemId(null);
    },
    [deleteCompletedItem],
  );

  const handleRetry = useCallback(
    (id: string) => {
      retryItem(id);
      setSelectedItemId(null);
    },
    [retryItem],
  );

  const handleDiscard = useCallback(
    (id: string) => {
      discardItem(id);
      setSelectedItemId(null);
    },
    [discardItem],
  );

  const handleManualEntry = useCallback((id: string) => {
    setSelectedItemId(null);
    setManualEntryItemId(id);
  }, []);

  const handleManualEntryClose = useCallback(() => {
    setManualEntryItemId(null);
  }, []);

  // ── Edit / Accept for ConfirmationCard ──────────────────────────────────────

  const handleAccept = useCallback(() => {
    if (activeItemId) confirmItem(activeItemId);
  }, [activeItemId, confirmItem]);

  const handleEdit = useCallback(
    (data: Partial<Thing>) => {
      if (activeItemId) editItem(activeItemId, data);
    },
    [activeItemId, editItem],
  );

  const handleCardDiscard = useCallback(() => {
    if (activeItemId) discardItem(activeItemId);
  }, [activeItemId, discardItem]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        bgcolor: 'background.default',
        overflow: 'hidden',
      }}
      role="main"
      aria-label="Quick Pack Mode"
    >
      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <Paper
        elevation={2}
        square
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          py: 1,
          zIndex: 10,
          flexShrink: 0,
        }}
        component="header"
      >
        {/* Container name */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            fontWeight="bold"
            noWrap
            aria-label={`Packing into: ${container.name}`}
          >
            {container.name}
          </Typography>
        </Box>

        {/* Session counter */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            mx: 1,
          }}
          aria-label={`Session: ${sessionStats.completed} completed, ${sessionStats.captured} captured`}
        >
          {isPaused && (
            <Tooltip title="Offline — processing paused">
              <WifiOffIcon sx={{ fontSize: 18, color: 'warning.main' }} aria-label="Offline" />
            </Tooltip>
          )}
          <Chip
            icon={<PhotoCameraIcon />}
            label={`${sessionStats.completed} / ${sessionStats.captured}`}
            size="small"
            color={sessionStats.failed > 0 ? 'warning' : 'default'}
            aria-hidden="true"
          />
        </Box>

        {/* Exit button */}
        <Tooltip title="Exit Quick Pack">
          <IconButton
            onClick={handleExitRequest}
            aria-label="Exit Quick Pack Mode"
            size="small"
          >
            <ExitToAppIcon />
          </IconButton>
        </Tooltip>
      </Paper>

      {/* ── Center: Viewfinder + ConfirmationCard overlay ─────────────────── */}
      <Box
        sx={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <LiveViewfinder
          onCapture={handleCapture}
          onClose={handleExitRequest}
          disabled={activeItemId !== null}
        />

        {/* ConfirmationCard overlay — shown when an item needs confirming */}
        {activeItem && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 20,
              pointerEvents: 'none',
              '& > *': { pointerEvents: 'auto' },
            }}
          >
            <ConfirmationCard
              item={activeItem}
              categories={categories}
              onAccept={handleAccept}
              onEdit={handleEdit}
              onDiscard={handleCardDiscard}
            />
          </Box>
        )}
      </Box>

      {/* ── Bottom: thumbnail strip ────────────────────────────────────────── */}
      {items.length > 0 && (
        <Box
          component="section"
          aria-label="Captured items"
          sx={{
            flexShrink: 0,
            bgcolor: 'grey.900',
            px: 1,
            py: 0.75,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              gap: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.3) transparent',
              pb: 0.25,
              // Make the strip scroll-snapping friendly on mobile
              scrollSnapType: 'x mandatory',
              '& > *': { scrollSnapAlign: 'start' },
            }}
          >
            {items.map((item) => (
              <Thumbnail
                key={item.id}
                item={item}
                isActive={item.id === activeItemId}
                onClick={() => handleThumbnailClick(item)}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* ── Detail panel for completed items ──────────────────────────────── */}
      {selectedItem && selectedItem.status === 'complete' && (
        <DetailPanel
          item={selectedItem}
          categories={categories}
          inventoryId={inventoryId}
          onClose={handleDetailClose}
          onDeleted={handleItemDeleted}
        />
      )}

      {/* ── Action options for failed items ───────────────────────────────── */}
      {selectedItem && selectedItem.status === 'failed' && (
        <FailedItemPanel
          item={selectedItem}
          categories={categories}
          inventoryId={inventoryId}
          onRetry={() => handleRetry(selectedItem.id)}
          onManualEntry={() => handleManualEntry(selectedItem.id)}
          onDiscard={() => handleDiscard(selectedItem.id)}
          onClose={handleDetailClose}
        />
      )}

      {/* ── Manual entry panel (pre-filled with available AI data) ────────── */}
      {manualEntryItem && (
        <DetailPanel
          item={manualEntryItem}
          categories={categories}
          inventoryId={inventoryId}
          onClose={handleManualEntryClose}
          onDeleted={(id) => {
            discardItem(id);
            handleManualEntryClose();
          }}
        />
      )}

      {/* ── Session summary ────────────────────────────────────────────────── */}
      {showSummary && (
        <SessionSummary stats={sessionStats} onClose={handleSummaryClose} />
      )}
    </Box>
  );
}
