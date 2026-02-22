import { useState, type FormEvent, useEffect } from 'react';
import { signIn, confirmSignIn, signOut, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Link,
  Divider,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import SmsIcon from '@mui/icons-material/Sms';
import SecurityIcon from '@mui/icons-material/Security';
import { Link as RouterLink } from 'react-router-dom';
import PasswordField from './PasswordField';

export default function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [challengeName, setChallengeName] = useState<string | null>(null);
  const [resetPasswordVisibility, setResetPasswordVisibility] = useState(false);

  // Reset the resetPasswordVisibility flag after it's been triggered
  useEffect(() => {
    if (resetPasswordVisibility) {
      const timer = setTimeout(() => {
        setResetPasswordVisibility(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [resetPasswordVisibility]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn({
        username: email,
        password,
      });

      if (result.isSignedIn) {
        // User is fully signed in
        // Reset password field before navigation
        setPassword('');
        navigate('/');
      } else if (result.nextStep) {
        // Handle different challenge types
        switch (result.nextStep.signInStep) {
          case 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED':
            setChallengeName('NEW_PASSWORD_REQUIRED');
            break;
          case 'RESET_PASSWORD':
            // User needs to reset their password via resetPassword API
            // Automatically initiate the reset password flow
            handleResetPasswordFlow();
            break;
          case 'CONFIRM_SIGN_UP':
            setError('Please check your email and confirm your account before signing in.');
            break;
          case 'CONFIRM_SIGN_IN_WITH_SMS_CODE':
            setChallengeName('SMS_MFA');
            break;
          case 'CONFIRM_SIGN_IN_WITH_TOTP_CODE':
            setChallengeName('TOTP_MFA');
            break;
          case 'CONTINUE_SIGN_IN_WITH_MFA_SELECTION':
            setError('MFA selection is required but not currently supported. Please contact support.');
            break;
          case 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP':
            setError('TOTP setup is required but not currently supported. Please contact support.');
            break;
          case 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE':
            setError('Custom authentication challenge is not currently supported. Please contact support.');
            break;
          case 'DONE':
            // Sign-in is complete, navigate to home
            navigate('/');
            break;
          default:
            setError(`Unhandled sign-in step: ${result.nextStep.signInStep}. Please contact support.`);
        }
      } else {
        setError('Unexpected sign-in result. Please try again.');
      }
    } catch (err: any) {
      // Handle specific error types
      if (err.name === 'NotAuthorizedException') {
        setError('Invalid email or password. Please check your credentials.');
      } else if (err.name === 'UserNotConfirmedException') {
        setError('Please check your email and confirm your account before signing in.');
      } else if (err.name === 'PasswordResetRequiredException') {
        setError('Password reset is required. Please contact support.');
      } else if (err.name === 'UserNotFoundException') {
        setError('User not found. Please check your email or sign up for a new account.');
      } else {
        setError(err.message || 'Failed to sign in. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate new password
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters long');
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(newPassword)) {
      setError('Password must contain uppercase, lowercase, numbers, and symbols');
      return;
    }

    setLoading(true);

    try {
      const result = await confirmSignIn({
        challengeResponse: newPassword,
      });

      if (result.isSignedIn) {
        // Reset password visibility before clearing fields
        setResetPasswordVisibility(true);
        // Reset password fields before navigation
        setNewPassword('');
        setConfirmPassword('');
        navigate('/');
      } else if (result.nextStep) {
        // Handle any additional steps (e.g., MFA after password change)
        switch (result.nextStep.signInStep) {
          case 'CONFIRM_SIGN_IN_WITH_SMS_CODE':
            setChallengeName('SMS_MFA');
            break;
          case 'CONFIRM_SIGN_IN_WITH_TOTP_CODE':
            setChallengeName('TOTP_MFA');
            break;
          case 'DONE':
            navigate('/');
            break;
          default:
            setError(`Additional step required: ${result.nextStep.signInStep}`);
        }
      } else {
        setError('Password change failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Password change error:', err);
      setError(err.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerification = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!mfaCode || mfaCode.length < 6) {
      setError('Please enter a valid verification code');
      return;
    }

    setLoading(true);

    try {
      const result = await confirmSignIn({
        challengeResponse: mfaCode,
      });

      if (result.isSignedIn) {
        // Reset MFA code before navigation
        setMfaCode('');
        navigate('/');
      } else if (result.nextStep) {
        setError(`Additional authentication required: ${result.nextStep.signInStep}`);
      } else {
        setError('MFA verification failed. Please try again.');
      }
    } catch (err: any) {
      console.error('MFA verification error:', err);
      if (err.name === 'CodeMismatchException') {
        setError('Invalid verification code. Please check and try again.');
      } else if (err.name === 'NotAuthorizedException') {
        setError('Verification code expired. Please sign in again.');
        await cancelChallenge();
      } else {
        setError(err.message || 'Failed to verify code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordFlow = async () => {
    setLoading(true);
    try {
      const output = await resetPassword({ username: email });
      const { nextStep } = output;
      
      if (nextStep.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
        // Show the reset password form with code input
        setChallengeName('RESET_PASSWORD_CODE');
      } else if (nextStep.resetPasswordStep === 'DONE') {
        setError('Password reset complete. Please sign in with your new password.');
      }
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(err.message || 'Failed to initiate password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate inputs
    if (!resetCode || resetCode.length < 6) {
      setError('Please enter the verification code from your email');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters long');
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(newPassword)) {
      setError('Password must contain uppercase, lowercase, numbers, and symbols');
      return;
    }

    setLoading(true);

    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: resetCode,
        newPassword: newPassword,
      });

      // Reset password visibility before clearing fields
      setResetPasswordVisibility(true);
      
      // Password reset successful, clear form and show success message
      setChallengeName(null);
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
      setPassword('');
      setError('');
      
      // Show success message and allow user to sign in
      alert('Password reset successful! Please sign in with your new password.');
    } catch (err: any) {
      console.error('Confirm reset password error:', err);
      if (err.name === 'CodeMismatchException') {
        setError('Invalid verification code. Please check your email and try again.');
      } else if (err.name === 'ExpiredCodeException') {
        setError('Verification code has expired. Please request a new one.');
      } else {
        setError(err.message || 'Failed to reset password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const cancelChallenge = async () => {
    // Reset password visibility before clearing fields
    setResetPasswordVisibility(true);
    
    // Clear the authentication session and return to sign-in
    try {
      await signOut({ global: true });
    } catch (err) {
      // Ignore errors - session may already be cleared
      console.log('Sign out during cancel:', err);
    }
    
    // Reset all form state
    setChallengeName(null);
    setNewPassword('');
    setConfirmPassword('');
    setResetCode('');
    setMfaCode('');
    setError('');
    setPassword('');
    setEmail('');
  };

  // Render password reset with code form
  if (challengeName === 'RESET_PASSWORD_CODE') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
          px: { xs: 2, sm: 3 },
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: { xs: 3, sm: 4 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: 400,
            width: '100%',
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: 'warning.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
            aria-hidden="true"
          >
            <VpnKeyIcon sx={{ color: 'white' }} />
          </Box>
          <Typography component="h1" variant="h5" gutterBottom>
            Reset Password
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            Enter the verification code sent to your email and choose a new password.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }} role="alert">
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleConfirmResetPassword} sx={{ width: '100%' }} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="resetCode"
              label="Verification Code"
              name="resetCode"
              autoComplete="one-time-code"
              autoFocus
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              disabled={loading}
              helperText="Enter the code from your email"
              inputProps={{
                'aria-label': 'Verification Code',
              }}
            />
            <PasswordField
              margin="normal"
              required
              fullWidth
              name="newPassword"
              label="New Password"
              id="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              helperText="Minimum 12 characters with uppercase, lowercase, numbers, and symbols"
              inputProps={{
                'aria-label': 'New Password',
              }}
              resetVisibility={resetPasswordVisibility}
            />
            <PasswordField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm New Password"
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              inputProps={{
                'aria-label': 'Confirm New Password',
              }}
              resetVisibility={resetPasswordVisibility}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading || !resetCode || !newPassword || !confirmPassword}
              aria-label={loading ? 'Resetting password...' : 'Reset password'}
            >
              {loading ? <CircularProgress size={24} /> : 'Reset Password'}
            </Button>
            <Divider sx={{ my: 2 }} />
            <Button
              fullWidth
              variant="outlined"
              onClick={() => cancelChallenge()}
              disabled={loading}
              sx={{ mb: 1 }}
            >
              Cancel
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  // Render password change form if required
  if (challengeName === 'NEW_PASSWORD_REQUIRED') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
          px: { xs: 2, sm: 3 },
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: { xs: 3, sm: 4 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: 400,
            width: '100%',
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: 'warning.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
            aria-hidden="true"
          >
            <VpnKeyIcon sx={{ color: 'white' }} />
          </Box>
          <Typography component="h1" variant="h5" gutterBottom>
            Change Password
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            You must change your temporary password before continuing.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }} role="alert">
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handlePasswordChange} sx={{ width: '100%' }} noValidate>
            <PasswordField
              margin="normal"
              required
              fullWidth
              name="newPassword"
              label="New Password"
              id="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              helperText="Minimum 12 characters with uppercase, lowercase, numbers, and symbols"
              inputProps={{
                'aria-label': 'New Password',
              }}
              resetVisibility={resetPasswordVisibility}
            />
            <PasswordField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm New Password"
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              inputProps={{
                'aria-label': 'Confirm New Password',
              }}
              resetVisibility={resetPasswordVisibility}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading || !newPassword || !confirmPassword}
              aria-label={loading ? 'Changing password...' : 'Change password'}
            >
              {loading ? <CircularProgress size={24} /> : 'Change Password'}
            </Button>
            <Divider sx={{ my: 2 }} />
            <Button
              fullWidth
              variant="outlined"
              onClick={() => cancelChallenge()}
              disabled={loading}
              sx={{ mb: 1 }}
            >
              Cancel
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  // Render MFA verification form (SMS or TOTP)
  if (challengeName === 'SMS_MFA' || challengeName === 'TOTP_MFA') {
    const isSMS = challengeName === 'SMS_MFA';
    
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
          px: { xs: 2, sm: 3 },
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: { xs: 3, sm: 4 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: 400,
            width: '100%',
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: 'success.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
            aria-hidden="true"
          >
            {isSMS ? <SmsIcon sx={{ color: 'white' }} /> : <SecurityIcon sx={{ color: 'white' }} />}
          </Box>
          <Typography component="h1" variant="h5" gutterBottom>
            {isSMS ? 'SMS Verification' : 'Authenticator Code'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            {isSMS 
              ? 'Enter the verification code sent to your phone'
              : 'Enter the code from your authenticator app'}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }} role="alert">
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleMfaVerification} sx={{ width: '100%' }} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="mfaCode"
              label="Verification Code"
              name="mfaCode"
              autoComplete="one-time-code"
              autoFocus
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              disabled={loading}
              helperText={isSMS ? 'Enter the 6-digit code from SMS' : 'Enter the 6-digit code from your app'}
              inputProps={{
                'aria-label': 'Verification Code',
                maxLength: 6,
                inputMode: 'numeric',
                pattern: '[0-9]*',
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading || mfaCode.length < 6}
              aria-label={loading ? 'Verifying...' : 'Verify code'}
            >
              {loading ? <CircularProgress size={24} /> : 'Verify Code'}
            </Button>
            <Divider sx={{ my: 2 }} />
            <Button
              fullWidth
              variant="outlined"
              onClick={() => cancelChallenge()}
              disabled={loading}
              sx={{ mb: 1 }}
            >
              Cancel
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  // Render normal sign-in form
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
        px: { xs: 2, sm: 3 },
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, sm: 4 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 400,
          width: '100%',
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
          }}
          aria-hidden="true"
        >
          <LockOutlinedIcon sx={{ color: 'white' }} />
        </Box>
        <Typography component="h1" variant="h5" gutterBottom>
          Sign In
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Where's My Stuff!
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: '100%', mb: 2 }} role="alert">
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }} noValidate>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            inputProps={{
              'aria-label': 'Email Address',
            }}
          />
          <PasswordField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            inputProps={{
              'aria-label': 'Password',
            }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
            aria-label={loading ? 'Signing in...' : 'Sign in'}
          >
            {loading ? <CircularProgress size={24} /> : 'Sign In'}
          </Button>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Don't have an account?{' '}
              <Link component={RouterLink} to="/signup" underline="hover">
                Sign Up
              </Link>
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
