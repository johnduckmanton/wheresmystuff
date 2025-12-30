const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { hasInventoryAccess } = require('./dynamodb');
const { logDataAccess } = require('./auditLogService');
const storageService = require('./storageService');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Storage Alert Service
 * Handles storage duration alerts, notifications, and retrieval planning
 */
class StorageAlertService {
  /**
   * Check for storage alerts across all containers in an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} Alert summary and recommendations
   */
  async checkStorageAlerts(inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get all containers in storage
    const storageContainers = await storageService.listStorageContainers(inventoryId, userId, {
      limit: 100 // Check up to 100 containers
    });

    const alerts = [];
    const recommendations = [];
    let totalAlertCost = 0;
    let highPriorityAlerts = 0;

    // Analyze each container for alerts
    for (const item of storageContainers.containers) {
      const containerAlerts = this.analyzeContainerForAlerts(item);
      
      if (containerAlerts.length > 0) {
        alerts.push({
          containerId: item.container.id,
          containerName: item.container.name,
          alerts: containerAlerts,
          currentCost: item.currentCost,
          duration: item.duration
        });

        // Count high priority alerts
        const highPriorityCount = containerAlerts.filter(alert => alert.priority === 'high').length;
        highPriorityAlerts += highPriorityCount;

        // Add to total alert cost (containers with any alerts)
        totalAlertCost += item.currentCost;
      }

      // Generate recommendations
      const containerRecommendations = this.generateContainerRecommendations(item);
      if (containerRecommendations.length > 0) {
        recommendations.push({
          containerId: item.container.id,
          containerName: item.container.name,
          recommendations: containerRecommendations
        });
      }
    }

    // Generate overall recommendations
    const overallRecommendations = this.generateOverallRecommendations(storageContainers);

    // Log the alert check
    await logDataAccess(userId, 'read', 'storage_alerts', 'check', inventoryId);

    return {
      summary: {
        totalContainersInStorage: storageContainers.containers.length,
        containersWithAlerts: alerts.length,
        highPriorityAlerts,
        totalAlertCost,
        totalStorageCost: storageContainers.summary.totalCurrentCost,
        averageDuration: storageContainers.summary.averageDuration
      },
      alerts,
      recommendations: recommendations.concat(overallRecommendations),
      checkedAt: new Date().toISOString()
    };
  }

  /**
   * Analyze a single container for alerts
   * @param {object} item - Container with storage info
   * @returns {Array} Array of alerts
   */
  analyzeContainerForAlerts(item) {
    const alerts = [];
    const { duration, currentCost, storageRecord } = item;
    const monthlyRate = storageRecord.storageRate;

    // Duration-based alerts
    if (duration.months >= 24) {
      alerts.push({
        type: 'extended_storage',
        priority: 'high',
        message: `Container has been in storage for ${duration.months} months (${Math.floor(duration.months / 12)} years). Consider reviewing necessity.`,
        action: 'review_necessity',
        costImpact: currentCost
      });
    } else if (duration.months >= 12) {
      alerts.push({
        type: 'long_term_storage',
        priority: 'medium',
        message: `Container has been in storage for ${duration.months} months. Review if items are still needed.`,
        action: 'review_contents',
        costImpact: currentCost
      });
    } else if (duration.months >= 6) {
      alerts.push({
        type: 'medium_term_storage',
        priority: 'low',
        message: `Container has been in storage for ${duration.months} months. Consider retrieval planning.`,
        action: 'plan_retrieval',
        costImpact: currentCost
      });
    }

    // Cost-based alerts
    const projectedYearlyCost = monthlyRate * 12;
    if (projectedYearlyCost > 1000) {
      alerts.push({
        type: 'high_cost_storage',
        priority: 'high',
        message: `High storage cost: £${projectedYearlyCost.toFixed(2)} per year. Consider alternative storage or retrieval.`,
        action: 'cost_optimization',
        costImpact: projectedYearlyCost
      });
    } else if (projectedYearlyCost > 500) {
      alerts.push({
        type: 'moderate_cost_storage',
        priority: 'medium',
        message: `Moderate storage cost: £${projectedYearlyCost.toFixed(2)} per year. Monitor for cost efficiency.`,
        action: 'cost_monitoring',
        costImpact: projectedYearlyCost
      });
    }

    // Rate efficiency alerts
    if (currentCost > 0 && monthlyRate > 0) {
      const costPerDay = monthlyRate / 30.44;
      const avgItemValue = item.container.estimatedValue / Math.max(item.container.itemCount, 1);
      
      if (avgItemValue > 0 && (currentCost / avgItemValue) > 0.1) {
        alerts.push({
          type: 'cost_vs_value',
          priority: 'medium',
          message: `Storage cost (${((currentCost / item.container.estimatedValue) * 100).toFixed(1)}% of item value) may exceed item worth.`,
          action: 'value_assessment',
          costImpact: currentCost
        });
      }
    }

    return alerts;
  }

  /**
   * Generate recommendations for a single container
   * @param {object} item - Container with storage info
   * @returns {Array} Array of recommendations
   */
  generateContainerRecommendations(item) {
    const recommendations = [];
    const { duration, currentCost, storageRecord } = item;
    const monthlyRate = storageRecord.storageRate;

    // Retrieval timing recommendations
    if (duration.months >= 6) {
      const seasonalRecommendation = this.getSeasonalRetrievalRecommendation();
      if (seasonalRecommendation) {
        recommendations.push({
          type: 'seasonal_retrieval',
          priority: 'low',
          title: 'Seasonal Retrieval Opportunity',
          description: seasonalRecommendation,
          action: 'schedule_retrieval',
          estimatedSavings: monthlyRate * 2 // Assume 2 months savings
        });
      }
    }

    // Cost optimization recommendations
    if (monthlyRate > 100) {
      recommendations.push({
        type: 'cost_optimization',
        priority: 'medium',
        title: 'Consider Alternative Storage',
        description: 'High monthly rate suggests exploring cheaper storage options or partial retrieval.',
        action: 'explore_alternatives',
        estimatedSavings: monthlyRate * 0.3 // Assume 30% potential savings
      });
    }

    // Consolidation recommendations
    if (item.container.itemCount < 5 && duration.months >= 3) {
      recommendations.push({
        type: 'consolidation',
        priority: 'low',
        title: 'Container Consolidation',
        description: 'Low item count suggests this container could be consolidated with others.',
        action: 'consolidate_containers',
        estimatedSavings: monthlyRate // Full container savings
      });
    }

    return recommendations;
  }

  /**
   * Generate overall recommendations for the inventory
   * @param {object} storageData - Storage containers data
   * @returns {Array} Array of overall recommendations
   */
  generateOverallRecommendations(storageData) {
    const recommendations = [];
    const { containers, summary } = storageData;

    // Bulk retrieval recommendations
    const longTermContainers = containers.filter(item => item.duration.months >= 12);
    if (longTermContainers.length >= 3) {
      const totalSavings = longTermContainers.reduce((sum, item) => sum + item.storageRecord.storageRate, 0);
      recommendations.push({
        type: 'bulk_retrieval',
        priority: 'medium',
        title: 'Bulk Retrieval Opportunity',
        description: `${longTermContainers.length} containers have been in storage for over a year. Consider bulk retrieval.`,
        action: 'plan_bulk_retrieval',
        estimatedSavings: totalSavings,
        affectedContainers: longTermContainers.length
      });
    }

    // Storage location optimization
    const locationGroups = this.groupContainersByLocation(containers);
    const multiLocationRecommendation = this.analyzeLocationDistribution(locationGroups);
    if (multiLocationRecommendation) {
      recommendations.push(multiLocationRecommendation);
    }

    // Cost trend analysis
    if (summary.totalCurrentCost > 1000) {
      recommendations.push({
        type: 'cost_review',
        priority: 'high',
        title: 'Storage Cost Review',
        description: `Total storage cost of £${summary.totalCurrentCost.toFixed(2)} warrants comprehensive review.`,
        action: 'comprehensive_review',
        estimatedSavings: summary.totalCurrentCost * 0.2 // Assume 20% potential savings
      });
    }

    return recommendations;
  }

  /**
   * Get seasonal retrieval recommendation based on current date
   * @returns {string|null} Seasonal recommendation or null
   */
  getSeasonalRetrievalRecommendation() {
    const now = new Date();
    const month = now.getMonth(); // 0-11

    // Spring cleaning (March-May)
    if (month >= 2 && month <= 4) {
      return 'Spring is an ideal time for storage retrieval and organization. Consider retrieving items for spring cleaning.';
    }
    
    // Pre-holiday season (September-October)
    if (month >= 8 && month <= 9) {
      return 'Pre-holiday season is good for retrieving decorations and seasonal items before peak storage rates.';
    }
    
    // Post-holiday (January-February)
    if (month >= 0 && month <= 1) {
      return 'Post-holiday period often has lower storage demand and better retrieval scheduling availability.';
    }

    return null;
  }

  /**
   * Group containers by storage location
   * @param {Array} containers - Array of storage containers
   * @returns {Map} Map of location to containers
   */
  groupContainersByLocation(containers) {
    const locationGroups = new Map();
    
    containers.forEach(item => {
      const locationId = item.storageRecord.storageLocationId;
      if (!locationGroups.has(locationId)) {
        locationGroups.set(locationId, []);
      }
      locationGroups.get(locationId).push(item);
    });

    return locationGroups;
  }

  /**
   * Analyze location distribution for optimization opportunities
   * @param {Map} locationGroups - Containers grouped by location
   * @returns {object|null} Location optimization recommendation
   */
  analyzeLocationDistribution(locationGroups) {
    if (locationGroups.size <= 1) return null;

    const locations = Array.from(locationGroups.entries());
    const totalContainers = locations.reduce((sum, [, containers]) => sum + containers.length, 0);

    // Check for locations with very few containers
    const underutilizedLocations = locations.filter(([, containers]) => containers.length <= 2);
    
    if (underutilizedLocations.length > 0 && totalContainers >= 5) {
      const affectedContainers = underutilizedLocations.reduce((sum, [, containers]) => sum + containers.length, 0);
      const potentialSavings = underutilizedLocations.reduce((sum, [, containers]) => {
        return sum + containers.reduce((containerSum, item) => containerSum + item.storageRecord.storageRate, 0);
      }, 0);

      return {
        type: 'location_consolidation',
        priority: 'medium',
        title: 'Storage Location Consolidation',
        description: `${affectedContainers} containers across ${underutilizedLocations.length} locations could be consolidated.`,
        action: 'consolidate_locations',
        estimatedSavings: potentialSavings * 0.15, // Assume 15% savings from consolidation
        affectedContainers
      };
    }

    return null;
  }

  /**
   * Create storage alert notification
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @param {object} alertData - Alert data
   * @returns {Promise<object>} Created notification
   */
  async createStorageAlert(inventoryId, userId, alertData) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const alertId = `ALERT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const notification = {
      pk: `INVENTORY#${inventoryId}#ALERTS`,
      sk: alertId,
      gsi1pk: `USER#${userId}#ALERTS`,
      gsi1sk: alertData.createdAt || new Date().toISOString(),
      id: alertId,
      inventoryId,
      userId,
      type: 'storage_alert',
      priority: alertData.priority || 'medium',
      title: alertData.title,
      message: alertData.message,
      containerId: alertData.containerId,
      containerName: alertData.containerName,
      action: alertData.action,
      costImpact: alertData.costImpact,
      isRead: false,
      isResolved: false,
      createdAt: new Date().toISOString(),
      expiresAt: alertData.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: notification
    }));

    // Log the alert creation
    await logDataAccess(userId, 'create', 'storage_alert', alertId, inventoryId);

    return notification;
  }

  /**
   * Get storage alerts for an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {Promise<object>} Alerts list
   */
  async getStorageAlerts(inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const {
      priority,
      isRead,
      isResolved,
      limit = 50
    } = options;

    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#ALERTS`
      },
      Limit: Math.min(limit, 100),
      ScanIndexForward: false // Most recent first
    };

    // Add filters
    const filterExpressions = [];
    if (priority) {
      filterExpressions.push('priority = :priority');
      queryParams.ExpressionAttributeValues[':priority'] = priority;
    }
    if (isRead !== undefined) {
      filterExpressions.push('isRead = :isRead');
      queryParams.ExpressionAttributeValues[':isRead'] = isRead;
    }
    if (isResolved !== undefined) {
      filterExpressions.push('isResolved = :isResolved');
      queryParams.ExpressionAttributeValues[':isResolved'] = isResolved;
    }

    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(' AND ');
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    // Log the access
    await logDataAccess(userId, 'read', 'storage_alerts', 'list', inventoryId);

    return {
      alerts: result.Items || [],
      count: result.Items?.length || 0
    };
  }

  /**
   * Mark storage alert as read
   * @param {string} alertId - Alert ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} Updated alert
   */
  async markAlertAsRead(alertId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const updateParams = {
      TableName: TABLE_NAME,
      Key: {
        pk: `INVENTORY#${inventoryId}#ALERTS`,
        sk: alertId
      },
      UpdateExpression: 'SET isRead = :isRead, readAt = :readAt',
      ExpressionAttributeValues: {
        ':isRead': true,
        ':readAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await docClient.send(new UpdateCommand(updateParams));

    // Log the update
    await logDataAccess(userId, 'update', 'storage_alert_read', alertId, inventoryId);

    return result.Attributes;
  }

  /**
   * Resolve storage alert
   * @param {string} alertId - Alert ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @param {string} resolution - Resolution notes
   * @returns {Promise<object>} Updated alert
   */
  async resolveAlert(alertId, inventoryId, userId, resolution) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const updateParams = {
      TableName: TABLE_NAME,
      Key: {
        pk: `INVENTORY#${inventoryId}#ALERTS`,
        sk: alertId
      },
      UpdateExpression: 'SET isResolved = :isResolved, resolvedAt = :resolvedAt, resolution = :resolution',
      ExpressionAttributeValues: {
        ':isResolved': true,
        ':resolvedAt': new Date().toISOString(),
        ':resolution': resolution
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await docClient.send(new UpdateCommand(updateParams));

    // Log the resolution
    await logDataAccess(userId, 'update', 'storage_alert_resolved', alertId, inventoryId);

    return result.Attributes;
  }
}

module.exports = new StorageAlertService();