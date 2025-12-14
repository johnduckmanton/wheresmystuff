const { createEntity, getEntity, listEntities, updateEntity, deleteEntity } = require('../services/dynamodb');
const { validateRequired, validateUUID, sanitizeInput } = require('../utils/validation');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');

const ENTITY_TYPE = 'CATEGORIES';

/**
 * Lambda handler for Categories CRUD operations
 * Handles GET, POST, PUT, DELETE requests for Categories
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
    console.error('Error in Categories handler:', err);
    
    // Handle authentication errors
    if (err.statusCode === 401) {
      return error(err.message || 'Unauthorized', 401);
    }
    
    // Handle other errors
    return error(err.message || 'Internal server error', err.statusCode || 500);
  }
};

/**
 * Handle GET request - List all categories
 */
async function handleGet() {
  try {
    const categories = await listEntities(ENTITY_TYPE);
    return success(categories);
  } catch (err) {
    console.error('Error listing categories:', err);
    throw new Error('Failed to retrieve categories');
  }
}

/**
 * Handle POST request - Create a new category
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
    
    // Create the category
    const category = await createEntity(ENTITY_TYPE, sanitizedData);
    
    return success(category, 201);
  } catch (err) {
    console.error('Error creating category:', err);
    throw new Error('Failed to create category');
  }
}

/**
 * Handle PUT request - Update an existing category
 */
async function handleUpdate(event, id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid category ID', 400);
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
    
    // Update the category
    const category = await updateEntity(ENTITY_TYPE, id, sanitizedData);
    
    return success(category);
  } catch (err) {
    console.error('Error updating category:', err);
    
    if (err.message === 'Entity not found') {
      return error('Category not found', 404);
    }
    
    throw new Error('Failed to update category');
  }
}

/**
 * Handle DELETE request - Delete a category
 */
async function handleDelete(id) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid category ID', 400);
    }
    
    // Check if category exists before deleting
    const category = await getEntity(ENTITY_TYPE, id);
    if (!category) {
      return error('Category not found', 404);
    }
    
    // Delete the category
    await deleteEntity(ENTITY_TYPE, id);
    
    return success({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting category:', err);
    throw new Error('Failed to delete category');
  }
}
