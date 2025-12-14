const { createEntity, getEntity, listEntities, updateEntity, deleteEntity } = require('../services/dynamodb');
const { validateRequired, validateUUID, sanitizeInput } = require('../utils/validation');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');

const ENTITY_TYPE = 'THINGS';

/**
 * Lambda handler for Things CRUD operations
 * Handles GET, POST, PUT, DELETE requests for Things
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
        return await handleDelete(event, pathParameters.id);
      default:
        return error('Method not allowed', 405);
    }
  } catch (err) {
    console.error('Error in Things handler:', err);
    
    // Handle authentication errors
    if (err.statusCode === 401) {
      return error(err.message || 'Unauthorized', 401);
    }
    
    // Handle other errors
    return error(err.message || 'Internal server error', err.statusCode || 500);
  }
};

/**
 * Handle GET request - List all things
 */
async function handleGet(event) {
  try {
    const things = await listEntities(ENTITY_TYPE);
    return success(things);
  } catch (err) {
    console.error('Error listing things:', err);
    throw new Error('Failed to retrieve things');
  }
}

/**
 * Handle POST request - Create a new thing
 */
async function handleCreate(event) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Sanitize input
    const sanitizedData = sanitizeInput(body);
    
    // Validate required fields
    const validation = validateRequired(sanitizedData, ['name']);
    if (!validation.valid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    // Validate optional UUID references if provided
    const uuidFields = ['locationId', 'roomId', 'ownerId', 'categoryId'];
    for (const field of uuidFields) {
      if (sanitizedData[field] && !validateUUID(sanitizedData[field])) {
        return error(`Invalid ${field} format`, 400);
      }
    }
    
    // Validate photos array if provided
    if (sanitizedData.photos && !Array.isArray(sanitizedData.photos)) {
      return error('Photos must be an array', 400);
    }
    
    // Create the thing
    const thing = await createEntity(ENTITY_TYPE, sanitizedData);
    
    return success(thing, 201);
  } catch (err) {
    console.error('Error creating thing:', err);
    throw new Error('Failed to create thing');
  }
}

/**
 * Handle PUT request - Update an existing thing
 */
async function handleUpdate(event, id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid thing ID', 400);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Sanitize input
    const sanitizedData = sanitizeInput(body);
    
    // Validate required fields
    const validation = validateRequired(sanitizedData, ['name']);
    if (!validation.valid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    // Validate optional UUID references if provided
    const uuidFields = ['locationId', 'roomId', 'ownerId', 'categoryId'];
    for (const field of uuidFields) {
      if (sanitizedData[field] && !validateUUID(sanitizedData[field])) {
        return error(`Invalid ${field} format`, 400);
      }
    }
    
    // Validate photos array if provided
    if (sanitizedData.photos && !Array.isArray(sanitizedData.photos)) {
      return error('Photos must be an array', 400);
    }
    
    // Update the thing
    const thing = await updateEntity(ENTITY_TYPE, id, sanitizedData);
    
    return success(thing);
  } catch (err) {
    console.error('Error updating thing:', err);
    
    if (err.message === 'Entity not found') {
      return error('Thing not found', 404);
    }
    
    throw new Error('Failed to update thing');
  }
}

/**
 * Handle DELETE request - Delete a thing
 */
async function handleDelete(event, id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid thing ID', 400);
    }
    
    // Check if thing exists before deleting
    const thing = await getEntity(ENTITY_TYPE, id);
    if (!thing) {
      return error('Thing not found', 404);
    }
    
    // Delete the thing
    await deleteEntity(ENTITY_TYPE, id);
    
    return success({ message: 'Thing deleted successfully' });
  } catch (err) {
    console.error('Error deleting thing:', err);
    throw new Error('Failed to delete thing');
  }
}
