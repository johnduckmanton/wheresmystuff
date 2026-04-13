import { useState } from 'react';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Badge,
  Box,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Home as HomeIcon,
  Inventory as InventoryIcon,
  MoveToInbox as MovingIcon,
  QrCodeScanner as ScanIcon,
  MoreHoriz as MoreIcon,
  Assignment as ProjectIcon,
  LocationOn as LocationIcon,
  Category as CategoryIcon,
  People as PeopleIcon,
  Storage as StorageIcon,
  AccountCircle as ProfileIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMobileDetection } from '../hooks/useMobileDetection';
import InventorySelector from './InventorySelector';

/**
 * Mobile-optimized bottom navigation component
 * Provides touch-friendly navigation for mobile devices
 * Validates: Requirements 13.1, 13.2, 13.3
 */

interface MobileNavigationProps {
  containerCount?: number;
  unreadNotifications?: number;
}

export default function MobileNavigation({ 
  containerCount = 0, 
  unreadNotifications = 0 
}: MobileNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { isMobile } = useMobileDetection();
  const [showMore, setShowMore] = useState(false);

  // Don't render on desktop
  if (!isMobile) {
    return null;
  }

  // Get current active tab based on pathname
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path === '/' || path === '/home') return 0;
    if (path.startsWith('/things') || path.startsWith('/categories') || path.startsWith('/locations')) return 1;
    if (path.startsWith('/containers') || path.startsWith('/moving')) return 2;
    if (path.startsWith('/scan')) return 3;
    if (path.startsWith('/ai-photo')) return 4;
    return 5; // More tab
  };

  const handleNavigationChange = (_event: React.SyntheticEvent, newValue: number) => {
    switch (newValue) {
      case 0:
        navigate('/');
        break;
      case 1:
        navigate('/things');
        break;
      case 2:
        navigate('/containers');
        break;
      case 3:
        navigate('/scan');
        break;
      case 4:
        navigate('/ai-photo');
        break;
      case 5:
        setShowMore(!showMore);
        break;
    }
  };

  const handleMoreOptionClick = (path: string) => {
    navigate(path);
    setShowMore(false);
  };

  return (
    <>
      {/* More Options Overlay */}
      {showMore && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 56, // Height of bottom navigation
            left: 0,
            right: 0,
            background: 'white',
            borderTop: 1,
            borderColor: 'divider',
            zIndex: 1001,
            maxHeight: '50vh',
            overflow: 'auto',
          }}
        >
          <Box sx={{ p: 2 }}>
            <InventorySelector />
            <Divider sx={{ my: 2 }} />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 2,
              }}
            >
              <MoreOption
                icon={<LocationIcon />}
                label="Locations"
                onClick={() => handleMoreOptionClick('/locations')}
              />
              <MoreOption
                icon={<CategoryIcon />}
                label="Categories"
                onClick={() => handleMoreOptionClick('/categories')}
              />
              <MoreOption
                icon={<PeopleIcon />}
                label="People"
                onClick={() => handleMoreOptionClick('/people')}
              />
              <MoreOption
                icon={<ProjectIcon />}
                label="Projects"
                onClick={() => handleMoreOptionClick('/projects')}
              />
              <MoreOption
                icon={<StorageIcon />}
                label="Storage"
                onClick={() => handleMoreOptionClick('/storage')}
              />
              <MoreOption
                icon={<ProfileIcon />}
                label="Profile"
                onClick={() => handleMoreOptionClick('/profile')}
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* Backdrop for more options */}
      {showMore && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
          }}
          onClick={() => setShowMore(false)}
        />
      )}

      {/* Bottom Navigation */}
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1002,
          borderTop: 1,
          borderColor: 'divider',
        }}
        elevation={8}
      >
        <BottomNavigation
          value={getCurrentTab()}
          onChange={handleNavigationChange}
          sx={{
            height: 56,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
              padding: '6px 6px 8px',
              '&.Mui-selected': {
                color: theme.palette.primary.main,
              },
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.65rem',
              fontWeight: 500,
              '&.Mui-selected': {
                fontSize: '0.65rem',
              },
            },
          }}
        >
          <BottomNavigationAction
            label="Home"
            icon={<HomeIcon />}
            sx={{ color: 'text.secondary' }}
          />
          
          <BottomNavigationAction
            label="Inventory"
            icon={<InventoryIcon />}
            sx={{ color: 'text.secondary' }}
          />
          
          <BottomNavigationAction
            label="Moving"
            icon={
              <Badge badgeContent={containerCount > 0 ? containerCount : null} color="primary">
                <MovingIcon />
              </Badge>
            }
            sx={{ color: 'text.secondary' }}
          />
          
          <BottomNavigationAction
            label="Scan"
            icon={<ScanIcon />}
            sx={{ color: 'text.secondary' }}
          />
          
          <BottomNavigationAction
            label="AI Photo"
            icon={<AutoAwesomeIcon />}
            sx={{ color: 'text.secondary' }}
          />
          
          <BottomNavigationAction
            label="More"
            icon={
              <Badge badgeContent={unreadNotifications > 0 ? unreadNotifications : null} color="error">
                <MoreIcon />
              </Badge>
            }
            sx={{ color: 'text.secondary' }}
          />
        </BottomNavigation>
      </Paper>

      {/* Spacer to prevent content from being hidden behind navigation */}
      <Box sx={{ height: 56 }} />
    </>
  );
}

/**
 * More option item component
 */
interface MoreOptionProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
}

function MoreOption({ icon, label, onClick, badge }: MoreOptionProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 2,
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        '&:hover': {
          backgroundColor: 'action.hover',
        },
        '&:active': {
          backgroundColor: 'action.selected',
        },
      }}
    >
      <Badge badgeContent={badge} color="primary">
        <Box
          sx={{
            color: 'text.secondary',
            mb: 1,
            '& .MuiSvgIcon-root': {
              fontSize: 24,
            },
          }}
        >
          {icon}
        </Box>
      </Badge>
      <Box
        sx={{
          fontSize: '0.75rem',
          fontWeight: 500,
          color: 'text.secondary',
          textAlign: 'center',
        }}
      >
        {label}
      </Box>
    </Box>
  );
}