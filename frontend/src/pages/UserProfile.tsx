import { Box, Typography, Container, Paper, FormControlLabel, Switch } from '@mui/material';
import UserProfileView from '../components/UserProfileView';
import MfaStatusSection from '../components/MfaStatusSection';
import { useAccessibility } from '../contexts/AccessibilityContext';

/**
 * User Profile Page
 * Displays the current user's profile with editing capabilities
 * Validates: Requirements 4.1, 4.3, 4.4, 6.1, 6.2, 6.3, 6.4, 6.5
 */
export default function UserProfile() {
  const { settings, updateSettings, announceToScreenReader } = useAccessibility();

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          My Profile
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Manage your profile information and view your User ID for sharing with others.
        </Typography>
        
        <UserProfileView
          editable={true}
          onProfileUpdate={(profile) => {
            console.log('Profile updated:', profile);
          }}
        />

        <MfaStatusSection />

        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>Preferences</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={settings.themeMode === 'dark'}
                onChange={(e) => {
                  const newMode = e.target.checked ? 'dark' : 'light';
                  updateSettings({ themeMode: newMode });
                  announceToScreenReader(`Theme changed to ${newMode} mode`);
                }}
                inputProps={{ 'aria-label': 'Dark mode' }}
              />
            }
            label="Dark mode"
          />
        </Paper>
      </Box>
    </Container>
  );
}