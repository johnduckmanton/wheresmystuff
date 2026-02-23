const containerService = require('../services/containerService');
const { validateRequired, validateUUID, sanitizeInput, validateAndSanitize } = require('../utils/validation');
const { containerSchema } = require('../utils/schemas');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { createValidationErrorResponse } = require('../utils/errorHandler');
const { authenticate, authorizeInventoryAccess } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { withCorsValidation } = require('../middleware/corsValidation');

/**
 * Lambda handler for Container CRUD operations
 * Handles GET, POST, PUT, DELETE requests for Containers
 */
const containersHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/containers',
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
    if (path.includes('/move')) {
      // Container move operations
      const containerId = pathParameters.id;
      
      if (path.includes('/bulk-move')) {
        switch (httpMethod) {
          case 'POST':
            return await handleBulkMove(event, origin);
          default:
            return error('Method not allowed', 405, origin);
        }
      } else {
        switch (httpMethod) {
          case 'POST':
            return await handleMove(event, containerId, origin);
          default:
            return error('Method not allowed', 405, origin);
        }
      }
    } else if (path.includes('/contents')) {
      // Container contents operations
      const containerId = pathParameters.id;
      
      switch (httpMethod) {
        case 'GET':
          return await handleGetContents(event, containerId, origin);
        case 'PUT':
          return await handleUpdateContents(event, containerId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/status')) {
      // Container status operations
      const containerId = pathParameters.id;
      
      switch (httpMethod) {
        case 'PUT':
          return await handleUpdateStatus(event, containerId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/qr-lookup')) {
      // QR code lookup
      switch (httpMethod) {
        case 'GET':
          return await handleQRLookup(event, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else {
      // Standard CRUD operations
      switch (httpMethod) {
        case 'GET':
          if (pathParameters.id) {
            return await handleGet(event, pathParameters.id, origin);
          } else {
            return await handleList(event, origin);
          }
        case 'POST':
          return await handleCreate(event, origin);
        case 'PUT':
          return await handleUpdate(event, pathParameters.id, origin);
        case 'DELETE':
          return await handleDelete(event, pathParameters.id, origin);
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
 * Handle GET request - Get a specific container
 */
async function handleGet(event, id, origin) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
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
    
    // Get the container
    const container = await containerService.getContainer(id, inventoryId, event.user.userId);
    
    if (!container) {
      return error('Container not found', 404, origin);
    }
    
    return success(container, 200, origin);
  } catch (err) {
    console.error('Error getting container:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve container');
  }
}

/**
 * Handle GET request - List containers for an inventory
 */
async function handleList(event, origin) {
  try {
    // Extract inventory ID from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Parse filtering and pagination options
    const options = {};
    
    if (event.queryStringParameters?.limit) {
      const limit = parseInt(event.queryStringParameters.limit);
      if (limit > 0 && limit <= 100) {
        options.limit = limit;
      }
    }
    
    if (event.queryStringParameters?.lastEvaluatedKey) {
      try {
        options.lastEvaluatedKey = JSON.parse(decodeURIComponent(event.queryStringParameters.lastEvaluatedKey));
      } catch (e) {
        return error('Invalid lastEvaluatedKey format', 400, origin);
      }
    }
    
    // Add filters
    if (event.queryStringParameters?.status) {
      options.status = sanitizeInput(event.queryStringParameters.status);
    }
    
    if (event.queryStringParameters?.type) {
      options.type = sanitizeInput(event.queryStringParameters.type);
    }
    
    if (event.queryStringParameters?.locationId) {
      if (validateUUID(event.queryStringParameters.locationId)) {
        options.locationId = event.queryStringParameters.locationId;
      }
    }
    
    if (event.queryStringParameters?.projectId) {
      if (validateUUID(event.queryStringParameters.projectId)) {
        options.projectId = event.queryStringParameters.projectId;
      }
    }
    
    if (event.queryStringParameters?.search) {
      options.search = sanitizeInput(event.queryStringParameters.search);
    }
    
    if (event.queryStringParameters?.sortBy) {
      options.sortBy = sanitizeInput(event.queryStringParameters.sortBy);
    }
    
    if (event.queryStringParameters?.sortOrder) {
      const sortOrder = sanitizeInput(event.queryStringParameters.sortOrder);
      if (sortOrder === 'asc' || sortOrder === 'desc') {
        options.sortOrder = sortOrder;
      }
    }

    // Add handling flags filter
    if (event.queryStringParameters?.handlingFlags) {
      try {
        const handlingFlags = JSON.parse(event.queryStringParameters.handlingFlags);
        if (Array.isArray(handlingFlags)) {
          options.handlingFlags = handlingFlags.map(flag => sanitizeInput(flag));
        }
      } catch (e) {
        // If parsing fails, treat as single flag
        options.handlingFlags = [sanitizeInput(event.queryStringParameters.handlingFlags)];
      }
    }
    
    // Get containers
    const result = await containerService.listContainers(inventoryId, event.user.userId, options);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error listing containers:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve containers');
  }
}

/**
 * Handle POST request - Create a new container
 */
async function handleCreate(event, origin) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Add createdBy from authenticated user before validation
    body.createdBy = event.user.userId;
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, containerSchema);
    if (!validation.valid) {
      const validationErrorResponse = createValidationErrorResponse(validation.errors);
      return {
        statusCode: validationErrorResponse.statusCode,
        headers: getAllHeaders(origin),
        body: JSON.stringify({
          success: false,
          error: validationErrorResponse.error,
          requestId: validationErrorResponse.requestId
        })
      };
    }
    
    const sanitizedData = validation.data;
    
    // Create the container
    const container = await containerService.createContainer(sanitizedData, event.user.userId);
    
    return success(container, 201, origin);
  } catch (err) {
    console.error('Error creating container:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Validation failed')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to create container');
  }
}

/**
 * Handle PUT request - Update an existing container
 */
async function handleUpdate(event, id, origin) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid container ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Add updatedBy from authenticated user before validation
    body.updatedBy = event.user.userId;
    
    // For updates, we need to get the existing container to include createdBy
    // since it's required by the schema but shouldn't come from the request
    if (!body.createdBy) {
      try {
        const existingContainer = await containerService.getContainer(id, body.inventoryId, event.user.userId);
        if (existingContainer) {
          body.createdBy = existingContainer.createdBy;
        }
      } catch (err) {
        // If we can't get the existing container, let the validation fail naturally
        console.warn('Could not get existing container for createdBy field:', err.message);
      }
    }
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, containerSchema);
    if (!validation.valid) {
      const validationErrorResponse = createValidationErrorResponse(validation.errors);
      return {
        statusCode: validationErrorResponse.statusCode,
        headers: getAllHeaders(origin),
        body: JSON.stringify({
          success: false,
          error: validationErrorResponse.error,
          requestId: validationErrorResponse.requestId
        })
      };
    }
    
    const sanitizedData = validation.data;
    
    // Update the container
    const container = await containerService.updateContainer(id, sanitizedData.inventoryId, sanitizedData, event.user.userId);
    
    return success(container, 200, origin);
  } catch (err) {
    console.error('Error updating container:', err);
    
    if (err.message === 'Container not found') {
      return error('Container not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Validation failed')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to update container');
  }
}

/**
 * Handle DELETE request - Delete a container
 */
async function handleDelete(event, id, origin) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
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

    // Check for force parameter
    const force = event.queryStringParameters?.force === 'true';
    
    // Delete the container
    await containerService.deleteContainer(id, inventoryId, event.user.userId, force);
    
    return success({ message: 'Container deleted successfully' }, 200, origin);
  } catch (err) {
    console.error('Error deleting container:', err);
    
    if (err.message === 'Container not found') {
      return error('Container not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Cannot delete container that contains items')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to delete container');
  }
}

/**
 * Handle POST request - Move a container to a new location
 */
async function handleMove(event, id, origin) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid container ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.inventoryId || !validateUUID(body.inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    if (!body.newLocationId || !validateUUID(body.newLocationId)) {
      return error('Valid newLocationId is required', 400, origin);
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    const newLocationId = sanitizeInput(body.newLocationId);
    
    // Move the container
    const result = await containerService.moveContainer(id, inventoryId, newLocationId, event.user.userId);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error moving container:', err);
    
    if (err.message === 'Container not found') {
      return error('Container not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to move container');
  }
}

/**
 * Handle POST request - Bulk move containers to a new location
 */
async function handleBulkMove(event, origin) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.inventoryId || !validateUUID(body.inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    if (!body.newLocationId || !validateUUID(body.newLocationId)) {
      return error('Valid newLocationId is required', 400, origin);
    }
    
    if (!body.containerIds || !Array.isArray(body.containerIds) || body.containerIds.length === 0) {
      return error('containerIds array is required and must not be empty', 400, origin);
    }
    
    // Validate all container IDs
    for (const containerId of body.containerIds) {
      if (!validateUUID(containerId)) {
        return error(`Invalid container ID: ${containerId}`, 400, origin);
      }
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    const newLocationId = sanitizeInput(body.newLocationId);
    const containerIds = body.containerIds.map(id => sanitizeInput(id));
    
    // Bulk move containers
    const result = await containerService.bulkMoveContainers(containerIds, inventoryId, newLocationId, event.user.userId);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error bulk moving containers:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Cannot move more than')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to bulk move containers');
  }
}

/**
 * Handle PUT request - Update container status
 */
async function handleUpdateStatus(event, id, origin) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid container ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.inventoryId || !validateUUID(body.inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    if (!body.status) {
      return error('Status is required', 400, origin);
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    const status = sanitizeInput(body.status);
    
    // Update container status
    const container = await containerService.updateContainerStatus(id, inventoryId, status, event.user.userId);
    
    return success(container, 200, origin);
  } catch (err) {
    console.error('Error updating container status:', err);
    
    if (err.message === 'Container not found') {
      return error('Container not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Status update failed')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to update container status');
  }
}

/**
 * Handle GET request - Get container contents
 */
async function handleGetContents(event, id, origin) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
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
    const result = await containerService.getContainerContents(id, inventoryId, event.user.userId);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error getting container contents:', err);
    
    if (err.message === 'Container not found') {
      return error('Container not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve container contents');
  }
}

/**
 * Handle PUT request - Update container contents (item count and value)
 */
async function handleUpdateContents(event, id, origin) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid container ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.inventoryId || !validateUUID(body.inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    if (typeof body.itemCount !== 'number' || body.itemCount < 0) {
      return error('itemCount must be a non-negative number', 400, origin);
    }
    
    if (typeof body.estimatedValue !== 'number' || body.estimatedValue < 0) {
      return error('estimatedValue must be a non-negative number', 400, origin);
    }
    
    // Sanitize inputs
    const inventoryId = sanitizeInput(body.inventoryId);
    const itemCount = body.itemCount;
    const estimatedValue = body.estimatedValue;
    
    // Update container contents
    const container = await containerService.updateContainerContents(id, inventoryId, itemCount, estimatedValue, event.user.userId);
    
    return success(container, 200, origin);
  } catch (err) {
    console.error('Error updating container contents:', err);
    
    if (err.message === 'Container not found') {
      return error('Container not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to update container contents');
  }
}

/**
 * Handle GET request - Lookup container by QR code
 */
async function handleQRLookup(event, origin) {
  try {
    // Get QR code from query parameters
    const qrCode = event.queryStringParameters?.qrCode;
    
    if (!qrCode) {
      return error('qrCode query parameter is required', 400, origin);
    }
    
    // Sanitize QR code
    const sanitizedQRCode = sanitizeInput(qrCode);
    
    // Find container by QR code
    const container = await containerService.findContainerByQRCode(sanitizedQRCode, event.user.userId);
    
    if (!container) {
      return error('Container not found for QR code', 404, origin);
    }
    
    return success(container, 200, origin);
  } catch (err) {
    console.error('Error looking up container by QR code:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to lookup container by QR code');
  }
}

// Export the handler wrapped with rate limiting and CORS validation
exports.handler = withCorsValidation(withRateLimit(containersHandler));