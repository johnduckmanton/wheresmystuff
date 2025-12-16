const { v4: uuidv4 } = require('uuid');
const { logAuth, logDataAccess, logAuthzFailure } = require('../services/auditLogService');

/**
 * Error types for categorization
 */
const ERROR_TYPES = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization', 
  VALIDATION: 'validation',
  NOT_FOUND: 'not_found',
  RATE_LIMIT: 'rate_limit',
  SERVER: 'server',
  DATABASE: 'database',
  EXTERNAL_SERVICE: 'external_service'
};

/**
 * Generic error messages for client responses
 * These messages don't expose internal system details
 */
const GENERIC_ERROR_MESSAGES = {
  [ERROR_TYPES.AUTHENTICATION]: 'Authentication failed',
  [ERROR_TYPES.AUTHORIZATION]: 'Access denied',
  [ERROR_TYPES.VALIDATION]: 'Invalid input provided',
  [ERROR_TYPES.NOT_FOUND]: 'Resource not found',
  [ERROR_TYPES.RATE_LIMIT]: 'Too many requests',
  [ERROR_TYPES.SERVER]: 'Internal server error',
  [ERROR_TYPES.DATABASE]: 'Service temporarily unavailable',
  [ERROR_TYPES.EXTERNAL_SERVICE]: 'Service temporarily unavailable'
};

/**
 * Create a secure error response for clients
 * Ensures no sensitive information is leaked to the client
 * 
 * @param {string} errorType - Type of error from ERROR_TYPES
 * @param {string} [customMessage] - Custom safe message for client (optional)
 * @param {number} [statusCode] - HTTP status code
 * @param {string} [requestId] - Request ID for correlation
 * @returns {object} Secure error response object
 */
function createSecureErrorResponse(errorType, customMessage = null, statusCode = 500, requestId = null) {
  // Use generic message if no custom message provided
  const clientMessage = customMessage || GENERIC_ERROR_MESSAGES[errorType] || GENERIC_ERROR_MESSAGES[ERROR_TYPES.SERVER];
  
  // Generate request ID if not provided
  const correlationId = requestId || uuidv4();
  
  return {
    error: clientMessage,
    statusCode: statusCode,
    requestId: correlationId
  };
}

/**
 * Log detailed error information server-side for debugging
 * Includes full error details, stack traces, and context
 * 
 * @param {Error} error - The original error object
 * @param {object} context - Additional context information
 * @param {string} context.userId - User ID if available
 * @param {string} context.endpoint - API endpoint
 * @param {string} context.method - HTTP method
 * @param {object} context.requestData - Request data (sanitized)
 * @param {string} context.requestId - Request correlation ID
 * @param {string} errorType - Type of error from ERROR_TYPES
 */
function logDetailedError(error, context, errorType) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    requestId: context.requestId,
    errorType: errorType,
    message: error.message,
    stack: error.stack,
    userId: context.userId || 'anonymous',
    endpoint: context.endpoint,
    method: context.method,
    statusCode: error.statusCode || 500,
    // Include sanitized request data (remove sensitive fields)
    requestData: sanitizeRequestData(context.requestData),
    // Additional error properties
    name: error.name,
    code: error.code
  };
  
  // Log to console (in production, this would go to CloudWatch)
  console.error('Detailed Error Log:', JSON.stringify(logEntry, null, 2));
  
  // For authentication and authorization errors, also log to audit system
  if (errorType === ERROR_TYPES.AUTHENTICATION && context.userId) {
    logAuth(context.userId, false, context.ipAddress, context.userAgent).catch(auditErr => {
      console.error('Failed to log authentication error to audit system:', auditErr);
    });
  }
  
  if (errorType === ERROR_TYPES.AUTHORIZATION && context.userId) {
    logAuthzFailure(
      context.userId, 
      context.method, 
      context.endpoint, 
      error.message
    ).catch(auditErr => {
      console.error('Failed to log authorization error to audit system:', auditErr);
    });
  }
}

/**
 * Sanitize request data to remove sensitive information before logging
 * 
 * @param {object} requestData - Original request data
 * @returns {object} Sanitized request data
 */
function sanitizeRequestData(requestData) {
  if (!requestData || typeof requestData !== 'object') {
    return requestData;
  }
  
  const sensitiveFields = [
    'password', 'token', 'authorization', 'secret', 'key', 
    'credential', 'auth', 'session', 'cookie'
  ];
  
  const sanitized = { ...requestData };
  
  // Remove sensitive fields (case insensitive)
  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Create safe validation error messages
 * Provides specific field errors without exposing internal validation logic
 * 
 * @param {Array} validationErrors - Array of validation error messages
 * @param {string} [requestId] - Request correlation ID
 * @returns {object} Safe validation error response
 */
function createValidationErrorResponse(validationErrors, requestId = null) {
  // Sanitize validation errors to remove internal details
  const safeErrors = validationErrors.map(error => {
    // Remove any references to internal schema structure
    let safeError = error
      .replace(/schema\./gi, '')
      .replace(/validation\./gi, '')
      .replace(/internal\./gi, '')
      .replace(/system\./gi, '')
      .replace(/database\./gi, '')
      .replace(/definitions\./gi, '')
      .replace(/properties\./gi, '')
      .replace(/config\./gi, '')
      .replace(/rules\./gi, '');
    
    // Remove sensitive field references and internal method names
    safeError = safeError
      .replace(/secret/gi, 'field')
      .replace(/password/gi, 'field')
      .replace(/key/gi, 'field')
      .replace(/token/gi, 'field')
      .replace(/credential/gi, 'field')
      .replace(/sensitiveData/gi, 'field')
      .replace(/internalId/gi, 'field')
      .replace(/phoneRegex/gi, 'pattern')
      .replace(/validateString/gi, 'validation')
      .replace(/processField/gi, 'processing')
      .replace(/checkConstraints/gi, 'validation')
      .replace(/passwordComplexity/gi, 'complexity');
    
    // Ensure error messages are informative but don't expose implementation
    if (safeError.includes('required')) {
      safeError = safeError.replace(/is required.*/, 'is required');
    }
    
    if (safeError.includes('type')) {
      safeError = safeError.replace(/type.*/, 'has invalid format');
    }
    
    // Clean up any remaining internal references
    safeError = safeError
      .replace(/\b[a-zA-Z]+\.[a-zA-Z]+(\.[a-zA-Z]+)*/g, 'field') // Remove any dot notation (including nested)
      .replace(/\s+/g, ' ') // Clean up extra spaces
      .trim();
    
    return safeError;
  });
  
  return createSecureErrorResponse(
    ERROR_TYPES.VALIDATION,
    `Validation failed: ${safeErrors.join(', ')}`,
    400,
    requestId
  );
}

/**
 * Handle authentication errors securely
 * 
 * @param {Error} error - Authentication error
 * @param {object} context - Request context
 * @returns {object} Secure error response
 */
function handleAuthenticationError(error, context) {
  const requestId = uuidv4();
  
  // Log detailed error server-side
  logDetailedError(error, { ...context, requestId }, ERROR_TYPES.AUTHENTICATION);
  
  // Return generic authentication error to client
  return createSecureErrorResponse(
    ERROR_TYPES.AUTHENTICATION,
    null, // Use generic message
    401,
    requestId
  );
}

/**
 * Handle authorization errors securely
 * 
 * @param {Error} error - Authorization error
 * @param {object} context - Request context
 * @returns {object} Secure error response
 */
function handleAuthorizationError(error, context) {
  const requestId = uuidv4();
  
  // Log detailed error server-side
  logDetailedError(error, { ...context, requestId }, ERROR_TYPES.AUTHORIZATION);
  
  // Return generic authorization error to client
  return createSecureErrorResponse(
    ERROR_TYPES.AUTHORIZATION,
    null, // Use generic message
    403,
    requestId
  );
}

/**
 * Handle database errors securely
 * Ensures no table names, column names, or query details are exposed
 * 
 * @param {Error} error - Database error
 * @param {object} context - Request context
 * @returns {object} Secure error response
 */
function handleDatabaseError(error, context) {
  const requestId = uuidv4();
  
  // Log detailed error server-side
  logDetailedError(error, { ...context, requestId }, ERROR_TYPES.DATABASE);
  
  // Return generic database error to client (no schema details)
  return createSecureErrorResponse(
    ERROR_TYPES.DATABASE,
    null, // Use generic message
    500,
    requestId
  );
}

/**
 * Handle server errors securely
 * 
 * @param {Error} error - Server error
 * @param {object} context - Request context
 * @returns {object} Secure error response
 */
function handleServerError(error, context) {
  const requestId = uuidv4();
  
  // Log detailed error server-side
  logDetailedError(error, { ...context, requestId }, ERROR_TYPES.SERVER);
  
  // Return generic server error to client (no stack traces)
  return createSecureErrorResponse(
    ERROR_TYPES.SERVER,
    null, // Use generic message
    500,
    requestId
  );
}

/**
 * Main error handler that routes errors to appropriate handlers
 * 
 * @param {Error} error - The error to handle
 * @param {object} context - Request context
 * @returns {object} Secure error response
 */
function handleError(error, context = {}) {
  // Determine error type based on error properties
  if (error.statusCode === 401 || error.name === 'UnauthorizedError' || error.message.includes('token')) {
    return handleAuthenticationError(error, context);
  }
  
  if (error.statusCode === 403 || error.name === 'ForbiddenError' || error.message.includes('Access denied')) {
    return handleAuthorizationError(error, context);
  }
  
  if (error.name === 'ValidationError' || error.statusCode === 400) {
    const requestId = uuidv4();
    logDetailedError(error, { ...context, requestId }, ERROR_TYPES.VALIDATION);
    return createSecureErrorResponse(ERROR_TYPES.VALIDATION, null, 400, requestId);
  }
  
  if (error.statusCode === 404 || error.message.includes('not found')) {
    const requestId = uuidv4();
    logDetailedError(error, { ...context, requestId }, ERROR_TYPES.NOT_FOUND);
    return createSecureErrorResponse(ERROR_TYPES.NOT_FOUND, null, 404, requestId);
  }
  
  if (error.statusCode === 429 || error.message.includes('rate limit')) {
    const requestId = uuidv4();
    logDetailedError(error, { ...context, requestId }, ERROR_TYPES.RATE_LIMIT);
    return createSecureErrorResponse(ERROR_TYPES.RATE_LIMIT, null, 429, requestId);
  }
  
  // Check for database-related errors
  if (error.name === 'DynamoDBError' || 
      error.code === 'ResourceNotFoundException' ||
      error.code === 'ValidationException' ||
      error.message.includes('DynamoDB') ||
      error.message.includes('table') ||
      error.message.includes('query')) {
    return handleDatabaseError(error, context);
  }
  
  // Default to server error
  return handleServerError(error, context);
}

module.exports = {
  ERROR_TYPES,
  GENERIC_ERROR_MESSAGES,
  createSecureErrorResponse,
  logDetailedError,
  createValidationErrorResponse,
  handleAuthenticationError,
  handleAuthorizationError,
  handleDatabaseError,
  handleServerError,
  handleError,
  sanitizeRequestData
};