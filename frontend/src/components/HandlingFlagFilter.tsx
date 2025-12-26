
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,

  type SelectChangeEvent,
} from '@mui/material';
import HandlingFlagChip from './HandlingFlagChip';
import { HandlingFlag } from '../types/entities';

interface HandlingFlagFilterProps {
  selectedFlags: HandlingFlag[];
  onFlagsChange: (flags: HandlingFlag[]) => void;
  availableFlags?: HandlingFlag[];
  label?: string;
  variant?: 'select' | 'chips';
  size?: 'small' | 'medium';
}

const allHandlingFlags: HandlingFlag[] = [
  'fragile',
  'heavy', 
  'valuable',
  'priority',
  'keep_upright',
  'temperature_sensitive',
];

export default function HandlingFlagFilter({
  selectedFlags,
  onFlagsChange,
  availableFlags = allHandlingFlags,
  label = 'Handling Requirements',
  variant = 'select',
  size = 'medium',
}: HandlingFlagFilterProps) {
  const handleSelectChange = (event: SelectChangeEvent<HandlingFlag[]>) => {
    const value = event.target.value;
    onFlagsChange(typeof value === 'string' ? value.split(',') as HandlingFlag[] : value);
  };

  const handleChipToggle = (flag: HandlingFlag) => {
    const newFlags = selectedFlags.includes(flag)
      ? selectedFlags.filter(f => f !== flag)
      : [...selectedFlags, flag];
    onFlagsChange(newFlags);
  };

  if (variant === 'chips') {
    return (
      <Box>
        {label && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {label}
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {availableFlags.map((flag) => (
            <HandlingFlagChip
              key={flag}
              flag={flag}
              size={size}
              variant={selectedFlags.includes(flag) ? 'filled' : 'outlined'}
              showIcon={true}
              showLabel={true}
              onClick={() => handleChipToggle(flag)}
            />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <FormControl fullWidth size={size}>
      <InputLabel>{label}</InputLabel>
      <Select
        multiple
        value={selectedFlags}
        onChange={handleSelectChange}
        input={<OutlinedInput label={label} />}
        renderValue={(selected) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selected.map((flag) => (
              <HandlingFlagChip
                key={flag}
                flag={flag}
                size="small"
                showIcon={false}
                showLabel={true}
              />
            ))}
          </Box>
        )}
      >
        {availableFlags.map((flag) => (
          <MenuItem key={flag} value={flag}>
            <HandlingFlagChip
              flag={flag}
              size="small"
              showIcon={true}
              showLabel={true}
            />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}