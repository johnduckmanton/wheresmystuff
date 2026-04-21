const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) {
  throw new Error('TABLE_NAME environment variable is required');
}

/**
 * Scan History Service
 * Tracks QR code scans and container lookups for audit and user convenience
 */
class ScanHistoryService {
  /**
   * Record a QR code scan event
   * @param {string} userId - User ID who performed the scan
   * @param {string} inventoryId - Inventory ID
   * @param {Object} scanData - Scan event data
   * @returns {Promise<Object>} Recorded scan history entry
   */
  async recordScan(userId, inventoryId, scanData) {
    const scanId = uuidv4();
    const timestamp = new Date().toISOString();

    const scanEntry = {
      pk: `USER#${userId}#SCAN_HISTORY`,
      sk: `${Date.now()}#${scanId}`,
      id: scanId,
      userId,
      inventoryId,
      timestamp,
      type: scanData.type || 'qr_scan', // qr_scan, manual_lookup, container_search
      success: scanData.success || false,
      containerId: scanData.containerId,
      containerName: scanData.containerName,
      qrCodeId: scanData.qrCodeId,
      method: scanData.method, // camera, manual_entry, name_search, id_lookup
      error: scanData.error,
      itemCount: scanData.itemCount,
      ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days TTL
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: scanEntry
    }));

    return scanEntry;
  }

  /**
   * Get recent scan history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Scan history with pagination
   */
  async getScanHistory(userId, options = {}) {
    const {
      limit = 20,
      lastEvaluatedKey,
      inventoryId,
      successOnly = false
    } = options;

    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}#SCAN_HISTORY`
      },
      Limit: Math.min(limit, 50),
      ScanIndexForward: false // Most recent first
    };

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    // Add filters
    const filterExpressions = [];
    const filterValues = {};

    if (inventoryId) {
      filterExpressions.push('inventoryId = :inventoryId');
      filterValues[':inventoryId'] = inventoryId;
    }

    if (successOnly) {
      filterExpressions.push('#success = :success');
      filterValues[':success'] = true;
      queryParams.ExpressionAttributeNames = { '#success': 'success' };
    }

    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(' AND ');
      queryParams.ExpressionAttributeValues = { ...queryParams.ExpressionAttributeValues, ...filterValues };
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    return {
      scans: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
      count: result.Items ? result.Items.length : 0,
      hasMore: !!result.LastEvaluatedKey
    };
  }

  /**
   * Get recent successful scans for quick access
   * @param {string} userId - User ID
   * @param {string} inventoryId - Inventory ID
   * @param {number} limit - Number of recent scans to return
   * @returns {Promise<Array>} Recent successful scans
   */
  async getRecentSuccessfulScans(userId, inventoryId, limit = 10) {
    const history = await this.getScanHistory(userId, {
      limit,
      inventoryId,
      successOnly: true
    });

    // Remove duplicates by container ID, keeping most recent
    const uniqueScans = [];
    const seenContainers = new Set();

    for (const scan of history.scans) {
      if (scan.containerId && !seenContainers.has(scan.containerId)) {
        seenContainers.add(scan.containerId);
        uniqueScans.push({
          containerId: scan.containerId,
          containerName: scan.containerName,
          timestamp: scan.timestamp,
          method: scan.method,
          itemCount: scan.itemCount
        });
      }
    }

    return uniqueScans;
  }

  /**
   * Clean up old scan history entries (called by scheduled job)
   * @param {string} userId - User ID
   * @param {number} daysToKeep - Number of days to keep (default 90)
   * @returns {Promise<number>} Number of entries deleted
   */
  async cleanupOldScans(userId, daysToKeep = 90) {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    // Query old entries
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk < :cutoff',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}#SCAN_HISTORY`,
        ':cutoff': cutoffTime.toString()
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      return 0;
    }

    // Delete old entries in batches
    const deletePromises = result.Items.map(item => 
      docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: item.pk,
          sk: item.sk
        }
      }))
    );

    await Promise.all(deletePromises);
    return result.Items.length;
  }
}

module.exports = new ScanHistoryService();