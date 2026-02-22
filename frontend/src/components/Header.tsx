import { useState, useEffect } from 'react';
import { signOut, getCurrentUser } from 'aws-amplify/auth';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';

interface HeaderProps {
  onMenuClick?: () => void;
}

/**
 * Header Component with Responsive Behavior
 * - Shows menu button on mobile to toggle sidebar
 * - Hides user email on small screens
 * Validates: Requirements 20.2, 20.3, 20.4
 */
export default function Header({ onMenuClick }: HeaderProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  // Load user email on mount
  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setUserEmail(user.signInDetails?.loginId || '');
      })
      .catch(() => {
        // User not authenticated
      });
  }, []);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut({ global: true });
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleProfileClick = () => {
    handleMenuClose();
    navigate('/profile');
  };

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        {isMobile && onMenuClick && (
          <IconButton
            color="inherit"
            aria-label="open navigation menu"
            edge="start"
            onClick={onMenuClick}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}
        <Typography 
          variant="h6" 
          component="h1" 
          sx={{ 
            flexGrow: 1,
            fontSize: { xs: '1rem', sm: '1.25rem' },
            color: 'white',
            fontWeight: 'bold',
          }}
        >
          Where's My Stuff!
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {userEmail && (
            <Typography 
              variant="body2" 
              sx={{ display: { xs: 'none', sm: 'block' } }}
              aria-label={`Signed in as ${userEmail}`}
            >
              {userEmail}
            </Typography>
          )}
          <IconButton
            color="inherit"
            onClick={handleMenuOpen}
            aria-label="open user menu"
            aria-controls={Boolean(anchorEl) ? 'user-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={Boolean(anchorEl)}
          >
            <AccountCircleIcon />
          </IconButton>
          <Menu
            id="user-menu"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={handleProfileClick}>
              <PersonIcon sx={{ mr: 1 }} fontSize="small" aria-hidden="true" />
              My Profile
            </MenuItem>
            <MenuItem onClick={handleSignOut}>
              <LogoutIcon sx={{ mr: 1 }} fontSize="small" aria-hidden="true" />
              Sign Out
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
