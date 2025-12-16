/**
 * Security Headers Middleware
 * Adds security headers to all HTTP responses to protect against common web vulnerabilities
 */

/**
 * Get security headers object
 * @returns {object} Security headers to be added to responses
 */
function getSecurityHeaders() {
  return {
    // Content Security Policy - Restrict resource loading to prevent XSS
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
    
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // Prevent clickjacking attacks
    'X-Frame-Options': 'DENY',
    
    // Enforce HTTPS for 1 year (31536000 seconds)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    
    // Enable XSS filtering in browsers
    'X-XSS-Protection': '1; mode=block'
  };
}

/**
 * Add security headers to a response object
 * @param {object} response - Lambda response object
 * @returns {object} Response object with security headers added
 */
function addSecurityHeaders(response) {
  if (!response) {
    return response;
  }
  
  // Ensure headers object exists
  if (!response.headers) {
    response.headers = {};
  }
  
  // Add security headers
  const securityHeaders = getSecurityHeaders();
  Object.assign(response.headers, securityHeaders);
  
  return response;
}

/**
 * Security headers middleware wrapper
 * Wraps a handler function to automatically add security headers to all responses
 * @param {Function} handler - The handler function to wrap
 * @returns {Function} Wrapped handler with security headers
 */
function withSecurityHeaders(handler) {
  return async (event, context) => {
    try {
      // Execute the original handler
      const response = await handler(event, context);
      
      // Add security headers to the response
      return addSecurityHeaders(response);
    } catch (error) {
      // If handler throws an error, we still need to add security headers
      // to any error response that might be generated
      throw error;
    }
  };
}

module.exports = {
  getSecurityHeaders,
  addSecurityHeaders,
  withSecurityHeaders
};