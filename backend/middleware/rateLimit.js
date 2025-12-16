const { checkRateLimit, recordRequest } = require('../services/rateLimitService');
const { logRateLimit } = require('../services/auditLogService');
const { logRateLimitViolation } = require('../utils/securityLogger');
const { getSecurityHeaders } = require('./securityHeaders');

/**
 * Create a response with custom headers
 * @param {number} statusCode - HTTP status code
 * @param {object} body - Response body
 * @param {object} additionalHeaders - Additional headers
 * @returns {object} Lambda response object
 */
function createResponse(statusCode, body, additionalHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...getSecurityHeaders(),
      ...additionalHeaders
    },
    body: JSON.stringify(body)
  };
}

/**
 * Rate limiting middleware
 * @param {Function} handler - The handler function to wrap
 * @returns {Function} Wrapped handler with rate limiting
 */
function withRateLimit(handler) {
  return async (event, context) => {
    try {
      // Extract user ID from the event (set by auth middleware)
      const userId = event.requestContext?.authorizer?.claims?.sub;
      if (!userId) {
        // If no user ID, skip rate limiting (unauthenticated endpoints)
        return await handler(event, context);
      }
      
      // Extract endpoint from the event
      const endpoint = `${event.httpMethod} ${event.resource}`;
      
      // Check rate limit
      const rateLimitResult = await checkRateLimit(userId, endpoint);
      
      if (!rateLimitResult.allowed) {
        // Log rate limit violation
        const ipAddress = event.requestContext?.http?.sourceIp || 'unknown';
        const userAgent = event.headers?.['user-agent'] || 'unknown';
        const requestId = event.requestContext?.requestId || 'unknown';
        
        // Log to audit service
        await logRateLimit(userId, endpoint, ipAddress, userAgent);
        
        // Log to CloudWatch for metrics
        await logRateLimitViolation(userId, endpoint, ipAddress, requestId);
        
        // Rate limit exceeded
        return createResponse(429, {
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.'
        }, {
          'Retry-After': rateLimitResult.resetTime - Math.floor(Date.now() / 1000),
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
        });
      }
      
      // Record the request
      await recordRequest(userId, endpoint);
      
      // Execute the original handler
      const response = await handler(event, context);
      
      // Add rate limit headers to successful responses
      if (response && response.headers) {
        response.headers['X-RateLimit-Limit'] = '100';
        response.headers['X-RateLimit-Remaining'] = (rateLimitResult.remaining - 1).toString();
        response.headers['X-RateLimit-Reset'] = rateLimitResult.resetTime.toString();
      }
      
      return response;
    } catch (error) {
      console.error('Rate limiting middleware error:', error);
      // In case of rate limiting error, allow the request to proceed
      return await handler(event, context);
    }
  };
}

module.exports = {
  withRateLimit
};