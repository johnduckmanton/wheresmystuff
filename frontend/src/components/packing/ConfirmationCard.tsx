import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slide,
  TextField,
  Typography,
} from '@mui/material';
import {
  DeleteOutline as DeleteOutlineIcon,
  WarningAmber as WarningAmberIcon,
} from '@mui/icons-material';
import type { SnapQueueItem } from '../../hooks/useSnapQueue';
import type { Category, Thing } from '../../types';

export interface ConfirmationCardProps {
  item: SnapQueueItem;
  categories: Category[];
  onAccept: () => void;
  onEdit: (editedData: Partial<Thing>) => void;
  onDiscard: () => void;
  lowConfidenceThreshold?: number;
}

export default function ConfirmationCard({
  item,
  categories,
  onAccept,
  onEdit,
  onDiscard,
  lowConfidenceThreshold = 0.6,
}: ConfirmationCardProps) {
  const analysis = item.analysisResult;

  // Resolve the initial category ID by matching the suggested category name
  const initialCategory = categories.find(
    (c) => c.name === analysis?.suggestedCategory,
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(analysis?.itemName ?? '');
  const [editDescription, setEditDescription] = useState(analysis?.description ?? '');
  const [editCategoryId, setEditCategoryId] = useState(initialCategory?.id ?? '');

  const isLowConfidence =
    analysis !== undefined &&
    analysis.confidence.overall <= lowConfidenceThreshold;

  function handleEditConfirm() {
    const editedData: Partial<Thing> = {
      name: editName,
      description: editDescription || undefined,
      categoryId: editCategoryId || undefined,
    };
    onEdit(editedData);
  }

  function handleEditCancel() {
    // Reset fields back to analysis values
    setEditName(analysis?.itemName ?? '');
    setEditDescription(analysis?.description ?? '');
    setEditCategoryId(initialCategory?.id ?? '');
    setIsEditing(false);
  }

  return (
    <Slide direction="up" in mountOnEnter={false} unmountOnExit={false}>
      <Paper
        elevation={8}
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          borderRadius: '16px 16px 0 0',
          p: 2,
        }}
      >
        {isEditing ? (
          /* ── Edit mode ─────────────────────────────────────────────── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              fullWidth
              size="small"
              inputProps={{ 'aria-label': 'Item name' }}
            />

            <TextField
              label="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              fullWidth
              size="small"
              multiline
              rows={2}
              inputProps={{ 'aria-label': 'Item description' }}
            />

            <FormControl fullWidth size="small">
              <InputLabel id="category-select-label">Category</InputLabel>
              <Select
                labelId="category-select-label"
                label="Category"
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
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

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                onClick={handleEditConfirm}
                fullWidth
                aria-label="Confirm edits"
              >
                Confirm
              </Button>
              <Button
                variant="outlined"
                onClick={handleEditCancel}
                fullWidth
                aria-label="Cancel editing"
              >
                Cancel
              </Button>
            </Box>
          </Box>
        ) : (
          /* ── Display mode ──────────────────────────────────────────── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Row 1: item name + discard button */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6" sx={{ flex: 1, mr: 1 }} noWrap>
                {analysis?.itemName ?? 'Unknown item'}
              </Typography>
              <IconButton
                onClick={onDiscard}
                size="small"
                aria-label="Discard item"
                color="default"
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Box>

            {/* Row 2: category chip */}
            {analysis?.suggestedCategory && (
              <Box>
                <Chip
                  label={analysis.suggestedCategory}
                  size="small"
                  aria-label={`Category: ${analysis.suggestedCategory}`}
                />
              </Box>
            )}

            {/* Row 3: low-confidence warning chip */}
            {isLowConfidence && (
              <Box>
                <Chip
                  icon={<WarningAmberIcon />}
                  label="Low confidence — please verify"
                  size="small"
                  sx={{
                    bgcolor: 'warning.light',
                    color: 'warning.contrastText',
                    '& .MuiChip-icon': { color: 'warning.contrastText' },
                  }}
                  aria-label="Low confidence warning"
                />
              </Box>
            )}

            {/* Row 4: action buttons */}
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={onAccept}
                aria-label="Accept AI suggestion"
              >
                Accept
              </Button>
              <Button
                variant="outlined"
                onClick={() => setIsEditing(true)}
                aria-label="Edit item details"
              >
                Edit
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Slide>
  );
}
