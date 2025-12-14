const { createEntity, getEntity, listEntities, updateEntity, deleteEntity } = require('../services/dynamodb');
const { validateRequired, validateUUID, sanitizeInput } = require('../utils/validation');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');

const ENTITY_TYPE = 'LOCATIONS';

/**
 * Lambda handler for Locations CRUD operations
 * Handles GET, POST, PUT, DELETE requests for Locations
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
        return await handleGet();
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
    console.error('Error in Locations handler:', err);
    
    // Handle authentication errors
    if (err.statusCode === 401) {
      return error(err.message || 'Unauthorized', 401);
    }
    
    // Handle other errors
    return error(err.message || 'Internal server error', err.statusCode || 500);
  }
};

/**
 * Handle GET request - List all locations
 */
async function handleGet() {
  try {
    const locations = await listEntities(ENTITY_TYPE);
    return success(locations);
  } catch (err) {
    console.error('Error listing locations:', err);
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
    
    // Sanitize input
    const sanitizedData = sanitizeInput(body);
    
    // Validate required fields
    const validation = validateRequired(sanitizedData, ['name']);
    if (!validation.valid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    // Create the location with address fields
    const location = await createEntity(ENTITY_TYPE, sanitizedData);
    
    return success(location, 201);
  } catch (err) {
    console.error('Error creating location:', err);
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
    
    // Sanitize input
    const sanitizedData = sanitizeInput(body);
    
    // Validate required fields
    const validation = validateRequired(sanitizedData, ['name']);
    if (!validation.valid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    // Update the location
    const location = await updateEntity(ENTITY_TYPE, id, sanitizedData);
    
    return success(location);
  } catch (err) {
    console.error('Error updating location:', err);
    
    if (err.message === 'Entity not found') {
      return error('Location not found', 404);
    }
    
    throw new Error('Failed to update location');
  }
}

/**
 * Handle DELETE request - Delete a location
 */
async function handleDelete(id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid location ID', 400);
    }
    
    // Check if location exists before deleting
    const location = await getEntity(ENTITY_TYPE, id);
    if (!location) {
      return error('Location not found', 404);
    }
    
    // Delete the location
    await deleteEntity(ENTITY_TYPE, id);
    
    return success({ message: 'Location deleted successfully' });
  } catch (err) {
    console.error('Error deleting location:', err);
    throw new Error('Failed to delete location');
  }
}
