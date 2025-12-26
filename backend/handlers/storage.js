const storageService = require('../services/storageService');
const { validateRequired, validateUUID, sanitizeInput, validateAndSanitize } = require('../utils/validation');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { createValidationErrorResponse } = require('../utils/errorHandler');
const { authenticate } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { withCorsValidation } = require('../middleware/corsValidation');

/**
 * Lambda handler for Storage management operations
 * Handles storage tracking, cost calculation, and storage location management
 */
const storageHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/storage',
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
    if (path.includes('/start')) {
      // Start storage tracking
      const containerId = pathParameters.id;
      switch (httpMethod) {
        case 'POST':
          return await handleStartStorage(event, containerId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/end')) {
      // End storage tracking
      const containerId = pathParameters.id;
      switch (httpMethod) {
        case 'POST':
          return await handleEndStorage(event, containerId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/info')) {
      // Get storage information
      const containerId = pathParameters.id;
      switch (httpMethod) {
        case 'GET':
          return await handleGetStorageInfo(event, containerId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/projections')) {
      // Get cost projections
      const containerId = pathParameters.id;
      switch (httpMethod) {
        case 'GET':
          return await handleGetProjections(event, containerId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/rate')) {
      // Update storage rate
      const containerId = pathParameters.id;
      switch (httpMethod) {
        case 'PUT':
          return await handleUpdateRate(event, containerId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/list')) {
      // List storage containers
      switch (httpMethod) {
        case 'GET':
          return await handleListStorageContainers(event, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else {
      return error('Endpoint not found', 404, origin);
    }
  } catch (err) {
    // Use secure error handling
    return secureError(err, context, origin);
  }
};

/**
 * Handle POST request - Start storage tracking for a container
 */
async function handleStartStorage(event, containerId, origin) {
  try {
    // Validate container ID parameter
    if (!containerId || !validateUUID(containerId)) {
      return error('Invalid container ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.inventoryId || !validateUUID(body.inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    if (!body.storageLocationId || !validateUUID(body.storageLocationId)) {
      return error('Valid storageLocationId is required', 400, origin);
    }
    
    // Validate storage rate (optional, defaults to 0)
    let storageRate = 0;
    if (body.storageRate !== undefined) {
      if (typeof body.storageRate !== 'number' || body.storageRate < 0) {
        return error('Storage rate must be a non-negative number', 400, origin);
      }
      storageRate = body.storageRate;
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    const storageLocationId = sanitizeInput(body.storageLocationId);
    
    // Start storage tracking
    const result = await storageService.startStorageTracking(
      containerId, 
      inventoryId, 
      storageLocationId, 
      storageRate, 
      event.user.userId
    );
    
    return success(result, 201, origin);
  } catch (err) {
    console.error('Error starting storage tracking:', err);
    
    if (err.message === 'Container not found') {
      return error('Container not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to start storage tracking');
  }
}

/**
 * Handle POST request - End storage tracking for a container
 */
async function handleEndStorage(event, containerId, origin) {
  try {
    // Validate container ID parameter
    if (!containerId || !validateUUID(containerId)) {
      return error('Invalid container ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.inventoryId || !validateUUID(body.inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    
    // End storage tracking
    const result = await storageService.endStorageTracking(containerId, inventoryId, event.user.userId);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error ending storage tracking:', err);
    
    if (err.message === 'Container not found') {
      return error('Container not found', 404, origin);
    }
    
    if (err.message === 'No active storage tracking found for container') {
      return error('No active storage tracking found for container', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to end storage tracking');
  }
}

/**
 * Handle GET request - Get storage information for a container
 */
async function handleGetStorageInfo(event, containerId, origin) {
  try {
    // Validate container ID parameter
    if (!containerId || !validateUUID(containerId)) {
      return error('Invalid container ID', 400, origin);
    }
    
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Get storage information
    const result = await storageService.getStorageInfo(containerId, inventoryId, event.user.userId);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error getting storage info:', err);
    
    if (err.message === 'Container not found') {
      return error('Container not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve storage information');
  }
}

/**
 * Handle GET request - Get cost projections for a container
 */
async function handleGetProjections(event, containerId, origin) {
  try {
    // Validate container ID parameter
    if (!containerId || !validateUUID(containerId)) {
      return error('Invalid container ID', 400, origin);
    }
    
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Get projection months (optional, defaults to 12)
    let projectionMonths = 12;
    if (event.queryStringParameters?.months) {
      const months = parseInt(event.queryStringParameters.months);
      if (months > 0 && months <= 60) { // Cap at 5 years
        projectionMonths = months;
      }
    }
    
    // Get cost projections
    const result = await storageService.getStorageCostProjections(
      containerId, 
      inventoryId, 
      event.user.userId, 
      projectionMonths
    );
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error getting cost projections:', err);
    
    if (err.message === 'Container not found') {
      return error('Container not found', 404, origin);
    }
    
    if (err.message === 'Container is not currently in storage') {
      return error('Container is not currently in storage', 400, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve cost projections');
  }
}

/**
 * Handle PUT request - Update storage rate for a container
 */
async function handleUpdateRate(event, containerId, origin) {
  try {
    // Validate container ID parameter
    if (!containerId || !validateUUID(containerId)) {
      return error('Invalid container ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.inventoryId || !validateUUID(body.inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    if (typeof body.storageRate !== 'number' || body.storageRate < 0) {
      return error('Storage rate must be a non-negative number', 400, origin);
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    const storageRate = body.storageRate;
    
    // Update storage rate
    const result = await storageService.updateStorageRate(containerId, inventoryId, storageRate, event.user.userId);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error updating storage rate:', err);
    
    if (err.message === 'Container not found') {
      return error('Container not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Storage rate must be')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to update storage rate');
  }
}

/**
 * Handle GET request - List all containers in storage for an inventory
 */
async function handleListStorageContainers(event, origin) {
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
    
    if (event.queryStringParameters?.storageLocationId) {
      if (validateUUID(event.queryStringParameters.storageLocationId)) {
        options.storageLocationId = event.queryStringParameters.storageLocationId;
      }
    }
    
    if (event.queryStringParameters?.minDuration) {
      const minDuration = parseInt(event.queryStringParameters.minDuration);
      if (minDuration >= 0) {
        options.minDuration = minDuration;
      }
    }
    
    if (event.queryStringParameters?.maxDuration) {
      const maxDuration = parseInt(event.queryStringParameters.maxDuration);
      if (maxDuration >= 0) {
        options.maxDuration = maxDuration;
      }
    }
    
    if (event.queryStringParameters?.minCost) {
      const minCost = parseFloat(event.queryStringParameters.minCost);
      if (minCost >= 0) {
        options.minCost = minCost;
      }
    }
    
    if (event.queryStringParameters?.maxCost) {
      const maxCost = parseFloat(event.queryStringParameters.maxCost);
      if (maxCost >= 0) {
        options.maxCost = maxCost;
      }
    }
    
    if (event.queryStringParameters?.sortBy) {
      const sortBy = sanitizeInput(event.queryStringParameters.sortBy);
      if (['storageStartDate', 'duration', 'cost', 'containerName'].includes(sortBy)) {
        options.sortBy = sortBy;
      }
    }
    
    if (event.queryStringParameters?.sortOrder) {
      const sortOrder = sanitizeInput(event.queryStringParameters.sortOrder);
      if (sortOrder === 'asc' || sortOrder === 'desc') {
        options.sortOrder = sortOrder;
      }
    }
    
    if (event.queryStringParameters?.limit) {
      const limit = parseInt(event.queryStringParameters.limit);
      if (limit > 0 && limit <= 100) {
        options.limit = limit;
      }
    }
    
    // List storage containers
    const result = await storageService.listStorageContainers(inventoryId, event.user.userId, options);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error listing storage containers:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve storage containers');
  }
}

// Export the handler wrapped with rate limiting and CORS validation
exports.handler = withCorsValidation(withRateLimit(storageHandler));