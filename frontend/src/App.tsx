import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import Tooltip from '@mui/material/Tooltip';
import { Accessibility as AccessibilityIcon } from '@mui/icons-material';
import { useEffect, useState, createContext, useContext } from 'react';

import ErrorBoundary from './components/ErrorBoundary';
import { LoadingProvider } from './contexts/LoadingContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { InventoryProvider } from './contexts/InventoryContext';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import SignIn from './components/SignIn';
import SignUp from './components/SignUp';
import AuthDebug from './components/AuthDebug';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SkipLink from './components/accessibility/SkipLink';
import AccessibilitySettings from './components/accessibility/AccessibilitySettings';
import Home from './pages/Home';
import Things from './pages/Things';
import Locations from './pages/Locations';
import Categories from './pages/Categories';
import People from './pages/People';
import Inventories from './pages/Inventories';
import InventorySettings from './pages/InventorySettings';
import InventoryMembers from './pages/InventoryMembers';
import UserProfile from './pages/UserProfile';
import AcceptInvitation from './pages/AcceptInvitation';
import MovingDashboard from './pages/MovingDashboard';
import StorageDashboard from './pages/StorageDashboard';
import InventoryDashboard from './pages/InventoryDashboard';
import Containers from './pages/Containers';
import Projects from './pages/Projects';
import SharedContainerView from './components/SharedContainerView';
import { RouteModuleTracker } from './components/RouteModuleTracker';
import MobileNavigation from './components/MobileNavigation';
import { useMobileDetection } from './hooks/useMobileDetection';
import ScanPage from './pages/Scan';
import apiClient from './services/api';
import { theme } from './theme';

// Context for mobile sidebar state
const MobileSidebarContext = createContext<{
  toggleMobileSidebar: () => void;
}>({
  toggleMobileSidebar: () => {},
});

export const useMobileSidebar = () => useContext(MobileSidebarContext);

/**
 * Main Layout with Responsive Design
 * - Desktop: Permanent sidebar with content offset
 * - Mobile: Overlay sidebar with full-width content
 * Validates: Requirements 20.2, 20.3, 20.4
 */
function MainLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accessibilitySettingsOpen, setAccessibilitySettingsOpen] = useState(false);
  const { isMobile } = useMobileDetection();

  const handleMobileToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <MobileSidebarContext.Provider value={{ toggleMobileSidebar: handleMobileToggle }}>
      <RouteModuleTracker />
      <SkipLink />
      <Box sx={{ 
        display: 'flex', 
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'background.default' // Fix black areas
      }}>
        <Header onMenuClick={handleMobileToggle} />
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{
            flexGrow: 1,
            p: { xs: 1, sm: 2, md: 3 }, // Reduced padding for mobile
            mt: 8,
            width: { xs: '100%', md: 'calc(100% - 240px)' },
            minWidth: 0, // Prevent overflow
            height: 'calc(100vh - 64px)', // Account for header height
            overflow: 'auto',
            backgroundColor: 'background.default', // Ensure proper background
          }}
          role="main"
          aria-label="Main content"
        >
          {children}
        </Box>
        
        {/* Accessibility Settings FAB — hidden on mobile */}
        {!isMobile && (
          <Tooltip title="Accessibility Settings" placement="left">
            <Fab
              color="primary"
              aria-label="Open accessibility settings"
              onClick={() => setAccessibilitySettingsOpen(true)}
              sx={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                zIndex: 1000,
              }}
            >
              <AccessibilityIcon />
            </Fab>
          </Tooltip>
        )}
        
        <AccessibilitySettings
          open={accessibilitySettingsOpen}
          onClose={() => setAccessibilitySettingsOpen(false)}
        />
        <MobileNavigation />
      </Box>
    </MobileSidebarContext.Provider>
  );
}

/**
 * Smart redirect for home routes based on last used module
 * Always shows the Home page with module selection cards.
 * Last-used module tracking still works for the mobile bottom nav.
 */
function SmartHomeRedirect() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <Home />
      </MainLayout>
    </ProtectedRoute>
  );
}

/**
 * Auth Error Handler Component
 * Sets up global authentication error handling
 * Validates: Requirements 1.5, 16.2
 */
function AuthErrorHandler() {
  const navigate = useNavigate();
  const { showError } = useNotification();

  useEffect(() => {
    // Set up auth error callback
    apiClient.setAuthErrorCallback(() => {
      showError('Your session has expired. Please sign in again.');
      navigate('/signin');
    });
  }, [navigate, showError]);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <AccessibilityProvider>
          <CssBaseline />
          <NotificationProvider>
            <LoadingProvider>
              <InventoryProvider>
                <BrowserRouter>
                <AuthErrorHandler />
                <Routes>
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/auth-debug" element={<AuthDebug />} />
                <Route path="/shared/container/:shareId" element={<SharedContainerView />} />
                <Route
                  path="/accept-invitation"
                  element={
                    <ProtectedRoute>
                      <AcceptInvitation />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/home"
                  element={<SmartHomeRedirect />}
                />
                <Route
                  path="/inventory"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <InventoryDashboard />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/moving"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <MovingDashboard />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/storage"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <StorageDashboard />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <Projects />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/containers"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <Containers />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/things"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <Things />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/locations"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <Locations />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/categories"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <Categories />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/people"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <People />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inventories"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <Inventories />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inventories/:inventoryId/settings"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <InventorySettings />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inventories/:inventoryId/members"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <InventoryMembers />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <UserProfile />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/scan"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <ScanPage />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route path="/" element={<SmartHomeRedirect />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
            </BrowserRouter>
            </InventoryProvider>
          </LoadingProvider>
        </NotificationProvider>
      </AccessibilityProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
