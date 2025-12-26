const containerSharingService = require('../services/containerSharingService');
const { validateRequired, validateUUID, sanitizeInput } = require('../utils/validation');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { withCorsValidation } = require('../middleware/corsValidation');

/**
 * Lambda handler for Container Sharing operations
 * Handles sharing link creation, access, and management
 */
const containerSharingHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/container-sharing',
    method: event.requestContext.http.method,
    userId: event.user?.userId || 'anonymous',
    ipAddress: event.requestContext.http.sourceIp,
    userAgent: event.headers?.['user-agent'],
    requestData: {
      pathParameters: event.pathParameters,
      queryStringParameters: event.queryStringParameters,
      body: event.body ? JSON.parse(event.body) : null
    }
  };

  try {
    const httpMethod = event.requestContext.http.method;
    const pathParameters = event.pathParameters || {};
    const path = event.requestContext.http.path;
    
    // Handle public shared container access (no authentication required)
    if (path.includes('/shared/container/')) {
      switch (httpMethod) {
        case 'GET':
          return await handleGetSharedContainer(event, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    }
    
    // All other operations require authentication
    await authenticate(event);
    
    // Route to appropriate handler based on HTTP method and path
    if (path.includes('/sharing-links')) {
      // Sharing link management
      const containerId = pathParameters.containerId;
      
      switch (httpMethod) {
        case 'GET':
          return await handleListSharingLinks(event, containerId, origin);
        case 'POST':
          return await handleCreateSharingLink(event, containerId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/sharing-link/')) {
      // Individual sharing link operations
      const shareId = pathParameters.shareId;
      
      switch (httpMethod) {
        case 'PUT':
          return await handleUpdateSharingLink(event, shareId, origin);
        case 'DELETE':
          return await handleDeleteSharingLink(event, shareId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else {
      return error('Invalid endpoint', 404, origin);
    }
  } catch (err) {
    // Use secure error handling
    return secureError(err, context, origin);
  }
};

/**
 * Handle GET request - Access a shared container (public endpoint)
 */
async function handleGetSharedContainer(event, origin) {
  try {
    const shareId = event.pathParameters?.shareId;
    const token = event.queryStringParameters?.token;
    
    if (!shareId) {
      return error('Share ID is required', 400, origin);
    }
    
    if (!token) {
      return error('Sharing token is required', 400, origin);
    }
    
    // Sanitize inputs
    const sanitizedShareId = sanitizeInput(shareId);
    const sanitizedToken = sanitizeInput(token);
    
    // Gather accessor information for logging
    const accessorInfo = {
      ipAddress: event.requestContext.http.sourceIp,
      userAgent: event.headers?.['user-agent'] || 'unknown',
      timestamp: new Date().toISOString(),
      referer: event.headers?.referer || event.headers?.Referer
    };
    
    // Get shared container data
    const sharedData = await containerSharingService.getSharingLink(
      sanitizedShareId,
      sanitizedToken,
      accessorInfo
    );
    
    return success(sharedData, 200, origin);
  } catch (err) {
    console.error('Error accessing shared container:', err);
    
    if (err.message.includes('not found')) {
      return error('Shared container not found', 404, origin);
    }
    
    if (err.message.includes('Invalid sharing token')) {
      return error('Invalid or expired sharing link', 403, origin);
    }
    
    if (err.message.includes('expired') || err.message.includes('limit exceeded')) {
      return error('Sharing link is no longer available', 410, origin);
    }
    
    throw new Error('Failed to access shared container');
  }
}

/**
 * Handle POST request - Create a new sharing link
 */
async function handleCreateSharingLink(event, containerId, origin) {
  try {
    // Validate container ID parameter
    if (!containerId || !validateUUID(containerId)) {
      return error('Invalid container ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.inventoryId || !validateUUID(body.inventoryId)) {
      return error('Valid inventoryId is required', 400, origin);
    }
    
    // Sanitize and validate optional fields
    const options = {};
    
    if (body.expiresAt) {
      const expirationDate = new Date(body.expiresAt);
      if (isNaN(expirationDate.getTime())) {
        return error('Invalid expiration date format', 400, origin);
      }
      if (expirationDate <= new Date()) {
        return error('Expiration date must be in the future', 400, origin);
      }
      options.expiresAt = expirationDate.toISOString();
    }
    
    if (typeof body.includeItemDetails === 'boolean') {
      options.includeItemDetails = body.includeItemDetails;
    }
    
    if (typeof body.includePhotos === 'boolean') {
      options.includePhotos = body.includePhotos;
    }
    
    if (typeof body.includeSensitiveData === 'boolean') {
      options.includeSensitiveData = body.includeSensitiveData;
    }
    
    if (body.maxAccesses && typeof body.maxAccesses === 'number' && body.maxAccesses > 0) {
      options.maxAccesses = Math.min(body.maxAccesses, 1000); // Cap at 1000 accesses
    }
    
    if (body.description && typeof body.description === 'string') {
      options.description = sanitizeInput(body.description).substring(0, 500);
    }
    
    if (body.allowedDomains && Array.isArray(body.allowedDomains)) {
      options.allowedDomains = body.allowedDomains
        .map(domain => sanitizeInput(domain))
        .filter(domain => domain.length > 0)
        .slice(0, 10); // Limit to 10 domains
    }
    
    // Create the sharing link
    const sharingLink = await containerSharingService.createSharingLink(
      containerId,
      sanitizeInput(body.inventoryId),
      event.user.userId,
      options
    );
    
    return success(sharingLink, 201, origin);
  } catch (err) {
    console.error('Error creating sharing link:', err);
    
    if (err.message.includes('not found') || err.message.includes('access denied')) {
      return error('Container not found or access denied', 404, origin);
    }
    
    throw new Error('Failed to create sharing link');
  }
}

/**
 * Handle GET request - List sharing links for a container
 */
async function handleListSharingLinks(event, containerId, origin) {
  try {
    // Validate container ID parameter
    if (!containerId || !validateUUID(containerId)) {
      return error('Invalid container ID', 400, origin);
    }
    
    // Get inventoryId from query parameters
    const inventoryId = event.queryStringParameters?.inventoryId;
    
    if (!inventoryId || !validateUUID(inventoryId)) {
      return error('Valid inventoryId query parameter is required', 400, origin);
    }
    
    // List sharing links
    const sharingLinks = await containerSharingService.listSharingLinks(
      containerId,
      sanitizeInput(inventoryId),
      event.user.userId
    );
    
    return success({ sharingLinks }, 200, origin);
  } catch (err) {
    console.error('Error listing sharing links:', err);
    
    if (err.message.includes('not found') || err.message.includes('access denied')) {
      return error('Container not found or access denied', 404, origin);
    }
    
    throw new Error('Failed to list sharing links');
  }
}

/**
 * Handle PUT request - Update sharing link (deactivate)
 */
async function handleUpdateSharingLink(event, shareId, origin) {
  try {
    // Validate share ID parameter
    if (!shareId || !validateUUID(shareId)) {
      return error('Invalid share ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Currently only supports deactivation
    if (body.action === 'deactivate') {
      await containerSharingService.deactivateSharingLink(shareId, event.user.userId);
      return success({ message: 'Sharing link deactivated successfully' }, 200, origin);
    } else {
      return error('Invalid action. Only "deactivate" is supported', 400, origin);
    }
  } catch (err) {
    console.error('Error updating sharing link:', err);
    
    if (err.message.includes('not found')) {
      return error('Sharing link not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error('Access denied: Cannot modify this sharing link', 403, origin);
    }
    
    throw new Error('Failed to update sharing link');
  }
}

/**
 * Handle DELETE request - Delete sharing link
 */
async function handleDeleteSharingLink(event, shareId, origin) {
  try {
    // Validate share ID parameter
    if (!shareId || !validateUUID(shareId)) {
      return error('Invalid share ID', 400, origin);
    }
    
    // Delete the sharing link
    await containerSharingService.deleteSharingLink(shareId, event.user.userId);
    
    return success({ message: 'Sharing link deleted successfully' }, 200, origin);
  } catch (err) {
    console.error('Error deleting sharing link:', err);
    
    if (err.message.includes('not found')) {
      return error('Sharing link not found', 404, origin);
    }
    
    if (err.message.includes('Access denied')) {
      return error('Access denied: Cannot delete this sharing link', 403, origin);
    }
    
    throw new Error('Failed to delete sharing link');
  }
}

// Export the handler wrapped with rate limiting and CORS validation
exports.handler = withCorsValidation(withRateLimit(containerSharingHandler));