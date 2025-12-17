import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  Stack,
} from '@mui/material';
import { Search as SearchIcon, Person as PersonIcon } from '@mui/icons-material';
import apiClient from '../services/api';
import type { UserLookupResult } from '../types';
import { validateEmail, getErrorMessage } from '../utils/validation';

interface UserLookupDialogProps {
  open: boolean;
  onClose: () => void;
  onUserSelect: (user: UserLookupResult) => void;
  title?: string;
  description?: string;
}

/**
 * User Lookup Dialog Component
 * Allows searching for users by email address
 * Validates: Requirements 1.1, 3.1, 3.2
 */
export default function UserLookupDialog({
  open,
  onClose,
  onUserSelect,
  title = "Look Up User",
  description = "Search for a user by their email address to add them to your inventory."
}: UserLookupDialogProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchResult, setSearchResult] = useState<UserLookupResult | null>(null);



  const handleSearch = async () => {
    const trimmedEmail = email.trim();
    
    // Enhanced client-side validation using shared utility
    const validation = validateEmail(trimmedEmail);
    if (!validation.valid) {
      setError(validation.error || 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');
    setSearchResult(null);

    try {
      const result = await apiClient.lookupUserByEmail(validation.normalizedEmail || trimmedEmail);
      setSearchResult(result);
      
      if (!result.found) {
        setError('User not found. You can send them an invitation instead.');
      }
    } catch (err) {
      console.error('Error looking up user:', err);
      
      // Use shared error message utility
      const errorMessage = getErrorMessage(err, 'search for user');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = () => {
    if (searchResult && searchResult.found) {
      onUserSelect(searchResult);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setSearchResult(null);
    setLoading(false);
    onClose();
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) {
      setError('');
    }
    if (searchResult) {
      setSearchResult(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSearch();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchIcon />
          {title}
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Email Address"
              value={email}
              onChange={handleEmailChange}
              onKeyPress={handleKeyPress}
              error={!!error && !searchResult}
              helperText={error && !searchResult ? error : 'Enter the email address of the user you want to find'}
              required
              fullWidth
              autoFocus
              placeholder="user@example.com"
              type="email"
              disabled={loading}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={loading || !email.trim()}
              sx={{ minWidth: 100 }}
            >
              {loading ? <CircularProgress size={20} /> : 'Search'}
            </Button>
          </Box>

          {/* Search Results */}
          {searchResult && (
            <Box sx={{ mt: 1 }}>
              {searchResult.found ? (
                <Alert 
                  severity="success" 
                  sx={{ mb: 2 }}
                  action={
                    <Button 
                      color="inherit" 
                      size="small" 
                      onClick={handleSelectUser}
                      variant="outlined"
                    >
                      Select User
                    </Button>
                  }
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                      User Found!
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <PersonIcon fontSize="small" />
                        <Typography variant="body2">
                          {searchResult.displayName || searchResult.username}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {searchResult.email}
                      </Typography>
                      <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip 
                          label={searchResult.emailVerified ? 'Email Verified' : 'Email Not Verified'} 
                          size="small" 
                          color={searchResult.emailVerified ? 'success' : 'warning'}
                          variant="outlined"
                        />
                        <Chip 
                          label={searchResult.userStatus || 'Active'} 
                          size="small" 
                          color="default"
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  </Box>
                </Alert>
              ) : (
                <Alert severity="info">
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    User Not Found
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    No user found with email address "{email}". You can send them an invitation to join and create an account.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}

          {/* Email Validation Info */}
          <Alert severity="info" sx={{ mt: 1 }}>
            <Typography variant="body2">
              <strong>Tip:</strong> Make sure the email address is exactly as the user registered with. 
              Email addresses are case-sensitive and must match exactly.
            </Typography>
          </Alert>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        {searchResult?.found && (
          <Button 
            variant="contained" 
            onClick={handleSelectUser}
            startIcon={<PersonIcon />}
          >
            Select User
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}