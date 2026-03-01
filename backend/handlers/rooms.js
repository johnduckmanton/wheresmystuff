const { createEntity, getEntity, listEntities, updateEntity, deleteEntity } = require('../services/dynamodb');
const { validateRequired, validateUUID, sanitizeInput, validateAndSanitize, decodeHtmlEntities } = require('../utils/validation');
const { roomSchema } = require('../utils/schemas');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { createValidationErrorResponse } = require('../utils/errorHandler');
const { authenticate, authorizeInventoryAccess } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { logDataAccess } = require('../services/auditLogService');

const ENTITY_TYPE = 'ROOMS';

/**
 * Lambda handler for Rooms CRUD operations
 * Handles GET, POST, PUT, DELETE requests for Rooms
 */
const roomsHandler = async (event) => {
  const context = {
    endpoint: '/rooms',
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
 * Handle GET request - Get a single room by ID or list all rooms for an inventory
 */
async function handleGet(event) {
  try {
    const pathParameters = event.pathParameters || {};
    const queryParams = event.queryStringParameters || {};
    const inventoryId = queryParams.inventoryId;
    const locationId = queryParams.locationId;
    const roomId = pathParameters.id;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    // If roomId is provided, get a single room
    if (roomId) {
      if (!validateUUID(roomId)) {
        return error('Invalid room ID format', 400);
      }
      
      const room = await getEntity(ENTITY_TYPE, inventoryId, roomId);
      
      if (!room) {
        return error('Room not found', 404);
      }
      
      // Decode HTML entities in photo keys for backward compatibility
      if (room.photos && Array.isArray(room.photos)) {
        room.photos = room.photos.map(photo => decodeHtmlEntities(photo));
      }
      
      // Log data access
      await logDataAccess(event.user.userId, 'read', 'rooms', roomId, inventoryId);
      
      return success(room);
    }
    
    // Get all rooms for the inventory
    const rooms = await listEntities(ENTITY_TYPE, inventoryId);
    
    // Decode HTML entities in photo keys for backward compatibility
    rooms.forEach(room => {
      if (room.photos && Array.isArray(room.photos)) {
        room.photos = room.photos.map(photo => decodeHtmlEntities(photo));
      }
    });
    
    // Filter by locationId if provided
    if (locationId) {
      if (!validateUUID(locationId)) {
        return error('Invalid locationId format', 400);
      }
      
      const filteredRooms = rooms.filter(room => room.locationId === locationId);
      
      // Log data access
      await logDataAccess(event.user.userId, 'read', 'rooms', 'list_filtered', inventoryId);
      
      return success(filteredRooms);
    }
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'rooms', 'list', inventoryId);
    
    return success(rooms);
  } catch (err) {
    console.error('Error listing rooms:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to retrieve rooms');
  }
}

/**
 * Handle POST request - Create a new room
 */
async function handleCreate(event) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, roomSchema);
    if (!validation.valid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    const sanitizedData = validation.data;
    
    // Check inventory access
    await authorizeInventoryAccess(event, sanitizedData.inventoryId);
    
    // Create the room
    const room = await createEntity(ENTITY_TYPE, sanitizedData);
    
    // Log data access
    await logDataAccess(event.user.userId, 'create', 'rooms', room.id, sanitizedData.inventoryId);
    
    return success(room, 201);
  } catch (err) {
    console.error('Error creating room:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to create room');
  }
}

/**
 * Handle PUT request - Update an existing room
 */
async function handleUpdate(event, id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid room ID', 400);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, roomSchema);
    if (!validation.valid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    const sanitizedData = validation.data;
    
    // Check inventory access
    await authorizeInventoryAccess(event, sanitizedData.inventoryId);
    
    // Update the room
    const room = await updateEntity(ENTITY_TYPE, sanitizedData.inventoryId, id, sanitizedData);
    
    // Log data access
    await logDataAccess(event.user.userId, 'update', 'rooms', id, sanitizedData.inventoryId);
    
    return success(room);
  } catch (err) {
    console.error('Error updating room:', err);
    
    if (err.message === 'Entity not found') {
      return error('Room not found', 404);
    }
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to update room');
  }
}

/**
 * Handle DELETE request - Delete a room
 */
async function handleDelete(event, id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid room ID', 400);
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
    
    // Check if room exists before deleting
    const room = await getEntity(ENTITY_TYPE, inventoryId, id);
    if (!room) {
      return error('Room not found', 404);
    }
    
    // Delete the room
    await deleteEntity(ENTITY_TYPE, inventoryId, id);
    
    // Log data access
    await logDataAccess(event.user.userId, 'delete', 'rooms', id, inventoryId);
    
    return success({ message: 'Room deleted successfully' });
  } catch (err) {
    console.error('Error deleting room:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to delete room');
  }
}

// Export the handler wrapped with rate limiting
exports.handler = withRateLimit(roomsHandler);
