
import { Chip, Tooltip } from '@mui/material';
import {
  Warning as FragileIcon,
  FitnessCenter as HeavyIcon,
  Diamond as ValuableIcon,
  PriorityHigh as PriorityIcon,
  VerticalAlignTop as KeepUprightIcon,
  Thermostat as TemperatureIcon,
} from '@mui/icons-material';
import type { HandlingFlag } from '../types/entities';

interface HandlingFlagChipProps {
  flag: HandlingFlag;
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
  showIcon?: boolean;
  showLabel?: boolean;
  onClick?: () => void;
}

const handlingFlagConfig = {
  fragile: {
    label: 'Fragile',
    color: 'error' as const,
    icon: FragileIcon,
    description: 'Handle with care - fragile items',
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
  },
  heavy: {
    label: 'Heavy',
    color: 'warning' as const,
    icon: HeavyIcon,
    description: 'Heavy container - use proper lifting techniques',
    backgroundColor: '#fff3e0',
    borderColor: '#ff9800',
  },
  valuable: {
    label: 'Valuable',
    color: 'success' as const,
    icon: ValuableIcon,
    description: 'Contains valuable items - secure handling required',
    backgroundColor: '#e8f5e8',
    borderColor: '#4caf50',
  },
  priority: {
    label: 'Priority',
    color: 'primary' as const,
    icon: PriorityIcon,
    description: 'Priority container - handle first',
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  keep_upright: {
    label: 'Keep Upright',
    color: 'info' as const,
    icon: KeepUprightIcon,
    description: 'Must be kept upright at all times',
    backgroundColor: '#e1f5fe',
    borderColor: '#03a9f4',
  },
  temperature_sensitive: {
    label: 'Temperature Sensitive',
    color: 'secondary' as const,
    icon: TemperatureIcon,
    description: 'Temperature sensitive - avoid extreme temperatures',
    backgroundColor: '#fce4ec',
    borderColor: '#e91e63',
  },
};

export default function HandlingFlagChip({
  flag,
  size = 'small',
  variant = 'filled',
  showIcon = true,
  showLabel = true,
  onClick,
}: HandlingFlagChipProps) {
  const config = handlingFlagConfig[flag];
  
  if (!config) {
    return null;
  }

  const IconComponent = config.icon;
  
  const chipProps = {
    size,
    color: config.color,
    variant,
    clickable: !!onClick,
    onClick,
    sx: {
      ...(variant === 'outlined' && {
        borderColor: config.borderColor,
        backgroundColor: 'transparent',
        '&:hover': {
          backgroundColor: config.backgroundColor,
        },
      }),
      ...(variant === 'filled' && {
        backgroundColor: config.backgroundColor,
        color: config.borderColor,
        border: `1px solid ${config.borderColor}`,
        '&:hover': {
          backgroundColor: config.borderColor,
          color: 'white',
        },
      }),
    },
  };

  // const chipContent = (
  //   <>
  //     {showIcon && <IconComponent sx={{ fontSize: size === 'small' ? 14 : 18 }} />}
  //     {showLabel && config.label}
  //   </>
  // );

  if (showIcon && !showLabel) {
    // Icon only - show as tooltip
    return (
      <Tooltip title={`${config.label}: ${config.description}`} arrow>
        <Chip
          {...chipProps}
          label={<IconComponent sx={{ fontSize: size === 'small' ? 14 : 18 }} />}
        />
      </Tooltip>
    );
  }

  if (showLabel && !showIcon) {
    // Label only
    return (
      <Tooltip title={config.description} arrow>
        <Chip {...chipProps} label={config.label} />
      </Tooltip>
    );
  }

  // Both icon and label
  return (
    <Tooltip title={config.description} arrow>
      <Chip
        {...chipProps}
        icon={showIcon ? <IconComponent /> : undefined}
        label={showLabel ? config.label : undefined}
      />
    </Tooltip>
  );
}

// Export utility functions for getting flag info
export const getHandlingFlagConfig = (flag: HandlingFlag) => handlingFlagConfig[flag];

export const getHandlingFlagColor = (flag: HandlingFlag) => handlingFlagConfig[flag]?.color || 'default';

export const getHandlingFlagLabel = (flag: HandlingFlag) => handlingFlagConfig[flag]?.label || flag;

export const getHandlingFlagIcon = (flag: HandlingFlag) => handlingFlagConfig[flag]?.icon;

export const getHandlingFlagDescription = (flag: HandlingFlag) => handlingFlagConfig[flag]?.description || '';