/**
 * Error Logging Utility
 * Logs errors to console in development and sends to monitoring service in production
 * Includes context: timestamp, userId, error type, user action
 */

interface ErrorContext {
  userId?: string;
  errorType: string;
  userAction: string;
  component?: string;
  additionalData?: Record<string, any>;
}

interface ErrorLog {
  timestamp: string;
  userId?: string;
  errorType: string;
  userAction: string;
  component?: string;
  message: string;
  stack?: string;
  userAgent: string;
  url: string;
  additionalData?: Record<string, any>;
}

class ErrorLogger {
  private isDevelopment: boolean;
  private monitoringEndpoint: string;

  constructor() {
    this.isDevelopment = import.meta.env.MODE === 'development';
    this.monitoringEndpoint = import.meta.env.VITE_API_URL 
      ? `${import.meta.env.VITE_API_URL}/monitoring/errors`
      : '';
  }

  /**
   * Log an error with context
   * @param error - The error object or message
   * @param context - Additional context about the error
   * @param _userFriendlyMessage - Optional user-friendly message to display (reserved for future use)
   */
  logError(
    error: Error | string,
    context: ErrorContext,
    _userFriendlyMessage?: string
  ): void {
    const errorLog = this.createErrorLog(error, context);

    // Always log to console in development
    if (this.isDevelopment) {
      this.logToConsole(errorLog, error);
    }

    // Send to monitoring service in production
    if (!this.isDevelopment && this.monitoringEndpoint) {
      this.sendToMonitoring(errorLog);
    }

    // Store in local error history for debugging
    this.storeInHistory(errorLog);
  }

  /**
   * Create structured error log
   */
  private createErrorLog(
    error: Error | string,
    context: ErrorContext
  ): ErrorLog {
    const errorObj = typeof error === 'string' ? new Error(error) : error;

    return {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      errorType: context.errorType,
      userAction: context.userAction,
      component: context.component,
      message: errorObj.message,
      stack: errorObj.stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      additionalData: context.additionalData,
    };
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(errorLog: ErrorLog, originalError: Error | string): void {
    console.group(`🔴 Error: ${errorLog.errorType}`);
    console.error('Message:', errorLog.message);
    console.log('User Action:', errorLog.userAction);
    console.log('Component:', errorLog.component || 'Unknown');
    console.log('Timestamp:', errorLog.timestamp);
    console.log('User ID:', errorLog.userId || 'Not authenticated');
    
    if (errorLog.additionalData) {
      console.log('Additional Data:', errorLog.additionalData);
    }
    
    if (typeof originalError !== 'string' && originalError.stack) {
      console.log('Stack Trace:', originalError.stack);
    }
    
    console.groupEnd();
  }

  /**
   * Send error to monitoring service
   */
  private async sendToMonitoring(errorLog: ErrorLog): Promise<void> {
    try {
      // Use fetch instead of axios to avoid circular dependencies
      await fetch(this.monitoringEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorLog),
      });
    } catch (sendError) {
      // Silently fail - don't want error logging to break the app
      console.error('Failed to send error to monitoring service:', sendError);
    }
  }

  /**
   * Store error in local history for debugging
   */
  private storeInHistory(errorLog: ErrorLog): void {
    try {
      const historyKey = 'error_history';
      const maxHistorySize = 50;
      
      const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
      history.unshift(errorLog);
      
      // Keep only the most recent errors
      const trimmedHistory = history.slice(0, maxHistorySize);
      
      localStorage.setItem(historyKey, JSON.stringify(trimmedHistory));
    } catch (storageError) {
      // Silently fail if localStorage is not available
      console.warn('Failed to store error in history:', storageError);
    }
  }

  /**
   * Get error history for debugging
   */
  getErrorHistory(): ErrorLog[] {
    try {
      return JSON.parse(localStorage.getItem('error_history') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    try {
      localStorage.removeItem('error_history');
    } catch (error) {
      console.warn('Failed to clear error history:', error);
    }
  }

  /**
   * Log a network error
   */
  logNetworkError(
    error: Error | string,
    endpoint: string,
    userId?: string,
    userAction?: string
  ): void {
    this.logError(error, {
      userId,
      errorType: 'NetworkError',
      userAction: userAction || 'API Request',
      component: 'API Service',
      additionalData: { endpoint },
    });
  }

  /**
   * Log a validation error
   */
  logValidationError(
    error: Error | string,
    formName: string,
    userId?: string,
    invalidFields?: string[]
  ): void {
    this.logError(error, {
      userId,
      errorType: 'ValidationError',
      userAction: 'Form Submission',
      component: formName,
      additionalData: { invalidFields },
    });
  }

  /**
   * Log a camera/hardware error
   */
  logHardwareError(
    error: Error | string,
    hardwareType: 'camera' | 'barcode-scanner',
    userId?: string,
    userAction?: string
  ): void {
    this.logError(error, {
      userId,
      errorType: 'HardwareError',
      userAction: userAction || `${hardwareType} access`,
      component: hardwareType,
      additionalData: { hardwareType },
    });
  }

  /**
   * Log an AI/service error
   */
  logServiceError(
    error: Error | string,
    serviceName: string,
    userId?: string,
    userAction?: string
  ): void {
    this.logError(error, {
      userId,
      errorType: 'ServiceError',
      userAction: userAction || `${serviceName} request`,
      component: serviceName,
      additionalData: { serviceName },
    });
  }

  /**
   * Log a create-and-pack workflow error
   */
  logCreateAndPackError(
    error: Error | string,
    stage: 'creation' | 'allocation' | 'validation',
    userId?: string,
    thingData?: any,
    containerId?: string
  ): void {
    this.logError(error, {
      userId,
      errorType: 'CreateAndPackError',
      userAction: `Create and pack thing - ${stage}`,
      component: 'PackingInterface',
      additionalData: {
        stage,
        thingName: thingData?.name,
        containerId,
      },
    });
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();

// Export types for use in other modules
export type { ErrorContext, ErrorLog };
