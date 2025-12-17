const inventoryService = require('../services/inventoryService');
const { validateRequired, validateUUID, sanitizeInput, validateAndSanitize, decodeHtmlEntities } = require('../utils/validation');
const { inventorySchema } = require('../utils/schemas');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { createValidationErrorResponse } = require('../utils/errorHandler');
const { authenticate } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { withCorsValidation } = require('../middleware/corsValidation');
const { logDataAccess } = require('../services/auditLogService');

/**
 * Lambda handler for Inventory CRUD operations
 * Handles GET, POST, PUT, DELETE requests for Inventories and Membership management
 */
const inventoryHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/inventories',
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
    if (path.includes('/members')) {
      // Membership management routes
      const inventoryId = pathParameters.id;
      const userId = pathParameters.userId;
      
      // Check for role management sub-route
      if (path.includes('/role') && userId) {
        switch (httpMethod) {
          case 'PUT':
            return await handleUpdateMemberRole(event, inventoryId, userId, origin);
          default:
            return error('Method not allowed', 405, origin);
        }
      }
      
      switch (httpMethod) {
        case 'GET':
          return await handleGetMembers(event, inventoryId, origin);
        case 'POST':
          return await handleAddMember(event, inventoryId, origin);
        case 'DELETE':
          return await handleRemoveMember(event, inventoryId, userId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else {
      // Inventory management routes
      switch (httpMethod) {
        case 'GET':
          if (pathParameters.id) {
            return await handleGetInventory(event, pathParameters.id, origin);
          } else {
            return await handleGetInventories(event, origin);
          }
        case 'POST':
          return await handleCreateInventory(event, origin);
        case 'PUT':
          return await handleUpdateInventory(event, pathParameters.id, origin);
        case 'DELETE':
          return await handleDeleteInventory(event, pathParameters.id, origin);
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
 * Handle GET request - List all inventories for the authenticated user
 */
async function handleGetInventories(event, origin) {
  try {
    const inventories = await inventoryService.getUserInventories(event.user.userId);
    
    // Decode HTML entities in photo keys for backward compatibility
    inventories.forEach(inventory => {
      if (inventory.photos && Array.isArray(inventory.photos)) {
        inventory.photos = inventory.photos.map(photo => decodeHtmlEntities(photo));
      }
    });
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'inventories', 'list', null);
    
    return success(inventories, 200, origin);
  } catch (err) {
    console.error('Error listing inventories:', err);
    throw new Error('Failed to retrieve inventories');
  }
}

/**
 * Handle GET request - Get a specific inventory by ID
 */
async function handleGetInventory(event, id, origin) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid inventory ID', 400, origin);
    }
    
    // Get the specific inventory
    const inventory = await inventoryService.getInventory(id, event.user.userId);
    
    // Decode HTML entities in photo keys for backward compatibility
    if (inventory.photos && Array.isArray(inventory.photos)) {
      inventory.photos = inventory.photos.map(photo => decodeHtmlEntities(photo));
    }
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'inventories', id, id);
    
    return success(inventory, 200, origin);
  } catch (err) {
    console.error('Error getting inventory:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message === 'Inventory not found') {
      return error('Inventory not found', 404, origin);
    }
    
    throw new Error('Failed to retrieve inventory');
  }
}

/**
 * Handle POST request - Create a new inventory
 */
async function handleCreateInventory(event, origin) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, inventorySchema);
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
    
    // Create the inventory
    const inventory = await inventoryService.createInventory(event.user.userId, sanitizedData);
    
    // Log data access
    await logDataAccess(event.user.userId, 'create', 'inventories', inventory.id, inventory.id);
    
    return success(inventory, 201, origin);
  } catch (err) {
    console.error('Error creating inventory:', err);
    throw new Error('Failed to create inventory');
  }
}

/**
 * Handle PUT request - Update an existing inventory
 */
async function handleUpdateInventory(event, id, origin) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid inventory ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, inventorySchema);
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
    
    // Update the inventory
    const inventory = await inventoryService.updateInventory(id, event.user.userId, sanitizedData);
    
    // Log data access
    await logDataAccess(event.user.userId, 'update', 'inventories', id, id);
    
    return success(inventory, 200, origin);
  } catch (err) {
    console.error('Error updating inventory:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message === 'Inventory not found') {
      return error('Inventory not found', 404, origin);
    }
    
    throw new Error('Failed to update inventory');
  }
}

/**
 * Handle DELETE request - Delete an inventory
 */
async function handleDeleteInventory(event, id, origin) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid inventory ID', 400, origin);
    }
    
    // Delete the inventory
    await inventoryService.deleteInventory(id, event.user.userId);
    
    // Log data access
    await logDataAccess(event.user.userId, 'delete', 'inventories', id, id);
    
    return success({ message: 'Inventory deleted successfully' }, 200, origin);
  } catch (err) {
    console.error('Error deleting inventory:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message === 'Inventory not found') {
      return error('Inventory not found', 404, origin);
    }
    
    throw new Error('Failed to delete inventory');
  }
}

/**
 * Handle GET request - List members of an inventory
 */
async function handleGetMembers(event, inventoryId, origin) {
  try {
    // Validate inventory ID parameter
    if (!inventoryId || !validateUUID(inventoryId)) {
      return error('Invalid inventory ID', 400, origin);
    }
    
    // Get inventory members
    const members = await inventoryService.getInventoryMembers(inventoryId, event.user.userId);
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'inventory_members', 'list', inventoryId);
    
    return success(members, 200, origin);
  } catch (err) {
    console.error('Error listing inventory members:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve inventory members');
  }
}

/**
 * Handle POST request - Add a member to an inventory
 */
async function handleAddMember(event, inventoryId, origin) {
  try {
    // Validate inventory ID parameter
    if (!inventoryId || !validateUUID(inventoryId)) {
      return error('Invalid inventory ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.userId || !validateUUID(body.userId)) {
      return error('Valid userId is required', 400, origin);
    }
    
    // Sanitize the userId
    const memberUserId = sanitizeInput(body.userId);
    
    // Add member to inventory
    const membership = await inventoryService.addInventoryMember(inventoryId, event.user.userId, memberUserId);
    
    // Log data access
    await logDataAccess(event.user.userId, 'create', 'inventory_members', memberUserId, inventoryId);
    
    return success(membership, 201, origin);
  } catch (err) {
    console.error('Error adding inventory member:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('already a member')) {
      return error(err.message, 409, origin);
    }
    
    throw new Error('Failed to add inventory member');
  }
}

/**
 * Handle DELETE request - Remove a member from an inventory
 */
async function handleRemoveMember(event, inventoryId, userId, origin) {
  try {
    // Validate parameters
    if (!inventoryId || !validateUUID(inventoryId)) {
      return error('Invalid inventory ID', 400, origin);
    }
    
    if (!userId || !validateUUID(userId)) {
      return error('Invalid user ID', 400, origin);
    }
    
    // Remove member from inventory
    await inventoryService.removeInventoryMember(inventoryId, event.user.userId, userId);
    
    // Log data access
    await logDataAccess(event.user.userId, 'delete', 'inventory_members', userId, inventoryId);
    
    return success({ message: 'Member removed successfully' }, 200, origin);
  } catch (err) {
    console.error('Error removing inventory member:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('not a member')) {
      return error(err.message, 404, origin);
    }
    
    if (err.message.includes('cannot remove themselves')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to remove inventory member');
  }
}

/**
 * Handle PUT request - Update a member's role in an inventory
 */
async function handleUpdateMemberRole(event, inventoryId, userId, origin) {
  try {
    // Validate parameters
    if (!inventoryId || !validateUUID(inventoryId)) {
      return error('Invalid inventory ID', 400, origin);
    }
    
    if (!userId || !validateUUID(userId)) {
      return error('Invalid user ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.role) {
      return error('Role is required', 400, origin);
    }
    
    // Validate role value
    const validRoles = ['owner', 'administrator', 'member', 'read_only'];
    if (!validRoles.includes(body.role)) {
      return error(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400, origin);
    }
    
    // Sanitize inputs
    const role = sanitizeInput(body.role);
    const reason = body.reason ? sanitizeInput(body.reason) : '';
    
    // Update member role
    const membership = await inventoryService.updateMemberRole(
      inventoryId, 
      event.user.userId, 
      userId, 
      role, 
      reason
    );
    
    // Log data access
    await logDataAccess(event.user.userId, 'update', 'inventory_member_role', userId, inventoryId);
    
    return success(membership, 200, origin);
  } catch (err) {
    console.error('Error updating member role:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('not a member')) {
      return error(err.message, 404, origin);
    }
    
    if (err.message.includes('Invalid role')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to update member role');
  }
}

// Export the handler wrapped with rate limiting and CORS validation
exports.handler = withCorsValidation(withRateLimit(inventoryHandler));