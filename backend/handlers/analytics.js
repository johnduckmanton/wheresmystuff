const analyticsService = require('../services/analyticsService');
const { validateRequired, validateUUID, sanitizeInput } = require('../utils/validation');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { withCorsValidation } = require('../middleware/corsValidation');

/**
 * Lambda handler for Analytics operations
 * Handles GET requests for various analytics endpoints
 */
const analyticsHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/analytics',
    method: event.requestContext.http.method,
    userId: event.user?.userId,
    ipAddress: event.requestContext.http.sourceIp,
    userAgent: event.headers?.['user-agent'],
    requestData: {
      pathParameters: event.pathParameters,
      queryStringParameters: event.queryStringParameters
    }
  };

  try {
    // Authenticate the request
    await authenticate(event);
    
    const httpMethod = event.requestContext.http.method;
    const path = event.requestContext.http.path;
    
    // Only allow GET requests for analytics
    if (httpMethod !== 'GET') {
      return error('Method not allowed', 405, origin);
    }
    
    // Route to appropriate analytics handler based on path
    if (path.includes('/packing-metrics')) {
      return await handlePackingMetrics(event, origin);
    } else if (path.includes('/container-utilization')) {
      return await handleContainerUtilization(event, origin);
    } else if (path.includes('/moving-progress')) {
      return await handleMovingProgress(event, origin);
    } else if (path.includes('/storage-costs')) {
      return await handleStorageCosts(event, origin);
    } else if (path.includes('/recommendations')) {
      return await handleRecommendations(event, origin);
    } else {
      return error('Analytics endpoint not found', 404, origin);
    }
  } catch (err) {
    // Use secure error handling
    return secureError(err, context, origin);
  }
};

/**
 * Handle GET request - Get packing metrics and activity tracking
 */
async function handlePackingMetrics(event, origin) {
  try {
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Parse optional parameters
    const options = {};
    
    if (event.queryStringParameters?.startDate) {
      const startDate = sanitizeInput(event.queryStringParameters.startDate);
      // Basic date validation (ISO format)
      if (!/^\d{4}-\d{2}-\d{2}/.test(startDate)) {
        return error('Invalid startDate format. Use YYYY-MM-DD', 400, origin);
      }
      options.startDate = startDate;
    }
    
    if (event.queryStringParameters?.endDate) {
      const endDate = sanitizeInput(event.queryStringParameters.endDate);
      if (!/^\d{4}-\d{2}-\d{2}/.test(endDate)) {
        return error('Invalid endDate format. Use YYYY-MM-DD', 400, origin);
      }
      options.endDate = endDate;
    }
    
    if (event.queryStringParameters?.projectId) {
      if (validateUUID(event.queryStringParameters.projectId)) {
        options.projectId = event.queryStringParameters.projectId;
      }
    }
    
    // Get packing metrics
    const metrics = await analyticsService.getPackingMetrics(inventoryId, event.user.userId, options);
    
    return success(metrics, 200, origin);
  } catch (err) {
    console.error('Error getting packing metrics:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve packing metrics');
  }
}

/**
 * Handle GET request - Get container utilization and efficiency analytics
 */
async function handleContainerUtilization(event, origin) {
  try {
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Parse optional filters
    const options = {};
    
    if (event.queryStringParameters?.containerType) {
      options.containerType = sanitizeInput(event.queryStringParameters.containerType);
    }
    
    if (event.queryStringParameters?.status) {
      options.status = sanitizeInput(event.queryStringParameters.status);
    }
    
    if (event.queryStringParameters?.locationId) {
      if (validateUUID(event.queryStringParameters.locationId)) {
        options.locationId = event.queryStringParameters.locationId;
      }
    }
    
    // Get container utilization analytics
    const utilization = await analyticsService.getContainerUtilization(inventoryId, event.user.userId, options);
    
    return success(utilization, 200, origin);
  } catch (err) {
    console.error('Error getting container utilization:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve container utilization');
  }
}

/**
 * Handle GET request - Get moving progress and completion analytics
 */
async function handleMovingProgress(event, origin) {
  try {
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Get optional projectId
    let projectId = null;
    if (event.queryStringParameters?.projectId) {
      if (validateUUID(event.queryStringParameters.projectId)) {
        projectId = event.queryStringParameters.projectId;
      } else {
        return error('Invalid projectId format', 400, origin);
      }
    }
    
    // Get moving progress analytics
    const progress = await analyticsService.getMovingProgress(inventoryId, event.user.userId, projectId);
    
    return success(progress, 200, origin);
  } catch (err) {
    console.error('Error getting moving progress:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve moving progress');
  }
}

/**
 * Handle GET request - Get storage costs and duration analytics
 */
async function handleStorageCosts(event, origin) {
  try {
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Parse optional parameters
    const options = {};
    
    if (event.queryStringParameters?.startDate) {
      const startDate = sanitizeInput(event.queryStringParameters.startDate);
      if (!/^\d{4}-\d{2}-\d{2}/.test(startDate)) {
        return error('Invalid startDate format. Use YYYY-MM-DD', 400, origin);
      }
      options.startDate = startDate;
    }
    
    if (event.queryStringParameters?.endDate) {
      const endDate = sanitizeInput(event.queryStringParameters.endDate);
      if (!/^\d{4}-\d{2}-\d{2}/.test(endDate)) {
        return error('Invalid endDate format. Use YYYY-MM-DD', 400, origin);
      }
      options.endDate = endDate;
    }
    
    if (event.queryStringParameters?.locationId) {
      if (validateUUID(event.queryStringParameters.locationId)) {
        options.locationId = event.queryStringParameters.locationId;
      }
    }
    
    // Get storage costs analytics
    const costs = await analyticsService.getStorageCosts(inventoryId, event.user.userId, options);
    
    return success(costs, 200, origin);
  } catch (err) {
    console.error('Error getting storage costs:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve storage costs');
  }
}

/**
 * Handle GET request - Get recommendations and optimization suggestions
 */
async function handleRecommendations(event, origin) {
  try {
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Get recommendations
    const recommendations = await analyticsService.getRecommendations(inventoryId, event.user.userId);
    
    return success(recommendations, 200, origin);
  } catch (err) {
    console.error('Error getting recommendations:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve recommendations');
  }
}

// Export the handler wrapped with rate limiting and CORS validation
exports.handler = withCorsValidation(withRateLimit(analyticsHandler));