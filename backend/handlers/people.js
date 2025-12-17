const { createEntity, getEntity, listEntities, updateEntity, deleteEntity } = require('../services/dynamodb');
const { validateRequired, validateUUID, sanitizeInput, validateAndSanitize, decodeHtmlEntities } = require('../utils/validation');
const { personSchema } = require('../utils/schemas');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { createValidationErrorResponse } = require('../utils/errorHandler');
const { authenticate, authorizeInventoryAccess } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { logDataAccess } = require('../services/auditLogService');

const ENTITY_TYPE = 'PEOPLE';

/**
 * Lambda handler for People CRUD operations
 * Handles GET, POST, PUT, DELETE requests for People
 */
const peopleHandler = async (event) => {
  const context = {
    endpoint: '/people',
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
 * Handle GET request - List all people for an inventory
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
    
    const people = await listEntities(ENTITY_TYPE, inventoryId);
    
    // Decode HTML entities for backward compatibility
    people.forEach(person => {
      // Decode text fields
      if (person.name) person.name = decodeHtmlEntities(person.name);
      if (person.description) person.description = decodeHtmlEntities(person.description);
      if (person.email) person.email = decodeHtmlEntities(person.email);
      if (person.phone) person.phone = decodeHtmlEntities(person.phone);
      if (person.notes) person.notes = decodeHtmlEntities(person.notes);
      
      // Decode photo keys
      if (person.photos && Array.isArray(person.photos)) {
        person.photos = person.photos.map(photo => decodeHtmlEntities(photo));
      }
    });
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'people', 'list', inventoryId);
    
    return success(people);
  } catch (err) {
    console.error('Error listing people:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
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
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, personSchema);
    if (!validation.valid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    const sanitizedData = validation.data;
    
    // Check inventory access
    await authorizeInventoryAccess(event, sanitizedData.inventoryId);
    
    // Create the person
    const person = await createEntity(ENTITY_TYPE, sanitizedData);
    
    // Decode HTML entities for backward compatibility
    if (person.name) person.name = decodeHtmlEntities(person.name);
    if (person.description) person.description = decodeHtmlEntities(person.description);
    if (person.email) person.email = decodeHtmlEntities(person.email);
    if (person.phone) person.phone = decodeHtmlEntities(person.phone);
    if (person.notes) person.notes = decodeHtmlEntities(person.notes);
    if (person.photos && Array.isArray(person.photos)) {
      person.photos = person.photos.map(photo => decodeHtmlEntities(photo));
    }
    
    // Log data access
    await logDataAccess(event.user.userId, 'create', 'people', person.id, sanitizedData.inventoryId);
    
    return success(person, 201);
  } catch (err) {
    console.error('Error creating person:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
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
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, personSchema);
    if (!validation.valid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    const sanitizedData = validation.data;
    
    // Check inventory access
    await authorizeInventoryAccess(event, sanitizedData.inventoryId);
    
    // Update the person
    const person = await updateEntity(ENTITY_TYPE, sanitizedData.inventoryId, id, sanitizedData);
    
    // Decode HTML entities for backward compatibility
    if (person.name) person.name = decodeHtmlEntities(person.name);
    if (person.description) person.description = decodeHtmlEntities(person.description);
    if (person.email) person.email = decodeHtmlEntities(person.email);
    if (person.phone) person.phone = decodeHtmlEntities(person.phone);
    if (person.notes) person.notes = decodeHtmlEntities(person.notes);
    if (person.photos && Array.isArray(person.photos)) {
      person.photos = person.photos.map(photo => decodeHtmlEntities(photo));
    }
    
    // Log data access
    await logDataAccess(event.user.userId, 'update', 'people', id, sanitizedData.inventoryId);
    
    return success(person);
  } catch (err) {
    console.error('Error updating person:', err);
    
    if (err.message === 'Entity not found') {
      return error('Person not found', 404);
    }
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to update person');
  }
}

/**
 * Handle DELETE request - Delete a person
 */
async function handleDelete(event, id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid person ID', 400);
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
    
    // Check if person exists before deleting
    const person = await getEntity(ENTITY_TYPE, inventoryId, id);
    if (!person) {
      return error('Person not found', 404);
    }
    
    // Delete the person
    await deleteEntity(ENTITY_TYPE, inventoryId, id);
    
    // Log data access
    await logDataAccess(event.user.userId, 'delete', 'people', id, inventoryId);
    
    return success({ message: 'Person deleted successfully' });
  } catch (err) {
    console.error('Error deleting person:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403);
    }
    
    throw new Error('Failed to delete person');
  }
}

// Export the handler wrapped with rate limiting
exports.handler = withRateLimit(peopleHandler);
