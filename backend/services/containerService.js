const { Container, ContainerStatus } = require('../models/container');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { hasInventoryAccess, getUserInventories } = require('./dynamodb');
const { logDataAccess, logContainerOperation, logBulkOperation } = require('./auditLogService');
const cacheService = require('./cacheService');
const dbOptimizationService = require('./databaseOptimizationService');
const performanceMonitoring = require('./performanceMonitoringService');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Container Service
 * Handles all container-related operations including CRUD, location management, and bulk operations
 */
class ContainerService {
  /**
   * Create a new container
   * @param {object} containerData - Container data
   * @param {string} userId - User ID creating the container
   * @returns {Promise<Container>} Created container
   */
  async createContainer(containerData, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, containerData.inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Check for duplicate container name in the same inventory
    const existingContainer = await this.findContainerByName(containerData.name, containerData.inventoryId, userId);
    if (existingContainer) {
      throw new Error(`A container with the name "${containerData.name}" already exists in this inventory`);
    }

    // Create container instance
    const container = new Container({
      ...containerData,
      createdBy: userId,
      updatedBy: userId
    });

    // Validate container data
    const validation = container.validate();
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: container.toDynamoDBItem(),
      ConditionExpression: 'attribute_not_exists(pk)'
    }));

    // Log the creation
    await logContainerOperation(userId, 'create', container.id, containerData.inventoryId, {
      containerName: container.name,
      containerType: container.type,
      locationId: container.locationId
    });

    // CACHING DISABLED - No cache invalidation needed

    return container;
  }

  /**
   * Get a container by ID
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the container
   * @returns {Promise<Container|null>} Container or null if not found
   */
  async getContainer(containerId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `INVENTORY#${inventoryId}#CONTAINERS`,
        sk: containerId
      }
    }));

    if (!result.Item) {
      throw new Error('Container not found');
    }

    // Log the access
    await logDataAccess(userId, 'read', 'containers', containerId, inventoryId);

    return Container.fromDynamoDBItem(result.Item);
  }

  /**
   * Find a container by ID across all inventories the user has access to
   * This is used for QR code scanning where we don't know which inventory the container belongs to
   * @param {string} containerId - Container ID
   * @param {string} userId - User ID requesting the container
   * @returns {Promise<{container: Container, inventoryId: string}|null>} Container with its inventory ID or null if not found
   */
  async findContainerAcrossInventories(containerId, userId) {
    console.log('🔍 findContainerAcrossInventories called:', { containerId, userId });
    
    // Get all inventories the user has access to
    const userInventories = await getUserInventories(userId);
    console.log('📋 User inventories found:', userInventories?.length || 0);
    
    if (!userInventories || userInventories.length === 0) {
      console.log('❌ No inventories found for user');
      return null;
    }

    // Search for the container in each inventory
    for (const inventory of userInventories) {
      try {
        console.log('🔍 Searching in inventory:', inventory.id);
        
        const result = await docClient.send(new GetCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: `INVENTORY#${inventory.id}#CONTAINERS`,
            sk: containerId
          }
        }));

        if (result.Item) {
          console.log('✅ Container found in inventory:', inventory.id);
          // Found the container
          const container = Container.fromDynamoDBItem(result.Item);
          
          // Log the access
          await logDataAccess(userId, 'read', 'containers', containerId, inventory.id);
          
          return {
            container,
            inventoryId: inventory.id
          };
        } else {
          console.log('❌ Container not found in inventory:', inventory.id);
        }
      } catch (error) {
        // Continue searching in other inventories if this one fails
        console.error(`❌ Error searching for container ${containerId} in inventory ${inventory.id}:`, error);
        continue;
      }
    }

    // Container not found in any accessible inventory
    console.log('❌ Container not found in any accessible inventory');
    return null;
  }

  /**
   * List containers for an inventory with filtering and pagination
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the containers
   * @param {object} options - Filtering and pagination options
   * @returns {Promise<object>} Containers list with pagination info
   */
  async listContainers(inventoryId, userId, options = {}) {
    const operationId = `listContainers_${inventoryId}_${Date.now()}`;
    performanceMonitoring.startTiming(operationId, 'containerList', { inventoryId, userId });

    try {
      // Validate inventory access
      const hasAccess = await hasInventoryAccess(userId, inventoryId);
      if (!hasAccess) {
        throw new Error('Access denied to inventory');
      }

    const {
      limit = 50,
      lastEvaluatedKey,
      status,
      type,
      locationId,
      projectId,
      handlingFlags,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // CACHING DISABLED - Always fetch fresh data from DynamoDB
    // This prevents stale data issues that were causing container names to disappear

    // Build query parameters
    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#CONTAINERS`
      },
      Limit: Math.min(limit, 100), // Cap at 100 items per request
      ScanIndexForward: sortOrder === 'asc'
    };

    // Add pagination
    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    // Add projection expression to reduce data transfer
    // Note: Container data is stored at root level, not in nested 'data' field
    queryParams.ProjectionExpression = 'pk, sk, id, #name, #type, #status, locationId, projectId, description, contentsSummary, itemCount, estimatedValue, handlingFlags, photos, qrCode, size, createdAt, updatedAt, createdBy, updatedBy, inventoryId';
    queryParams.ExpressionAttributeNames = { 
      '#name': 'name',
      '#type': 'type', 
      '#status': 'status'
    };

    // Build filter expression for additional filters
    const filterExpressions = [];
    const filterValues = {};

    if (status) {
      filterExpressions.push('#status = :status');
      filterValues[':status'] = status;
    }

    if (type) {
      filterExpressions.push('#type = :type');
      filterValues[':type'] = type;
    }

    if (locationId) {
      filterExpressions.push('locationId = :locationId');
      filterValues[':locationId'] = locationId;
    }

    if (projectId) {
      filterExpressions.push('projectId = :projectId');
      filterValues[':projectId'] = projectId;
    }

    if (search) {
      filterExpressions.push('contains(#name, :search) OR contains(description, :search)');
      filterValues[':search'] = search;
    }

    // Handle filtering by handling flags (containers must have ALL specified flags)
    if (handlingFlags && Array.isArray(handlingFlags) && handlingFlags.length > 0) {
      const flagConditions = handlingFlags.map((flag, index) => {
        const paramName = `:handlingFlag${index}`;
        filterValues[paramName] = flag;
        return `contains(handlingFlags, ${paramName})`;
      });
      filterExpressions.push(`(${flagConditions.join(' AND ')})`);
    }

    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(' AND ');
      queryParams.ExpressionAttributeValues = { ...queryParams.ExpressionAttributeValues, ...filterValues };
    }

    // Use optimized query for better performance
    const result = await dbOptimizationService.optimizedQuery(queryParams, {
      maxItems: limit,
      projectionExpression: queryParams.ProjectionExpression,
      scanIndexForward: sortOrder === 'asc'
    });

    // Convert to Container instances
    const containers = result.items.map(item => Container.fromDynamoDBItem(item));

    // Apply sorting if not by creation date (DynamoDB sorts by SK by default)
    if (sortBy !== 'createdAt') {
      containers.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        
        if (sortOrder === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
    }

    // Log the access
    await logDataAccess(userId, 'read', 'containers', 'list', inventoryId);

    const resultData = {
      containers,
      lastEvaluatedKey: result.lastEvaluatedKey,
      count: containers.length,
      hasMore: result.hasMore
    };

    // CACHING DISABLED - No longer caching container lists to prevent stale data

    const duration = performanceMonitoring.endTiming(operationId, {
      containerCount: containers.length,
      fromCache: false
    });

    return resultData;
    } catch (error) {
      performanceMonitoring.recordError('ContainerListError', 'listContainers', { inventoryId, userId });
      throw error;
    }
  }

  /**
   * Update a container
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {object} updates - Fields to update
   * @param {string} userId - User ID making the update
   * @returns {Promise<Container>} Updated container
   */
  async updateContainer(containerId, inventoryId, updates, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing container
    const container = await this.getContainer(containerId, inventoryId, userId);
    if (!container) {
      throw new Error('Container not found');
    }

    // If updating the name, check for duplicates
    if (updates.name && updates.name.trim() !== container.name) {
      const existingContainer = await this.findContainerByName(updates.name, inventoryId, userId);
      if (existingContainer && existingContainer.id !== containerId) {
        throw new Error(`A container with the name "${updates.name}" already exists in this inventory`);
      }
    }

    // Update container data
    container.update(updates, userId);

    // Validate updated container
    const validation = container.validate();
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: container.toDynamoDBItem()
    }));

    // Log the update
    await logContainerOperation(userId, 'update', containerId, inventoryId, {
      updatedFields: Object.keys(updates),
      previousValues: container ? {
        name: container.name,
        status: container.status,
        locationId: container.locationId
      } : undefined
    });

    // CACHING DISABLED - No cache invalidation needed

    return container;
  }

  /**
   * Delete a container
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID deleting the container
   * @returns {Promise<void>}
   */
  async deleteContainer(containerId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing container to check if it's empty
    const container = await this.getContainer(containerId, inventoryId, userId);
    if (!container) {
      throw new Error('Container not found');
    }

    // Check if container is empty
    if (container.itemCount > 0) {
      throw new Error('Cannot delete container that contains items. Please remove all items first.');
    }

    // Delete from DynamoDB
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `INVENTORY#${inventoryId}#CONTAINERS`,
        sk: containerId
      }
    }));

    // Log the deletion
    await logContainerOperation(userId, 'delete', containerId, inventoryId, {
      containerName: container.name,
      itemCount: container.itemCount
    });

    // CACHING DISABLED - No cache invalidation needed
  }

  /**
   * Update container status with validation
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} newStatus - New status
   * @param {string} userId - User ID making the update
   * @returns {Promise<Container>} Updated container
   */
  async updateContainerStatus(containerId, inventoryId, newStatus, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing container
    const container = await this.getContainer(containerId, inventoryId, userId);
    if (!container) {
      throw new Error('Container not found');
    }

    // Update status with validation
    const statusUpdate = container.updateStatus(newStatus, userId);
    if (!statusUpdate.success) {
      throw new Error(`Status update failed: ${statusUpdate.errors.join(', ')}`);
    }

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: container.toDynamoDBItem()
    }));

    // Log the status update
    await logDataAccess(userId, 'update', 'container_status', containerId, inventoryId);

    return container;
  }

  /**
   * Move a container to a new location and update all contained items
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} newLocationId - New location ID
   * @param {string} userId - User ID making the move
   * @returns {Promise<object>} Move result with updated items count
   */
  async moveContainer(containerId, inventoryId, newLocationId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing container
    const container = await this.getContainer(containerId, inventoryId, userId);
    if (!container) {
      throw new Error('Container not found');
    }

    const oldLocationId = container.locationId;

    // Update container location
    container.locationId = newLocationId;
    container.updatedBy = userId;
    container.updatedAt = new Date().toISOString();

    // Save container update
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: container.toDynamoDBItem()
    }));

    // Get all items in this container and update their locations
    const itemsResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'containerId = :containerId',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#THINGS`,
        ':containerId': containerId
      }
    }));

    let updatedItemsCount = 0;

    // Update each item's location
    if (itemsResult.Items && itemsResult.Items.length > 0) {
      const updatePromises = itemsResult.Items.map(async (item) => {
        const updatedItem = {
          ...item,
          data: {
            ...item.data,
            locationId: newLocationId,
            previousLocationId: oldLocationId,
            updatedAt: new Date().toISOString()
          }
        };

        await docClient.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: updatedItem
        }));

        updatedItemsCount++;
      });

      await Promise.all(updatePromises);
    }

    // Log the container move
    await logContainerOperation(userId, 'move', containerId, inventoryId, {
      previousLocationId: oldLocationId,
      newLocationId,
      itemsUpdated: updatedItemsCount
    });

    return {
      container,
      updatedItemsCount,
      oldLocationId,
      newLocationId
    };
  }

  /**
   * Bulk move multiple containers to a new location
   * @param {string[]} containerIds - Array of container IDs
   * @param {string} inventoryId - Inventory ID
   * @param {string} newLocationId - New location ID
   * @param {string} userId - User ID making the move
   * @returns {Promise<object>} Bulk move result
   */
  async bulkMoveContainers(containerIds, inventoryId, newLocationId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    if (!containerIds || containerIds.length === 0) {
      throw new Error('No containers specified for bulk move');
    }

    if (containerIds.length > 50) {
      throw new Error('Cannot move more than 50 containers at once');
    }

    try {
      // Use optimized bulk move operation
      const moveResult = await dbOptimizationService.bulkMoveContainersOptimized(
        containerIds, 
        inventoryId, 
        newLocationId, 
        userId
      );

      // Log the bulk move operation
      await logBulkOperation(userId, 'bulk_move_containers', inventoryId, {
        containerIds,
        containerCount: containerIds.length,
        newLocationId,
        containersUpdated: moveResult.containersUpdated,
        itemsUpdated: moveResult.itemsUpdated,
        errors: moveResult.errors
      });

      // CACHING DISABLED - No cache invalidation needed

      return {
        totalContainers: moveResult.totalContainers,
        containersUpdated: moveResult.containersUpdated,
        itemsUpdated: moveResult.itemsUpdated,
        successfulMoves: moveResult.containersUpdated,
        failedMoves: moveResult.totalContainers - moveResult.containersUpdated,
        totalUpdatedItems: moveResult.itemsUpdated,
        newLocationId,
        errors: moveResult.errors
      };

    } catch (error) {
      console.error('Bulk move containers error:', error);
      throw new Error(`Bulk move failed: ${error.message}`);
    }
  }

  /**
   * Search containers by QR code
   * @param {string} qrCode - QR code to search for
   * @param {string} userId - User ID making the search
   * @returns {Promise<Container|null>} Container or null if not found
   */
  async findContainerByQRCode(qrCode, userId) {
    // Query by QR code using GSI (would need to be created)
    // For now, we'll scan through containers (not efficient for production)
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'QRCodeIndex', // This GSI would need to be created
      KeyConditionExpression: 'qrCode = :qrCode',
      ExpressionAttributeValues: {
        ':qrCode': qrCode
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    const containerItem = result.Items[0];
    
    // Validate user has access to the inventory
    const hasAccess = await hasInventoryAccess(userId, containerItem.inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to container inventory');
    }

    // Log the QR code lookup
    await logDataAccess(userId, 'read', 'container_qr_lookup', containerItem.id, containerItem.inventoryId);

    return Container.fromDynamoDBItem(containerItem);
  }

  /**
   * Get container contents (items within the container)
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the contents
   * @returns {Promise<object>} Container with its items
   */
  async getContainerContents(containerId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // CACHING DISABLED - Always fetch fresh container contents

    // Get the container
    const container = await this.getContainer(containerId, inventoryId, userId);
    if (!container) {
      throw new Error('Container not found');
    }

    // Get all items in this container
    const itemsResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: '#data.containerId = :containerId',
      ExpressionAttributeNames: {
        '#data': 'data'
      },
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#THINGS`,
        ':containerId': containerId
      }
    }));

    const items = itemsResult.Items ? itemsResult.Items.map(item => ({
      id: item.sk,
      ...item.data
    })) : [];

    // Log the contents access
    await logDataAccess(userId, 'read', 'container_contents', containerId, inventoryId);

    const contentsData = {
      container,
      items,
      itemCount: items.length
    };

    // CACHING DISABLED - No longer caching container contents

    return contentsData;
  }

  /**
   * Update container item count and estimated value
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {number} itemCount - New item count
   * @param {number} estimatedValue - New estimated value
   * @param {string} userId - User ID making the update
   * @returns {Promise<Container>} Updated container
   */
  async updateContainerContents(containerId, inventoryId, itemCount, estimatedValue, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing container
    const container = await this.getContainer(containerId, inventoryId, userId);
    if (!container) {
      throw new Error('Container not found');
    }

    // Update contents
    container.updateContents(itemCount, estimatedValue, userId);

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: container.toDynamoDBItem()
    }));

    // Log the contents update
    await logDataAccess(userId, 'update', 'container_contents', containerId, inventoryId);

    return container;
  }
  /**
   * Find a container by name within an inventory
   * @param {string} containerName - Container name to search for
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID making the request
   * @returns {Promise<Container|null>} Container or null if not found
   */
  async findContainerByName(containerName, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Query containers and filter by name (case-insensitive)
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: '#name = :name',
      ExpressionAttributeNames: {
        '#name': 'name'
      },
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#CONTAINERS`,
        ':name': containerName.trim()
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return Container.fromDynamoDBItem(result.Items[0]);
  }
}

module.exports = new ContainerService();