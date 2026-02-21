import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Inventory as InventoryIcon, Add as AddIcon } from '@mui/icons-material';

export interface ModeSelectorProps {
  mode: 'select' | 'create';
  onModeChange: (mode: 'select' | 'create') => void;
  disabled?: boolean;
}

export default function ModeSelector({ mode, onModeChange, disabled = false }: ModeSelectorProps) {
  const handleModeChange = (_event: React.MouseEvent<HTMLElement>, newMode: 'select' | 'create' | null) => {
    if (newMode !== null) {
      onModeChange(newMode);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={handleModeChange}
        disabled={disabled}
        aria-label="packing mode selection"
        orientation="horizontal"
        sx={{
          width: { xs: '100%', sm: 'auto' },
          flexDirection: { xs: 'column', sm: 'row' },
          '& .MuiToggleButtonGroup-grouped': {
            width: { xs: '100%', sm: 'auto' },
          },
          '& .MuiToggleButton-root': {
            minHeight: '48px',
            px: 3,
            py: 1.5,
            fontSize: '1rem',
            textTransform: 'none',
            fontWeight: 'medium',
            width: { xs: '100%', sm: 'auto' },
          },
        }}
      >
        <ToggleButton value="select" aria-label="select existing items">
          <InventoryIcon sx={{ mr: 1 }} />
          Select Existing
        </ToggleButton>
        <ToggleButton value="create" aria-label="create new item">
          <AddIcon sx={{ mr: 1 }} />
          Create New
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
