import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { fetchMFAPreference, updateMFAPreference } from 'aws-amplify/auth';
import MfaSetup from './MfaSetup';

/**
 * MFA Status Section Component
 * Displays current MFA status and allows users to enable/disable TOTP MFA.
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
export default function MfaStatusSection() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState('');
  const [showSetup, setShowSetup] = useState(false);

  const loadMfaStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const preference = await fetchMFAPreference();
      const isEnabled =
        preference.preferred === 'TOTP' ||
        (Array.isArray(preference.enabled) && preference.enabled.includes('TOTP'));
      setMfaEnabled(isEnabled);
    } catch (err) {
      console.error('Error fetching MFA preference:', err);
      setError(err instanceof Error ? err.message : 'Failed to load MFA status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMfaStatus();
  }, [loadMfaStatus]);

  const handleDisableMfa = async () => {
    try {
      setDisabling(true);
      setError('');
      await updateMFAPreference({ totp: 'DISABLED' });
      await loadMfaStatus();
    } catch (err) {
      console.error('Error disabling MFA:', err);
      setError(err instanceof Error ? err.message : 'Failed to disable MFA');
    } finally {
      setDisabling(false);
    }
  };

  const handleSetupComplete = () => {
    setShowSetup(false);
    loadMfaStatus();
  };

  const handleSetupCancel = () => {
    setShowSetup(false);
  };

  if (showSetup) {
    return (
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <MfaSetup onSetupComplete={handleSetupComplete} onCancel={handleSetupCancel} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <SecurityIcon color="primary" />
          <Typography variant="h6">Two-Factor Authentication</Typography>
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={loadMfaStatus}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : mfaEnabled ? (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Chip
                icon={<CheckCircleIcon />}
                label="MFA Active"
                color="success"
                variant="outlined"
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Your account is protected with two-factor authentication.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              onClick={handleDisableMfa}
              disabled={disabling}
              startIcon={disabling ? <CircularProgress size={16} /> : undefined}
            >
              {disabling ? 'Disabling...' : 'Disable MFA'}
            </Button>
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add an extra layer of security to your account by enabling two-factor authentication
              with an authenticator app.
            </Typography>
            <Button variant="contained" onClick={() => setShowSetup(true)}>
              Set up MFA
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
