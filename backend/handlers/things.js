const { createEntity, getEntity, listEntities, updateEntity, deleteEntity } = require('../services/dynamodb');
const { validateRequired, validateUUID, sanitizeInput, validateAndSanitize } = require('../utils/validation');
const { thingSchema } = require('../utils/schemas');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { createValidationErrorResponse } = require('../utils/errorHandler');
const { authenticate, authorizeInventoryAccess, extractInventoryId } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { withCorsValidation } = require('../middleware/corsValidation');
const { logDataAccess } = require('../services/auditLogService');

const ENTITY_TYPE = 'THINGS';

/**
 * Lambda handler for Things CRUD operations
 * Handles GET, POST, PUT, DELETE requests for Things
 */
const thingsHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/things',
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
        return await handleGet(event, origin);
      case 'POST':
        return await handleCreate(event, origin);
      case 'PUT':
        return await handleUpdate(event, pathParameters.id, origin);
      case 'DELETE':
        return await handleDelete(event, pathParameters.id, origin);
      default:
        return error('Method not allowed', 405, origin);
    }
  } catch (err) {
    // Use secure error handling
    return secureError(err, context, origin);
  }
};

/**
 * Handle GET request - List all things for an inventory
 */
async function handleGet(event, origin) {
  try {
    // Extract inventory ID from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    const things = await listEntities(ENTITY_TYPE, inventoryId);
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'things', 'list', inventoryId);
    
    return success(things, 200, origin);
  } catch (err) {
    console.error('Error listing things:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to retrieve things');
  }
}

/**
 * Handle POST request - Create a new thing
 */
async function handleCreate(event, origin) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, thingSchema);
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
    
    // Check inventory access
    await authorizeInventoryAccess(event, sanitizedData.inventoryId);
    
    // Create the thing
    const thing = await createEntity(ENTITY_TYPE, sanitizedData);
    
    // Log data access
    await logDataAccess(event.user.userId, 'create', 'things', thing.id, sanitizedData.inventoryId);
    
    return success(thing, 201, origin);
  } catch (err) {
    console.error('Error creating thing:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to create thing');
  }
}

/**
 * Handle PUT request - Update an existing thing
 */
async function handleUpdate(event, id, origin) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid thing ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, thingSchema);
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
    
    // Check inventory access
    await authorizeInventoryAccess(event, sanitizedData.inventoryId);
    
    // Update the thing
    const thing = await updateEntity(ENTITY_TYPE, sanitizedData.inventoryId, id, sanitizedData);
    
    // Log data access
    await logDataAccess(event.user.userId, 'update', 'things', id, sanitizedData.inventoryId);
    
    return success(thing, 200, origin);
  } catch (err) {
    console.error('Error updating thing:', err);
    
    if (err.message === 'Entity not found') {
      return error('Thing not found', 404, origin);
    }
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to update thing');
  }
}

/**
 * Handle DELETE request - Delete a thing
 */
async function handleDelete(event, id, origin) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid thing ID', 400, origin);
    }
    
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    // Check if thing exists before deleting
    const thing = await getEntity(ENTITY_TYPE, inventoryId, id);
    if (!thing) {
      return error('Thing not found', 404, origin);
    }
    
    // Delete the thing
    await deleteEntity(ENTITY_TYPE, inventoryId, id);
    
    // Log data access
    await logDataAccess(event.user.userId, 'delete', 'things', id, inventoryId);
    
    return success({ message: 'Thing deleted successfully' }, 200, origin);
  } catch (err) {
    console.error('Error deleting thing:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to delete thing');
  }
}

// Export the handler wrapped with rate limiting and CORS validation
exports.handler = withCorsValidation(withRateLimit(thingsHandler));