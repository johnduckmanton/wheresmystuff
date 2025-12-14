const { generateUploadUrl, generateDownloadUrl } = require('../services/s3');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

/**
 * Lambda handler for Photo operations
 * Handles POST /upload and GET /photo/{key} requests
 */
exports.handler = async (event) => {
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
      default:
        return error('Method not allowed', 405);
    }
  } catch (err) {
    console.error('Error in Photo handler:', err);
    
    // Handle authentication errors
    if (err.statusCode === 401) {
      return error(err.message || 'Unauthorized', 401);
    }
    
    // Handle other errors
    return error(err.message || 'Internal server error', err.statusCode || 500);
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
    
    // Generate unique key for the file
    // Format: photos/{uuid}/{timestamp}-{filename}
    const fileId = uuidv4();
    const timestamp = Date.now();
    const sanitizedFileName = body.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `photos/${fileId}/${timestamp}-${sanitizedFileName}`;
    
    // Generate presigned upload URL
    const uploadUrl = await generateUploadUrl(key, body.contentType);
    
    return success({
      uploadUrl,
      key,
      expiresIn: 3600 // 1 hour
    }, 200);
  } catch (err) {
    console.error('Error generating upload URL:', err);
    
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
    
    // Generate presigned download URL
    const downloadUrl = await generateDownloadUrl(decodedKey);
    
    return success({
      downloadUrl,
      key: decodedKey,
      expiresIn: 3600 // 1 hour
    }, 200);
  } catch (err) {
    console.error('Error generating download URL:', err);
    throw new Error('Failed to generate download URL');
  }
}
