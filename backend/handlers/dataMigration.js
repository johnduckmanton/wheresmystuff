const dataMigrationService = require('../services/dataMigrationService');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { authenticate, authorizeInventoryAccess } = require('../middleware/auth');
const { validateUUID } = require('../utils/validation');
const { logDataAccess } = require('../services/auditLogService');

/**
 * Lambda handler for Data Migration operations
 * Handles migration of existing inventory data to support moving & storage features
 */
const dataMigrationHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/data-migration',
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
      case 'migrate-inventory':
        if (httpMethod === 'POST') {
          return await handleMigrateInventory(event, origin);
        }
        break;
      case 'create-from-locations':
        if (httpMethod === 'POST') {
          return await handleCreateFromLocations(event, origin);
        }
        break;
      case 'bulk-create-containers':
        if (httpMethod === 'POST') {
          return await handleBulkCreateContainers(event, origin);
        }
        break;
      case 'validate-cleanup':
        if (httpMethod === 'POST') {
          return await handleValidateCleanup(event, origin);
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
 * Handle inventory migration to container support
 */
async function handleMigrateInventory(event, origin) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { inventoryId, options = {} } = body;

    // Validate required fields
    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);

    // Validate options
    const {
      createDefaultContainers = true,
      groupByLocation = true,
      groupByCategory = false,
      maxItemsPerContainer = 50,
      dryRun = false
    } = options;

    if (typeof createDefaultContainers !== 'boolean' ||
        typeof groupByLocation !== 'boolean' ||
        typeof groupByCategory !== 'boolean' ||
        typeof dryRun !== 'boolean') {
      return error('Options must be boolean values', 400, origin);
    }

    if (typeof maxItemsPerContainer !== 'number' || maxItemsPerContainer < 1 || maxItemsPerContainer > 200) {
      return error('maxItemsPerContainer must be a number between 1 and 200', 400, origin);
    }

    // Perform migration
    const result = await dataMigrationService.migrateInventoryToContainerSupport(
      inventoryId,
      event.user.userId,
      {
        createDefaultContainers,
        groupByLocation,
        groupByCategory,
        maxItemsPerContainer,
        dryRun
      }
    );

    // Log the operation
    await logDataAccess(event.user.userId, 'migrate', 'inventory_containers', inventoryId, inventoryId);

    return success(result, 200, origin);
  } catch (err) {
    console.error('Error migrating inventory:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to migrate inventory');
  }
}

/**
 * Handle creating containers from locations
 */
async function handleCreateFromLocations(event, origin) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { inventoryId, options = {} } = body;

    // Validate required fields
    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);

    // Validate options
    const {
      containerPrefix = 'Location Container',
      maxItemsPerContainer = 50,
      dryRun = false
    } = options;

    if (typeof containerPrefix !== 'string' || containerPrefix.trim().length === 0) {
      return error('containerPrefix must be a non-empty string', 400, origin);
    }

    if (typeof maxItemsPerContainer !== 'number' || maxItemsPerContainer < 1 || maxItemsPerContainer > 200) {
      return error('maxItemsPerContainer must be a number between 1 and 200', 400, origin);
    }

    if (typeof dryRun !== 'boolean') {
      return error('dryRun must be a boolean value', 400, origin);
    }

    // Create containers from locations
    const result = await dataMigrationService.createContainersFromLocations(
      inventoryId,
      event.user.userId,
      {
        containerPrefix,
        maxItemsPerContainer,
        dryRun
      }
    );

    // Log the operation
    await logDataAccess(event.user.userId, 'create', 'containers_from_locations', inventoryId, inventoryId);

    return success(result, 200, origin);
  } catch (err) {
    console.error('Error creating containers from locations:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to create containers from locations');
  }
}

/**
 * Handle bulk container creation
 */
async function handleBulkCreateContainers(event, origin) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { inventoryId, containerSpecs } = body;

    // Validate required fields
    if (!inventoryId || !containerSpecs) {
      return error('inventoryId and containerSpecs are required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    if (!Array.isArray(containerSpecs)) {
      return error('containerSpecs must be an array', 400, origin);
    }

    if (containerSpecs.length === 0) {
      return error('containerSpecs cannot be empty', 400, origin);
    }

    if (containerSpecs.length > 100) {
      return error('Cannot create more than 100 containers at once', 400, origin);
    }

    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);

    // Bulk create containers
    const result = await dataMigrationService.bulkCreateContainers(
      inventoryId,
      containerSpecs,
      event.user.userId
    );

    // Log the operation
    await logDataAccess(event.user.userId, 'create', 'bulk_containers', inventoryId, inventoryId);

    return success(result, 200, origin);
  } catch (err) {
    console.error('Error bulk creating containers:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to bulk create containers');
  }
}

/**
 * Handle data validation and cleanup
 */
async function handleValidateCleanup(event, origin) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { inventoryId, options = {} } = body;

    // Validate required fields
    if (!inventoryId) {
      return error('inventoryId is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);

    // Validate options
    const {
      fixOrphanedItems = true,
      updateContainerCounts = true,
      removeEmptyContainers = false,
      dryRun = false
    } = options;

    if (typeof fixOrphanedItems !== 'boolean' ||
        typeof updateContainerCounts !== 'boolean' ||
        typeof removeEmptyContainers !== 'boolean' ||
        typeof dryRun !== 'boolean') {
      return error('Options must be boolean values', 400, origin);
    }

    // Perform validation and cleanup
    const result = await dataMigrationService.validateAndCleanupData(
      inventoryId,
      event.user.userId,
      {
        fixOrphanedItems,
        updateContainerCounts,
        removeEmptyContainers,
        dryRun
      }
    );

    // Log the operation
    await logDataAccess(event.user.userId, 'cleanup', 'data_validation', inventoryId, inventoryId);

    return success(result, 200, origin);
  } catch (err) {
    console.error('Error validating and cleaning up data:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to validate and cleanup data');
  }
}

module.exports = { dataMigrationHandler };