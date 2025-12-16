const { getSecurityHeaders } = require('../middleware/securityHeaders');
const { handleError, createSecureErrorResponse } = require('./errorHandler');
const { getCorsHeaders } = require('../middleware/corsValidation');

/**
 * Get CORS headers for API responses
 * @param {string} origin - Request origin header
 * @returns {object} CORS headers object
 */
function corsHeaders(origin) {
  return getCorsHeaders(origin);
}

/**
 * Get all headers including CORS and security headers
 * @param {string} origin - Request origin header
 * @returns {object} Combined headers object
 */
function getAllHeaders(origin) {
  return {
    ...corsHeaders(origin),
    ...getSecurityHeaders()
  };
}

/**
 * Create a success response
 * @param {*} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {string} origin - Request origin header
 * @returns {object} Lambda response object
 */
function success(data, statusCode = 200, origin = null) {
  return {
    statusCode,
    headers: getAllHeaders(origin),
    body: JSON.stringify({
      success: true,
      data
    })
  };
}

/**
 * Create an error response (legacy method - use secureError for new code)
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {string} origin - Request origin header
 * @returns {object} Lambda response object
 */
function error(message, statusCode = 400, origin = null) {
  return {
    statusCode,
    headers: getAllHeaders(origin),
    body: JSON.stringify({
      success: false,
      error: message
    })
  };
}

/**
 * Create a secure error response using the error handler
 * @param {Error} errorObj - Error object
 * @param {object} context - Request context for logging
 * @param {string} origin - Request origin header
 * @returns {object} Lambda response object with secure error
 */
function secureError(errorObj, context = {}, origin = null) {
  const secureErrorResponse = handleError(errorObj, context);
  
  return {
    statusCode: secureErrorResponse.statusCode,
    headers: getAllHeaders(origin),
    body: JSON.stringify({
      success: false,
      error: secureErrorResponse.error,
      requestId: secureErrorResponse.requestId
    })
  };
}

module.exports = {
  corsHeaders,
  getAllHeaders,
  success,
  error,
  secureError
};
