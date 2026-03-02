const packingService = require('../services/packingService');
const { validateRequired, validateUUID, sanitizeInput, validateAndSanitize } = require('../utils/validation');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { createValidationErrorResponse } = require('../utils/errorHandler');
const { authenticate, authorizeInventoryAccess } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { withCorsValidation } = require('../middleware/corsValidation');
const errorLogger = require('../utils/errorLogger');

/**
 * Lambda handler for Packing operations
 * Handles item-to-container assignment, removal, and transfer operations
 */
const packingHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/packing',
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
    if (path.includes('/add-items')) {
      // Add items to container
      const containerId = pathParameters.containerId;
      
      switch (httpMethod) {
        case 'POST':
          return await handleAddItems(event, containerId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/remove-items')) {
      // Remove items from container
      const containerId = pathParameters.containerId;
      
      switch (httpMethod) {
        case 'POST':
          return await handleRemoveItems(event, containerId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/transfer-items')) {
      // Transfer items between containers
      switch (httpMethod) {
        case 'POST':
          return await handleTransferItems(event, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/bulk-assign')) {
      // Bulk assign items to containers
      switch (httpMethod) {
        case 'POST':
          return await handleBulkAssign(event, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/available-items')) {
      // Get available items for packing
      switch (httpMethod) {
        case 'GET':
          return await handleGetAvailableItems(event, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/interface-data')) {
      // Get all data needed for packing interface (optimized single call)
      switch (httpMethod) {
        case 'GET':
          return await handleGetInterfaceData(event, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/validate-capacity')) {
      // Validate container capacity
      const containerId = pathParameters.containerId;
      
      switch (httpMethod) {
        case 'POST':
          return await handleValidateCapacity(event, containerId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/contents')) {
      // Get container contents
      const containerId = pathParameters.containerId;
      
      switch (httpMethod) {
        case 'GET':
          return await handleGetContents(event, containerId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/create-and-pack')) {
      // Create a thing and immediately pack it into a container
      switch (httpMethod) {
        case 'POST':
          return await handleCreateAndPack(event, origin);
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
 * Handle POST request - Add items to container
 */
async function handleAddItems(event, containerId, origin) {
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
    
    if (!body.itemIds || !Array.isArray(body.itemIds) || body.itemIds.length === 0) {
      return error('itemIds array is required and must not be empty', 400, origin);
    }
    
    // Validate all item IDs
    for (const itemId of body.itemIds) {
      if (!validateUUID(itemId)) {
        return error(`Invalid item ID: ${itemId}`, 400, origin);
      }
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    const itemIds = body.itemIds.map(id => sanitizeInput(id));
    
    // Add items to container
    const result = await packingService.addItemsToContainer(containerId, inventoryId, itemIds, event.user.userId);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error adding items to container:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Container not found')) {
      return error(err.message, 404, origin);
    }
    
    if (err.message.includes('Item not found') || err.message.includes('already packed')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to add items to container');
  }
}

/**
 * Handle POST request - Remove items from container
 */
async function handleRemoveItems(event, containerId, origin) {
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
    
    if (!body.itemIds || !Array.isArray(body.itemIds) || body.itemIds.length === 0) {
      return error('itemIds array is required and must not be empty', 400, origin);
    }
    
    // Validate all item IDs
    for (const itemId of body.itemIds) {
      if (!validateUUID(itemId)) {
        return error(`Invalid item ID: ${itemId}`, 400, origin);
      }
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    const itemIds = body.itemIds.map(id => sanitizeInput(id));
    
    // Remove items from container
    const result = await packingService.removeItemsFromContainer(containerId, inventoryId, itemIds, event.user.userId);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error removing items from container:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Container not found')) {
      return error(err.message, 404, origin);
    }
    
    if (err.message.includes('Item not found') || err.message.includes('not in container')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to remove items from container');
  }
}

/**
 * Handle POST request - Transfer items between containers
 */
async function handleTransferItems(event, origin) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.inventoryId || !validateUUID(body.inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    if (!body.sourceContainerId || !validateUUID(body.sourceContainerId)) {
      return error('Valid sourceContainerId is required', 400, origin);
    }
    
    if (!body.targetContainerId || !validateUUID(body.targetContainerId)) {
      return error('Valid targetContainerId is required', 400, origin);
    }
    
    if (!body.itemIds || !Array.isArray(body.itemIds) || body.itemIds.length === 0) {
      return error('itemIds array is required and must not be empty', 400, origin);
    }
    
    // Validate all item IDs
    for (const itemId of body.itemIds) {
      if (!validateUUID(itemId)) {
        return error(`Invalid item ID: ${itemId}`, 400, origin);
      }
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    const sourceContainerId = sanitizeInput(body.sourceContainerId);
    const targetContainerId = sanitizeInput(body.targetContainerId);
    const itemIds = body.itemIds.map(id => sanitizeInput(id));
    
    // Transfer items between containers
    const result = await packingService.moveItemsBetweenContainers(
      sourceContainerId, 
      targetContainerId, 
      inventoryId, 
      itemIds, 
      event.user.userId
    );
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error transferring items between containers:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('not found')) {
      return error(err.message, 404, origin);
    }
    
    if (err.message.includes('cannot be the same') || err.message.includes('not in')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to transfer items between containers');
  }
}

/**
 * Handle POST request - Bulk assign items to containers
 */
async function handleBulkAssign(event, origin) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.inventoryId || !validateUUID(body.inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    if (!body.assignments || !Array.isArray(body.assignments) || body.assignments.length === 0) {
      return error('assignments array is required and must not be empty', 400, origin);
    }
    
    // Validate assignments structure
    for (const assignment of body.assignments) {
      if (!assignment.containerId || !validateUUID(assignment.containerId)) {
        return error('Each assignment must have a valid containerId', 400, origin);
      }
      
      if (!assignment.itemIds || !Array.isArray(assignment.itemIds) || assignment.itemIds.length === 0) {
        return error('Each assignment must have a non-empty itemIds array', 400, origin);
      }
      
      // Validate item IDs in assignment
      for (const itemId of assignment.itemIds) {
        if (!validateUUID(itemId)) {
          return error(`Invalid item ID in assignment: ${itemId}`, 400, origin);
        }
      }
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    const assignments = body.assignments.map(assignment => ({
      containerId: sanitizeInput(assignment.containerId),
      itemIds: assignment.itemIds.map(id => sanitizeInput(id))
    }));
    
    // Perform bulk assignment
    const result = await packingService.bulkAssignItems(assignments, inventoryId, event.user.userId);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error performing bulk assignment:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Cannot process more than')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to perform bulk assignment');
  }
}

/**
 * Handle GET request - Get available items for packing
 */
async function handleGetAvailableItems(event, origin) {
  try {
    // Extract inventory ID from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Parse filtering options
    const filters = {};
    
    if (event.queryStringParameters?.limit) {
      const limit = parseInt(event.queryStringParameters.limit);
      if (limit > 0 && limit <= 100) {
        filters.limit = limit;
      }
    }
    
    if (event.queryStringParameters?.lastEvaluatedKey) {
      try {
        filters.lastEvaluatedKey = JSON.parse(decodeURIComponent(event.queryStringParameters.lastEvaluatedKey));
      } catch (e) {
        return error('Invalid lastEvaluatedKey format', 400, origin);
      }
    }
    
    if (event.queryStringParameters?.locationId) {
      if (validateUUID(event.queryStringParameters.locationId)) {
        filters.locationId = event.queryStringParameters.locationId;
      }
    }
    
    if (event.queryStringParameters?.categoryId) {
      if (validateUUID(event.queryStringParameters.categoryId)) {
        filters.categoryId = event.queryStringParameters.categoryId;
      }
    }
    
    if (event.queryStringParameters?.search) {
      filters.search = sanitizeInput(event.queryStringParameters.search);
    }
    
    // Get available items
    const result = await packingService.getAvailableItems(inventoryId, event.user.userId, filters);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error getting available items:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve available items');
  }
}

/**
 * Handle POST request - Validate container capacity
 */
async function handleValidateCapacity(event, containerId, origin) {
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
    
    if (!body.itemIds || !Array.isArray(body.itemIds) || body.itemIds.length === 0) {
      return error('itemIds array is required and must not be empty', 400, origin);
    }
    
    // Validate all item IDs
    for (const itemId of body.itemIds) {
      if (!validateUUID(itemId)) {
        return error(`Invalid item ID: ${itemId}`, 400, origin);
      }
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    const itemIds = body.itemIds.map(id => sanitizeInput(id));
    
    // Validate container capacity
    const result = await packingService.validateContainerCapacity(containerId, inventoryId, itemIds, event.user.userId);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error validating container capacity:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Container not found')) {
      return error(err.message, 404, origin);
    }
    
    throw new Error('Failed to validate container capacity');
  }
}

/**
 * Handle GET request - Get container contents
 */
async function handleGetContents(event, containerId, origin) {
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
    
    // Get container contents
    const result = await packingService.getContainerContents(containerId, inventoryId, event.user.userId);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error getting container contents:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Container not found')) {
      return error(err.message, 404, origin);
    }
    
    throw new Error('Failed to retrieve container contents');
  }
}

/**
 * Handle POST request - Create a thing and immediately pack it into a container
 */
async function handleCreateAndPack(event, origin) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.inventoryId || !validateUUID(body.inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    if (!body.containerId || !validateUUID(body.containerId)) {
      return error('Valid containerId is required', 400, origin);
    }
    
    if (!body.thingData || typeof body.thingData !== 'object') {
      return error('thingData object is required', 400, origin);
    }
    
    // Validate thing data - name is required
    if (!body.thingData.name || typeof body.thingData.name !== 'string' || body.thingData.name.trim().length === 0) {
      return error('Thing name is required', 400, origin);
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    const containerId = sanitizeInput(body.containerId);
    
    // Sanitize thing data
    const thingData = {
      name: sanitizeInput(body.thingData.name),
      ...(body.thingData.description && { description: sanitizeInput(body.thingData.description) }),
      ...(body.thingData.categoryId && validateUUID(body.thingData.categoryId) && { categoryId: sanitizeInput(body.thingData.categoryId) }),
      ...(body.thingData.value !== undefined && { value: body.thingData.value }),
      ...(body.thingData.purchasePrice !== undefined && { purchasePrice: body.thingData.purchasePrice }),
      ...(body.thingData.photos && Array.isArray(body.thingData.photos) && { photos: body.thingData.photos }),
      ...(body.thingData.tags && Array.isArray(body.thingData.tags) && { tags: body.thingData.tags.map(tag => sanitizeInput(tag)) }),
      ...(body.thingData.serialNumber && { serialNumber: sanitizeInput(body.thingData.serialNumber) }),
      ...(body.thingData.model && { model: sanitizeInput(body.thingData.model) }),
      ...(body.thingData.make && { make: sanitizeInput(body.thingData.make) }),
      ...(body.thingData.brand && { brand: sanitizeInput(body.thingData.brand) }),
      ...(body.thingData.condition && { condition: sanitizeInput(body.thingData.condition) }),
      ...(body.thingData.notes && { notes: sanitizeInput(body.thingData.notes) }),
      ...(body.thingData.barcode && { barcode: sanitizeInput(body.thingData.barcode) })
    };
    
    // Create and pack the thing
    const result = await packingService.createAndPackThing(thingData, containerId, inventoryId, event.user.userId);
    
    return success(result, 201, origin);
  } catch (err) {
    // Determine error stage for better logging
    const body = JSON.parse(event.body || '{}');
    let stage = 'validation';
    
    if (err.message.includes('Container not found') || err.message.includes('not found')) {
      stage = 'validation';
    } else if (err.message.includes('allocation') || err.message.includes('add to container')) {
      stage = 'allocation';
    } else if (err.statusCode >= 500 || !err.statusCode) {
      stage = 'creation';
    }
    
    // Log error with context
    const { userFriendlyMessage } = errorLogger.logCreateAndPackError(
      err,
      stage,
      event.user?.userId,
      body.thingData,
      body.containerId
    );
    
    // Handle specific error status codes from the service
    if (err.statusCode) {
      // Map status codes to user-friendly messages
      let userMessage = userFriendlyMessage;
      
      switch (err.statusCode) {
        case 400:
          userMessage = err.message;
          break;
        case 403:
          userMessage = 'You do not have permission to access this inventory';
          break;
        case 404:
          if (err.message.includes('Container')) {
            userMessage = 'The selected container could not be found';
          } else {
            userMessage = 'The requested resource could not be found';
          }
          break;
        case 409:
          userMessage = 'Unable to complete the operation due to a conflict. Please try again';
          break;
        case 500:
          userMessage = 'An unexpected error occurred. Please try again later';
          break;
        case 503:
          userMessage = 'The service is temporarily unavailable. Please try again in a moment';
          break;
        default:
          userMessage = 'An error occurred while creating and packing the item';
      }
      
      return error(userMessage, err.statusCode, origin);
    }
    
    // Legacy error handling for errors without statusCode
    if (err.message.includes('Access denied')) {
      return error('You do not have permission to access this inventory', 403, origin);
    }
    
    if (err.message.includes('Container not found')) {
      return error('The selected container could not be found', 404, origin);
    }
    
    if (err.message.includes('not found')) {
      return error('The requested resource could not be found', 404, origin);
    }
    
    if (err.message.includes('required') || err.message.includes('Invalid')) {
      return error(err.message, 400, origin);
    }
    
    // Generic server error - return user-friendly message
    return error(userFriendlyMessage, 500, origin);
  }
}

/**
 * Handle GET request - Get all data needed for packing interface
 * This optimized endpoint returns things, categories, locations, rooms, people, and containers in a single call
 * to avoid Lambda throttling from multiple parallel requests
 */
async function handleGetInterfaceData(event, origin) {
  try {
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    console.log('handleGetInterfaceData called with inventoryId:', inventoryId);
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    console.log('Inventory access authorized for user:', event.user?.userId);

    // Import required services
    const { listEntities } = require('../services/dynamodb');
    
    console.log('Fetching entities from DynamoDB...');
    
    // Fetch all data in parallel from DynamoDB (single Lambda execution)
    const [things, categories, locations, rooms, people, containers] = await Promise.all([
      listEntities('THINGS', inventoryId),
      listEntities('CATEGORIES', inventoryId),
      listEntities('LOCATIONS', inventoryId),
      listEntities('ROOMS', inventoryId),
      listEntities('PEOPLE', inventoryId),
      listEntities('CONTAINERS', inventoryId),
    ]);
    
    console.log('Entities fetched:', {
      things: things.length,
      categories: categories.length,
      locations: locations.length,
      rooms: rooms.length,
      people: people.length,
      containers: containers.length,
    });
    
    // Debug: Log first container to see what data we're getting
    if (containers.length > 0) {
      console.log('First container from DB:', JSON.stringify(containers[0], null, 2));
    }

    return success({
      things,
      categories,
      locations,
      rooms,
      people,
      containers,
    }, 200, origin);
  } catch (err) {
    console.error('Error getting packing interface data:', err);
    
    if (err.message && err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    // Return secure error response instead of throwing
    return secureError(err, {
      endpoint: '/packing/interface-data',
      method: 'GET',
      userId: event.user?.userId,
      errorType: 'PackingInterfaceDataError',
      userAction: 'Loading packing interface data',
    }, origin);
  }
}

// Export the handler wrapped with rate limiting and CORS validation
exports.handler = withCorsValidation(withRateLimit(packingHandler));