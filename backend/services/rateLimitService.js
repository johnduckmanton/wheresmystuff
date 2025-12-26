const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';
const RATE_LIMIT_PER_MINUTE = 100;
const WINDOW_SIZE_SECONDS = 60;

/**
 * Check if a request is within the rate limit
 * @param {string} userId - User identifier
 * @param {string} endpoint - API endpoint
 * @returns {Promise<{allowed: boolean, remaining: number, resetTime: number}>}
 */
async function checkRateLimit(userId, endpoint) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / WINDOW_SIZE_SECONDS) * WINDOW_SIZE_SECONDS;
  const resetTime = windowStart + WINDOW_SIZE_SECONDS;
  
  const key = {
    pk: `RATELIMIT#${userId}#${endpoint}`,
    sk: windowStart.toString()
  };
  
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: key
    }));
    
    const currentCount = result.Item ? result.Item.count : 0;
    const allowed = currentCount < RATE_LIMIT_PER_MINUTE;
    const remaining = Math.max(0, RATE_LIMIT_PER_MINUTE - currentCount);
    
    return {
      allowed,
      remaining,
      resetTime
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // In case of error, allow the request but log the issue
    return {
      allowed: true,
      remaining: RATE_LIMIT_PER_MINUTE,
      resetTime
    };
  }
}

/**
 * Record a request for rate limiting purposes
 * @param {string} userId - User identifier
 * @param {string} endpoint - API endpoint
 * @returns {Promise<void>}
 */
async function recordRequest(userId, endpoint) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / WINDOW_SIZE_SECONDS) * WINDOW_SIZE_SECONDS;
  const expiresAt = windowStart + (WINDOW_SIZE_SECONDS * 2); // Keep for 2 windows for safety
  
  const key = {
    pk: `RATELIMIT#${userId}#${endpoint}`,
    sk: windowStart.toString()
  };
  
  try {
    // Try to increment existing counter
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: key,
      UpdateExpression: 'ADD #count :inc SET #expiresAt = :expiresAt',
      ExpressionAttributeNames: {
        '#count': 'count',
        '#expiresAt': 'expiresAt'
      },
      ExpressionAttributeValues: {
        ':inc': 1,
        ':expiresAt': expiresAt
      }
    }));
  } catch (error) {
    // If item doesn't exist, create it
    try {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...key,
          count: 1,
          userId,
          endpoint,
          windowStart,
          expiresAt
        },
        ConditionExpression: 'attribute_not_exists(pk)'
      }));
    } catch (putError) {
      // If put fails due to condition, the item was created by another request
      // Try the update again
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: key,
        UpdateExpression: 'ADD #count :inc SET #expiresAt = :expiresAt',
        ExpressionAttributeNames: {
          '#count': 'count',
          '#expiresAt': 'expiresAt'
        },
        ExpressionAttributeValues: {
          ':inc': 1,
          ':expiresAt': expiresAt
        }
      }));
    }
  }
}

/**
 * Get rate limit status for a user and endpoint
 * @param {string} userId - User identifier
 * @param {string} endpoint - API endpoint
 * @returns {Promise<{count: number, remaining: number, resetTime: number}>}
 */
async function getRateLimitStatus(userId, endpoint) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / WINDOW_SIZE_SECONDS) * WINDOW_SIZE_SECONDS;
  const resetTime = windowStart + WINDOW_SIZE_SECONDS;
  
  const key = {
    pk: `RATELIMIT#${userId}#${endpoint}`,
    sk: windowStart.toString()
  };
  
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: key
    }));
    
    const count = result.Item ? result.Item.count : 0;
    const remaining = Math.max(0, RATE_LIMIT_PER_MINUTE - count);
    
    return {
      count,
      remaining,
      resetTime
    };
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    return {
      count: 0,
      remaining: RATE_LIMIT_PER_MINUTE,
      resetTime
    };
  }
}

module.exports = {
  checkRateLimit,
  recordRequest,
  getRateLimitStatus,
  RATE_LIMIT_PER_MINUTE,
  WINDOW_SIZE_SECONDS
};