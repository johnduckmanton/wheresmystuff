const barcodeService = require('../services/barcodeService');
const { success, error, secureError } = require('../utils/response');
const { authenticate, authorizeInventoryAccess } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { logDataAccess } = require('../services/auditLogService');

/**
 * Lambda handler for Barcode Lookup operations
 * Handles POST /barcode/lookup requests
 */
const barcodeHandler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  
  const context = {
    endpoint: '/barcode',
    method: event.requestContext.http.method,
    userId: event.user?.userId,
    ipAddress: event.requestContext.http.sourceIp,
    userAgent: event.headers?.['user-agent'],
    requestData: {
      body: event.body ? JSON.parse(event.body) : null
    }
  };

  try {
    // Authenticate the request
    await authenticate(event);
    
    const httpMethod = event.requestContext.http.method;
    
    // Route to appropriate handler based on HTTP method
    switch (httpMethod) {
      case 'POST':
        return await handleBarcodeLookup(event, origin);
      default:
        return error('Method not allowed', 405, origin);
    }
  } catch (err) {
    return secureError(err, context);
  }
};

/**
 * Handle POST /barcode/lookup - Lookup barcode and return product information
 */
async function handleBarcodeLookup(event, origin) {
  try {
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.barcode) {
      return error('barcode is required', 400, origin);
    }
    
    if (!body.inventoryId) {
      return error('inventoryId is required', 400, origin);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, body.inventoryId);
    
    // Validate barcode format
    const validation = barcodeService.validateBarcode(body.barcode);
    if (!validation.valid) {
      return error(validation.error, 400, origin);
    }
    
    // Lookup barcode
    const result = await barcodeService.lookupBarcode(validation.cleaned);
    
    // Log the barcode lookup
    await logDataAccess(
      event.user.userId,
      'read',
      'barcode_lookup',
      validation.cleaned,
      body.inventoryId
    );
    
    return success({
      ...result,
      barcode: validation.cleaned,
      barcodeType: validation.type
    }, 200, origin);
    
  } catch (err) {
    console.error('Error looking up barcode:', err);
    
    // Handle authentication/authorization errors
    if (err.statusCode === 401 || err.statusCode === 403) {
      return error(err.message || 'Access denied', err.statusCode, origin);
    }
    
    // Handle barcode lookup errors
    if (err.message.includes('not found') || err.message.includes('Failed to lookup')) {
      return error(err.message, 404, origin);
    }
    
    // Handle API configuration errors
    if (err.message.includes('not configured')) {
      return error('Barcode lookup service is not configured', 503, origin);
    }
    
    throw new Error('Failed to lookup barcode');
  }
}

// Export the handler wrapped with rate limiting
exports.handler = withRateLimit(barcodeHandler);
