const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';
const HMAC_SECRET = process.env.AUDIT_LOG_HMAC_SECRET || 'default-secret-change-in-production';

/**
 * Generate HMAC for audit log entry integrity
 * @param {Object} logEntry - The log entry object
 * @returns {string} HMAC signature
 */
function generateHMAC(logEntry) {
  // Create a canonical string representation of the log entry for HMAC
  const canonicalData = JSON.stringify({
    timestamp: logEntry.timestamp,
    eventType: logEntry.eventType,
    userId: logEntry.userId,
    action: logEntry.action,
    resource: logEntry.resource,
    success: logEntry.success,
    details: logEntry.details
  });
  
  return crypto.createHmac('sha256', HMAC_SECRET)
    .update(canonicalData)
    .digest('hex');
}

/**
 * Log a rate limit violation
 * @param {string} userId - User identifier
 * @param {string} endpoint - API endpoint
 * @param {string} ipAddress - Client IP address
 * @param {string} userAgent - Client user agent
 * @returns {Promise<void>}
 */
async function logRateLimit(userId, endpoint, ipAddress = 'unknown', userAgent = 'unknown') {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0]; // YYYY-MM-DD format for partitioning
  const id = uuidv4();
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'rate_limit',
    userId,
    ipAddress,
    userAgent,
    action: 'rate_limit_exceeded',
    resource: endpoint,
    success: false,
    details: {
      endpoint,
      userId,
      violationType: 'rate_limit_exceeded'
    }
  };
  
  // Add HMAC for integrity protection
  logEntry.hmac = generateHMAC(logEntry);
  
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: logEntry
    }));
  } catch (error) {
    console.error('Error logging rate limit violation:', error);
    // Don't throw error - logging failures shouldn't break the application
  }
}

/**
 * Log an authentication event
 * @param {string} userId - User identifier
 * @param {boolean} success - Whether authentication succeeded
 * @param {string} ipAddress - Client IP address
 * @param {string} userAgent - Client user agent
 * @param {Object} additionalDetails - Additional details for failed authentication
 * @returns {Promise<void>}
 */
async function logAuth(userId, success, ipAddress = 'unknown', userAgent = 'unknown', additionalDetails = {}) {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const id = uuidv4();
  
  const details = {
    authResult: success ? 'success' : 'failure',
    ...additionalDetails
  };
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'auth',
    userId,
    ipAddress,
    userAgent,
    action: success ? 'login_success' : 'login_failure',
    resource: 'authentication',
    success,
    details
  };
  
  // Add HMAC for integrity protection
  logEntry.hmac = generateHMAC(logEntry);
  
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: logEntry
    }));
  } catch (error) {
    console.error('Error logging authentication event:', error);
  }
}

/**
 * Log a data access event
 * @param {string} userId - User identifier
 * @param {string} action - Action performed (create, read, update, delete)
 * @param {string} entityType - Type of entity accessed
 * @param {string} entityId - ID of entity accessed
 * @param {string} inventoryId - Inventory ID
 * @returns {Promise<void>}
 */
async function logDataAccess(userId, action, entityType, entityId, inventoryId) {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const id = uuidv4();
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'data_access',
    userId,
    action,
    resource: `${entityType}#${entityId}`,
    success: true,
    details: {
      entityType,
      entityId,
      inventoryId,
      action
    }
  };
  
  // Add HMAC for integrity protection
  logEntry.hmac = generateHMAC(logEntry);
  
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: logEntry
    }));
  } catch (error) {
    console.error('Error logging data access event:', error);
  }
}

/**
 * Log an authorization failure
 * @param {string} userId - User identifier
 * @param {string} action - Attempted action
 * @param {string} resource - Resource identifier
 * @param {string} reason - Failure reason
 * @returns {Promise<void>}
 */
async function logAuthzFailure(userId, action, resource, reason) {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const id = uuidv4();
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'authz_failure',
    userId,
    action,
    resource,
    success: false,
    details: {
      reason,
      attemptedAction: action,
      targetResource: resource
    }
  };
  
  // Add HMAC for integrity protection
  logEntry.hmac = generateHMAC(logEntry);
  
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: logEntry
    }));
  } catch (error) {
    console.error('Error logging authorization failure:', error);
  }
}

/**
 * Verify HMAC integrity of audit log entry
 * @param {Object} logEntry - The log entry object with HMAC
 * @returns {boolean} True if HMAC is valid
 */
function verifyHMAC(logEntry) {
  const storedHmac = logEntry.hmac;
  if (!storedHmac) {
    return false;
  }
  
  // Create a copy without the HMAC field for verification
  const entryForVerification = { ...logEntry };
  delete entryForVerification.hmac;
  delete entryForVerification.pk;
  delete entryForVerification.sk;
  delete entryForVerification.id;
  
  const expectedHmac = generateHMAC(entryForVerification);
  return crypto.timingSafeEqual(Buffer.from(storedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'));
}

module.exports = {
  logRateLimit,
  logAuth,
  logDataAccess,
  logAuthzFailure,
  verifyHMAC
};