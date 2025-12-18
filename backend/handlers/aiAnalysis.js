const { success, error, secureError } = require('../utils/response');
const { authenticate, authorizeInventoryAccess } = require('../middleware/auth');
const { validateRequired, validateUUID } = require('../utils/validation');
const { withRateLimit } = require('../middleware/rateLimit');
const { logDataAccess } = require('../services/auditLogService');
const aiAnalysisService = require('../services/aiAnalysisService');
const { getCategories } = require('../services/dynamodb');

/**
 * Lambda handler for AI Analysis operations
 * Handles POST /ai/analyze-photo requests
 */
const aiAnalysisHandler = async (event) => {
  const context = {
    endpoint: '/ai/analyze-photo',
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
    
    // Only handle POST requests
    if (httpMethod !== 'POST') {
      return error('Method not allowed', 405);
    }

    return await handleAnalyzePhoto(event);
  } catch (err) {
    // Use secure error handling
    return secureError(err, context);
  }
};

/**
 * Handle POST /ai/analyze-photo - Analyze a photo with AI
 */
async function handleAnalyzePhoto(event) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.photoKey) {
      return error('photoKey is required', 400);
    }
    
    if (!body.inventoryId) {
      return error('inventoryId is required', 400);
    }
    
    // Validate UUID format
    if (!validateUUID(body.inventoryId)) {
      return error('Invalid inventoryId format', 400);
    }
    
    // Check inventory access
    await authorizeInventoryAccess(event, body.inventoryId);
    
    // Verify photo key format and access
    const keyParts = body.photoKey.split('/');
    if (keyParts.length < 5 || keyParts[0] !== 'photos') {
      return error('Invalid photo key format', 400);
    }
    
    const [, keyUserId, keyInventoryId, entityId] = keyParts;
    
    // Verify the photo belongs to the specified inventory
    if (keyInventoryId !== body.inventoryId) {
      return error('Photo does not belong to specified inventory', 400);
    }
    
    // Get existing categories for better suggestions
    let existingCategories = [];
    try {
      existingCategories = await getCategories(body.inventoryId);
    } catch (categoryError) {
      console.warn('Could not fetch categories for AI analysis:', categoryError);
      // Continue without categories - AI will use defaults
    }
    
    // Determine if we should use mock analysis (for development/testing)
    const useMockAnalysis = process.env.AI_MOCK_MODE === 'true' || !process.env.OPENAI_API_KEY;
    
    let analysisResult;
    if (useMockAnalysis) {
      console.log('Using mock AI analysis (OPENAI_API_KEY not configured)');
      analysisResult = await aiAnalysisService.mockAnalyze(body.photoKey);
    } else {
      // Use real AI analysis
      analysisResult = await aiAnalysisService.analyzePhoto(
        body.photoKey, 
        body.inventoryId, 
        existingCategories
      );
    }
    
    // Log the AI analysis request
    await logDataAccess(
      event.user.userId, 
      'ai_analyze', 
      'photos', 
      body.photoKey, 
      body.inventoryId
    );
    
    // Return analysis results
    return success({
      ...analysisResult,
      photoKey: body.photoKey,
      inventoryId: body.inventoryId,
      mockMode: useMockAnalysis
    }, 200);
    
  } catch (err) {
    console.error('Error in AI photo analysis:', err);
    
    // Handle authentication/authorization errors
    if (err.statusCode === 401 || err.statusCode === 403) {
      return error(err.message || 'Access denied', err.statusCode);
    }
    
    // Handle AI service errors gracefully
    if (err.message.includes('OpenAI') || err.message.includes('AI analysis')) {
      return error('AI analysis service temporarily unavailable. Please try again later.', 503);
    }
    
    throw new Error('Failed to analyze photo');
  }
}

// Export the handler wrapped with rate limiting
exports.handler = withRateLimit(aiAnalysisHandler);