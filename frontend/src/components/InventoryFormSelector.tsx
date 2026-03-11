import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import { useInventory } from '../contexts/InventoryContext';

interface InventoryFormSelectorProps {
  value: string;
  onChange: (inventoryId: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Inventory Form Selector Component
 * Reusable inventory selector for entity forms
 * Validates: Requirements 1.2
 */
export default function InventoryFormSelector({
  value,
  onChange,
  error,
  required = true,
  disabled = false,
}: InventoryFormSelectorProps) {
  const { inventories, currentInventory } = useInventory();

  // Auto-select current inventory if no value is set
  const effectiveValue = value || currentInventory?.id || '';

  // Deduplicate inventories by ID
  const uniqueInventories = inventories.reduce((acc, inventory) => {
    if (!acc.find(inv => inv.id === inventory.id)) {
      acc.push(inventory);
    }
    return acc;
  }, [] as typeof inventories);

  return (
    <FormControl fullWidth error={!!error} required={required}>
      <InputLabel id="inventory-select-label">
        Inventory
      </InputLabel>
      <Select
        labelId="inventory-select-label"
        value={effectiveValue}
        label="Inventory"
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        inputProps={{
          'aria-label': 'Select inventory',
          'aria-required': required,
        }}
      >
        {uniqueInventories.length === 0 ? (
          <MenuItem value="" disabled>
            No inventories available
          </MenuItem>
        ) : (
          uniqueInventories.map((inventory) => (
            <MenuItem key={inventory.id} value={inventory.id}>
              {inventory.name}
              {inventory.description && (
                <span style={{ color: 'text.secondary', fontSize: '0.875rem', marginLeft: 8 }}>
                  - {inventory.description}
                </span>
              )}
            </MenuItem>
          ))
        )}
      </Select>
      {error && <FormHelperText>{error}</FormHelperText>}
      {!error && required && (
        <FormHelperText>
          Select which inventory this item belongs to
        </FormHelperText>
      )}
    </FormControl>
  );
}