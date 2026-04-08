import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import { setUpTOTP, verifyTOTPSetup, updateMFAPreference, getCurrentUser } from 'aws-amplify/auth';

const APP_NAME = 'WheresMyStuff';

/**
 * Build a TOTP otpauth:// URI for QR code scanning.
 * Extracted as a pure function for independent testing.
 */
export function buildTotpUri(secret: string, username: string, issuer: string = APP_NAME): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedUsername = encodeURIComponent(username);
  const encodedSecret = encodeURIComponent(secret);
  return `otpauth://totp/${encodedIssuer}:${encodedUsername}?secret=${encodedSecret}&issuer=${encodedIssuer}`;
}

/**
 * Sanitize TOTP code input: strip non-numeric characters and truncate to 6 digits.
 * Extracted as a pure function for independent testing.
 */
export function sanitizeTotpCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, 6);
}

export interface MfaSetupProps {
  /** For forced setup during sign-in, pass the setup details from the sign-in response */
  totpSetupDetails?: { secretCode: string; username: string };
  /** Optional custom verify handler for forced sign-in flow (replaces internal verifyTOTPSetup) */
  onVerify?: (code: string) => Promise<void>;
  /** Called when setup completes successfully */
  onSetupComplete: () => void;
  /** Called when user cancels setup */
  onCancel: () => void;
}

/**
 * MFA Setup Component
 * Reusable TOTP setup wizard used by both the Profile page and forced sign-in setup flow.
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */
export default function MfaSetup({ totpSetupDetails, onVerify, onSetupComplete, onCancel }: MfaSetupProps) {
  const [secret, setSecret] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (totpSetupDetails) {
      setSecret(totpSetupDetails.secretCode);
      setUsername(totpSetupDetails.username);
      setSetupLoading(false);
    } else {
      initializeSetup();
    }
  }, [totpSetupDetails]);

  const initializeSetup = async () => {
    try {
      setSetupLoading(true);
      setError('');
      const totpSetup = await setUpTOTP();
      const currentUser = await getCurrentUser();
      setSecret(totpSetup.sharedSecret);
      setUsername(currentUser.signInDetails?.loginId || currentUser.username);
    } catch (err) {
      console.error('TOTP setup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to set up MFA. Please try again.');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = secret;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleCodeChange = (value: string) => {
    setCode(sanitizeTotpCode(value));
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (code.length !== 6) {
      setError('Please enter a 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      if (onVerify) {
        // Custom verify handler (e.g., forced sign-in flow uses confirmSignIn)
        await onVerify(code);
      } else {
        await verifyTOTPSetup({ code });
        await updateMFAPreference({ totp: 'PREFERRED' });
        setSetupComplete(true);
      }
    } catch (err: any) {
      console.error('TOTP verification error:', err);
      if (err.name === 'EnableSoftwareTokenMFAException' || err.name === 'CodeMismatchException') {
        setError('Invalid verification code. Please check your authenticator app and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to verify code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (setupComplete) {
    return (
      <Paper elevation={0} sx={{ p: 3, textAlign: 'center' }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            bgcolor: 'success.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
          aria-hidden="true"
        >
          <CheckCircleIcon sx={{ color: 'white' }} />
        </Box>
        <Typography variant="h6" gutterBottom>
          MFA is now active
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Your account is now protected with two-factor authentication.
        </Typography>
        <Button variant="contained" onClick={onSetupComplete}>
          Done
        </Button>
      </Paper>
    );
  }

  // Loading state
  if (setupLoading) {
    return (
      <Paper elevation={0} sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          Setting up MFA...
        </Typography>
      </Paper>
    );
  }

  // Setup error with no secret (initial setup failed)
  if (error && !secret) {
    return (
      <Paper elevation={0} sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="contained" onClick={initializeSetup}>
            Retry
          </Button>
        </Box>
      </Paper>
    );
  }

  const totpUri = buildTotpUri(secret, username);

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6">Set Up Authenticator App</Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Scan the QR code below with your authenticator app (e.g., Google Authenticator, Authy),
        or manually enter the secret key.
      </Typography>

      {/* QR Code */}
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
        <QRCodeSVG value={totpUri} size={200} level="M" />
      </Box>

      {/* Secret key for manual entry */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          bgcolor: 'grey.100',
          borderRadius: 1,
          p: 1.5,
          mb: 3,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            flex: 1,
          }}
          aria-label="TOTP secret key"
        >
          {secret}
        </Typography>
        <Tooltip title={copySuccess ? 'Copied!' : 'Copy secret'}>
          <IconButton
            size="small"
            onClick={handleCopySecret}
            aria-label="Copy secret key"
          >
            <CopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Verification form */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter the 6-digit code from your authenticator app to complete setup.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleVerify} noValidate>
        <TextField
          fullWidth
          id="mfa-setup-code"
          label="Verification Code"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          disabled={loading}
          autoComplete="one-time-code"
          helperText="Enter the 6-digit code from your authenticator app"
          inputProps={{
            'aria-label': 'Verification Code',
            maxLength: 6,
            inputMode: 'numeric',
            pattern: '[0-9]*',
          }}
          sx={{ mb: 2 }}
        />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || code.length !== 6}
            aria-label={loading ? 'Verifying...' : 'Verify and enable MFA'}
          >
            {loading ? <CircularProgress size={24} /> : 'Verify & Enable'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
