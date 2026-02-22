import { Eye, EyeOff } from 'lucide-react';
import { Box } from '@mui/material';

interface PasswordToggleButtonProps {
  isVisible: boolean;
  onToggle: () => void;
  fieldId: string;
  className?: string;
}

export default function PasswordToggleButton({
  isVisible,
  onToggle,
  fieldId,
  className,
}: PasswordToggleButtonProps) {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onToggle();
    }
  };

  const ariaLabel = isVisible ? 'Hide password' : 'Show password';
  const Icon = isVisible ? EyeOff : Eye;

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      aria-pressed={isVisible}
      aria-controls={fieldId}
      className={className}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '44px',
        minHeight: '44px',
        cursor: 'pointer',
        borderRadius: '4px',
        transition: 'background-color 0.2s, outline 0.2s',
        '&:hover': {
          backgroundColor: 'action.hover',
        },
        '&:focus': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: '2px',
        },
        '&:focus:not(:focus-visible)': {
          outline: 'none',
        },
      }}
    >
      <Icon size={20} aria-hidden="true" />
    </Box>
  );
}
