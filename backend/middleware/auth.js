const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Cache for JWKS client
let client = null;

/**
 * Get JWKS client for Cognito
 * @returns {jwksClient.JwksClient} JWKS client instance
 */
function getJwksClient() {
  if (!client) {
    const region = process.env.AWS_REGION || 'us-east-1';
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
 * Verify JWT token from Cognito
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
    
    jwt.verify(cleanToken, getKey, {
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          reject(new Error('Token expired'));
        } else if (err.name === 'JsonWebTokenError') {
          reject(new Error('Invalid token'));
        } else {
          reject(err);
        }
        return;
      }
      
      resolve(decoded);
    });
  });
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
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    
    const decoded = await verifyToken(authHeader);
    const user = getUserFromToken(decoded);
    
    // Attach user info to event for use in handlers
    event.user = user;
    
    return event;
  } catch (error) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    err.originalError = error.message;
    throw err;
  }
}

module.exports = {
  verifyToken,
  getUserFromToken,
  authenticate
};
