const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { hasInventoryAccess } = require('./dynamodb');
const { logDataAccess } = require('./auditLogService');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Analytics Service
 * Handles analytics data collection, metrics calculation, and insights generation
 */
class AnalyticsService {
  /**
   * Get packing metrics and activity tracking
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting metrics
   * @param {object} options - Date range and filtering options
   * @returns {Promise<object>} Packing metrics
   */
  async getPackingMetrics(inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const { startDate, endDate, projectId } = options;

    // Get all containers for the inventory
    const containersResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#CONTAINERS`
      }
    }));

    const containers = containersResult.Items || [];

    // Filter by date range if provided
    let filteredContainers = containers;
    if (startDate || endDate) {
      filteredContainers = containers.filter(container => {
        const createdAt = new Date(container.createdAt);
        if (startDate && createdAt < new Date(startDate)) return false;
        if (endDate && createdAt > new Date(endDate)) return false;
        return true;
      });
    }

    // Filter by project if provided
    if (projectId) {
      filteredContainers = filteredContainers.filter(container => 
        container.projectId === projectId
      );
    }

    // Calculate packing metrics
    const metrics = this._calculatePackingMetrics(filteredContainers, options);

    // Get packing activity timeline
    const timeline = this._generatePackingTimeline(filteredContainers, options);

    // Log the analytics access
    await logDataAccess(userId, 'read', 'packing_metrics', inventoryId, inventoryId);

    return {
      metrics,
      timeline,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null
      },
      totalContainers: filteredContainers.length
    };
  }

  /**
   * Get container utilization and efficiency analytics
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting analytics
   * @param {object} options - Filtering options
   * @returns {Promise<object>} Container utilization analytics
   */
  async getContainerUtilization(inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const { containerType, status, locationId } = options;

    // Get all containers for the inventory
    const containersResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#CONTAINERS`
      }
    }));

    const containers = containersResult.Items || [];

    // Apply filters
    let filteredContainers = containers;
    
    if (containerType) {
      filteredContainers = filteredContainers.filter(c => c.type === containerType);
    }
    
    if (status) {
      filteredContainers = filteredContainers.filter(c => c.status === status);
    }
    
    if (locationId) {
      filteredContainers = filteredContainers.filter(c => c.locationId === locationId);
    }

    // Calculate utilization metrics
    const utilization = this._calculateContainerUtilization(filteredContainers);

    // Get efficiency insights
    const efficiency = this._calculatePackingEfficiency(filteredContainers);

    // Log the analytics access
    await logDataAccess(userId, 'read', 'container_utilization', inventoryId, inventoryId);

    return {
      utilization,
      efficiency,
      totalContainers: filteredContainers.length,
      filters: { containerType, status, locationId }
    };
  }

  /**
   * Get moving progress and completion analytics
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting analytics
   * @param {string} projectId - Optional project ID for project-specific analytics
   * @returns {Promise<object>} Moving progress analytics
   */
  async getMovingProgress(inventoryId, userId, projectId = null) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get containers (filtered by project if specified)
    const containersQuery = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#CONTAINERS`
      }
    };

    if (projectId) {
      containersQuery.FilterExpression = 'projectId = :projectId';
      containersQuery.ExpressionAttributeValues[':projectId'] = projectId;
    }

    const containersResult = await docClient.send(new QueryCommand(containersQuery));
    const containers = containersResult.Items || [];

    // Get all items in the inventory
    const itemsResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#THINGS`
      }
    }));

    const items = itemsResult.Items || [];

    // Calculate progress metrics
    const progress = this._calculateMovingProgress(containers, items, projectId);

    // Get completion timeline
    const completionTimeline = this._generateCompletionTimeline(containers);

    // Log the analytics access
    await logDataAccess(userId, 'read', 'moving_progress', projectId || inventoryId, inventoryId);

    return {
      progress,
      completionTimeline,
      projectId,
      totalContainers: containers.length,
      totalItems: items.length
    };
  }

  /**
   * Get storage costs and duration analytics
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting analytics
   * @param {object} options - Date range and filtering options
   * @returns {Promise<object>} Storage cost analytics
   */
  async getStorageCosts(inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const { startDate, endDate, locationId } = options;

    // Get containers in storage locations
    const containersResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'attribute_exists(storageStartDate)',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#CONTAINERS`
      }
    }));

    const storageContainers = containersResult.Items || [];

    // Filter by location if specified
    let filteredContainers = storageContainers;
    if (locationId) {
      filteredContainers = storageContainers.filter(c => c.locationId === locationId);
    }

    // Calculate storage costs and duration
    const storageCosts = this._calculateStorageCosts(filteredContainers, options);

    // Generate cost projections
    const projections = this._generateCostProjections(filteredContainers);

    // Log the analytics access
    await logDataAccess(userId, 'read', 'storage_costs', inventoryId, inventoryId);

    return {
      costs: storageCosts,
      projections,
      totalStorageContainers: filteredContainers.length,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null
      }
    };
  }

  /**
   * Generate recommendations and optimization suggestions
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting recommendations
   * @returns {Promise<object>} Recommendations and suggestions
   */
  async getRecommendations(inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get comprehensive data for analysis
    const [packingMetrics, utilization, progress] = await Promise.all([
      this.getPackingMetrics(inventoryId, userId),
      this.getContainerUtilization(inventoryId, userId),
      this.getMovingProgress(inventoryId, userId)
    ]);

    // Generate recommendations based on analytics
    const recommendations = this._generateRecommendations(packingMetrics, utilization, progress);

    // Log the analytics access
    await logDataAccess(userId, 'read', 'recommendations', inventoryId, inventoryId);

    return {
      recommendations,
      basedOn: {
        packingMetrics: packingMetrics.metrics,
        utilization: utilization.utilization,
        progress: progress.progress
      },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Calculate packing metrics from container data
   * @param {Array} containers - Container data
   * @param {object} options - Calculation options
   * @returns {object} Packing metrics
   * @private
   */
  _calculatePackingMetrics(containers, options = {}) {
    const now = new Date();
    const totalContainers = containers.length;
    const totalItems = containers.reduce((sum, c) => sum + (c.itemCount || 0), 0);
    const totalValue = containers.reduce((sum, c) => sum + (c.estimatedValue || 0), 0);

    // Calculate containers by status
    const statusBreakdown = containers.reduce((acc, container) => {
      const status = container.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Calculate containers by type
    const typeBreakdown = containers.reduce((acc, container) => {
      const type = container.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Calculate average items per container
    const avgItemsPerContainer = totalContainers > 0 ? totalItems / totalContainers : 0;

    // Calculate average value per container
    const avgValuePerContainer = totalContainers > 0 ? totalValue / totalContainers : 0;

    // Calculate packing velocity (containers created per day)
    const packingVelocity = this._calculatePackingVelocity(containers);

    return {
      totalContainers,
      totalItems,
      totalValue,
      avgItemsPerContainer: Math.round(avgItemsPerContainer * 100) / 100,
      avgValuePerContainer: Math.round(avgValuePerContainer * 100) / 100,
      statusBreakdown,
      typeBreakdown,
      packingVelocity
    };
  }

  /**
   * Calculate container utilization metrics
   * @param {Array} containers - Container data
   * @returns {object} Utilization metrics
   * @private
   */
  _calculateContainerUtilization(containers) {
    const totalContainers = containers.length;
    
    if (totalContainers === 0) {
      return {
        emptyContainers: 0,
        lightlyPacked: 0,
        wellPacked: 0,
        overPacked: 0,
        utilizationScore: 0
      };
    }

    // Categorize containers by utilization
    const utilization = containers.reduce((acc, container) => {
      const itemCount = container.itemCount || 0;
      
      if (itemCount === 0) {
        acc.emptyContainers++;
      } else if (itemCount <= 5) {
        acc.lightlyPacked++;
      } else if (itemCount <= 20) {
        acc.wellPacked++;
      } else {
        acc.overPacked++;
      }
      
      return acc;
    }, {
      emptyContainers: 0,
      lightlyPacked: 0,
      wellPacked: 0,
      overPacked: 0
    });

    // Calculate overall utilization score (0-100)
    const utilizationScore = Math.round(
      ((utilization.wellPacked * 100 + utilization.lightlyPacked * 60 + utilization.overPacked * 40) / totalContainers)
    );

    return {
      ...utilization,
      utilizationScore,
      totalContainers
    };
  }

  /**
   * Calculate packing efficiency metrics
   * @param {Array} containers - Container data
   * @returns {object} Efficiency metrics
   * @private
   */
  _calculatePackingEfficiency(containers) {
    const totalContainers = containers.length;
    const totalItems = containers.reduce((sum, c) => sum + (c.itemCount || 0), 0);

    if (totalContainers === 0 || totalItems === 0) {
      return {
        efficiency: 0,
        wastedSpace: 0,
        recommendations: []
      };
    }

    // Calculate theoretical optimal containers needed (assuming 15 items per container)
    const optimalContainers = Math.ceil(totalItems / 15);
    const efficiency = Math.round((optimalContainers / totalContainers) * 100);
    const wastedSpace = Math.max(0, totalContainers - optimalContainers);

    const recommendations = [];
    
    if (efficiency < 70) {
      recommendations.push('Consider consolidating items into fewer containers');
    }
    
    if (wastedSpace > 5) {
      recommendations.push(`You could potentially save ${wastedSpace} containers by repacking`);
    }

    return {
      efficiency,
      wastedSpace,
      optimalContainers,
      actualContainers: totalContainers,
      recommendations
    };
  }

  /**
   * Calculate moving progress metrics
   * @param {Array} containers - Container data
   * @param {Array} items - Item data
   * @param {string} projectId - Project ID filter
   * @returns {object} Progress metrics
   * @private
   */
  _calculateMovingProgress(containers, items, projectId) {
    const totalItems = items.length;
    const packedItems = items.filter(item => item.containerId).length;
    const unpackedItems = totalItems - packedItems;

    const totalContainers = containers.length;
    const packedContainers = containers.filter(c => (c.itemCount || 0) > 0).length;
    const emptyContainers = totalContainers - packedContainers;

    // Calculate completion percentage
    const completionPercentage = totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0;

    // Calculate containers by status
    const containersByStatus = containers.reduce((acc, container) => {
      const status = container.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      totalItems,
      packedItems,
      unpackedItems,
      totalContainers,
      packedContainers,
      emptyContainers,
      completionPercentage,
      containersByStatus,
      packingRate: totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0
    };
  }

  /**
   * Calculate storage costs and duration
   * @param {Array} containers - Storage container data
   * @param {object} options - Calculation options
   * @returns {object} Storage cost metrics
   * @private
   */
  _calculateStorageCosts(containers, options = {}) {
    const now = new Date();
    let totalMonthlyCost = 0;
    let totalDuration = 0;
    let totalContainers = containers.length;

    const costBreakdown = containers.map(container => {
      const storageStartDate = new Date(container.storageStartDate);
      const durationDays = Math.ceil((now - storageStartDate) / (1000 * 60 * 60 * 24));
      const durationMonths = durationDays / 30.44; // Average days per month
      const monthlyRate = container.storageRate || 0;
      const totalCost = durationMonths * monthlyRate;

      totalMonthlyCost += monthlyRate;
      totalDuration += durationDays;

      return {
        containerId: container.sk,
        containerName: container.name,
        storageStartDate: container.storageStartDate,
        durationDays,
        durationMonths: Math.round(durationMonths * 100) / 100,
        monthlyRate,
        totalCost: Math.round(totalCost * 100) / 100
      };
    });

    const avgDuration = totalContainers > 0 ? Math.round(totalDuration / totalContainers) : 0;
    const totalCost = costBreakdown.reduce((sum, item) => sum + item.totalCost, 0);

    return {
      totalContainers,
      totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      avgDuration,
      costBreakdown
    };
  }

  /**
   * Generate cost projections for storage
   * @param {Array} containers - Storage container data
   * @returns {object} Cost projections
   * @private
   */
  _generateCostProjections(containers) {
    const monthlyRate = containers.reduce((sum, c) => sum + (c.storageRate || 0), 0);
    
    return {
      nextMonth: Math.round(monthlyRate * 100) / 100,
      next3Months: Math.round(monthlyRate * 3 * 100) / 100,
      next6Months: Math.round(monthlyRate * 6 * 100) / 100,
      nextYear: Math.round(monthlyRate * 12 * 100) / 100
    };
  }

  /**
   * Calculate packing velocity (containers per day)
   * @param {Array} containers - Container data
   * @returns {object} Packing velocity metrics
   * @private
   */
  _calculatePackingVelocity(containers) {
    if (containers.length === 0) {
      return { containersPerDay: 0, trend: 'stable' };
    }

    // Sort containers by creation date
    const sortedContainers = containers.sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt)
    );

    const firstDate = new Date(sortedContainers[0].createdAt);
    const lastDate = new Date(sortedContainers[sortedContainers.length - 1].createdAt);
    const daysDiff = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)));

    const containersPerDay = Math.round((containers.length / daysDiff) * 100) / 100;

    // Calculate trend (simple comparison of first half vs second half)
    const midPoint = Math.floor(containers.length / 2);
    const firstHalf = sortedContainers.slice(0, midPoint);
    const secondHalf = sortedContainers.slice(midPoint);

    let trend = 'stable';
    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const firstHalfRate = firstHalf.length / Math.max(1, 
        Math.ceil((new Date(firstHalf[firstHalf.length - 1].createdAt) - new Date(firstHalf[0].createdAt)) / (1000 * 60 * 60 * 24))
      );
      const secondHalfRate = secondHalf.length / Math.max(1,
        Math.ceil((new Date(secondHalf[secondHalf.length - 1].createdAt) - new Date(secondHalf[0].createdAt)) / (1000 * 60 * 60 * 24))
      );

      if (secondHalfRate > firstHalfRate * 1.2) {
        trend = 'increasing';
      } else if (secondHalfRate < firstHalfRate * 0.8) {
        trend = 'decreasing';
      }
    }

    return { containersPerDay, trend };
  }

  /**
   * Generate packing timeline data
   * @param {Array} containers - Container data
   * @param {object} options - Timeline options
   * @returns {Array} Timeline data points
   * @private
   */
  _generatePackingTimeline(containers, options = {}) {
    if (containers.length === 0) {
      return [];
    }

    // Group containers by date
    const timelineData = containers.reduce((acc, container) => {
      const date = new Date(container.createdAt).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          containersCreated: 0,
          itemsPacked: 0,
          totalValue: 0
        };
      }
      
      acc[date].containersCreated++;
      acc[date].itemsPacked += container.itemCount || 0;
      acc[date].totalValue += container.estimatedValue || 0;
      
      return acc;
    }, {});

    // Convert to array and sort by date
    return Object.values(timelineData)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(item => ({
        ...item,
        totalValue: Math.round(item.totalValue * 100) / 100
      }));
  }

  /**
   * Generate completion timeline
   * @param {Array} containers - Container data
   * @returns {Array} Completion timeline data
   * @private
   */
  _generateCompletionTimeline(containers) {
    const statusTimeline = containers.reduce((acc, container) => {
      const date = new Date(container.updatedAt || container.createdAt).toISOString().split('T')[0];
      const status = container.status || 'unknown';
      
      if (!acc[date]) {
        acc[date] = { date };
      }
      
      acc[date][status] = (acc[date][status] || 0) + 1;
      
      return acc;
    }, {});

    return Object.values(statusTimeline)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Generate recommendations based on analytics data
   * @param {object} packingMetrics - Packing metrics
   * @param {object} utilization - Utilization data
   * @param {object} progress - Progress data
   * @returns {Array} Recommendations
   * @private
   */
  _generateRecommendations(packingMetrics, utilization, progress) {
    const recommendations = [];

    // Packing efficiency recommendations
    if (packingMetrics.metrics.avgItemsPerContainer < 5) {
      recommendations.push({
        type: 'efficiency',
        priority: 'high',
        title: 'Improve Container Utilization',
        description: `Your containers average only ${packingMetrics.metrics.avgItemsPerContainer.toFixed(1)} items each. Consider packing more items per container to improve efficiency.`,
        action: 'Review lightly packed containers and consolidate items'
      });
    }

    // Container utilization recommendations
    if (utilization.utilization.emptyContainers > 0) {
      recommendations.push({
        type: 'utilization',
        priority: 'medium',
        title: 'Empty Containers Found',
        description: `You have ${utilization.utilization.emptyContainers} empty containers. Consider removing them or packing items into them.`,
        action: 'Review empty containers and either pack them or remove them'
      });
    }

    // Progress recommendations
    if (progress.progress.completionPercentage < 50 && progress.progress.emptyContainers > 5) {
      recommendations.push({
        type: 'progress',
        priority: 'high',
        title: 'Focus on Packing',
        description: `You're ${progress.progress.completionPercentage}% complete with packing, but have ${progress.progress.emptyContainers} empty containers. Focus on packing items before creating more containers.`,
        action: 'Pack existing items into containers before creating new ones'
      });
    }

    // Packing velocity recommendations
    if (packingMetrics.metrics.packingVelocity.trend === 'decreasing') {
      recommendations.push({
        type: 'velocity',
        priority: 'medium',
        title: 'Packing Pace Slowing',
        description: 'Your packing pace has been decreasing. Consider setting daily packing goals to maintain momentum.',
        action: 'Set a daily target for containers to pack'
      });
    }

    // Value distribution recommendations
    if (packingMetrics.metrics.avgValuePerContainer > 1000) {
      recommendations.push({
        type: 'security',
        priority: 'high',
        title: 'High-Value Containers',
        description: `Your containers average £${packingMetrics.metrics.avgValuePerContainer.toFixed(2)} in value. Consider special handling for valuable items.`,
        action: 'Mark high-value containers with appropriate handling flags'
      });
    }

    return recommendations;
  }
}

module.exports = new AnalyticsService();