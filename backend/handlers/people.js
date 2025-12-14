const { createEntity, getEntity, listEntities, updateEntity, deleteEntity } = require('../services/dynamodb');
const { validateRequired, validateUUID, sanitizeInput } = require('../utils/validation');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');

const ENTITY_TYPE = 'PEOPLE';

/**
 * Lambda handler for People CRUD operations
 * Handles GET, POST, PUT, DELETE requests for People
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
    console.error('Error in People handler:', err);
    
    // Handle authentication errors
    if (err.statusCode === 401) {
      return error(err.message || 'Unauthorized', 401);
    }
    
    // Handle other errors
    return error(err.message || 'Internal server error', err.statusCode || 500);
  }
};

/**
 * Handle GET request - List all people
 */
async function handleGet() {
  try {
    const people = await listEntities(ENTITY_TYPE);
    return success(people);
  } catch (err) {
    console.error('Error listing people:', err);
    throw new Error('Failed to retrieve people');
  }
}

/**
 * Handle POST request - Create a new person
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
    
    // Create the person
    const person = await createEntity(ENTITY_TYPE, sanitizedData);
    
    return success(person, 201);
  } catch (err) {
    console.error('Error creating person:', err);
    throw new Error('Failed to create person');
  }
}

/**
 * Handle PUT request - Update an existing person
 */
async function handleUpdate(event, id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid person ID', 400);
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
    
    // Update the person
    const person = await updateEntity(ENTITY_TYPE, id, sanitizedData);
    
    return success(person);
  } catch (err) {
    console.error('Error updating person:', err);
    
    if (err.message === 'Entity not found') {
      return error('Person not found', 404);
    }
    
    throw new Error('Failed to update person');
  }
}

/**
 * Handle DELETE request - Delete a person
 */
async function handleDelete(id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid person ID', 400);
    }
    
    // Check if person exists before deleting
    const person = await getEntity(ENTITY_TYPE, id);
    if (!person) {
      return error('Person not found', 404);
    }
    
    // Delete the person
    await deleteEntity(ENTITY_TYPE, id);
    
    return success({ message: 'Person deleted successfully' });
  } catch (err) {
    console.error('Error deleting person:', err);
    throw new Error('Failed to delete person');
  }
}
