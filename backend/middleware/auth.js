const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const inventoryService = require('../services/inventoryService');
const auditLogService = require('../services/auditLogService');
const { logAuthFailure, logAuthzFailure } = require('../utils/securityLogger');

// Cache for JWKS client
let client = null;

/**
 * Get JWKS client for Cognito
 * @returns {jwksClient.JwksClient} JWKS client instance
 */
function getJwksClient() {
  if (!client) {
    const region = process.env.AWS_REGION || 'eu-west-1';
    const userPoolId = process.env.USER_POOL_ID;
    
    if (!userPoolId) {
      throw new Error('USER_POOL_ID environment variable is required');
    }
    
    const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    
    client = jwksClient({
      jwksUri,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 10
    });
  }
  
  return client;
}

/**
 * Get signing key from JWKS
 * @param {object} header - JWT header
 * @param {function} callback - Callback function
 */
function getKey(header, callback) {
  const client = getJwksClient();
  
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verify JWT token from Cognito with comprehensive validation
 * @param {string} token - JWT token
 * @returns {Promise<object>} Decoded token payload
 */
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    if (!token) {
      reject(new Error('No token provided'));
      return;
    }
    
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
    
    // Get expected issuer and audience from environment
    const region = process.env.AWS_REGION || 'eu-west-1';
    const userPoolId = process.env.USER_POOL_ID;
    const clientId = process.env.USER_POOL_CLIENT_ID;
    
    if (!userPoolId) {
      reject(new Error('USER_POOL_ID environment variable is required'));
      return;
    }
    
    const expectedIssuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    
    // Enhanced JWT verification options
    const verifyOptions = {
      algorithms: ['RS256'],
      issuer: expectedIssuer,
      clockTolerance: 30 // Allow 30 seconds clock skew
    };
    
    // Note: Cognito access tokens use 'client_id' instead of 'aud'
    // We'll validate client_id manually in validateTokenClaims
    
    jwt.verify(cleanToken, getKey, verifyOptions, (err, decoded) => {
      if (err) {
        let errorMessage = 'Invalid token';
        
        if (err.name === 'TokenExpiredError') {
          errorMessage = 'Token expired';
        } else if (err.name === 'JsonWebTokenError') {
          if (err.message.includes('jwt issuer invalid')) {
            errorMessage = 'Invalid token issuer';
          } else if (err.message.includes('jwt audience invalid')) {
            errorMessage = 'Invalid token audience';
          } else {
            errorMessage = 'Invalid token format';
          }
        } else if (err.name === 'NotBeforeError') {
          errorMessage = 'Token not yet valid';
        }
        
        reject(new Error(errorMessage));
        return;
      }
      
      // Additional validation checks
      try {
        validateTokenClaims(decoded);
        resolve(decoded);
      } catch (validationError) {
        reject(validationError);
      }
    });
  });
}

/**
 * Validate additional JWT token claims
 * @param {object} decoded - Decoded JWT token
 * @throws {Error} If validation fails
 */
function validateTokenClaims(decoded) {
  // Validate token type
  if (decoded.token_use && decoded.token_use !== 'access' && decoded.token_use !== 'id') {
    throw new Error('Invalid token type');
  }
  
  // Validate subject exists
  if (!decoded.sub) {
    throw new Error('Missing subject claim');
  }
  
  // Validate client_id for Cognito tokens
  const expectedClientId = process.env.USER_POOL_CLIENT_ID;
  if (expectedClientId && decoded.client_id && decoded.client_id !== expectedClientId) {
    throw new Error('Invalid client ID');
  }
  
  // Validate issued at time
  if (!decoded.iat || typeof decoded.iat !== 'number') {
    throw new Error('Missing or invalid issued at claim');
  }
  
  // Validate expiration time
  if (!decoded.exp || typeof decoded.exp !== 'number') {
    throw new Error('Missing or invalid expiration claim');
  }
  
  // Check if token is expired (additional check beyond jwt.verify)
  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp <= now) {
    throw new Error('Token expired');
  }
  
  // Validate not before time if present
  if (decoded.nbf && typeof decoded.nbf === 'number' && decoded.nbf > now) {
    throw new Error('Token not yet valid');
  }
}

/**
 * Extract user information from decoded token
 * @param {object} decodedToken - Decoded JWT token
 * @returns {object} User information
 */
function getUserFromToken(decodedToken) {
  return {
    userId: decodedToken.sub,
    email: decodedToken.email,
    username: decodedToken['cognito:username'] || decodedToken.email
  };
}

/**
 * Authentication middleware for Lambda handlers
 * Verifies JWT token and attaches user info to event
 * @param {object} event - Lambda event object
 * @returns {Promise<object>} Event with user info or throws error
 */
async function authenticate(event) {
  const ipAddress = event.requestContext?.identity?.sourceIp || 'unknown';
  const userAgent = event.headers?.['User-Agent'] || event.headers?.['user-agent'] || 'unknown';
  let userId = 'unknown';
  let validationFailureReason = 'unknown';
  
  try {
    // Check if API Gateway already validated the JWT (claims available in requestContext)
    if (event.requestContext?.authorizer?.jwt?.claims) {
      const claims = event.requestContext.authorizer.jwt.claims;
      const user = {
        userId: claims.sub,
        email: claims.email,
        username: claims['cognito:username'] || claims.username || claims.email
      };
      userId = user.userId;
      
      // Attach user info to event for use in handlers
      event.user = user;
      
      // Log successful authentication
      await auditLogService.logAuth(userId, true, ipAddress, userAgent);
      
      return event;
    }
    
    // Fallback to manual JWT validation
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    
    if (!authHeader) {
      validationFailureReason = 'missing_authorization_header';
      throw new Error('No authorization header');
    }
    
    const decoded = await verifyToken(authHeader);
    const user = getUserFromToken(decoded);
    userId = user.userId;
    
    // Attach user info to event for use in handlers
    event.user = user;
    
    // Log successful authentication
    await auditLogService.logAuth(userId, true, ipAddress, userAgent);
    
    return event;
  } catch (error) {
    // Determine failure reason for detailed logging
    if (error.message.includes('No token provided') || error.message.includes('No authorization header')) {
      validationFailureReason = 'missing_token';
    } else if (error.message.includes('Token expired')) {
      validationFailureReason = 'token_expired';
    } else if (error.message.includes('Invalid token issuer')) {
      validationFailureReason = 'invalid_issuer';
    } else if (error.message.includes('Invalid token audience')) {
      validationFailureReason = 'invalid_audience';
    } else if (error.message.includes('Invalid token format') || error.message.includes('Invalid token type')) {
      validationFailureReason = 'invalid_format';
    } else if (error.message.includes('Token not yet valid')) {
      validationFailureReason = 'token_not_yet_valid';
    } else if (error.message.includes('Missing') && error.message.includes('claim')) {
      validationFailureReason = 'missing_claims';
    } else {
      validationFailureReason = 'signature_verification_failed';
    }
    
    // Log failed authentication with detailed reason
    await auditLogService.logAuth(userId, false, ipAddress, userAgent, {
      failureReason: validationFailureReason,
      errorMessage: error.message
    });
    
    // Log to CloudWatch for metrics
    const requestId = event.requestContext?.requestId || 'unknown';
    await logAuthFailure(userId, validationFailureReason, ipAddress, requestId);
    
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    err.originalError = error.message;
    err.validationFailureReason = validationFailureReason;
    throw err;
  }
}

/**
 * Authorization middleware for inventory-based access control
 * Verifies that the authenticated user has access to the specified inventory
 * @param {object} event - Lambda event object (must have user from authenticate)
 * @param {string} inventoryId - Inventory ID to check access for
 * @returns {Promise<object>} Event with inventory access info or throws error
 */
async function authorizeInventoryAccess(event, inventoryId) {
  try {
    if (!event.user) {
      throw new Error('User not authenticated');
    }
    
    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }
    
    const hasAccess = await inventoryService.hasInventoryAccess(event.user.userId, inventoryId);
    
    if (!hasAccess) {
      // Log authorization failure
      await auditLogService.logAuthzFailure(
        event.user.userId,
        'access_inventory',
        `inventory#${inventoryId}`,
        'User does not have access to inventory'
      );
      
      // Log to CloudWatch for metrics
      const requestId = event.requestContext?.requestId || 'unknown';
      await logAuthzFailure(
        event.user.userId,
        `inventory#${inventoryId}`,
        'access_inventory',
        'User does not have access to inventory',
        requestId
      );
      
      const err = new Error('Access denied: User does not have access to this inventory');
      err.statusCode = 403;
      throw err;
    }
    
    // Attach inventory access info to event
    event.inventoryAccess = {
      inventoryId,
      hasAccess: true
    };
    
    return event;
  } catch (error) {
    if (error.statusCode === 403) {
      throw error;
    }
    
    // Log authorization failure for unexpected errors
    if (event.user) {
      await auditLogService.logAuthzFailure(
        event.user.userId,
        'access_inventory',
        `inventory#${inventoryId}`,
        error.message
      );
      
      // Log to CloudWatch for metrics
      const requestId = event.requestContext?.requestId || 'unknown';
      await logAuthzFailure(
        event.user.userId,
        `inventory#${inventoryId}`,
        'access_inventory',
        error.message,
        requestId
      );
    }
    
    const err = new Error('Authorization failed');
    err.statusCode = 403;
    err.originalError = error.message;
    throw err;
  }
}

/**
 * Combined authentication and authorization middleware
 * First authenticates the user, then checks inventory access
 * @param {object} event - Lambda event object
 * @param {string} inventoryId - Inventory ID to check access for
 * @returns {Promise<object>} Event with user and inventory access info
 */
async function authenticateAndAuthorize(event, inventoryId) {
  // First authenticate
  await authenticate(event);
  
  // Then authorize inventory access
  await authorizeInventoryAccess(event, inventoryId);
  
  return event;
}

/**
 * Extract inventory ID from event path parameters or body
 * @param {object} event - Lambda event object
 * @returns {string|null} Inventory ID if found
 */
function extractInventoryId(event) {
  // Try path parameters first
  if (event.pathParameters?.inventoryId) {
    return event.pathParameters.inventoryId;
  }
  
  // Try request body
  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      if (body.inventoryId) {
        return body.inventoryId;
      }
    } catch (err) {
      // Ignore JSON parse errors
    }
  }
  
  // Try query parameters
  if (event.queryStringParameters?.inventoryId) {
    return event.queryStringParameters.inventoryId;
  }
  
  return null;
}

module.exports = {
  verifyToken,
  getUserFromToken,
  authenticate,
  authorizeInventoryAccess,
  authenticateAndAuthorize,
  extractInventoryId
};
