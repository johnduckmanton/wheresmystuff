import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { useEffect, useState, createContext, useContext } from 'react';
import { theme } from './theme';
import ErrorBoundary from './components/ErrorBoundary';
import { LoadingProvider } from './contexts/LoadingContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import SignIn from './components/SignIn';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Things from './pages/Things';
import Locations from './pages/Locations';
import Categories from './pages/Categories';
import People from './pages/People';
import apiClient from './services/api';

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

  const handleMobileToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <MobileSidebarContext.Provider value={{ toggleMobileSidebar: handleMobileToggle }}>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Header onMenuClick={handleMobileToggle} />
        <Sidebar />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, sm: 3 },
            mt: 8,
            width: { xs: '100%', md: 'calc(100% - 240px)' },
            minWidth: 0, // Prevent overflow
          }}
        >
          {children}
        </Box>
      </Box>
    </MobileSidebarContext.Provider>
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
        <CssBaseline />
        <NotificationProvider>
          <LoadingProvider>
            <BrowserRouter>
              <AuthErrorHandler />
              <Routes>
                <Route path="/signin" element={<SignIn />} />
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
                <Route path="/" element={<Navigate to="/things" replace />} />
                <Route path="*" element={<Navigate to="/things" replace />} />
              </Routes>
            </BrowserRouter>
          </LoadingProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
