const auditLogService = require('../services/auditLogService');

/**
 * Get allowed origins from environment or default configuration
 * @returns {string[]} Array of allowed origins
 */
function getAllowedOrigins() {
  // Get from environment variable or use default
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  
  if (allowedOriginsEnv) {
    return allowedOriginsEnv.split(',').map(origin => origin.trim());
  }
  
  // Default to CloudFront domain if available
  const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN;
  if (cloudFrontDomain) {
    return [`https://${cloudFrontDomain}`];
  }
  
  // Fallback for development (should not be used in production)
  if (process.env.NODE_ENV === 'development') {
    return ['http://localhost:3000', 'http://localhost:5173'];
  }
  
  // No wildcard allowed - return empty array to deny all
  return [];
}

/**
 * Validate origin header against allowed origins
 * @param {string} origin - Origin header value
 * @returns {boolean} True if origin is allowed
 */
function isOriginAllowed(origin) {
  if (!origin) {
    return false;
  }
  
  const allowedOrigins = getAllowedOrigins();
  
  // Exact match only - no wildcards allowed
  return allowedOrigins.includes(origin);
}

/**
 * Get CORS headers for allowed origin
 * @param {string} origin - Request origin
 * @returns {object} CORS headers object
 */
function getCorsHeaders(origin) {
  const baseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
    'Access-Control-Max-Age': '600'
  };
  
  // Only set Access-Control-Allow-Origin if origin is allowed
  if (isOriginAllowed(origin)) {
    baseHeaders['Access-Control-Allow-Origin'] = origin;
    baseHeaders['Access-Control-Allow-Credentials'] = 'true';
  }
  
  return baseHeaders;
}

/**
 * Validate CORS for state-changing requests (POST, PUT, DELETE)
 * @param {object} event - Lambda event object
 * @returns {Promise<object>} Event object or throws CORS error
 */
async function validateCorsForStateChangingRequest(event) {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const origin = event.headers?.Origin || event.headers?.origin;
  const referer = event.headers?.Referer || event.headers?.referer;
  
  // Only validate for state-changing requests
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!stateChangingMethods.includes(method)) {
    return event;
  }
  
  // For credentialed requests, validate Origin or Referer header
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (authHeader) {
    // Check Origin header first
    if (origin) {
      if (!isOriginAllowed(origin)) {
        // Log CORS violation
        const userId = event.user?.userId || 'unknown';
        await auditLogService.logAuthzFailure(
          userId,
          'cors_validation',
          `${method} ${event.requestContext?.http?.path || event.path}`,
          `Invalid origin: ${origin}`
        );
        
        const error = new Error('CORS policy violation: Invalid origin');
        error.statusCode = 403;
        error.corsError = true;
        throw error;
      }
    } else if (referer) {
      // If no Origin header, check Referer header
      try {
        const refererUrl = new URL(referer);
        const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
        
        if (!isOriginAllowed(refererOrigin)) {
          // Log CORS violation
          const userId = event.user?.userId || 'unknown';
          await auditLogService.logAuthzFailure(
            userId,
            'cors_validation',
            `${method} ${event.requestContext?.http?.path || event.path}`,
            `Invalid referer: ${referer}`
          );
          
          const error = new Error('CORS policy violation: Invalid referer');
          error.statusCode = 403;
          error.corsError = true;
          throw error;
        }
      } catch (urlError) {
        // Invalid referer URL
        const userId = event.user?.userId || 'unknown';
        await auditLogService.logAuthzFailure(
          userId,
          'cors_validation',
          `${method} ${event.requestContext?.http?.path || event.path}`,
          `Malformed referer: ${referer}`
        );
        
        const error = new Error('CORS policy violation: Malformed referer');
        error.statusCode = 403;
        error.corsError = true;
        throw error;
      }
    } else {
      // No Origin or Referer header for credentialed request
      const userId = event.user?.userId || 'unknown';
      await auditLogService.logAuthzFailure(
        userId,
        'cors_validation',
        `${method} ${event.requestContext?.http?.path || event.path}`,
        'Missing Origin and Referer headers for credentialed request'
      );
      
      const error = new Error('CORS policy violation: Missing origin information');
      error.statusCode = 403;
      error.corsError = true;
      throw error;
    }
  }
  
  return event;
}

/**
 * Handle OPTIONS preflight request
 * @param {object} event - Lambda event object
 * @returns {object} CORS preflight response
 */
function handlePreflightRequest(event) {
  const origin = event.headers?.Origin || event.headers?.origin;
  const requestedMethod = event.headers?.['Access-Control-Request-Method'] || 
                         event.headers?.['access-control-request-method'];
  const requestedHeaders = event.headers?.['Access-Control-Request-Headers'] || 
                          event.headers?.['access-control-request-headers'];
  
  // Validate origin
  if (!isOriginAllowed(origin)) {
    return {
      statusCode: 403,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'CORS policy violation: Origin not allowed'
      })
    };
  }
  
  // Validate requested method
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
  if (requestedMethod && !allowedMethods.includes(requestedMethod)) {
    return {
      statusCode: 403,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'CORS policy violation: Method not allowed'
      })
    };
  }
  
  // Return successful preflight response
  const corsHeaders = getCorsHeaders(origin);
  
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: ''
  };
}

/**
 * CORS validation middleware wrapper
 * @param {function} handler - Lambda handler function
 * @returns {function} Wrapped handler with CORS validation
 */
function withCorsValidation(handler) {
  return async (event, context) => {
    try {
      // Handle OPTIONS preflight requests
      const method = event.requestContext?.http?.method || event.httpMethod;
      if (method === 'OPTIONS') {
        return handlePreflightRequest(event);
      }
      
      // Validate CORS for state-changing requests
      await validateCorsForStateChangingRequest(event);
      
      // Call the original handler
      const response = await handler(event, context);
      
      // Add CORS headers to response
      const origin = event.headers?.Origin || event.headers?.origin;
      const corsHeaders = getCorsHeaders(origin);
      
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders
        }
      };
    } catch (error) {
      // Handle CORS errors
      if (error.corsError) {
        const origin = event.headers?.Origin || event.headers?.origin;
        const corsHeaders = getCorsHeaders(origin);
        
        return {
          statusCode: error.statusCode || 403,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          },
          body: JSON.stringify({
            success: false,
            error: error.message || 'CORS policy violation'
          })
        };
      }
      
      // Re-throw non-CORS errors
      throw error;
    }
  };
}

module.exports = {
  getAllowedOrigins,
  isOriginAllowed,
  getCorsHeaders,
  validateCorsForStateChangingRequest,
  handlePreflightRequest,
  withCorsValidation
};