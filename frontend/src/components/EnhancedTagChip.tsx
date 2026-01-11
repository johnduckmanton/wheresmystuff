import React, { useState } from 'react';
import {
  Chip,
  Box,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
} from '@mui/icons-material';

export interface EnhancedTagChipProps {
  label: string;
  onDelete?: () => void;
  variant?: 'filled' | 'outlined';
  color?: 'primary' | 'secondary' | 'default';
  size?: 'small' | 'medium';
  showHoverActions?: boolean;
  disabled?: boolean;
  clickable?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/**
 * Enhanced Tag Chip component with improved styling and hover effects
 * Provides delete action on hover for better user interaction
 * Supports theme-aware styling and accessibility features
 * Validates: Requirements 4.1, 4.2, 4.3, 5.3, 5.4
 */
export default function EnhancedTagChip({
  label,
  onDelete,
  variant = 'filled',
  color = 'default',
  size = 'small',
  showHoverActions = true,
  disabled = false,
  clickable = false,
  onClick,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: EnhancedTagChipProps) {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Determine if action icons should be visible
  const showActions = showHoverActions && (isHovered || isFocused) && !disabled;
  const hasActions = onDelete && showHoverActions;

  // Get theme-aware colors
  const getChipColors = () => {
    const isDark = theme.palette.mode === 'dark';
    
    switch (color) {
      case 'primary':
        return {
          backgroundColor: variant === 'filled' 
            ? alpha(theme.palette.primary.main, isDark ? 0.3 : 0.1)
            : 'transparent',
          borderColor: theme.palette.primary.main,
          textColor: theme.palette.primary.main,
          hoverBackgroundColor: alpha(theme.palette.primary.main, isDark ? 0.4 : 0.2),
        };
      case 'secondary':
        return {
          backgroundColor: variant === 'filled' 
            ? alpha(theme.palette.secondary.main, isDark ? 0.3 : 0.1)
            : 'transparent',
          borderColor: theme.palette.secondary.main,
          textColor: theme.palette.secondary.main,
          hoverBackgroundColor: alpha(theme.palette.secondary.main, isDark ? 0.4 : 0.2),
        };
      default:
        return {
          backgroundColor: variant === 'filled' 
            ? alpha(theme.palette.text.primary, isDark ? 0.2 : 0.08)
            : 'transparent',
          borderColor: alpha(theme.palette.text.primary, 0.3),
          textColor: theme.palette.text.primary,
          hoverBackgroundColor: alpha(theme.palette.text.primary, isDark ? 0.3 : 0.12),
        };
    }
  };

  const colors = getChipColors();

  // Handle delete action
  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onDelete && !disabled) {
      onDelete();
    }
  };

  // Handle chip click
  const handleChipClick = () => {
    if (onClick && clickable && !disabled) {
      onClick();
    }
  };

  // Handle keyboard events for accessibility
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        if (onDelete) {
          event.preventDefault();
          onDelete();
        }
        break;
      case 'Enter':
        if (onClick && clickable) {
          event.preventDefault();
          onClick();
        }
        break;
      case 'Escape':
        // Remove focus
        (event.target as HTMLElement).blur();
        break;
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Chip
        label={label}
        size={size}
        variant={variant}
        disabled={disabled}
        clickable={clickable || hasActions}
        onClick={handleChipClick}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        deleteIcon={
          showActions && onDelete ? (
            <Tooltip title="Remove tag" arrow>
              <CloseIcon 
                sx={{ 
                  fontSize: size === 'small' ? 16 : 18,
                  '&:hover': {
                    color: theme.palette.error.main,
                  },
                }} 
              />
            </Tooltip>
          ) : undefined
        }
        onDelete={showActions && onDelete ? handleDelete : undefined}
        sx={{
          height: size === 'small' ? 28 : 32,
          fontSize: size === 'small' ? '0.75rem' : '0.875rem',
          fontWeight: 500,
          borderRadius: '16px',
          transition: theme.transitions.create([
            'background-color',
            'border-color',
            'box-shadow',
            'transform',
          ], {
            duration: theme.transitions.duration.short,
          }),
          backgroundColor: colors.backgroundColor,
          color: colors.textColor,
          border: variant === 'outlined' ? `1px solid ${colors.borderColor}` : 'none',
          
          // Hover effects
          '&:hover': {
            backgroundColor: colors.hoverBackgroundColor,
            transform: hasActions ? 'translateY(-1px)' : 'none',
            boxShadow: hasActions ? theme.shadows[2] : 'none',
          },
          
          // Focus effects for accessibility
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px',
            backgroundColor: colors.hoverBackgroundColor,
          },
          
          // Disabled state
          '&.Mui-disabled': {
            opacity: 0.6,
            cursor: 'not-allowed',
          },
          
          // Clickable state
          ...(clickable && {
            cursor: 'pointer',
            '&:active': {
              transform: 'translateY(0px)',
            },
          }),
          
          // Action spacing when actions are visible
          ...(showActions && {
            paddingRight: size === 'small' ? '8px' : '10px',
          }),
        }}
        // Accessibility props
        aria-label={ariaLabel || `Tag: ${label}`}
        aria-describedby={ariaDescribedBy}
        role={clickable ? 'button' : 'listitem'}
        tabIndex={disabled ? -1 : 0}
      />
    </Box>
  );
}