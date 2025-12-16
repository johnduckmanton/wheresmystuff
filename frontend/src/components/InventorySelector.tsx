
import {
  Box,
  Select,
  MenuItem,
  FormControl,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../contexts/InventoryContext';

interface InventorySelectorProps {
  collapsed?: boolean;
}

/**
 * Inventory Selector Component
 * Allows users to switch between inventories and access inventory management
 * Validates: Requirements 1.1
 */
export default function InventorySelector({ collapsed = false }: InventorySelectorProps) {
  const navigate = useNavigate();
  const { currentInventory, inventories, setCurrentInventory } = useInventory();

  const handleInventoryChange = (inventoryId: string) => {
    const inventory = inventories.find(inv => inv.id === inventoryId);
    if (inventory) {
      setCurrentInventory(inventory);
    }
  };

  const handleManageInventories = () => {
    navigate('/inventories');
  };

  const handleInventorySettings = () => {
    if (currentInventory) {
      navigate(`/inventories/${currentInventory.id}/settings`);
    }
  };

  if (collapsed) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 1 }}>
        <Tooltip title={currentInventory?.name || 'No inventory selected'} placement="right">
          <IconButton
            onClick={handleManageInventories}
            sx={{
              width: 40,
              height: 40,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
            }}
          >
            {currentInventory?.name?.charAt(0).toUpperCase() || '?'}
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Manage inventories" placement="right">
          <IconButton size="small" onClick={handleManageInventories}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Current Inventory
      </Typography>
      
      <FormControl fullWidth size="small" sx={{ mb: 1 }}>
        <Select
          value={currentInventory?.id || ''}
          onChange={(e) => handleInventoryChange(e.target.value)}
          displayEmpty
          sx={{ fontSize: '0.875rem' }}
        >
          {inventories.length === 0 ? (
            <MenuItem value="" disabled>
              No inventories available
            </MenuItem>
          ) : (
            inventories.map((inventory) => (
              <MenuItem key={inventory.id} value={inventory.id}>
                <Box>
                  <Typography variant="body2" noWrap>
                    {inventory.name}
                  </Typography>
                  {inventory.description && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {inventory.description}
                    </Typography>
                  )}
                </Box>
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>
      
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="Inventory settings">
          <IconButton
            size="small"
            onClick={handleInventorySettings}
            disabled={!currentInventory}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Manage inventories">
          <IconButton size="small" onClick={handleManageInventories}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}