import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useNotification } from '../contexts/NotificationContext';
import apiClient from '../services/api';

/**
 * Invitation Acceptance Page
 * Handles invitation token validation and processing
 * Validates: Requirements 1.5
 */
export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [inventoryId, setInventoryId] = useState<string | null>(null);
  const [inventoryName, setInventoryName] = useState<string | null>(null);

  useEffect(() => {
    const acceptInvitation = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setError('Invalid invitation link: No token provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Accept the invitation
        const result = await apiClient.acceptInvitation(token);
        
        // Get inventory details
        const inventory = await apiClient.getInventory(result.inventoryId);
        
        setSuccess(true);
        setInventoryId(result.inventoryId);
        setInventoryName(inventory.name);
        
        showSuccess(`Successfully joined ${inventory.name}!`);
      } catch (err) {
        console.error('Error accepting invitation:', err);
        
        const errorMessage = err instanceof Error ? err.message : 'Failed to accept invitation';
        
        // Provide specific error messages based on error type
        if (errorMessage.includes('Invalid or expired')) {
          setError('This invitation link is invalid or has expired. Please request a new invitation.');
        } else if (errorMessage.includes('already been processed')) {
          setError('This invitation has already been used. You may already be a member of this inventory.');
        } else if (errorMessage.includes('has expired')) {
          setError('This invitation has expired. Please request a new invitation from the inventory owner.');
        } else if (errorMessage.includes('already a member')) {
          setError('You are already a member of this inventory.');
        } else {
          setError(errorMessage);
        }
        
        showError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    acceptInvitation();
  }, [searchParams, showSuccess, showError]);

  const handleGoToInventory = () => {
    if (inventoryId) {
      navigate('/inventories');
    }
  };

  const handleGoHome = () => {
    navigate('/things');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 500, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          {loading && (
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress size={60} sx={{ mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Processing Invitation
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please wait while we add you to the inventory...
              </Typography>
            </Box>
          )}

          {!loading && success && (
            <Box sx={{ textAlign: 'center' }}>
              <CheckCircleIcon
                sx={{ fontSize: 60, color: 'success.main', mb: 2 }}
              />
              <Typography variant="h5" gutterBottom>
                Invitation Accepted!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                You have successfully joined <strong>{inventoryName}</strong>.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  onClick={handleGoToInventory}
                  size="large"
                >
                  View Inventories
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleGoHome}
                  size="large"
                >
                  Go to Home
                </Button>
              </Box>
            </Box>
          )}

          {!loading && error && (
            <Box sx={{ textAlign: 'center' }}>
              <ErrorIcon
                sx={{ fontSize: 60, color: 'error.main', mb: 2 }}
              />
              <Typography variant="h5" gutterBottom>
                Unable to Accept Invitation
              </Typography>
              <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
                {error}
              </Alert>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  onClick={handleGoHome}
                  size="large"
                >
                  Go to Home
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
