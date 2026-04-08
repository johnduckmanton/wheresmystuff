import { Box, Typography, Container } from '@mui/material';
import UserProfileView from '../components/UserProfileView';
import MfaStatusSection from '../components/MfaStatusSection';

/**
 * User Profile Page
 * Displays the current user's profile with editing capabilities
 * Validates: Requirements 4.1, 4.3, 4.4
 */
export default function UserProfile() {
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
      </Box>
    </Container>
  );
}