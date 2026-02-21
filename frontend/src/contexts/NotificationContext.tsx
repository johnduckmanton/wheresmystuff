import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { 
  Snackbar, 
  Alert, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button,
  DialogContentText,
} from '@mui/material';
import type { AlertColor } from '@mui/material';

interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'text' | 'outlined' | 'contained';
}

interface NotificationContextType {
  showSuccess: (message: string) => void;
  showError: (message: string, options?: { requiresAction?: boolean; actions?: NotificationAction[] }) => void;
  showInfo: (message: string) => void;
}

interface NotificationState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

interface ErrorModalState {
  open: boolean;
  message: string;
  actions: NotificationAction[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Notification Context Provider
 * Manages toast notifications for success and error messages
 * Auto-dismisses after 5 seconds for toasts
 * Uses modals for error messages requiring action
 * Validates: Requirements 7.5, 15.2, 15.3
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    severity: 'info',
  });

  const [errorModal, setErrorModal] = useState<ErrorModalState>({
    open: false,
    message: '',
    actions: [],
  });

  const showNotification = (message: string, severity: AlertColor) => {
    setNotification({
      open: true,
      message,
      severity,
    });
  };

  const showSuccess = (message: string) => {
    showNotification(message, 'success');
  };

  const showError = (message: string, options?: { requiresAction?: boolean; actions?: NotificationAction[] }) => {
    // If error requires action, show modal instead of toast
    if (options?.requiresAction && options?.actions && options.actions.length > 0) {
      setErrorModal({
        open: true,
        message,
        actions: options.actions,
      });
    } else {
      // Default to toast notification for simple errors
      showNotification(message, 'error');
    }
  };

  const showInfo = (message: string) => {
    showNotification(message, 'info');
  };

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setNotification((prev) => ({ ...prev, open: false }));
  };

  const handleErrorModalClose = () => {
    setErrorModal({ open: false, message: '', actions: [] });
  };

  const handleActionClick = (action: NotificationAction) => {
    action.onClick();
    handleErrorModalClose();
  };

  return (
    <NotificationContext.Provider value={{ showSuccess, showError, showInfo }}>
      {children}
      
      {/* Toast Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={5000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleClose}
          severity={notification.severity}
          variant="filled"
          sx={{ 
            width: '100%',
            // Ensure readable on small screens
            fontSize: { xs: '0.875rem', sm: '0.875rem' },
            '& .MuiAlert-message': {
              wordBreak: 'break-word',
            },
          }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Error Modal for actions requiring user input */}
      <Dialog
        open={errorModal.open}
        onClose={handleErrorModalClose}
        maxWidth="sm"
        fullWidth
        // Ensure modal is readable on small screens
        PaperProps={{
          sx: {
            m: { xs: 2, sm: 3 },
            maxWidth: { xs: 'calc(100% - 32px)', sm: 600 },
          },
        }}
      >
        <DialogTitle sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
          Action Required
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            {errorModal.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ 
          p: { xs: 2, sm: 3 }, 
          gap: 1,
          flexDirection: { xs: 'column', sm: 'row' },
        }}>
          {errorModal.actions.map((action, index) => (
            <Button
              key={index}
              onClick={() => handleActionClick(action)}
              variant={action.variant || 'text'}
              fullWidth={{ xs: true, sm: false }}
              sx={{ minHeight: '44px' }} // Touch-friendly
            >
              {action.label}
            </Button>
          ))}
          <Button
            onClick={handleErrorModalClose}
            variant="outlined"
            fullWidth={{ xs: true, sm: false }}
            sx={{ minHeight: '44px' }} // Touch-friendly
          >
            Dismiss
          </Button>
        </DialogActions>
      </Dialog>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
