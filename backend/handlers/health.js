/**
 * Health Check Handler
 * 
 * Simple health check endpoint for monitoring and smoke tests.
 * Returns basic system status without requiring authentication.
 */

const { success, error } = require('../utils/response');

/**
 * Health check handler
 */
exports.handler = async (event) => {
  try {
    // Basic health check - just return success with timestamp
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'home-inventory-api',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      region: process.env.AWS_REGION || 'unknown'
    };

    // Optional: Add basic system checks
    if (process.env.TABLE_NAME) {
      healthStatus.database = {
        configured: true,
        tableName: process.env.TABLE_NAME
      };
    }

    if (process.env.USER_POOL_ID) {
      healthStatus.auth = {
        configured: true,
        userPoolId: process.env.USER_POOL_ID
      };
    }

    return success(healthStatus, 200);
    
  } catch (err) {
    console.error('Health check failed:', err);
    
    return error('Service temporarily unavailable', 503);
  }
};