const { generateUploadUrl, generateDownloadUrl, deleteObject, SECURE_URL_EXPIRATION } = require('../services/s3');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { createValidationErrorResponse } = require('../utils/errorHandler');
const { authenticate, authorizeInventoryAccess } = require('../middleware/auth');
const { validateRequired, validateUUID } = require('../utils/validation');
const inventoryService = require('../services/inventoryService');
const { v4: uuidv4 } = require('uuid');
const { withRateLimit } = require('../middleware/rateLimit');
const { logDataAccess } = require('../services/auditLogService');

/**
 * Lambda handler for Photo operations
 * Handles POST /upload and GET /photo/{key} requests
 */
const photoHandler = async (event) => {
  const context = {
    endpoint: '/photo',
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
    
    // Route to appropriate handler based on HTTP method and path
    switch (httpMethod) {
      case 'POST':
        return await handleGenerateUploadUrl(event);
      case 'GET':
        return await handleGenerateDownloadUrl(event, pathParameters.key);
      case 'DELETE':
        return await handleDeletePhoto(event, pathParameters.key);
      default:
        return error('Method not allowed', 405);
    }
  } catch (err) {
    // Use secure error handling
    return secureError(err, context);
  }
};

/**
 * Handle POST /upload - Generate presigned URL for upload
 */
async function handleGenerateUploadUrl(event) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.fileName) {
      return error('fileName is required', 400);
    }
    
    if (!body.contentType) {
      return error('contentType is required', 400);
    }
    
    if (!body.inventoryId) {
      return error('inventoryId is required', 400);
    }
    
    if (!body.entityId) {
      return error('entityId is required', 400);
    }
    
    // Validate UUIDs
    if (!validateUUID(body.inventoryId)) {
      return error('Invalid inventoryId format', 400);
    }
    
    if (!validateUUID(body.entityId)) {
      return error('Invalid entityId format', 400);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, body.inventoryId);
    
    // Generate user-scoped key for the file
    // Format: photos/{userId}/{inventoryId}/{entityId}/{timestamp}-{filename}
    const userId = event.user.userId;
    const timestamp = Date.now();
    const sanitizedFileName = body.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `photos/${userId}/${body.inventoryId}/${body.entityId}/${timestamp}-${sanitizedFileName}`;
    
    // Generate presigned upload URL with secure expiration (15 minutes)
    const uploadUrl = await generateUploadUrl(key, body.contentType, true);
    
    // Log data access
    await logDataAccess(event.user.userId, 'create', 'photos', key, body.inventoryId);
    
    return success({
      uploadUrl,
      key,
      expiresIn: SECURE_URL_EXPIRATION // 15 minutes
    }, 201);
  } catch (err) {
    console.error('Error generating upload URL:', err);
    
    // Handle authentication/authorization errors
    if (err.statusCode === 401 || err.statusCode === 403) {
      return error(err.message || 'Access denied', err.statusCode);
    }
    
    // Handle validation errors from S3 service
    if (err.message.includes('Invalid file type')) {
      return error(err.message, 400);
    }
    
    throw new Error('Failed to generate upload URL');
  }
}

/**
 * Handle GET /photo/{key} - Generate presigned URL for download
 */
async function handleGenerateDownloadUrl(event, key) {
  try {
    // Validate key parameter
    if (!key) {
      return error('Photo key is required', 400);
    }
    
    // Decode the key (it may be URL encoded)
    const decodedKey = decodeURIComponent(key);
    
    // Verify photo access by extracting inventory and entity info from key
    const keyParts = decodedKey.split('/');
    
    // Expected format: photos/{userId}/{inventoryId}/{entityId}/{filename}
    if (keyParts.length < 5 || keyParts[0] !== 'photos') {
      return error('Invalid photo key format', 400);
    }
    
    const [, keyUserId, inventoryId, entityId] = keyParts;
    const currentUserId = event.user.userId;
    
    // Validate UUIDs
    if (!validateUUID(inventoryId) || !validateUUID(entityId)) {
      return error('Invalid photo key format', 400);
    }
    
    // Check if user has access to the inventory
    const hasAccess = await inventoryService.hasInventoryAccess(currentUserId, inventoryId);
    if (!hasAccess) {
      return error('Access denied: You do not have access to this photo', 403);
    }
    
    // Generate presigned download URL with secure expiration (15 minutes)
    const downloadUrl = await generateDownloadUrl(decodedKey, true);
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'photos', decodedKey, inventoryId);
    
    return success({
      downloadUrl,
      key: decodedKey,
      expiresIn: SECURE_URL_EXPIRATION // 15 minutes
    }, 200);
  } catch (err) {
    console.error('Error generating download URL:', err);
    
    // Handle authentication/authorization errors
    if (err.statusCode === 401 || err.statusCode === 403) {
      return error(err.message || 'Access denied', err.statusCode);
    }
    
    throw new Error('Failed to generate download URL');
  }
}

/**
 * Handle DELETE /photo/{key} - Delete a photo
 */
async function handleDeletePhoto(event, key) {
  try {
    // Validate key parameter
    if (!key) {
      return error('Photo key is required', 400);
    }
    
    // Decode the key (it may be URL encoded)
    const decodedKey = decodeURIComponent(key);
    
    // Verify photo access by extracting inventory and entity info from key
    const keyParts = decodedKey.split('/');
    
    // Expected format: photos/{userId}/{inventoryId}/{entityId}/{filename}
    if (keyParts.length < 5 || keyParts[0] !== 'photos') {
      return error('Invalid photo key format', 400);
    }
    
    const [, keyUserId, inventoryId, entityId] = keyParts;
    const currentUserId = event.user.userId;
    
    // Validate UUIDs
    if (!validateUUID(inventoryId) || !validateUUID(entityId)) {
      return error('Invalid photo key format', 400);
    }
    
    // Check if user has access to the inventory
    const hasAccess = await inventoryService.hasInventoryAccess(currentUserId, inventoryId);
    if (!hasAccess) {
      return error('Access denied: You do not have access to this photo', 403);
    }
    
    // Delete the photo from S3
    await deleteObject(decodedKey);
    
    // Log data access
    await logDataAccess(event.user.userId, 'delete', 'photos', decodedKey, inventoryId);
    
    return success({
      message: 'Photo deleted successfully',
      key: decodedKey
    }, 200);
  } catch (err) {
    console.error('Error deleting photo:', err);
    
    // Handle authentication/authorization errors
    if (err.statusCode === 401 || err.statusCode === 403) {
      return error(err.message || 'Access denied', err.statusCode);
    }
    
    throw new Error('Failed to delete photo');
  }
}

// Export the handler wrapped with rate limiting
exports.handler = withRateLimit(photoHandler);
