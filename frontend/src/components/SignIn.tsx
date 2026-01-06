import { useState, type FormEvent } from 'react';
import { signIn, confirmSignIn } from 'aws-amplify/auth';
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
import { Link as RouterLink } from 'react-router-dom';

export default function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [challengeName, setChallengeName] = useState<string | null>(null);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn({
        username: email,
        password,
      });

      console.log('Sign in result:', result);
      console.log('Result type:', typeof result);
      console.log('Result keys:', Object.keys(result));

      if (result.isSignedIn) {
        // User is fully signed in
        console.log('User is fully signed in, navigating to home');
        navigate('/');
      } else if (result.nextStep) {
        // Handle different challenge types
        console.log('Challenge required:', result.nextStep.signInStep);
        switch (result.nextStep.signInStep) {
          case 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED':
            console.log('Password change required');
            setChallengeName('NEW_PASSWORD_REQUIRED');
            break;
          case 'CONFIRM_SIGN_IN_WITH_SMS_CODE':
            setError('SMS MFA is required but not implemented in this demo');
            break;
          case 'CONFIRM_SIGN_IN_WITH_TOTP_CODE':
            setError('TOTP MFA is required but not implemented in this demo');
            break;
          default:
            console.log('Unhandled sign-in step:', result.nextStep.signInStep);
            setError(`Unhandled sign-in step: ${result.nextStep.signInStep}`);
        }
      } else {
        console.log('Unexpected result structure:', result);
        setError('Unexpected sign-in result. Please try again.');
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      console.error('Error type:', typeof err);
      console.error('Error keys:', Object.keys(err));
      
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

      console.log('Password change result:', result);

      if (result.isSignedIn) {
        navigate('/');
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

  const resetForm = () => {
    setChallengeName(null);
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  };

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
            <TextField
              margin="normal"
              required
              fullWidth
              name="newPassword"
              label="New Password"
              type="password"
              id="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              helperText="Minimum 12 characters with uppercase, lowercase, numbers, and symbols"
              inputProps={{
                'aria-label': 'New Password',
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm New Password"
              type="password"
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              inputProps={{
                'aria-label': 'Confirm New Password',
              }}
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
              onClick={resetForm}
              disabled={loading}
              sx={{ mb: 1 }}
            >
              Back to Sign In
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
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
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
