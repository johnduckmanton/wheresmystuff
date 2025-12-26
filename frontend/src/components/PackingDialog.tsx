
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
} from '@mui/icons-material';
import PackingInterface from './PackingInterface';
import type { Container } from '../types/entities';

interface PackingDialogProps {
  open: boolean;
  container: Container | null;
  onClose: () => void;
  onItemsAdded?: (itemIds: string[]) => void;
  onContainerUpdated?: (container: Container) => void;
}

export default function PackingDialog({
  open,
  container,
  onClose,
  onItemsAdded,
  onContainerUpdated,
}: PackingDialogProps) {
  if (!container) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen
      aria-labelledby="packing-dialog-title"
    >
      <DialogTitle 
        id="packing-dialog-title"
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          pb: 2,
        }}
      >
        <Box>
          <Typography variant="h5" component="div">
            Pack Items
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add items to {container.name}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="large">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0, height: '100%' }}>
        <PackingInterface
          container={container}
          onClose={onClose}
          onItemsAdded={onItemsAdded || (() => {})}
          onContainerUpdated={onContainerUpdated}
        />
      </DialogContent>
    </Dialog>
  );
}