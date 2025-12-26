const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { hasInventoryAccess } = require('./dynamodb');
const { logDataAccess } = require('./auditLogService');
const containerService = require('./containerService');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Storage Service
 * Handles storage duration tracking, cost calculation, and storage location management
 */
class StorageService {
  /**
   * Start storage tracking for a container
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} storageLocationId - Storage location ID
   * @param {number} storageRate - Monthly storage rate
   * @param {string} userId - User ID
   * @returns {Promise<object>} Storage tracking result
   */
  async startStorageTracking(containerId, inventoryId, storageLocationId, storageRate, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get the container
    const container = await containerService.getContainer(containerId, inventoryId, userId);
    if (!container) {
      throw new Error('Container not found');
    }

    // Update container with storage information
    const storageStartDate = new Date().toISOString();
    const updates = {
      locationId: storageLocationId,
      storageStartDate,
      storageRate: storageRate || 0,
      status: 'stored'
    };

    const updatedContainer = await containerService.updateContainer(containerId, inventoryId, updates, userId);

    // Create storage tracking record
    const storageRecord = {
      pk: `INVENTORY#${inventoryId}#STORAGE`,
      sk: `${containerId}#${storageStartDate}`,
      gsi1pk: `STORAGE#${storageLocationId}`,
      gsi1sk: `CONTAINER#${containerId}`,
      containerId,
      inventoryId,
      storageLocationId,
      storageStartDate,
      storageRate: storageRate || 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: userId
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: storageRecord
    }));

    // Log the storage start
    await logDataAccess(userId, 'create', 'storage_tracking', containerId, inventoryId);

    return {
      container: updatedContainer,
      storageRecord,
      storageStartDate
    };
  }

  /**
   * End storage tracking for a container
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} Storage end result
   */
  async endStorageTracking(containerId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get current storage record
    const storageRecord = await this.getActiveStorageRecord(containerId, inventoryId, userId);
    if (!storageRecord) {
      throw new Error('No active storage tracking found for container');
    }

    // Calculate final storage duration and cost
    const endDate = new Date().toISOString();
    const duration = this.calculateStorageDuration(storageRecord.storageStartDate, endDate);
    const totalCost = this.calculateStorageCost(storageRecord.storageRate, duration.days);

    // Update storage record to mark as ended
    const updatedRecord = {
      ...storageRecord,
      storageEndDate: endDate,
      storageDuration: duration,
      totalStorageCost: totalCost,
      isActive: false,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: updatedRecord
    }));

    // Update container to remove storage tracking
    const container = await containerService.getContainer(containerId, inventoryId, userId);
    const updates = {
      storageStartDate: null,
      storageRate: null
    };

    const updatedContainer = await containerService.updateContainer(containerId, inventoryId, updates, userId);

    // Log the storage end
    await logDataAccess(userId, 'update', 'storage_tracking_end', containerId, inventoryId);

    return {
      container: updatedContainer,
      storageRecord: updatedRecord,
      duration,
      totalCost
    };
  }

  /**
   * Get active storage record for a container
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @returns {Promise<object|null>} Active storage record or null
   */
  async getActiveStorageRecord(containerId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      FilterExpression: 'isActive = :isActive',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#STORAGE`,
        ':skPrefix': containerId,
        ':isActive': true
      },
      ScanIndexForward: false, // Get most recent first
      Limit: 1
    }));

    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  }

  /**
   * Get storage information for a container
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} Storage information
   */
  async getStorageInfo(containerId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get container
    const container = await containerService.getContainer(containerId, inventoryId, userId);
    if (!container) {
      throw new Error('Container not found');
    }

    // Get active storage record
    const storageRecord = await this.getActiveStorageRecord(containerId, inventoryId, userId);

    if (!storageRecord && !container.storageStartDate) {
      return {
        container,
        isInStorage: false,
        storageInfo: null
      };
    }

    // Calculate current storage duration and cost
    const startDate = storageRecord?.storageStartDate || container.storageStartDate;
    const rate = storageRecord?.storageRate || container.storageRate || 0;
    const currentDate = new Date().toISOString();
    
    const duration = this.calculateStorageDuration(startDate, currentDate);
    const currentCost = this.calculateStorageCost(rate, duration.days);
    const projectedMonthlyCost = rate;
    const projectedYearlyCost = rate * 12;

    // Check for duration warnings
    const warnings = this.checkDurationWarnings(duration);

    // Log the access
    await logDataAccess(userId, 'read', 'storage_info', containerId, inventoryId);

    return {
      container,
      isInStorage: true,
      storageInfo: {
        storageStartDate: startDate,
        storageRate: rate,
        currentDuration: duration,
        currentCost,
        projectedMonthlyCost,
        projectedYearlyCost,
        warnings,
        storageRecord
      }
    };
  }

  /**
   * List all containers in storage for an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @param {object} options - Filtering options
   * @returns {Promise<object>} Storage containers list
   */
  async listStorageContainers(inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const {
      storageLocationId,
      minDuration,
      maxDuration,
      minCost,
      maxCost,
      sortBy = 'storageStartDate',
      sortOrder = 'desc',
      limit = 50
    } = options;

    // Get all active storage records for the inventory
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'isActive = :isActive',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#STORAGE`,
        ':isActive': true
      },
      Limit: Math.min(limit, 100)
    }));

    let storageRecords = result.Items || [];

    // Apply location filter
    if (storageLocationId) {
      storageRecords = storageRecords.filter(record => 
        record.storageLocationId === storageLocationId
      );
    }

    // Get container details and calculate current costs
    const containersWithStorage = await Promise.all(
      storageRecords.map(async (record) => {
        try {
          const container = await containerService.getContainer(record.containerId, inventoryId, userId);
          if (!container) return null;

          const duration = this.calculateStorageDuration(record.storageStartDate, new Date().toISOString());
          const currentCost = this.calculateStorageCost(record.storageRate, duration.days);
          const warnings = this.checkDurationWarnings(duration);

          return {
            container,
            storageRecord: record,
            duration,
            currentCost,
            warnings
          };
        } catch (error) {
          console.error(`Error getting container ${record.containerId}:`, error);
          return null;
        }
      })
    );

    // Filter out null results
    let validContainers = containersWithStorage.filter(item => item !== null);

    // Apply duration filters
    if (minDuration) {
      validContainers = validContainers.filter(item => item.duration.days >= minDuration);
    }
    if (maxDuration) {
      validContainers = validContainers.filter(item => item.duration.days <= maxDuration);
    }

    // Apply cost filters
    if (minCost) {
      validContainers = validContainers.filter(item => item.currentCost >= minCost);
    }
    if (maxCost) {
      validContainers = validContainers.filter(item => item.currentCost <= maxCost);
    }

    // Sort results
    validContainers.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'duration':
          aVal = a.duration.days;
          bVal = b.duration.days;
          break;
        case 'cost':
          aVal = a.currentCost;
          bVal = b.currentCost;
          break;
        case 'containerName':
          aVal = a.container.name;
          bVal = b.container.name;
          break;
        default:
          aVal = a.storageRecord.storageStartDate;
          bVal = b.storageRecord.storageStartDate;
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    // Calculate summary statistics
    const totalContainers = validContainers.length;
    const totalCurrentCost = validContainers.reduce((sum, item) => sum + item.currentCost, 0);
    const averageDuration = totalContainers > 0 
      ? validContainers.reduce((sum, item) => sum + item.duration.days, 0) / totalContainers 
      : 0;
    const containersWithWarnings = validContainers.filter(item => item.warnings.length > 0).length;

    // Log the access
    await logDataAccess(userId, 'read', 'storage_containers_list', 'list', inventoryId);

    return {
      containers: validContainers,
      summary: {
        totalContainers,
        totalCurrentCost,
        averageDuration: Math.round(averageDuration),
        containersWithWarnings
      }
    };
  }

  /**
   * Calculate storage duration between two dates
   * @param {string} startDate - Start date ISO string
   * @param {string} endDate - End date ISO string
   * @returns {object} Duration breakdown
   */
  calculateStorageDuration(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30.44); // Average days per month
    const years = Math.floor(days / 365.25); // Account for leap years

    return {
      days,
      weeks,
      months,
      years,
      totalDays: days
    };
  }

  /**
   * Calculate storage cost based on rate and duration
   * @param {number} monthlyRate - Monthly storage rate
   * @param {number} days - Number of days
   * @returns {number} Total cost
   */
  calculateStorageCost(monthlyRate, days) {
    if (!monthlyRate || monthlyRate <= 0) return 0;
    
    const dailyRate = monthlyRate / 30.44; // Average days per month
    return Math.round((dailyRate * days) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Check for duration warnings based on thresholds
   * @param {object} duration - Duration object
   * @returns {Array} Array of warning messages
   */
  checkDurationWarnings(duration) {
    const warnings = [];
    
    // Warning thresholds (configurable)
    const LONG_TERM_THRESHOLD_MONTHS = 6;
    const VERY_LONG_TERM_THRESHOLD_MONTHS = 12;
    const EXTENDED_THRESHOLD_MONTHS = 24;

    if (duration.months >= EXTENDED_THRESHOLD_MONTHS) {
      warnings.push({
        type: 'extended_storage',
        message: `Container has been in storage for ${duration.months} months (${duration.years} years). Consider reviewing storage necessity.`,
        severity: 'high'
      });
    } else if (duration.months >= VERY_LONG_TERM_THRESHOLD_MONTHS) {
      warnings.push({
        type: 'very_long_term',
        message: `Container has been in storage for ${duration.months} months. Consider if items are still needed.`,
        severity: 'medium'
      });
    } else if (duration.months >= LONG_TERM_THRESHOLD_MONTHS) {
      warnings.push({
        type: 'long_term',
        message: `Container has been in storage for ${duration.months} months. Review storage costs vs. item value.`,
        severity: 'low'
      });
    }

    return warnings;
  }

  /**
   * Get storage cost projections for a container
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @param {number} projectionMonths - Number of months to project
   * @returns {Promise<object>} Cost projections
   */
  async getStorageCostProjections(containerId, inventoryId, userId, projectionMonths = 12) {
    const storageInfo = await this.getStorageInfo(containerId, inventoryId, userId);
    
    if (!storageInfo.isInStorage) {
      throw new Error('Container is not currently in storage');
    }

    const { storageRate } = storageInfo.storageInfo;
    const projections = [];

    for (let month = 1; month <= projectionMonths; month++) {
      const projectedCost = storageRate * month;
      const totalDays = storageInfo.storageInfo.currentDuration.days + (month * 30.44);
      
      projections.push({
        month,
        monthlyCost: storageRate,
        cumulativeCost: Math.round((storageInfo.storageInfo.currentCost + projectedCost) * 100) / 100,
        totalDays: Math.round(totalDays)
      });
    }

    return {
      container: storageInfo.container,
      currentCost: storageInfo.storageInfo.currentCost,
      monthlyRate: storageRate,
      projections
    };
  }

  /**
   * Update storage rate for a container
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {number} newRate - New monthly storage rate
   * @param {string} userId - User ID
   * @returns {Promise<object>} Updated storage information
   */
  async updateStorageRate(containerId, inventoryId, newRate, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    if (typeof newRate !== 'number' || newRate < 0) {
      throw new Error('Storage rate must be a non-negative number');
    }

    // Update container storage rate
    const updates = { storageRate: newRate };
    const updatedContainer = await containerService.updateContainer(containerId, inventoryId, updates, userId);

    // Update active storage record if exists
    const storageRecord = await this.getActiveStorageRecord(containerId, inventoryId, userId);
    if (storageRecord) {
      const updatedRecord = {
        ...storageRecord,
        storageRate: newRate,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      };

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: updatedRecord
      }));
    }

    // Log the rate update
    await logDataAccess(userId, 'update', 'storage_rate', containerId, inventoryId);

    return {
      container: updatedContainer,
      newRate,
      storageRecord: storageRecord ? { ...storageRecord, storageRate: newRate } : null
    };
  }
}

module.exports = new StorageService();