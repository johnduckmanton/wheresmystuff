import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  RadioGroup,
  Radio,
  Switch,
  Box,
  Typography,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Accessibility as AccessibilityIcon,
  Visibility as VisibilityIcon,
  TextFields as TextFieldsIcon,
  Animation as AnimationIcon,
  Keyboard as KeyboardIcon,

} from '@mui/icons-material';
import { useAccessibility } from '../../contexts/AccessibilityContext';

interface AccessibilitySettingsProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Accessibility Settings Dialog
 * Validates: Requirements 13.1, 13.2, 13.4
 */
export default function AccessibilitySettings({ open, onClose }: AccessibilitySettingsProps) {
  const { settings, updateSettings, announceToScreenReader } = useAccessibility();

  const handleSettingChange = (setting: string, value: any) => {
    updateSettings({ [setting]: value });
    announceToScreenReader(`${setting} ${value ? 'enabled' : 'disabled'}`);
  };

  const handleFontSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fontSize = event.target.value as 'small' | 'medium' | 'large' | 'extra-large';
    updateSettings({ fontSize });
    announceToScreenReader(`Font size changed to ${fontSize}`);
  };

  const handleColorBlindnessChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const mode = event.target.value as 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
    updateSettings({ colorBlindnessMode: mode });
    announceToScreenReader(`Color blindness mode changed to ${mode === 'none' ? 'none' : mode}`);
  };

  const resetToDefaults = () => {
    updateSettings({
      highContrast: false,
      largeText: false,
      reducedMotion: false,
      keyboardNavigation: true,
      screenReaderMode: false,
      fontSize: 'medium',
      colorBlindnessMode: 'none',
    });
    announceToScreenReader('Accessibility settings reset to defaults');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="accessibility-settings-title"
      aria-describedby="accessibility-settings-description"
    >
      <DialogTitle
        id="accessibility-settings-title"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessibilityIcon />
          <Typography variant="h6">Accessibility Settings</Typography>
        </Box>
        <Tooltip title="Close settings">
          <IconButton
            onClick={onClose}
            size="small"
            aria-label="Close accessibility settings"
          >
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      <DialogContent>
        <Typography
          id="accessibility-settings-description"
          variant="body2"
          color="text.secondary"
          sx={{ mb: 3 }}
        >
          Customize the interface to meet your accessibility needs. These settings are saved locally and will persist across sessions.
        </Typography>

        {/* Visual Settings */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <VisibilityIcon />
            Visual Settings
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={settings.highContrast}
                onChange={(e) => handleSettingChange('highContrast', e.target.checked)}
                inputProps={{ 'aria-describedby': 'high-contrast-description' }}
              />
            }
            label="High Contrast Mode"
            sx={{ display: 'flex', justifyContent: 'space-between', ml: 0, mb: 1 }}
          />
          <Typography
            id="high-contrast-description"
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2, ml: 2 }}
          >
            Increases contrast between text and background for better visibility
          </Typography>

          <FormControl component="fieldset" sx={{ mb: 2 }}>
            <FormLabel component="legend" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextFieldsIcon />
              Font Size
            </FormLabel>
            <RadioGroup
              value={settings.fontSize}
              onChange={handleFontSizeChange}
              row
              sx={{ ml: 2 }}
            >
              <FormControlLabel value="small" control={<Radio />} label="Small" />
              <FormControlLabel value="medium" control={<Radio />} label="Medium" />
              <FormControlLabel value="large" control={<Radio />} label="Large" />
              <FormControlLabel value="extra-large" control={<Radio />} label="Extra Large" />
            </RadioGroup>
          </FormControl>

          <FormControl component="fieldset" sx={{ mb: 2 }}>
            <FormLabel component="legend">Color Blindness Support</FormLabel>
            <RadioGroup
              value={settings.colorBlindnessMode}
              onChange={handleColorBlindnessChange}
              sx={{ ml: 2 }}
            >
              <FormControlLabel value="none" control={<Radio />} label="None" />
              <FormControlLabel value="protanopia" control={<Radio />} label="Protanopia (Red-blind)" />
              <FormControlLabel value="deuteranopia" control={<Radio />} label="Deuteranopia (Green-blind)" />
              <FormControlLabel value="tritanopia" control={<Radio />} label="Tritanopia (Blue-blind)" />
            </RadioGroup>
          </FormControl>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Motion Settings */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AnimationIcon />
            Motion Settings
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={settings.reducedMotion}
                onChange={(e) => handleSettingChange('reducedMotion', e.target.checked)}
                inputProps={{ 'aria-describedby': 'reduced-motion-description' }}
              />
            }
            label="Reduce Motion"
            sx={{ display: 'flex', justifyContent: 'space-between', ml: 0, mb: 1 }}
          />
          <Typography
            id="reduced-motion-description"
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2, ml: 2 }}
          >
            Minimizes animations and transitions that may cause discomfort
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Navigation Settings */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <KeyboardIcon />
            Navigation Settings
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={settings.keyboardNavigation}
                onChange={(e) => handleSettingChange('keyboardNavigation', e.target.checked)}
                inputProps={{ 'aria-describedby': 'keyboard-nav-description' }}
              />
            }
            label="Enhanced Keyboard Navigation"
            sx={{ display: 'flex', justifyContent: 'space-between', ml: 0, mb: 1 }}
          />
          <Typography
            id="keyboard-nav-description"
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2, ml: 2 }}
          >
            Improves focus indicators and keyboard shortcuts
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={settings.screenReaderMode}
                onChange={(e) => handleSettingChange('screenReaderMode', e.target.checked)}
                inputProps={{ 'aria-describedby': 'screen-reader-description' }}
              />
            }
            label="Screen Reader Optimizations"
            sx={{ display: 'flex', justifyContent: 'space-between', ml: 0, mb: 1 }}
          />
          <Typography
            id="screen-reader-description"
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2, ml: 2 }}
          >
            Provides additional context and descriptions for screen readers
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Keyboard Shortcuts Info */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Keyboard Shortcuts
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, fontSize: '0.875rem' }}>
            <Typography variant="body2"><kbd>Tab</kbd> - Navigate forward</Typography>
            <Typography variant="body2"><kbd>Shift+Tab</kbd> - Navigate backward</Typography>
            <Typography variant="body2"><kbd>Enter/Space</kbd> - Activate button</Typography>
            <Typography variant="body2"><kbd>Esc</kbd> - Close dialog</Typography>
            <Typography variant="body2"><kbd>Arrow keys</kbd> - Navigate lists</Typography>
            <Typography variant="body2"><kbd>Home/End</kbd> - First/Last item</Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={resetToDefaults} color="inherit">
          Reset to Defaults
        </Button>
        <Button onClick={onClose} variant="contained" autoFocus>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}