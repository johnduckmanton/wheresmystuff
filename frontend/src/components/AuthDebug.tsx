import { useState } from 'react';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export default function AuthDebug() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const checkAuthStatus = async () => {
    setLoading(true);
    setError('');
    
    try {
      const info: any = {
        timestamp: new Date().toISOString(),
        environment: {
          userPoolId: import.meta.env.VITE_USER_POOL_ID,
          userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
          apiUrl: import.meta.env.VITE_API_URL,
          region: import.meta.env.VITE_AWS_REGION,
          environment: import.meta.env.VITE_ENVIRONMENT,
        }
      };

      // Try to get current user
      try {
        const user = await getCurrentUser();
        info.currentUser = {
          username: user.username,
          userId: user.userId,
          signInDetails: user.signInDetails,
        };
      } catch (userError: any) {
        info.currentUser = { error: userError.message };
      }

      // Try to get auth session
      try {
        const session = await fetchAuthSession();
        info.authSession = {
          tokens: session.tokens ? {
            accessToken: session.tokens.accessToken ? 'Present' : 'Missing',
            idToken: session.tokens.idToken ? 'Present' : 'Missing',
          } : 'No tokens',
          credentials: session.credentials ? 'Present' : 'Missing',
        };
      } catch (sessionError: any) {
        info.authSession = { error: sessionError.message };
      }

      setDebugInfo(info);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Authentication Debug
      </Typography>
      
      <Button
        variant="contained"
        onClick={checkAuthStatus}
        disabled={loading}
        sx={{ mb: 3 }}
      >
        {loading ? 'Checking...' : 'Check Auth Status'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {debugInfo && (
        <Paper sx={{ p: 2 }}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Environment Configuration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify(debugInfo.environment, null, 2)}
              </pre>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Current User</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify(debugInfo.currentUser, null, 2)}
              </pre>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Auth Session</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify(debugInfo.authSession, null, 2)}
              </pre>
            </AccordionDetails>
          </Accordion>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Generated at: {debugInfo.timestamp}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}