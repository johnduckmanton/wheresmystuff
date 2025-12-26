const storageAlertService = require('../services/storageAlertService');
const { validateRequired, validateUUID, sanitizeInput } = require('../utils/validation');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { withCorsValidation } = require('../middleware/corsValidation');

/**
 * Lambda handler for Storage Alert operations
 * Handles storage alerts, notifications, and retrieval planning
 */
const storageAlertsHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/storage-alerts',
    method: event.requestContext.http.method,
    userId: event.user?.userId,
    ipAddress: event.requestContext.http.sourceIp,
    userAgent: event.headers?.['user-agent'],
    requestData: {
      pathParameters: event.pathParameters,
      queryStringParameters: event.queryStringParameters,
      body: event.body ? JSON.parse(event.body) : null
    }
  };

  try {
    // Authenticate the request
    await authenticate(event);
    
    const httpMethod = event.requestContext.http.method;
    const pathParameters = event.pathParameters || {};
    const path = event.requestContext.http.path;
    
    // Route to appropriate handler based on HTTP method and path
    if (path.includes('/check')) {
      // Check for storage alerts
      switch (httpMethod) {
        case 'GET':
          return await handleCheckAlerts(event, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/create')) {
      // Create storage alert
      switch (httpMethod) {
        case 'POST':
          return await handleCreateAlert(event, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/read')) {
      // Mark alert as read
      const alertId = pathParameters.id;
      switch (httpMethod) {
        case 'PUT':
          return await handleMarkAsRead(event, alertId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/resolve')) {
      // Resolve alert
      const alertId = pathParameters.id;
      switch (httpMethod) {
        case 'PUT':
          return await handleResolveAlert(event, alertId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else {
      // List storage alerts
      switch (httpMethod) {
        case 'GET':
          return await handleListAlerts(event, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    }
  } catch (err) {
    // Use secure error handling
    return secureError(err, context, origin);
  }
};

/**
 * Handle GET request - Check for storage alerts
 */
async function handleCheckAlerts(event, origin) {
  try {
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Check storage alerts
    const result = await storageAlertService.checkStorageAlerts(inventoryId, event.user.userId);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error checking storage alerts:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to check storage alerts');
  }
}

/**
 * Handle POST request - Create storage alert
 */
async function handleCreateAlert(event, origin) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.inventoryId || !validateUUID(body.inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    if (!body.title || typeof body.title !== 'string') {
      return error('Title is required and must be a string', 400, origin);
    }
    
    if (!body.message || typeof body.message !== 'string') {
      return error('Message is required and must be a string', 400, origin);
    }
    
    // Validate optional fields
    if (body.priority && !['low', 'medium', 'high'].includes(body.priority)) {
      return error('Priority must be low, medium, or high', 400, origin);
    }
    
    if (body.containerId && !validateUUID(body.containerId)) {
      return error('Invalid containerId format', 400, origin);
    }
    
    if (body.costImpact && (typeof body.costImpact !== 'number' || body.costImpact < 0)) {
      return error('Cost impact must be a non-negative number', 400, origin);
    }
    
    // Sanitize inputs
    const alertData = {
      inventoryId: sanitizeInput(body.inventoryId),
      title: sanitizeInput(body.title),
      message: sanitizeInput(body.message),
      priority: body.priority ? sanitizeInput(body.priority) : 'medium',
      containerId: body.containerId ? sanitizeInput(body.containerId) : undefined,
      containerName: body.containerName ? sanitizeInput(body.containerName) : undefined,
      action: body.action ? sanitizeInput(body.action) : undefined,
      costImpact: body.costImpact || 0,
      expiresAt: body.expiresAt ? sanitizeInput(body.expiresAt) : undefined
    };
    
    // Create storage alert
    const result = await storageAlertService.createStorageAlert(
      alertData.inventoryId,
      event.user.userId,
      alertData
    );
    
    return success(result, 201, origin);
  } catch (err) {
    console.error('Error creating storage alert:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to create storage alert');
  }
}

/**
 * Handle GET request - List storage alerts
 */
async function handleListAlerts(event, origin) {
  try {
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Parse filtering options
    const options = {};
    
    if (event.queryStringParameters?.priority) {
      const priority = sanitizeInput(event.queryStringParameters.priority);
      if (['low', 'medium', 'high'].includes(priority)) {
        options.priority = priority;
      }
    }
    
    if (event.queryStringParameters?.isRead) {
      options.isRead = event.queryStringParameters.isRead === 'true';
    }
    
    if (event.queryStringParameters?.isResolved) {
      options.isResolved = event.queryStringParameters.isResolved === 'true';
    }
    
    if (event.queryStringParameters?.limit) {
      const limit = parseInt(event.queryStringParameters.limit);
      if (limit > 0 && limit <= 100) {
        options.limit = limit;
      }
    }
    
    // Get storage alerts
    const result = await storageAlertService.getStorageAlerts(inventoryId, event.user.userId, options);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error listing storage alerts:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve storage alerts');
  }
}

/**
 * Handle PUT request - Mark alert as read
 */
async function handleMarkAsRead(event, alertId, origin) {
  try {
    // Validate alert ID parameter
    if (!alertId || typeof alertId !== 'string') {
      return error('Invalid alert ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.inventoryId || !validateUUID(body.inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    const sanitizedAlertId = sanitizeInput(alertId);
    
    // Mark alert as read
    const result = await storageAlertService.markAlertAsRead(
      sanitizedAlertId,
      inventoryId,
      event.user.userId
    );
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error marking alert as read:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to mark alert as read');
  }
}

/**
 * Handle PUT request - Resolve alert
 */
async function handleResolveAlert(event, alertId, origin) {
  try {
    // Validate alert ID parameter
    if (!alertId || typeof alertId !== 'string') {
      return error('Invalid alert ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.inventoryId || !validateUUID(body.inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    if (!body.resolution || typeof body.resolution !== 'string') {
      return error('Resolution is required and must be a string', 400, origin);
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    const sanitizedAlertId = sanitizeInput(alertId);
    const resolution = sanitizeInput(body.resolution);
    
    // Resolve alert
    const result = await storageAlertService.resolveAlert(
      sanitizedAlertId,
      inventoryId,
      event.user.userId,
      resolution
    );
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error resolving alert:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to resolve alert');
  }
}

// Export the handler wrapped with rate limiting and CORS validation
exports.handler = withCorsValidation(withRateLimit(storageAlertsHandler));