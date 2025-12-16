const { createEntity, getEntity, listEntities, updateEntity, deleteEntity } = require('../services/dynamodb');
const { validateRequired, validateUUID, sanitizeInput, validateAndSanitize } = require('../utils/validation');
const { locationSchema } = require('../utils/schemas');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { createValidationErrorResponse } = require('../utils/errorHandler');
const { authenticate, authorizeInventoryAccess } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { logDataAccess } = require('../services/auditLogService');

const ENTITY_TYPE = 'LOCATIONS';

/**
 * Lambda handler for Locations CRUD operations
 * Handles GET, POST, PUT, DELETE requests for Locations
 */
const locationsHandler = async (event) => {
  const context = {
    endpoint: '/locations',
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
    
    // Route to appropriate handler based on HTTP method
    switch (httpMethod) {
      case 'GET':
        return await handleGet(event);
      case 'POST':
        return await handleCreate(event);
      case 'PUT':
        return await handleUpdate(event, pathParameters.id);
      case 'DELETE':
        return await handleDelete(event, pathParameters.id);
      default:
        return error('Method not allowed', 405);
    }
  } catch (err) {
    // Use secure error handling
    return secureError(err, context);
  }
};

/**
 * Handle GET request - List all locations for an inventory
 */
async function handleGet(event) {
  try {
    // Extract inventory ID from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    const locations = await listEntities(ENTITY_TYPE, inventoryId);
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'locations', 'list', inventoryId);
    
    return success(locations);
  } catch (err) {
    console.error('Error listing locations:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to retrieve locations');
  }
}

/**
 * Handle POST request - Create a new location
 */
async function handleCreate(event) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, locationSchema);
    if (!validation.valid) {
      const validationErrorResponse = createValidationErrorResponse(validation.errors);
      return {
        statusCode: validationErrorResponse.statusCode,
        headers: getAllHeaders(),
        body: JSON.stringify({
          success: false,
          error: validationErrorResponse.error,
          requestId: validationErrorResponse.requestId
        })
      };
    }
    
    const sanitizedData = validation.data;
    
    // Check inventory access
    await authorizeInventoryAccess(event, sanitizedData.inventoryId);
    
    // Create the location with address fields
    const location = await createEntity(ENTITY_TYPE, sanitizedData);
    
    // Log data access
    await logDataAccess(event.user.userId, 'create', 'locations', location.id, sanitizedData.inventoryId);
    
    return success(location, 201);
  } catch (err) {
    console.error('Error creating location:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to create location');
  }
}

/**
 * Handle PUT request - Update an existing location
 */
async function handleUpdate(event, id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid location ID', 400);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, locationSchema);
    if (!validation.valid) {
      const validationErrorResponse = createValidationErrorResponse(validation.errors);
      return {
        statusCode: validationErrorResponse.statusCode,
        headers: getAllHeaders(),
        body: JSON.stringify({
          success: false,
          error: validationErrorResponse.error,
          requestId: validationErrorResponse.requestId
        })
      };
    }
    
    const sanitizedData = validation.data;
    
    // Check inventory access
    await authorizeInventoryAccess(event, sanitizedData.inventoryId);
    
    // Update the location
    const location = await updateEntity(ENTITY_TYPE, sanitizedData.inventoryId, id, sanitizedData);
    
    // Log data access
    await logDataAccess(event.user.userId, 'update', 'locations', id, sanitizedData.inventoryId);
    
    return success(location);
  } catch (err) {
    console.error('Error updating location:', err);
    
    if (err.message === 'Entity not found') {
      return error('Location not found', 404);
    }
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to update location');
  }
}

/**
 * Handle DELETE request - Delete a location
 */
async function handleDelete(event, id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid location ID', 400);
    }
    
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    // Check if location exists before deleting
    const location = await getEntity(ENTITY_TYPE, inventoryId, id);
    if (!location) {
      return error('Location not found', 404);
    }
    
    // Delete the location
    await deleteEntity(ENTITY_TYPE, inventoryId, id);
    
    // Log data access
    await logDataAccess(event.user.userId, 'delete', 'locations', id, inventoryId);
    
    return success({ message: 'Location deleted successfully' });
  } catch (err) {
    console.error('Error deleting location:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to delete location');
  }
}

// Export the handler wrapped with rate limiting
exports.handler = withRateLimit(locationsHandler);
