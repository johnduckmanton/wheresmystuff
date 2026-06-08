'use strict';

const { validateRequired, validateUUID, sanitizeInput } = require('../utils/validation');
const { success, error, secureError } = require('../utils/response');
const { authenticate, authorizeInventoryAccess } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { withCorsValidation } = require('../middleware/corsValidation');
const photoSearchService = require('../services/photoSearchService');

/**
 * Lambda handler for Photo Search operations
 * Handles photo similarity search, embedding backfill, and backfill status
 */
const photoSearchHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/photo-search',
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
    const path = event.requestContext.http.path;

    // Route by HTTP method + path
    if (httpMethod === 'POST' && path === '/photo-search') {
      return await handleSearchByPhoto(event, origin);
    } else if (httpMethod === 'POST' && path === '/photo-search/backfill') {
      return await handleTriggerBackfill(event, origin);
    } else if (httpMethod === 'GET' && path === '/photo-search/status') {
      return await handleGetBackfillStatus(event, origin);
    } else {
      return error('Endpoint not found', 404, origin);
    }
  } catch (err) {
    // Use secure error handling for unexpected errors
    return secureError(err, context, origin);
  }
};

/**
 * Handle POST /photo-search — search for visually similar Things by photo
 * @param {object} event - Lambda event
 * @param {string} origin - Request origin for CORS
 */
async function handleSearchByPhoto(event, origin) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!body.photoKey || typeof body.photoKey !== 'string' || body.photoKey.trim().length === 0) {
      return error('photoKey is required', 400, origin);
    }

    if (!body.inventoryId) {
      return error('inventoryId is required', 400, origin);
    }

    if (!validateUUID(body.inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Sanitize inputs
    const photoKey = sanitizeInput(body.photoKey);
    const inventoryId = sanitizeInput(body.inventoryId);

    // Authorize inventory access
    await authorizeInventoryAccess(event, inventoryId);

    const userId = event.user.userId;

    // Delegate to photo search service
    const result = await photoSearchService.searchByPhoto(photoKey, inventoryId, userId);

    return success(result, 200, origin);
  } catch (err) {
    if (err.statusCode === 403) {
      return error('Access denied', 403, origin);
    }

    // Embedding generation failure — photo could not be processed
    if (
      err.message && (
        err.message.includes('OpenAI') ||
        err.message.includes('embedding') ||
        err.message.includes('vision API') ||
        err.message.includes('embeddings API')
      )
    ) {
      return error('Photo search service temporarily unavailable', 503, origin);
    }

    throw err;
  }
}

/**
 * Handle POST /photo-search/backfill — trigger embedding backfill for an inventory
 * @param {object} event - Lambda event
 * @param {string} origin - Request origin for CORS
 */
async function handleTriggerBackfill(event, origin) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!body.inventoryId) {
      return error('inventoryId is required', 400, origin);
    }

    if (!validateUUID(body.inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    const inventoryId = sanitizeInput(body.inventoryId);

    // Authorize inventory access
    await authorizeInventoryAccess(event, inventoryId);

    const userId = event.user.userId;

    // Delegate to photo search service
    const result = await photoSearchService.triggerBackfill(inventoryId, userId);

    return success(result, 200, origin);
  } catch (err) {
    if (err.statusCode === 403) {
      return error('Access denied', 403, origin);
    }

    throw err;
  }
}

/**
 * Handle GET /photo-search/status — get backfill status for an inventory
 * @param {object} event - Lambda event
 * @param {string} origin - Request origin for CORS
 */
async function handleGetBackfillStatus(event, origin) {
  try {
    // Get inventoryId from query string parameters
    const inventoryId = event.queryStringParameters?.inventoryId;

    if (!inventoryId) {
      return error('inventoryId query parameter is required', 400, origin);
    }

    if (!validateUUID(inventoryId)) {
      return error('Invalid inventoryId format', 400, origin);
    }

    // Authorize inventory access
    await authorizeInventoryAccess(event, inventoryId);

    // Return simple idle status (no backfill tracking implemented yet)
    const result = {
      status: 'idle',
      message: 'No backfill in progress'
    };

    return success(result, 200, origin);
  } catch (err) {
    if (err.statusCode === 403) {
      return error('Access denied', 403, origin);
    }

    throw err;
  }
}

// Export the handler wrapped with rate limiting and CORS validation
module.exports.handler = withCorsValidation(withRateLimit(photoSearchHandler));
