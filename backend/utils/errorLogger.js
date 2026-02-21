/**
 * Error Logging Utility
 * Logs errors to console in development and sends to monitoring service in production
 * Includes context: timestamp, userId, error type, user action
 */

const performanceMonitoring = require('../services/performanceMonitoringService');

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Log an error with context
 * @param {Error|string} error - The error object or message
 * @param {object} context - Error context
 * @param {string} context.userId - User ID
 * @param {string} context.errorType - Type of error
 * @param {string} context.operation - Operation that failed
 * @param {string} context.component - Component where error occurred
 * @param {object} context.additionalData - Additional error data
 * @param {string} userFriendlyMessage - User-friendly error message
 */
function logError(error, context, userFriendlyMessage) {
  const errorLog = createErrorLog(error, context);

  // Always log to console in development
  if (isDevelopment) {
    logToConsole(errorLog, error);
  } else {
    // In production, log only essential info to console
    console.error(`[${errorLog.errorType}] ${errorLog.message}`, {
      operation: errorLog.operation,
      userId: errorLog.userId,
      timestamp: errorLog.timestamp,
    });
  }

  // Record error in performance monitoring service
  performanceMonitoring.recordError(
    context.errorType,
    context.operation,
    {
      userId: context.userId,
      component: context.component,
      ...context.additionalData,
    }
  );

  return {
    errorLog,
    userFriendlyMessage: userFriendlyMessage || 'An error occurred. Please try again.',
  };
}

/**
 * Create structured error log
 * @private
 */
function createErrorLog(error, context) {
  const errorObj = typeof error === 'string' ? new Error(error) : error;

  return {
    timestamp: new Date().toISOString(),
    userId: context.userId,
    errorType: context.errorType,
    operation: context.operation,
    component: context.component,
    message: errorObj.message,
    stack: errorObj.stack,
    statusCode: errorObj.statusCode,
    additionalData: context.additionalData,
  };
}

/**
 * Log to console with formatting (development only)
 * @private
 */
function logToConsole(errorLog, originalError) {
  console.error('\n' + '='.repeat(80));
  console.error(`🔴 ERROR: ${errorLog.errorType}`);
  console.error('='.repeat(80));
  console.error('Message:', errorLog.message);
  console.error('Operation:', errorLog.operation);
  console.error('Component:', errorLog.component || 'Unknown');
  console.error('Timestamp:', errorLog.timestamp);
  console.error('User ID:', errorLog.userId || 'Not authenticated');
  console.error('Status Code:', errorLog.statusCode || 'N/A');
  
  if (errorLog.additionalData) {
    console.error('Additional Data:', JSON.stringify(errorLog.additionalData, null, 2));
  }
  
  if (originalError.stack) {
    console.error('Stack Trace:');
    console.error(originalError.stack);
  }
  
  console.error('='.repeat(80) + '\n');
}

/**
 * Log a network/API error
 */
function logNetworkError(error, endpoint, userId, operation) {
  return logError(error, {
    userId,
    errorType: 'NetworkError',
    operation: operation || 'API Request',
    component: 'API Handler',
    additionalData: { endpoint },
  }, 'A network error occurred. Please check your connection and try again.');
}

/**
 * Log a validation error
 */
function logValidationError(error, operation, userId, invalidFields) {
  return logError(error, {
    userId,
    errorType: 'ValidationError',
    operation,
    component: 'Validation',
    additionalData: { invalidFields },
  }, error.message || 'Invalid data provided. Please check your input.');
}

/**
 * Log a database error
 */
function logDatabaseError(error, operation, userId, tableName) {
  return logError(error, {
    userId,
    errorType: 'DatabaseError',
    operation,
    component: 'DynamoDB',
    additionalData: { tableName },
  }, 'A database error occurred. Please try again later.');
}

/**
 * Log a service error (AI, barcode, etc.)
 */
function logServiceError(error, serviceName, userId, operation) {
  return logError(error, {
    userId,
    errorType: 'ServiceError',
    operation: operation || `${serviceName} request`,
    component: serviceName,
    additionalData: { serviceName },
  }, `The ${serviceName} service is temporarily unavailable. Please try again.`);
}

/**
 * Log a create-and-pack workflow error
 */
function logCreateAndPackError(error, stage, userId, thingData, containerId) {
  return logError(error, {
    userId,
    errorType: 'CreateAndPackError',
    operation: `Create and pack thing - ${stage}`,
    component: 'PackingService',
    additionalData: {
      stage,
      thingName: thingData?.name,
      containerId,
    },
  }, getCreateAndPackUserMessage(stage, error));
}

/**
 * Get user-friendly message for create-and-pack errors
 * @private
 */
function getCreateAndPackUserMessage(stage, error) {
  switch (stage) {
    case 'validation':
      return error.message || 'Invalid data provided. Please check your input.';
    case 'creation':
      return 'Failed to create the item. Please try again.';
    case 'allocation':
      return 'The item was created but could not be added to the container. You can find it in your inventory.';
    default:
      return 'An error occurred while creating and packing the item. Please try again.';
  }
}

/**
 * Log an authentication/authorization error
 */
function logAuthError(error, operation, userId) {
  return logError(error, {
    userId,
    errorType: 'AuthError',
    operation,
    component: 'Authentication',
    additionalData: {},
  }, 'You do not have permission to perform this action.');
}

/**
 * Log a resource not found error
 */
function logNotFoundError(error, resourceType, resourceId, userId, operation) {
  return logError(error, {
    userId,
    errorType: 'NotFoundError',
    operation,
    component: 'Resource Lookup',
    additionalData: { resourceType, resourceId },
  }, `The requested ${resourceType} could not be found.`);
}

module.exports = {
  logError,
  logNetworkError,
  logValidationError,
  logDatabaseError,
  logServiceError,
  logCreateAndPackError,
  logAuthError,
  logNotFoundError,
};
