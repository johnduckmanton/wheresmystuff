const { createEntity, getEntity, listEntities, updateEntity, deleteEntity } = require('../services/dynamodb');
const { validateRequired, validateUUID, sanitizeInput, validateAndSanitize, validateAndNormalizeTags } = require('../utils/validation');
const { thingSchema } = require('../utils/schemas');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { createValidationErrorResponse, handleError } = require('../utils/errorHandler');
const { 
  handleTagSearchTimeout, 
  handleTagSuggestionError, 
  handleBulkTagOperationError,
  validateTagArray 
} = require('../utils/tagErrorHandler');
const { withRetryAndTimeout } = require('../utils/retryHandler');
const { authenticate, authorizeInventoryAccess, extractInventoryId } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { withCorsValidation } = require('../middleware/corsValidation');
const { logDataAccess } = require('../services/auditLogService');
const tagService = require('../services/tagService');
const tagCache = require('../services/tagCacheService');
const embeddingService = require('../services/embeddingService');

const ENTITY_TYPE = 'THINGS';

/**
 * Process and validate tags in thing data
 * @param {object} data - Thing data containing tags
 * @returns {object} Data with normalized tags
 */
function processThingTags(data) {
  if (!data.tags || !Array.isArray(data.tags)) {
    return data;
  }

  // Validate and normalize tags
  const tagResult = validateAndNormalizeTags(data.tags);
  
  if (!tagResult.valid) {
    const error = new Error(`Tag validation failed: ${tagResult.errors.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  return {
    ...data,
    tags: tagResult.normalizedTags
  };
}

/**
 * Lambda handler for Things CRUD operations
 * Handles GET, POST, PUT, DELETE requests for Things
 */
const thingsHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/things',
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
    const path = event.rawPath || event.requestContext.http.path;
    
    // Handle tag-specific endpoints
    if (path.includes('/tags')) {
      if (httpMethod === 'GET' && path.endsWith('/tags/analytics')) {
        return await handleTagAnalytics(event, origin);
      } else if (httpMethod === 'GET' && path.endsWith('/tags/paginated')) {
        return await handleGetTagsPaginated(event, origin);
      } else if (httpMethod === 'GET' && path.endsWith('/tags/cache-stats')) {
        return await handleGetCacheStats(event, origin);
      } else if (httpMethod === 'GET' && path.endsWith('/tags')) {
        return await handleGetTags(event, origin);
      } else if (httpMethod === 'POST' && path.includes('/tags/bulk')) {
        return await handleBulkTagOperations(event, origin);
      } else if (httpMethod === 'DELETE' && path.endsWith('/tags/cache')) {
        return await handleClearCache(event, origin);
      }
    }
    
    // Route to appropriate handler based on HTTP method
    switch (httpMethod) {
      case 'GET':
        return await handleGet(event, origin);
      case 'POST':
        return await handleCreate(event, origin);
      case 'PUT':
        return await handleUpdate(event, pathParameters.id, origin);
      case 'DELETE':
        return await handleDelete(event, pathParameters.id, origin);
      default:
        return error('Method not allowed', 405, origin);
    }
  } catch (err) {
    // Use secure error handling
    return secureError(err, context, origin);
  }
};

/**
 * Handle GET request - List all things for an inventory with optional tag filtering
 */
async function handleGet(event, origin) {
  try {
    // Extract inventory ID from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    // Check for tag search parameters with validation
    const tagParams = event.queryStringParameters?.tags;
    const tagMode = event.queryStringParameters?.tagMode || 'and';
    const partialMatch = event.queryStringParameters?.partialMatch === 'true';
    
    // Validate tag mode parameter
    if (!['and', 'or'].includes(tagMode)) {
      return error('Invalid tagMode parameter. Must be "and" or "or".', 400, origin);
    }
    
    let things;
    
    try {
      if (tagParams) {
        // Parse tags from comma-separated string
        const tags = tagParams.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        
        if (tags.length > 0) {
          // Validate tag array
          const tagValidation = validateTagArray(tags, null, event.requestContext?.requestId);
          if (!tagValidation.valid) {
            const errorMessages = tagValidation.errors.map(err => err.error || err.message).join(', ');
            return error(`Invalid search tags: ${errorMessages}`, 400, origin);
          }

          // Use timeout protection for search operations
          things = await withRetryAndTimeout(
            async () => {
              // Use TagService for advanced search capabilities
              if (partialMatch) {
                return await tagService.advancedTagSearch(inventoryId, {
                  tags,
                  mode: tagMode,
                  partialMatch: true
                });
              } else {
                return await tagService.searchByTags(inventoryId, tags, tagMode);
              }
            },
            25000, // 25 second timeout for search operations
            {
              maxAttempts: 2,
              retryableErrors: ['TIMEOUT', 'ThrottlingException', 'ServiceUnavailable']
            },
            `searchThings(${inventoryId}, ${tags.length} tags, ${tagMode})`
          );
        } else {
          // No valid tags, return all things
          things = await withRetryAndTimeout(
            () => listEntities(ENTITY_TYPE, inventoryId),
            15000, // 15 second timeout
            { maxAttempts: 2 },
            `listAllThings(${inventoryId})`
          );
        }
      } else {
        // No tag filtering, return all things
        things = await withRetryAndTimeout(
          () => listEntities(ENTITY_TYPE, inventoryId),
          15000, // 15 second timeout
          { maxAttempts: 2 },
          `listAllThings(${inventoryId})`
        );
      }
    } catch (searchError) {
      console.error('Search operation failed:', searchError);
      
      // Handle timeout errors specifically
      if (searchError.message.includes('timed out')) {
        const context = { 
          inventoryId, 
          userId: event.user?.userId || 'unknown', 
          endpoint: '/things',
          requestId: event.requestContext?.requestId 
        };
        const searchParams = { 
          tags: tagParams ? tagParams.split(',') : [], 
          mode: tagMode, 
          partialMatch, 
          inventoryId 
        };
        const timeoutError = handleTagSearchTimeout(searchError, context, searchParams);
        return error(timeoutError.error, timeoutError.statusCode, origin);
      }
      
      // Re-throw other errors to be handled by outer catch
      throw searchError;
    }
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'things', 'list', inventoryId);
    
    return success(things, 200, origin);
  } catch (err) {
    console.error('Error listing things:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to retrieve things');
  }
}

/**
 * Handle POST request - Create a new thing
 */
async function handleCreate(event, origin) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, thingSchema);
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
    
    let sanitizedData = validation.data;
    
    // Process and validate tags
    try {
      sanitizedData = processThingTags(sanitizedData);
    } catch (tagError) {
      return error(tagError.message, tagError.statusCode || 400, origin);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, sanitizedData.inventoryId);
    
    // Create the thing
    const thing = await createEntity(ENTITY_TYPE, sanitizedData);
    
    // Invalidate tag cache if thing has tags
    if (sanitizedData.tags && sanitizedData.tags.length > 0) {
      tagCache.invalidateInventoryCache(sanitizedData.inventoryId, 'tags');
    }
    
    // Log data access
    await logDataAccess(event.user.userId, 'create', 'things', thing.id, sanitizedData.inventoryId);
    
    return success(thing, 201, origin);
  } catch (err) {
    console.error('Error creating thing:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to create thing');
  }
}

/**
 * Handle PUT request - Update an existing thing
 */
async function handleUpdate(event, id, origin) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid thing ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate and sanitize using enhanced validation
    const validation = validateAndSanitize(body, thingSchema);
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
    
    let sanitizedData = validation.data;
    
    // Process and validate tags
    try {
      sanitizedData = processThingTags(sanitizedData);
    } catch (tagError) {
      return error(tagError.message, tagError.statusCode || 400, origin);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, sanitizedData.inventoryId);
    
    // Update the thing
    const thing = await updateEntity(ENTITY_TYPE, sanitizedData.inventoryId, id, sanitizedData);
    
    // Invalidate tag cache if thing has tags
    if (sanitizedData.tags !== undefined) {
      tagCache.invalidateInventoryCache(sanitizedData.inventoryId, 'tags');
    }
    
    // Log data access
    await logDataAccess(event.user.userId, 'update', 'things', id, sanitizedData.inventoryId);
    
    return success(thing, 200, origin);
  } catch (err) {
    console.error('Error updating thing:', err);
    console.error('Error stack:', err.stack);
    console.error('Error details:', JSON.stringify({
      message: err.message,
      statusCode: err.statusCode,
      name: err.name
    }));
    
    if (err.message === 'Entity not found') {
      return error('Thing not found', 404, origin);
    }
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw err;
  }
}

/**
 * Handle DELETE request - Delete a thing
 */
async function handleDelete(event, id, origin) {
  try {
    // Validate ID parameter
    if (!id || !validateUUID(id)) {
      return error('Invalid thing ID', 400, origin);
    }
    
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    // Check if thing exists before deleting
    const thing = await getEntity(ENTITY_TYPE, inventoryId, id);
    if (!thing) {
      return error('Thing not found', 404, origin);
    }
    
    // Delete the thing
    await deleteEntity(ENTITY_TYPE, inventoryId, id);
    
    // Invalidate tag cache since we deleted a thing that might have had tags
    tagCache.invalidateInventoryCache(inventoryId, 'tags');

    // Clean up embedding — non-blocking, failure must not affect Thing deletion
    try {
      await embeddingService.deleteEmbedding(inventoryId, id);
    } catch (embeddingErr) {
      console.error(JSON.stringify({
        message: 'Failed to delete embedding for Thing',
        thingId: id,
        inventoryId,
        error: embeddingErr.message
      }));
    }

    // Log data access
    await logDataAccess(event.user.userId, 'delete', 'things', id, inventoryId);
    
    return success({ message: 'Thing deleted successfully' }, 200, origin);
  } catch (err) {
    console.error('Error deleting thing:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to delete thing');
  }
}

/**
 * Handle GET /things/tags/cache-stats - Get cache statistics for monitoring
 */
async function handleGetCacheStats(event, origin) {
  try {
    // This endpoint is for admin/monitoring purposes
    // In production, you might want to add additional authorization
    await authenticate(event);
    
    const stats = tagCache.getStats();
    
    return success({
      cacheStats: stats,
      timestamp: new Date().toISOString()
    }, 200, origin);
  } catch (err) {
    console.error('Error getting cache stats:', err);
    throw new Error('Failed to retrieve cache statistics');
  }
}

/**
 * Handle DELETE /things/tags/cache - Clear tag cache for an inventory
 */
async function handleClearCache(event, origin) {
  try {
    await authenticate(event);
    
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (inventoryId) {
      if (!validateUUID(inventoryId)) {
        return error('Invalid inventoryId format', 400, origin);
      }
      
      // Check inventory access
      await authorizeInventoryAccess(event, inventoryId);
      
      // Clear cache for specific inventory
      tagCache.clearInventoryCache(inventoryId);
      
      return success({
        message: `Cache cleared for inventory ${inventoryId}`,
        inventoryId
      }, 200, origin);
    } else {
      // Clear all cache (admin operation)
      tagCache.clear();
      
      return success({
        message: 'All cache cleared'
      }, 200, origin);
    }
  } catch (err) {
    console.error('Error clearing cache:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to clear cache');
  }
}

/**
 * Handle GET /things/tags/paginated - Get paginated tags for large inventories
 */
async function handleGetTagsPaginated(event, origin) {
  try {
    // Extract inventory ID from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    // Extract pagination parameters
    const limit = event.queryStringParameters?.limit;
    const offset = event.queryStringParameters?.offset;
    const filter = event.queryStringParameters?.filter;
    const sortOrder = event.queryStringParameters?.sortOrder;
    
    const paginationOptions = {};
    if (limit) paginationOptions.limit = limit;
    if (offset) paginationOptions.offset = offset;
    if (filter) paginationOptions.filter = filter;
    if (sortOrder) paginationOptions.sortOrder = sortOrder;
    
    // Get paginated tags
    const result = await tagService.getInventoryTagsPaginated(inventoryId, paginationOptions);
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'tags', 'paginated-list', inventoryId);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error getting paginated tags:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to retrieve paginated tags');
  }
}

/**
 * Handle GET /things/tags - Get all tags for autocomplete with enhanced error handling
 */
async function handleGetTags(event, origin) {
  try {
    // Extract inventory ID from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    // Get optional parameters for tag suggestions
    const partialTag = event.queryStringParameters?.q || '';
    const excludeParam = event.queryStringParameters?.exclude || '';
    const limitParam = event.queryStringParameters?.limit || '10';
    
    const excludeTags = excludeParam ? excludeParam.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];
    const limit = Math.min(parseInt(limitParam, 10) || 10, 50); // Cap at 50

    // Validate limit parameter
    if (isNaN(limit) || limit < 1) {
      return error('Invalid limit parameter. Must be a positive number.', 400, origin);
    }
    
    let tags;
    
    try {
      // Use timeout protection for tag operations
      tags = await withRetryAndTimeout(
        async () => {
          if (partialTag || excludeTags.length > 0) {
            // Get filtered suggestions
            return await tagService.getTagSuggestions(inventoryId, partialTag, excludeTags, limit);
          } else {
            // Get all tags
            const allTags = await tagService.getInventoryTags(inventoryId);
            return allTags.slice(0, limit);
          }
        },
        10000, // 10 second timeout
        { maxAttempts: 2 },
        `getTags(${inventoryId})`
      );
    } catch (timeoutError) {
      console.error('Tag suggestions timeout:', timeoutError);
      const context = { 
        inventoryId, 
        userId: event.user?.userId || 'unknown', 
        endpoint: '/things/tags',
        requestId: event.requestContext?.requestId 
      };
      const suggestionParams = { query: partialTag, inventoryId, limit };
      const errorResponse = handleTagSuggestionError(timeoutError, context, suggestionParams);
      return error(errorResponse.error, errorResponse.statusCode, origin);
    }
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'tags', 'list', inventoryId);
    
    return success({ tags }, 200, origin);
  } catch (err) {
    console.error('Error getting tags:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    // Use secure error handling
    const context = { 
      inventoryId: event.queryStringParameters?.inventoryId,
      userId: event.user?.userId || 'unknown',
      endpoint: '/things/tags',
      method: 'GET'
    };
    return secureError(err, context, origin);
  }
}

/**
 * Handle GET /things/tags/analytics - Get tag usage statistics with pagination support
 */
async function handleTagAnalytics(event, origin) {
  try {
    // Extract inventory ID from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }
    
    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    // Extract pagination parameters
    const limit = event.queryStringParameters?.limit;
    const offset = event.queryStringParameters?.offset;
    const sortBy = event.queryStringParameters?.sortBy;
    const sortOrder = event.queryStringParameters?.sortOrder;
    const filter = event.queryStringParameters?.filter;
    
    const paginationOptions = {};
    if (limit) paginationOptions.limit = limit;
    if (offset) paginationOptions.offset = offset;
    if (sortBy) paginationOptions.sortBy = sortBy;
    if (sortOrder) paginationOptions.sortOrder = sortOrder;
    if (filter) paginationOptions.filter = filter;
    
    // Get tag analytics with pagination
    const analytics = await tagService.getTagAnalytics(inventoryId, paginationOptions);
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'tag-analytics', 'analytics', inventoryId);
    
    return success(analytics, 200, origin);
  } catch (err) {
    console.error('Error getting tag analytics:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    throw new Error('Failed to retrieve tag analytics');
  }
}

/**
 * Handle POST /things/tags/bulk - Bulk tag operations for multiple things
 */
async function handleBulkTagOperations(event, origin) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    const { operation, thingIds, inventoryId, tags } = body;
    
    if (!operation || !['add', 'remove', 'replace'].includes(operation)) {
      return error('operation must be one of: add, remove, replace', 400, origin);
    }
    
    if (!inventoryId || !validateUUID(inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    if (!thingIds || !Array.isArray(thingIds) || thingIds.length === 0) {
      return error('thingIds must be a non-empty array', 400, origin);
    }
    
    if (thingIds.length > 100) {
      return error('Cannot process more than 100 things at once', 400, origin);
    }
    
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return error('tags must be a non-empty array', 400, origin);
    }
    
    // Validate all thing IDs
    for (const thingId of thingIds) {
      if (!validateUUID(thingId)) {
        return error(`Invalid thing ID format: ${thingId}`, 400, origin);
      }
    }
    
    // Validate and normalize tags
    const tagResult = validateAndNormalizeTags(tags);
    if (!tagResult.valid) {
      return error(tagResult.error, 400, origin);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, inventoryId);
    
    // Perform bulk tag operation
    const result = await tagService.bulkTagOperation(inventoryId, {
      operation,
      thingIds,
      tags: tagResult.normalizedTags,
      userId: event.user.userId
    });
    
    // Log the operation
    await logDataAccess(event.user.userId, 'update', 'bulk-tags', `${operation}-${thingIds.length}`, inventoryId);
    
    return success(result, 200, origin);
  } catch (err) {
    console.error('Error performing bulk tag operation:', err);
    
    if (err.statusCode === 403) {
      return error(err.message || 'Access denied', 403, origin);
    }
    
    if (err.message.includes('not found')) {
      return error(err.message, 404, origin);
    }
    
    throw new Error('Failed to perform bulk tag operation');
  }
}

// Export the handler wrapped with rate limiting and CORS validation
exports.handler = withCorsValidation(withRateLimit(thingsHandler));