import React, { useRef, useEffect, useState } from 'react';
import { Box, Typography, Alert, Chip } from '@mui/material';
import { 
  TouchApp as TouchIcon,
  SwipeLeft as SwipeLeftIcon,
  SwipeRight as SwipeRightIcon,
  SwipeUp as SwipeUpIcon,
  SwipeDown as SwipeDownIcon,
} from '@mui/icons-material';
import { useAccessibility } from '../../contexts/AccessibilityContext';

interface GestureAction {
  gesture: 'swipeLeft' | 'swipeRight' | 'swipeUp' | 'swipeDown' | 'tap' | 'doubleTap' | 'longPress';
  action: () => void;
  description: string;
}

interface GestureInputProps {
  actions: GestureAction[];
  children: React.ReactNode;
  disabled?: boolean;
  showInstructions?: boolean;
}

/**
 * Gesture Input Component
 * Provides touch and gesture alternatives for all actions
 * Validates: Requirements 13.3, 13.5
 */
export default function GestureInput({
  actions,
  children,
  disabled = false,
  showInstructions = false,
}: GestureInputProps) {
  const { settings, announceToScreenReader } = useAccessibility();
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [lastTap, setLastTap] = useState<number>(0);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const SWIPE_THRESHOLD = 50;
  const DOUBLE_TAP_DELAY = 300;
  const LONG_PRESS_DELAY = 500;

  const handleTouchStart = (event: TouchEvent) => {
    if (disabled || !settings.keyboardNavigation) return;

    const touch = event.touches[0];
    const startTime = Date.now();
    
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      time: startTime,
    });

    // Start long press timer
    const timer = setTimeout(() => {
      const longPressAction = actions.find(a => a.gesture === 'longPress');
      if (longPressAction) {
        longPressAction.action();
        announceToScreenReader(`Long press: ${longPressAction.description}`, 'polite');
        // Prevent other gestures
        setTouchStart(null);
      }
    }, LONG_PRESS_DELAY);
    
    setLongPressTimer(timer);
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (disabled || !settings.keyboardNavigation || !touchStart) return;

    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    const touch = event.changedTouches[0];
    const endTime = Date.now();
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const deltaTime = endTime - touchStart.time;

    // Determine gesture type
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > SWIPE_THRESHOLD || absY > SWIPE_THRESHOLD) {
      // Swipe gesture
      let gestureType: 'swipeLeft' | 'swipeRight' | 'swipeUp' | 'swipeDown';
      
      if (absX > absY) {
        gestureType = deltaX > 0 ? 'swipeRight' : 'swipeLeft';
      } else {
        gestureType = deltaY > 0 ? 'swipeDown' : 'swipeUp';
      }

      const swipeAction = actions.find(a => a.gesture === gestureType);
      if (swipeAction) {
        swipeAction.action();
        announceToScreenReader(`${gestureType}: ${swipeAction.description}`, 'polite');
      }
    } else if (deltaTime < LONG_PRESS_DELAY) {
      // Tap gesture
      const currentTime = Date.now();
      const timeSinceLastTap = currentTime - lastTap;

      if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
        // Double tap
        const doubleTapAction = actions.find(a => a.gesture === 'doubleTap');
        if (doubleTapAction) {
          doubleTapAction.action();
          announceToScreenReader(`Double tap: ${doubleTapAction.description}`, 'polite');
        }
        setLastTap(0);
      } else {
        // Single tap
        const tapAction = actions.find(a => a.gesture === 'tap');
        if (tapAction) {
          tapAction.action();
          announceToScreenReader(`Tap: ${tapAction.description}`, 'polite');
        }
        setLastTap(currentTime);
      }
    }

    setTouchStart(null);
  };

  const handleTouchMove = (event: TouchEvent) => {
    // Prevent scrolling during gesture recognition
    if (touchStart && !disabled) {
      const touch = event.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStart.x);
      const deltaY = Math.abs(touch.clientY - touchStart.y);
      
      if (deltaX > 10 || deltaY > 10) {
        event.preventDefault();
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [touchStart, lastTap, longPressTimer, actions, disabled, settings.keyboardNavigation]);

  const getGestureIcon = (gesture: string) => {
    switch (gesture) {
      case 'swipeLeft': return <SwipeLeftIcon fontSize="small" />;
      case 'swipeRight': return <SwipeRightIcon fontSize="small" />;
      case 'swipeUp': return <SwipeUpIcon fontSize="small" />;
      case 'swipeDown': return <SwipeDownIcon fontSize="small" />;
      default: return <TouchIcon fontSize="small" />;
    }
  };

  const getGestureLabel = (gesture: string) => {
    switch (gesture) {
      case 'tap': return 'Tap';
      case 'doubleTap': return 'Double Tap';
      case 'longPress': return 'Long Press';
      case 'swipeLeft': return 'Swipe Left';
      case 'swipeRight': return 'Swipe Right';
      case 'swipeUp': return 'Swipe Up';
      case 'swipeDown': return 'Swipe Down';
      default: return gesture;
    }
  };

  return (
    <Box>
      {showInstructions && actions.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            <strong>Available Gestures:</strong>
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {actions.map((action, index) => (
              <Chip
                key={index}
                icon={getGestureIcon(action.gesture)}
                label={`${getGestureLabel(action.gesture)}: ${action.description}`}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        </Alert>
      )}
      
      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          touchAction: disabled ? 'auto' : 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          cursor: disabled ? 'default' : 'pointer',
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Gesture input area"
        aria-describedby="gesture-instructions"
      >
        {children}
      </Box>
      
      {showInstructions && (
        <Typography
          id="gesture-instructions"
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 1 }}
        >
          Use touch gestures to interact with this element. Available gestures are listed above.
        </Typography>
      )}
    </Box>
  );
}

/**
 * Hook for common gesture actions
 * Validates: Requirements 13.3, 13.5
 */
export function useCommonGestures(
  onSelect?: () => void,
  onDelete?: () => void,
  onEdit?: () => void,
  onToggle?: () => void
): GestureAction[] {
  const actions: GestureAction[] = [];

  if (onSelect) {
    actions.push({
      gesture: 'tap',
      action: onSelect,
      description: 'Select item',
    });
  }

  if (onToggle) {
    actions.push({
      gesture: 'doubleTap',
      action: onToggle,
      description: 'Toggle item',
    });
  }

  if (onEdit) {
    actions.push({
      gesture: 'longPress',
      action: onEdit,
      description: 'Edit item',
    });
  }

  if (onDelete) {
    actions.push({
      gesture: 'swipeLeft',
      action: onDelete,
      description: 'Delete item',
    });
  }

  return actions;
}

/**
 * Hook for navigation gestures
 * Validates: Requirements 13.3, 13.5
 */
export function useNavigationGestures(
  onBack?: () => void,
  onForward?: () => void,
  onUp?: () => void,
  onDown?: () => void
): GestureAction[] {
  const actions: GestureAction[] = [];

  if (onBack) {
    actions.push({
      gesture: 'swipeRight',
      action: onBack,
      description: 'Go back',
    });
  }

  if (onForward) {
    actions.push({
      gesture: 'swipeLeft',
      action: onForward,
      description: 'Go forward',
    });
  }

  if (onUp) {
    actions.push({
      gesture: 'swipeUp',
      action: onUp,
      description: 'Scroll up',
    });
  }

  if (onDown) {
    actions.push({
      gesture: 'swipeDown',
      action: onDown,
      description: 'Scroll down',
    });
  }

  return actions;
}