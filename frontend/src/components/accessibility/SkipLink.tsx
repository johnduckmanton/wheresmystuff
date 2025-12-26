
import { Button, Box } from '@mui/material';
import { useAccessibility } from '../../contexts/AccessibilityContext';

/**
 * Skip Link Component for keyboard navigation
 * Validates: Requirements 13.1, 13.2
 */
export default function SkipLink() {
  const { skipToContent } = useAccessibility();

  return (
    <Box
      sx={{
        position: 'absolute',
        top: -40,
        left: 6,
        zIndex: 9999,
        '&:focus-within': {
          top: 6,
        },
      }}
    >
      <Button
        variant="contained"
        color="primary"
        onClick={skipToContent}
        sx={{
          fontSize: '0.875rem',
          fontWeight: 'bold',
          padding: '8px 16px',
          '&:focus': {
            outline: '3px solid #ffffff',
            outlineOffset: '2px',
          },
        }}
        onFocus={(e) => {
          e.currentTarget.scrollIntoView({ behavior: 'auto', block: 'center' });
        }}
      >
        Skip to main content
      </Button>
    </Box>
  );
}