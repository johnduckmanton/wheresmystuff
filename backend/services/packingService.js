const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, BatchWriteCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { hasInventoryAccess } = require('./dynamodb');
const { logDataAccess, logPackingOperation, logBulkOperation } = require('./auditLogService');
const containerService = require('./containerService');
const notificationService = require('./notificationService');
const collaborationService = require('./collaborationService');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false
  },
  unmarshallOptions: {
    wrapNumbers: false
  }
});

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Remove undefined values from an object recursively
 * @param {any} obj - Object to clean
 * @returns {any} Cleaned object
 */
function removeUndefinedValues(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedValues(value);
      }
    }
    return cleaned;
  }
  
  return obj;
}

/**
 * Packing Service
 * Handles item-to-container operations including assignment, removal, and transfers
 */
class PackingService {
  /**
   * Add items to a container with validation
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string[]} itemIds - Array of item IDs to add
   * @param {string} userId - User ID performing the operation
   * @returns {Promise<object>} Operation result with updated items and container
   */
  async addItemsToContainer(containerId, inventoryId, itemIds, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    if (!itemIds || itemIds.length === 0) {
      throw new Error('No items specified for packing');
    }

    if (itemIds.length > 100) {
      throw new Error('Cannot pack more than 100 items at once');
    }

    // Get the container
    const container = await containerService.getContainer(containerId, inventoryId, userId);
    if (!container) {
      throw new Error('Container not found');
    }

    // Get all items to validate they exist and are not already packed
    const items = [];
    const itemsToUpdate = [];
    let totalValue = 0;

    for (const itemId of itemIds) {
      const item = await this._getItem(itemId, inventoryId);
      if (!item) {
        throw new Error(`Item not found: ${itemId}`);
      }

      if (item.containerId) {
        throw new Error(`Item ${itemId} is already packed in container ${item.containerId}`);
      }

      items.push(item);
      totalValue += item.purchasePrice || item.value || 0;

      // Prepare item update
      const updatedItem = {
        ...item,
        containerId: containerId,
        packedAt: new Date().toISOString(),
        previousLocationId: item.locationId,
        locationId: container.locationId // Update item location to match container
      };

      itemsToUpdate.push({
        pk: `INVENTORY#${inventoryId}#THINGS`,
        sk: itemId,
        data: updatedItem
      });
    }

    // Use transaction to ensure atomicity
    const transactItems = [];

    // Add item updates to transaction
    itemsToUpdate.forEach(item => {
      transactItems.push({
        Put: {
          TableName: TABLE_NAME,
          Item: removeUndefinedValues(item)
        }
      });
    });

    // Update container with new item count and estimated value
    const newItemCount = container.itemCount + items.length;
    const newEstimatedValue = container.estimatedValue + totalValue;
    
    container.updateContents(newItemCount, newEstimatedValue, userId);

    // Add container update to transaction
    transactItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: removeUndefinedValues(container.toDynamoDBItem())
      }
    });

    // Execute transaction
    try {
      await docClient.send(new TransactWriteCommand({
        TransactItems: transactItems
      }));
    } catch (transactionError) {
      throw transactionError;
    }

    // Log the packing operation
    await logPackingOperation(userId, 'pack_items', containerId, inventoryId, {
      itemIds: itemIds,
      itemCount: items.length,
      totalValue: totalValue,
      containerName: container.name
    });

    // Create activity entry and notify session participants
    try {
      await collaborationService.createActivityEntry(inventoryId, {
        type: 'items_packed',
        userId,
        containerId,
        itemIds: itemIds,
        details: {
          containerName: container.name,
          itemCount: items.length,
          totalValue: totalValue
        }
      });

      // Get active sessions for this inventory and notify participants
      const activeSessions = await collaborationService.getActivePackingSessions(inventoryId, userId);
      for (const session of activeSessions) {
        if (session.participants.length > 1) {
          await notificationService.notifySessionParticipants(
            session.id,
            session.participants.filter(id => id !== userId), // Don't notify the user who performed the action
            'items_packed',
            {
              inventoryId,
              sessionName: session.name,
              containerName: container.name,
              itemCount: items.length,
              userName: 'A user' // Could be enhanced to get actual user name
            }
          );
        }
      }
    } catch (notificationError) {
      console.error('Error sending packing notifications:', notificationError);
      // Don't fail the main operation if notifications fail
    }

    return {
      container,
      packedItems: items,
      packedCount: items.length,
      totalValue: totalValue,
      newItemCount: newItemCount,
      newEstimatedValue: newEstimatedValue
    };
  }

  /**
   * Remove items from a container and update their locations
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string[]} itemIds - Array of item IDs to remove
   * @param {string} userId - User ID performing the operation
   * @returns {Promise<object>} Operation result with updated items and container
   */
  async removeItemsFromContainer(containerId, inventoryId, itemIds, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    if (!itemIds || itemIds.length === 0) {
      throw new Error('No items specified for removal');
    }

    if (itemIds.length > 100) {
      throw new Error('Cannot remove more than 100 items at once');
    }

    // Get the container
    const container = await containerService.getContainer(containerId, inventoryId, userId);
    if (!container) {
      throw new Error('Container not found');
    }

    // Get all items to validate they exist and are in this container
    const items = [];
    const itemsToUpdate = [];
    let totalValue = 0;

    for (const itemId of itemIds) {
      const item = await this._getItem(itemId, inventoryId);
      if (!item) {
        throw new Error(`Item not found: ${itemId}`);
      }

      if (item.containerId !== containerId) {
        throw new Error(`Item ${itemId} is not in container ${containerId}`);
      }

      items.push(item);
      totalValue += item.purchasePrice || item.value || 0;

      // Prepare item update - restore previous location or use container location
      const updatedItem = {
        ...item,
        containerId: null,
        packedAt: null,
        locationId: item.previousLocationId || container.locationId,
        previousLocationId: null
      };

      itemsToUpdate.push({
        pk: `INVENTORY#${inventoryId}#THINGS`,
        sk: itemId,
        data: updatedItem
      });
    }

    // Use transaction to ensure atomicity
    const transactItems = [];

    // Add item updates to transaction
    itemsToUpdate.forEach(item => {
      transactItems.push({
        Put: {
          TableName: TABLE_NAME,
          Item: removeUndefinedValues(item)
        }
      });
    });

    // Update container with new item count and estimated value
    const newItemCount = Math.max(0, container.itemCount - items.length);
    const newEstimatedValue = Math.max(0, container.estimatedValue - totalValue);
    
    container.updateContents(newItemCount, newEstimatedValue, userId);

    // Add container update to transaction
    transactItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: removeUndefinedValues(container.toDynamoDBItem())
      }
    });

    // Execute transaction
    await docClient.send(new TransactWriteCommand({
      TransactItems: transactItems
    }));

    // Log the unpacking operation
    await logPackingOperation(userId, 'unpack_items', containerId, inventoryId, {
      itemIds: itemIds,
      itemCount: items.length,
      containerName: container.name
    });

    return {
      container,
      unpackedItems: items,
      unpackedCount: items.length,
      totalValue: totalValue,
      newItemCount: newItemCount,
      newEstimatedValue: newEstimatedValue
    };
  }

  /**
   * Move items between containers
   * @param {string} sourceContainerId - Source container ID
   * @param {string} targetContainerId - Target container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string[]} itemIds - Array of item IDs to move
   * @param {string} userId - User ID performing the operation
   * @returns {Promise<object>} Operation result with updated containers and items
   */
  async moveItemsBetweenContainers(sourceContainerId, targetContainerId, inventoryId, itemIds, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    if (!itemIds || itemIds.length === 0) {
      throw new Error('No items specified for transfer');
    }

    if (itemIds.length > 100) {
      throw new Error('Cannot transfer more than 100 items at once');
    }

    if (sourceContainerId === targetContainerId) {
      throw new Error('Source and target containers cannot be the same');
    }

    // Get both containers
    const sourceContainer = await containerService.getContainer(sourceContainerId, inventoryId, userId);
    if (!sourceContainer) {
      throw new Error('Source container not found');
    }

    const targetContainer = await containerService.getContainer(targetContainerId, inventoryId, userId);
    if (!targetContainer) {
      throw new Error('Target container not found');
    }

    // Get all items to validate they exist and are in the source container
    const items = [];
    const itemsToUpdate = [];
    let totalValue = 0;

    for (const itemId of itemIds) {
      const item = await this._getItem(itemId, inventoryId);
      if (!item) {
        throw new Error(`Item not found: ${itemId}`);
      }

      if (item.containerId !== sourceContainerId) {
        throw new Error(`Item ${itemId} is not in source container ${sourceContainerId}`);
      }

      items.push(item);
      totalValue += item.purchasePrice || item.value || 0;

      // Prepare item update - move to target container
      const updatedItem = {
        ...item,
        containerId: targetContainerId,
        packedAt: new Date().toISOString(),
        locationId: targetContainer.locationId // Update location to match target container
      };

      itemsToUpdate.push({
        pk: `INVENTORY#${inventoryId}#THINGS`,
        sk: itemId,
        data: updatedItem
      });
    }

    // Use transaction to ensure atomicity
    const transactItems = [];

    // Add item updates to transaction
    itemsToUpdate.forEach(item => {
      transactItems.push({
        Put: {
          TableName: TABLE_NAME,
          Item: removeUndefinedValues(item)
        }
      });
    });

    // Update source container (remove items)
    const sourceNewItemCount = Math.max(0, sourceContainer.itemCount - items.length);
    const sourceNewEstimatedValue = Math.max(0, sourceContainer.estimatedValue - totalValue);
    sourceContainer.updateContents(sourceNewItemCount, sourceNewEstimatedValue, userId);

    // Update target container (add items)
    const targetNewItemCount = targetContainer.itemCount + items.length;
    const targetNewEstimatedValue = targetContainer.estimatedValue + totalValue;
    targetContainer.updateContents(targetNewItemCount, targetNewEstimatedValue, userId);

    // Add container updates to transaction
    transactItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: removeUndefinedValues(sourceContainer.toDynamoDBItem())
      }
    });

    transactItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: removeUndefinedValues(targetContainer.toDynamoDBItem())
      }
    });

    // Execute transaction
    await docClient.send(new TransactWriteCommand({
      TransactItems: transactItems
    }));

    // Log the transfer operation
    await logPackingOperation(userId, 'transfer_items', sourceContainerId, inventoryId, {
      itemIds: itemIds,
      itemCount: items.length,
      sourceContainerId,
      targetContainerId,
      sourceContainerName: sourceContainer.name,
      targetContainerName: targetContainer.name
    });

    return {
      sourceContainer,
      targetContainer,
      transferredItems: items,
      transferredCount: items.length,
      totalValue: totalValue,
      sourceNewItemCount: sourceNewItemCount,
      targetNewItemCount: targetNewItemCount
    };
  }

  /**
   * Get container contents with detailed item information
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the contents
   * @returns {Promise<object>} Container with detailed items
   */
  async getContainerContents(containerId, inventoryId, userId) {
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

    // Calculate summary statistics
    const totalValue = items.reduce((sum, item) => sum + (item.purchasePrice || item.value || 0), 0);
    const categories = [...new Set(items.filter(item => item.categoryId).map(item => item.categoryId))];

    // Log the contents access
    await logDataAccess(userId, 'read', 'container_contents', containerId, inventoryId);

    return {
      container,
      items,
      itemCount: items.length,
      totalValue,
      categories: categories.length,
      summary: {
        itemCount: items.length,
        totalValue,
        categoriesCount: categories.length,
        hasPhotos: items.some(item => item.photos && item.photos.length > 0)
      }
    };
  }

  /**
   * Validate container capacity (placeholder for future capacity constraints)
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string[]} itemIds - Array of item IDs to validate
   * @param {string} userId - User ID performing validation
   * @returns {Promise<object>} Validation result
   */
  async validateContainerCapacity(containerId, inventoryId, itemIds, userId) {
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

    // For now, we'll implement basic validation
    // Future enhancements could include volume/weight constraints
    const warnings = [];
    const errors = [];

    // Check item count limits (arbitrary limit for demonstration)
    const maxItemsPerContainer = 200;
    const newItemCount = container.itemCount + itemIds.length;
    
    if (newItemCount > maxItemsPerContainer) {
      errors.push(`Container would exceed maximum item limit of ${maxItemsPerContainer} items`);
    }

    // Check for reasonable item count warning
    if (newItemCount > 50) {
      warnings.push(`Container will have ${newItemCount} items, which may be difficult to manage`);
    }

    // Get items to check for value warnings
    let totalNewValue = 0;
    for (const itemId of itemIds) {
      const item = await this._getItem(itemId, inventoryId);
      if (item) {
        totalNewValue += item.purchasePrice || item.value || 0;
      }
    }

    const newTotalValue = container.estimatedValue + totalNewValue;
    if (newTotalValue > 10000) {
      warnings.push(`Container will contain items worth $${newTotalValue.toFixed(2)}, consider special handling`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      currentItemCount: container.itemCount,
      newItemCount,
      currentValue: container.estimatedValue,
      newTotalValue,
      addedValue: totalNewValue
    };
  }

  /**
   * Bulk assign items to containers with optimization
   * @param {object[]} assignments - Array of {containerId, itemIds} assignments
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID performing the operation
   * @returns {Promise<object>} Bulk operation result
   */
  async bulkAssignItems(assignments, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    if (!assignments || assignments.length === 0) {
      throw new Error('No assignments specified');
    }

    if (assignments.length > 20) {
      throw new Error('Cannot process more than 20 container assignments at once');
    }

    const results = [];
    let totalItemsProcessed = 0;
    let totalErrors = 0;

    // Process each assignment
    for (const assignment of assignments) {
      try {
        const { containerId, itemIds } = assignment;
        
        if (!containerId || !itemIds || itemIds.length === 0) {
          results.push({
            containerId,
            success: false,
            error: 'Invalid assignment: containerId and itemIds are required'
          });
          totalErrors++;
          continue;
        }

        const result = await this.addItemsToContainer(containerId, inventoryId, itemIds, userId);
        
        results.push({
          containerId,
          success: true,
          packedCount: result.packedCount,
          totalValue: result.totalValue
        });
        
        totalItemsProcessed += result.packedCount;
      } catch (error) {
        results.push({
          containerId: assignment.containerId,
          success: false,
          error: error.message
        });
        totalErrors++;
      }
    }

    // Log the bulk operation
    await logBulkOperation(userId, 'bulk_pack_items', inventoryId, {
      assignmentCount: assignments.length,
      totalItemsAssigned: results.reduce((sum, r) => sum + (r.packedCount || 0), 0),
      containerIds: assignments.map(a => a.containerId),
      success: results.every(r => r.success)
    });

    return {
      results,
      totalAssignments: assignments.length,
      successfulAssignments: results.filter(r => r.success).length,
      failedAssignments: totalErrors,
      totalItemsProcessed,
      summary: {
        processed: totalItemsProcessed,
        errors: totalErrors,
        successRate: ((assignments.length - totalErrors) / assignments.length * 100).toFixed(1)
      }
    };
  }

  /**
   * Get available items for packing (items not currently in containers)
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the items
   * @param {object} filters - Optional filters (locationId, categoryId, search)
   * @returns {Promise<object>} Available items with pagination
   */
  async getAvailableItems(inventoryId, userId, filters = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const { locationId, categoryId, search, limit = 50, lastEvaluatedKey } = filters;

    // Build query parameters
    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'attribute_not_exists(#data.containerId) OR #data.containerId = :nullValue',
      ExpressionAttributeNames: {
        '#data': 'data'
      },
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#THINGS`,
        ':nullValue': null
      },
      Limit: Math.min(limit, 100)
    };

    // Add additional filters
    const additionalFilters = [];
    
    if (locationId) {
      additionalFilters.push('#data.locationId = :locationId');
      queryParams.ExpressionAttributeValues[':locationId'] = locationId;
    }

    if (categoryId) {
      additionalFilters.push('#data.categoryId = :categoryId');
      queryParams.ExpressionAttributeValues[':categoryId'] = categoryId;
    }

    if (search) {
      additionalFilters.push('contains(#data.#name, :search) OR contains(#data.description, :search)');
      queryParams.ExpressionAttributeValues[':search'] = search;
      queryParams.ExpressionAttributeNames['#name'] = 'name';
    }

    if (additionalFilters.length > 0) {
      queryParams.FilterExpression += ' AND ' + additionalFilters.join(' AND ');
    }

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    const items = result.Items ? result.Items.map(item => ({
      id: item.sk,
      ...item.data
    })) : [];

    // Log the access
    await logDataAccess(userId, 'read', 'available_items', 'list', inventoryId);

    return {
      items,
      count: items.length,
      lastEvaluatedKey: result.LastEvaluatedKey,
      hasMore: !!result.LastEvaluatedKey,
      totalValue: items.reduce((sum, item) => sum + (item.purchasePrice || item.value || 0), 0)
    };
  }

  /**
   * Get a single item by ID (private helper method)
   * @param {string} itemId - Item ID
   * @param {string} inventoryId - Inventory ID
   * @returns {Promise<object|null>} Item or null if not found
   * @private
   */
  async _getItem(itemId, inventoryId) {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `INVENTORY#${inventoryId}#THINGS`,
        sk: itemId
      }
    }));

    if (!result.Item) {
      return null;
    }

    return {
      id: result.Item.sk,
      ...result.Item.data
    };
  }
}

module.exports = new PackingService();