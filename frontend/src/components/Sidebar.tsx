import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  Box,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
  Collapse,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import HomeIcon from '@mui/icons-material/Home';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CategoryIcon from '@mui/icons-material/Category';
import PeopleIcon from '@mui/icons-material/People';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AllInboxIcon from '@mui/icons-material/AllInbox';
import FolderIcon from '@mui/icons-material/Folder';
import StorageIcon from '@mui/icons-material/Storage';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import InventorySelector from './InventorySelector';

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavigationItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const navigationItems: NavigationItem[] = [
  {
    label: 'Home',
    path: '/home',
    icon: <HomeIcon />,
  },
];

const inventoryItems: NavigationItem[] = [
  {
    label: 'Inventory Dashboard',
    path: '/inventory',
    icon: <DashboardIcon />,
  },
  {
    label: 'Things',
    path: '/things',
    icon: <InventoryIcon />,
  },
  {
    label: 'Locations',
    path: '/locations',
    icon: <LocationOnIcon />,
  },
  {
    label: 'Categories',
    path: '/categories',
    icon: <CategoryIcon />,
  },
  {
    label: 'People',
    path: '/people',
    icon: <PeopleIcon />,
  },
];

const movingItems: NavigationItem[] = [
  {
    label: 'Moving Dashboard',
    path: '/moving',
    icon: <LocalShippingIcon />,
  },
  {
    label: 'Projects',
    path: '/projects',
    icon: <FolderIcon />,
  },
  {
    label: 'Containers',
    path: '/containers',
    icon: <AllInboxIcon />,
  },
  {
    label: 'Storage Management',
    path: '/storage',
    icon: <StorageIcon />,
  },
];

/**
 * Sidebar Component with Responsive Behavior
 * - Desktop (>= 900px): Permanent drawer with collapse/expand
 * - Tablet/Mobile (< 900px): Temporary overlay drawer
 * Validates: Requirements 20.2, 20.3, 20.4
 */
export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // < 900px
  const isMobileSmall = useMediaQuery(theme.breakpoints.down('sm')); // < 600px
  const [open, setOpen] = useState(true);
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [movingOpen, setMovingOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-expand the section for the current route
  useEffect(() => {
    const path = location.pathname;
    if (['/inventory', '/things', '/locations', '/categories', '/people'].some(p => path.startsWith(p))) {
      setInventoryOpen(true);
    }
    if (['/moving', '/containers', '/projects', '/storage'].some(p => path.startsWith(p))) {
      setMovingOpen(true);
    }
  }, [location.pathname]);

  // Close mobile drawer when switching to desktop
  useEffect(() => {
    if (!isMobile && onMobileClose) {
      onMobileClose();
    }
  }, [isMobile, onMobileClose]);

  const handleToggle = () => {
    if (isMobile && onMobileClose) {
      onMobileClose();
    } else {
      setOpen(!open);
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    // Close mobile drawer after navigation
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  const renderNavigationSection = (items: NavigationItem[], title?: string) => (
    <>
      {title && (isMobile || open) && (
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            {title}
          </Typography>
        </Box>
      )}
      <List role="navigation" aria-label={title ? `${title} navigation` : 'main navigation'}>
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                onClick={() => handleNavigate(item.path)}
                selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                sx={{
                  minHeight: 48,
                  justifyContent: (isMobile || open) ? 'initial' : 'center',
                  px: 2.5,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: (isMobile || open) ? 3 : 'auto',
                    justifyContent: 'center',
                  }}
                  aria-hidden="true"
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  sx={{
                    opacity: (isMobile || open) ? 1 : 0,
                    display: (isMobile || open) ? 'block' : 'none',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </>
  );

  const drawerContent = (
    <>
      <Toolbar />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: (isMobile || open) ? 'flex-end' : 'center',
          px: 1,
          py: 1,
        }}
      >
        <IconButton 
          onClick={handleToggle} 
          aria-label={(isMobile || open) ? 'close navigation menu' : 'open navigation menu'}
          aria-expanded={isMobile ? mobileOpen : open}
        >
          {(isMobile || open) ? <ChevronLeftIcon /> : <MenuIcon />}
        </IconButton>
      </Box>
      <Divider />
      
      {/* Home */}
      {renderNavigationSection(navigationItems)}
      
      {/* Inventory — collapsible */}
      <Divider />
      <InventorySelector collapsed={!isMobile && !open} />
      <ListItemButton onClick={() => setInventoryOpen(!inventoryOpen)} sx={{ px: 2.5 }}>
        <ListItemIcon sx={{ minWidth: 0, mr: (isMobile || open) ? 3 : 'auto', justifyContent: 'center' }}>
          <InventoryIcon />
        </ListItemIcon>
        {(isMobile || open) && (
          <>
            <ListItemText primary="Inventory" primaryTypographyProps={{ variant: 'overline', color: 'text.secondary', sx: { fontSize: '0.75rem' } }} />
            {inventoryOpen ? <ExpandLess /> : <ExpandMore />}
          </>
        )}
      </ListItemButton>
      <Collapse in={inventoryOpen && (isMobile || open)} timeout="auto" unmountOnExit>
        {renderNavigationSection(inventoryItems)}
      </Collapse>
      
      {/* Moving & Storage — collapsible */}
      <Divider />
      <ListItemButton onClick={() => setMovingOpen(!movingOpen)} sx={{ px: 2.5 }}>
        <ListItemIcon sx={{ minWidth: 0, mr: (isMobile || open) ? 3 : 'auto', justifyContent: 'center' }}>
          <LocalShippingIcon />
        </ListItemIcon>
        {(isMobile || open) && (
          <>
            <ListItemText primary="Moving & Storage" primaryTypographyProps={{ variant: 'overline', color: 'text.secondary', sx: { fontSize: '0.75rem' } }} />
            {movingOpen ? <ExpandLess /> : <ExpandMore />}
          </>
        )}
      </ListItemButton>
      <Collapse in={movingOpen && (isMobile || open)} timeout="auto" unmountOnExit>
        {renderNavigationSection(movingItems)}
      </Collapse>
    </>
  );

  // Suppress sidebar entirely on mobile (< 600px) — MobileNavigation handles navigation there
  if (isMobileSmall) {
    return null;
  }

  // Mobile: Temporary drawer (overlay)
  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawerContent}
      </Drawer>
    );
  }

  // Desktop/Tablet: Permanent drawer
  return (
    <Drawer
      variant="permanent"
      sx={{
        display: { xs: 'none', md: 'block' },
        width: open ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: open ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED,
          boxSizing: 'border-box',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          overflowX: 'hidden',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
