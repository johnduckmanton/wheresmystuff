const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
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
 * Log a role change event
 * @param {string} userId - User whose role was changed
 * @param {string} changedBy - User who made the change
 * @param {string} inventoryId - Inventory ID
 * @param {string} oldRole - Previous role
 * @param {string} newRole - New role
 * @param {string} reason - Optional reason for the change
 * @returns {Promise<void>}
 */
async function logRoleChange(userId, changedBy, inventoryId, oldRole, newRole, reason = '') {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const id = uuidv4();
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'role_change',
    userId: changedBy,
    action: 'update_member_role',
    resource: `inventory#${inventoryId}#member#${userId}`,
    success: true,
    details: {
      targetUserId: userId,
      inventoryId,
      oldRole,
      newRole,
      reason,
      changedBy
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
    console.error('Error logging role change event:', error);
  }
}

/**
 * Log a member addition event
 * @param {string} userId - User who was added
 * @param {string} addedBy - User who added the member
 * @param {string} inventoryId - Inventory ID
 * @param {string} role - Role assigned to the new member
 * @param {string} method - How the member was added (email, user_id, invitation)
 * @returns {Promise<void>}
 */
async function logMemberAddition(userId, addedBy, inventoryId, role, method = 'user_id') {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const id = uuidv4();
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'member_addition',
    userId: addedBy,
    action: 'add_member',
    resource: `inventory#${inventoryId}#member#${userId}`,
    success: true,
    details: {
      targetUserId: userId,
      inventoryId,
      role,
      method,
      addedBy
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
    console.error('Error logging member addition event:', error);
  }
}

/**
 * Log a member removal event
 * @param {string} userId - User who was removed
 * @param {string} removedBy - User who removed the member
 * @param {string} inventoryId - Inventory ID
 * @param {string} role - Role of the removed member
 * @param {string} reason - Optional reason for removal
 * @returns {Promise<void>}
 */
async function logMemberRemoval(userId, removedBy, inventoryId, role, reason = '') {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const id = uuidv4();
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'member_removal',
    userId: removedBy,
    action: 'remove_member',
    resource: `inventory#${inventoryId}#member#${userId}`,
    success: true,
    details: {
      targetUserId: userId,
      inventoryId,
      role,
      reason,
      removedBy
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
    console.error('Error logging member removal event:', error);
  }
}

/**
 * Log a container operation (create, update, delete, move)
 * @param {string} userId - User performing the operation
 * @param {string} action - Action performed (create, update, delete, move)
 * @param {string} containerId - Container ID
 * @param {string} inventoryId - Inventory ID
 * @param {object} details - Additional operation details
 * @returns {Promise<void>}
 */
async function logContainerOperation(userId, action, containerId, inventoryId, details = {}) {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const id = uuidv4();
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'container_operation',
    userId,
    action,
    resource: `container#${containerId}`,
    success: true,
    details: {
      containerId,
      inventoryId,
      action,
      ...details
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
    console.error('Error logging container operation:', error);
  }
}

/**
 * Log item packing operations (add, remove, transfer)
 * @param {string} userId - User performing the operation
 * @param {string} action - Action performed (pack_items, unpack_items, transfer_items)
 * @param {string} containerId - Source container ID
 * @param {string} inventoryId - Inventory ID
 * @param {object} details - Operation details including item IDs and counts
 * @returns {Promise<void>}
 */
async function logPackingOperation(userId, action, containerId, inventoryId, details = {}) {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const id = uuidv4();
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'packing_operation',
    userId,
    action,
    resource: `container#${containerId}`,
    success: true,
    details: {
      containerId,
      inventoryId,
      action,
      ...details
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
    console.error('Error logging packing operation:', error);
  }
}

/**
 * Log bulk operations on containers or items
 * @param {string} userId - User performing the operation
 * @param {string} action - Bulk action performed
 * @param {string} inventoryId - Inventory ID
 * @param {object} details - Operation details including scope and results
 * @returns {Promise<void>}
 */
async function logBulkOperation(userId, action, inventoryId, details = {}) {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const id = uuidv4();
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'bulk_operation',
    userId,
    action,
    resource: `inventory#${inventoryId}`,
    success: details.success !== false,
    details: {
      inventoryId,
      action,
      ...details
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
    console.error('Error logging bulk operation:', error);
  }
}

/**
 * Log data validation and correction events
 * @param {string} userId - User performing the validation/correction
 * @param {string} action - Action performed (validate, correct, detect_inconsistency)
 * @param {string} inventoryId - Inventory ID
 * @param {object} details - Validation details including inconsistencies found and corrections made
 * @returns {Promise<void>}
 */
async function logDataValidation(userId, action, inventoryId, details = {}) {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const id = uuidv4();
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'data_validation',
    userId,
    action,
    resource: `inventory#${inventoryId}`,
    success: details.success !== false,
    details: {
      inventoryId,
      action,
      ...details
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
    console.error('Error logging data validation:', error);
  }
}

/**
 * Log moving project operations
 * @param {string} userId - User performing the operation
 * @param {string} action - Action performed (create, update, delete, assign_containers)
 * @param {string} projectId - Project ID
 * @param {string} inventoryId - Inventory ID
 * @param {object} details - Operation details
 * @returns {Promise<void>}
 */
async function logProjectOperation(userId, action, projectId, inventoryId, details = {}) {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const id = uuidv4();
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'project_operation',
    userId,
    action,
    resource: `project#${projectId}`,
    success: true,
    details: {
      projectId,
      inventoryId,
      action,
      ...details
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
    console.error('Error logging project operation:', error);
  }
}

/**
 * Query audit logs with filtering and search capabilities
 * @param {string} inventoryId - Inventory ID to filter by
 * @param {object} filters - Filter options
 * @param {string} filters.eventType - Event type to filter by
 * @param {string} filters.userId - User ID to filter by
 * @param {string} filters.action - Action to filter by
 * @param {string} filters.startDate - Start date (YYYY-MM-DD)
 * @param {string} filters.endDate - End date (YYYY-MM-DD)
 * @param {number} filters.limit - Maximum number of results (default: 50)
 * @returns {Promise<Array>} Array of audit log entries
 */
async function queryAuditLogs(inventoryId, filters = {}) {
  const { eventType, userId, action, startDate, endDate, limit = 50 } = filters;
  
  try {
    // If date range is specified, query by date partitions
    if (startDate || endDate) {
      const start = startDate || '2020-01-01';
      const end = endDate || new Date().toISOString().split('T')[0];
      
      const results = [];
      const currentDate = new Date(start);
      const endDateObj = new Date(end);
      
      while (currentDate <= endDateObj && results.length < limit) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        const response = await docClient.send(new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: {
            ':pk': `AUDITLOG#${dateStr}`
          },
          ScanIndexForward: false, // Most recent first
          Limit: limit - results.length
        }));
        
        if (response.Items) {
          // Filter results based on criteria
          const filteredItems = response.Items.filter(item => {
            if (inventoryId && !item.details?.inventoryId === inventoryId) return false;
            if (eventType && item.eventType !== eventType) return false;
            if (userId && item.userId !== userId) return false;
            if (action && item.action !== action) return false;
            return true;
          });
          
          results.push(...filteredItems);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return results.slice(0, limit);
    } else {
      // Query recent logs from today
      const today = new Date().toISOString().split('T')[0];
      
      const response = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `AUDITLOG#${today}`
        },
        ScanIndexForward: false,
        Limit: limit
      }));
      
      if (!response.Items) return [];
      
      // Filter results
      return response.Items.filter(item => {
        if (inventoryId && item.details?.inventoryId !== inventoryId) return false;
        if (eventType && item.eventType !== eventType) return false;
        if (userId && item.userId !== userId) return false;
        if (action && item.action !== action) return false;
        return true;
      });
    }
  } catch (error) {
    console.error('Error querying audit logs:', error);
    throw error;
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

/**
 * Log data synchronization operations
 * @param {string} userId - User performing the operation
 * @param {string} action - Sync action performed (container_move_sync, item_transfer_sync, resolve_inconsistencies, resolve_conflict)
 * @param {string} inventoryId - Inventory ID
 * @param {object} details - Synchronization details
 * @returns {Promise<void>}
 */
async function logSyncOperation(userId, action, inventoryId, details = {}) {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const id = uuidv4();
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'sync_operation',
    userId,
    action,
    resource: `inventory#${inventoryId}`,
    success: details.success !== false,
    details: {
      inventoryId,
      action,
      ...details
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
    console.error('Error logging sync operation:', error);
  }
}

/**
 * Log data migration operations
 * @param {string} userId - User performing the operation
 * @param {string} action - Migration action performed (inventory_container_migration, create_containers_from_locations, bulk_create_containers, data_cleanup)
 * @param {string} inventoryId - Inventory ID
 * @param {object} details - Migration details
 * @returns {Promise<void>}
 */
async function logMigrationOperation(userId, action, inventoryId, details = {}) {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const id = uuidv4();
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'migration_operation',
    userId,
    action,
    resource: `inventory#${inventoryId}`,
    success: details.success !== false,
    details: {
      inventoryId,
      action,
      ...details
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
    console.error('Error logging migration operation:', error);
  }
}

/**
 * Log security events (invalid QR codes, suspicious activity)
 * @param {string} userId - User identifier (or 'anonymous' if not authenticated)
 * @param {string} action - Security action (invalid_qr_scan, qr_validation_failure, suspicious_qr_activity)
 * @param {string} resource - Resource identifier (qr_code, container)
 * @param {object} details - Security event details
 * @returns {Promise<void>}
 */
async function logSecurityEvent(userId, action, resource, details = {}) {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const id = uuidv4();
  
  const logEntry = {
    pk: `AUDITLOG#${date}`,
    sk: `${timestamp}#${id}`,
    id,
    timestamp,
    eventType: 'security_event',
    userId,
    action,
    resource,
    success: false,
    details: {
      action,
      resource,
      ...details
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
    console.error('Error logging security event:', error);
  }
}

module.exports = {
  logRateLimit,
  logAuth,
  logDataAccess,
  logAuthzFailure,
  logRoleChange,
  logMemberAddition,
  logMemberRemoval,
  logContainerOperation,
  logPackingOperation,
  logBulkOperation,
  logDataValidation,
  logProjectOperation,
  logSyncOperation,
  logMigrationOperation,
  logSecurityEvent,
  queryAuditLogs,
  verifyHMAC
};