const dataSynchronizationService = require('../services/dataSynchronizationService');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { authenticate, authorizeInventoryAccess } = require('../middleware/auth');
const { validateUUID } = require('../utils/validation');
const { logDataAccess } = require('../services/auditLogService');

/**
 * Lambda handler for Data Synchronization operations
 * Handles synchronization between inventory and moving modules
 */
const dataSynchronizationHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/data-sync',
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
    const resource = pathParameters.resource;
    
    // Route to appropriate handler based on resource and HTTP method
    switch (resource) {
      case 'container-move':
        if (httpMethod === 'POST') {
          return await handleContainerMoveSync(event, origin);
        }
        break;
      case 'item-transfer':
        if (httpMethod === 'POST') {
          return await handleItemTransferSync(event, origin);
        }
        break;
      case 'validate-consistency':
        if (httpMethod === 'POST') {
          return await handleValidateConsistency(event, origin);
        }
        break;
      case 'resolve-inconsistencies':
        if (httpMethod === 'POST') {
          return await handleResolveInconsistencies(event, origin);
        }
        break;
      case 'detect-conflicts':
        if (httpMethod === 'POST') {
          return await handleDetectConflicts(event, origin);
        }
        break;
      case 'resolve-conflicts':
        if (httpMethod === 'POST') {
          return await handleResolveConflicts(event, origin);
        }
        break;
      default:
        return error('Resource not found', 404, origin);
    }
    
    return error('Method not allowed', 405, origin);
  } catch (err) {
    // Use secure error handling
    return secureError(err, context, origin);
  }
};

/**
 * Handle container move synchronization
 */
async function handleContainerMoveSync(event, origin) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { containerId, inventoryId, newLocationId } = body;

    // Validate required fields
    if (!containerId || !inventoryId || !newLocationId) {
      return error('containerId, inventoryId, and newLocationId are required', 400, origin);
    }

    if (!validateUUID(containerId) || !validateUUID(inventoryId) || !validateUUID(newLocationId)) {
      return error('Invalid UUID format', 400, origin);
    }

    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);

    // Perform synchronization
    const result = await dataSynchronizationService.synchronizeContainerMove(
      containerId,
      inventoryId,
      newLocationId,
      event.user.userId
    );

    // Log the operation
    await logDataAccess(event.user.userId, 'sync', 'container_move', containerId, inventoryId);

    return success(result, 200, origin);
  } catch (err) {
    console.error('Error synchronizing container move:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to synchronize container move');
  }
}

/**
 * Handle item transfer synchronization
 */
async function handleItemTransferSync(event, origin) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { itemIds, sourceContainerId, targetContainerId, inventoryId } = body;

    // Validate required fields
    if (!itemIds || !sourceContainerId || !targetContainerId || !inventoryId) {
      return error('itemIds, sourceContainerId, targetContainerId, and inventoryId are required', 400, origin);
    }

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return error('itemIds must be a non-empty array', 400, origin);
    }

    if (!validateUUID(sourceContainerId) || !validateUUID(targetContainerId) || !validateUUID(inventoryId)) {
      return error('Invalid UUID format', 400, origin);
    }

    // Validate item IDs
    for (const itemId of itemIds) {
      if (!validateUUID(itemId)) {
        return error(`Invalid item ID format: ${itemId}`, 400, origin);
      }
    }

    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);

    // Perform synchronization
    const result = await dataSynchronizationService.synchronizeItemTransfer(
      itemIds,
      sourceContainerId,
      targetContainerId,
      inventoryId,
      event.user.userId
    );

    // Log the operation
    await logDataAccess(event.user.userId, 'sync', 'item_transfer', `${sourceContainerId}->${targetContainerId}`, inventoryId);

    return success(result, 200, origin);
  } catch (err) {
    console.error('Error synchronizing item transfer:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to synchronize item transfer');
  }
}

/**
 * Handle data consistency validation
 */
async function handleValidateConsistency(event, origin) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { inventoryId } = body;

    // Validate required fields
    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);

    // Perform validation
    const result = await dataSynchronizationService.validateDataConsistency(
      inventoryId,
      event.user.userId
    );

    // Log the operation
    await logDataAccess(event.user.userId, 'validate', 'data_consistency', inventoryId, inventoryId);

    return success(result, 200, origin);
  } catch (err) {
    console.error('Error validating data consistency:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to validate data consistency');
  }
}

/**
 * Handle inconsistency resolution
 */
async function handleResolveInconsistencies(event, origin) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { inventoryId, inconsistencies } = body;

    // Validate required fields
    if (!inventoryId || !inconsistencies) {
      return error('inventoryId and inconsistencies are required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    if (!Array.isArray(inconsistencies)) {
      return error('inconsistencies must be an array', 400, origin);
    }

    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);

    // Perform resolution
    const result = await dataSynchronizationService.resolveInconsistencies(
      inventoryId,
      inconsistencies,
      event.user.userId
    );

    // Log the operation
    await logDataAccess(event.user.userId, 'resolve', 'inconsistencies', inventoryId, inventoryId);

    return success(result, 200, origin);
  } catch (err) {
    console.error('Error resolving inconsistencies:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to resolve inconsistencies');
  }
}

/**
 * Handle conflict detection
 */
async function handleDetectConflicts(event, origin) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { entityType, entityId, inventoryId, expectedVersion } = body;

    // Validate required fields
    if (!entityType || !entityId || !inventoryId || !expectedVersion) {
      return error('entityType, entityId, inventoryId, and expectedVersion are required', 400, origin);
    }

    if (!validateUUID(entityId) || !validateUUID(inventoryId)) {
      return error('Invalid UUID format', 400, origin);
    }

    if (!['item', 'container'].includes(entityType)) {
      return error('entityType must be either "item" or "container"', 400, origin);
    }

    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);

    // Detect conflicts
    const conflict = await dataSynchronizationService.detectConcurrentUpdateConflict(
      entityType,
      entityId,
      inventoryId,
      expectedVersion
    );

    // Log the operation
    await logDataAccess(event.user.userId, 'detect', 'conflicts', entityId, inventoryId);

    return success({
      hasConflict: !!conflict,
      conflict
    }, 200, origin);
  } catch (err) {
    console.error('Error detecting conflicts:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to detect conflicts');
  }
}

/**
 * Handle conflict resolution
 */
async function handleResolveConflicts(event, origin) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { conflict, localChanges, strategy } = body;

    // Validate required fields
    if (!conflict || !localChanges || !strategy) {
      return error('conflict, localChanges, and strategy are required', 400, origin);
    }

    if (!['merge', 'overwrite', 'reject'].includes(strategy)) {
      return error('strategy must be one of: merge, overwrite, reject', 400, origin);
    }

    // Check inventory access
    await authorizeInventoryAccess(event, conflict.inventoryId);

    // Resolve conflict
    const result = await dataSynchronizationService.resolveConcurrentUpdateConflict(
      conflict,
      localChanges,
      strategy,
      event.user.userId
    );

    // Log the operation
    await logDataAccess(event.user.userId, 'resolve', 'conflicts', conflict.entityId, conflict.inventoryId);

    return success(result, 200, origin);
  } catch (err) {
    console.error('Error resolving conflicts:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to resolve conflicts');
  }
}

module.exports = { dataSynchronizationHandler };