const { createEntity, getEntity, listEntities, updateEntity, deleteEntity } = require('../services/dynamodb');
const { validateRequired, validateUUID, sanitizeInput } = require('../utils/validation');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');

const ENTITY_TYPE = 'ROOMS';

/**
 * Lambda handler for Rooms CRUD operations
 * Handles GET, POST, PUT, DELETE requests for Rooms
 */
exports.handler = async (event) => {
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
        return await handleDelete(pathParameters.id);
      default:
        return error('Method not allowed', 405);
    }
  } catch (err) {
    console.error('Error in Rooms handler:', err);
    
    // Handle authentication errors
    if (err.statusCode === 401) {
      return error(err.message || 'Unauthorized', 401);
    }
    
    // Handle other errors
    return error(err.message || 'Internal server error', err.statusCode || 500);
  }
};

/**
 * Handle GET request - List all rooms or filter by locationId
 */
async function handleGet(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const locationId = queryParams.locationId;
    
    // Get all rooms
    const rooms = await listEntities(ENTITY_TYPE);
    
    // Filter by locationId if provided
    if (locationId) {
      if (!validateUUID(locationId)) {
        return error('Invalid locationId format', 400);
      }
      
      const filteredRooms = rooms.filter(room => room.locationId === locationId);
      return success(filteredRooms);
    }
    
    return success(rooms);
  } catch (err) {
    console.error('Error listing rooms:', err);
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
    
    // Sanitize input
    const sanitizedData = sanitizeInput(body);
    
    // Validate required fields (name and locationId are required)
    const validation = validateRequired(sanitizedData, ['name', 'locationId']);
    if (!validation.valid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    // Validate locationId UUID format
    if (!validateUUID(sanitizedData.locationId)) {
      return error('Invalid locationId format', 400);
    }
    
    // Create the room
    const room = await createEntity(ENTITY_TYPE, sanitizedData);
    
    return success(room, 201);
  } catch (err) {
    console.error('Error creating room:', err);
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
    
    // Sanitize input
    const sanitizedData = sanitizeInput(body);
    
    // Validate required fields
    const validation = validateRequired(sanitizedData, ['name', 'locationId']);
    if (!validation.valid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    // Validate locationId UUID format
    if (!validateUUID(sanitizedData.locationId)) {
      return error('Invalid locationId format', 400);
    }
    
    // Update the room
    const room = await updateEntity(ENTITY_TYPE, id, sanitizedData);
    
    return success(room);
  } catch (err) {
    console.error('Error updating room:', err);
    
    if (err.message === 'Entity not found') {
      return error('Room not found', 404);
    }
    
    throw new Error('Failed to update room');
  }
}

/**
 * Handle DELETE request - Delete a room
 */
async function handleDelete(id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid room ID', 400);
    }
    
    // Check if room exists before deleting
    const room = await getEntity(ENTITY_TYPE, id);
    if (!room) {
      return error('Room not found', 404);
    }
    
    // Delete the room
    await deleteEntity(ENTITY_TYPE, id);
    
    return success({ message: 'Room deleted successfully' });
  } catch (err) {
    console.error('Error deleting room:', err);
    throw new Error('Failed to delete room');
  }
}
