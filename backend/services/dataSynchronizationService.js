const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');
const { hasInventoryAccess } = require('./dynamodb');
const { logDataAccess, logSyncOperation } = require('./auditLogService');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Data Synchronization Service
 * Ensures seamless synchronization between inventory and moving modules
 * Handles conflict detection, resolution, and data consistency validation
 */
class DataSynchronizationService {
  /**
   * Synchronize item location when container is moved
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} newLocationId - New location ID
   * @param {string} userId - User ID performing the operation
   * @returns {Promise<object>} Synchronization result
   */
  async synchronizeContainerMove(containerId, inventoryId, newLocationId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get all items in the container
    const itemsResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'containerId = :containerId',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#THINGS`,
        ':containerId': containerId
      }
    }));

    const items = itemsResult.Items || [];
    const conflicts = [];
    const updates = [];

    // Check for conflicts and prepare updates
    for (const item of items) {
      const conflict = await this._detectLocationConflict(item, newLocationId, inventoryId);
      if (conflict) {
        conflicts.push(conflict);
      } else {
        // Prepare item update
        const updatedItem = {
          ...item,
          data: {
            ...item.data,
            locationId: newLocationId,
            previousLocationId: item.data.locationId,
            updatedAt: new Date().toISOString(),
            syncedAt: new Date().toISOString()
          }
        };
        updates.push(updatedItem);
      }
    }

    // If there are conflicts, return them for resolution
    if (conflicts.length > 0) {
      return {
        success: false,
        conflicts,
        requiresResolution: true,
        affectedItems: items.length
      };
    }

    // Execute updates in transaction
    if (updates.length > 0) {
      const transactItems = updates.map(item => ({
        Put: {
          TableName: TABLE_NAME,
          Item: item
        }
      }));

      // Split into batches of 25 (DynamoDB transaction limit)
      const batches = this._chunkArray(transactItems, 25);
      
      for (const batch of batches) {
        await docClient.send(new TransactWriteCommand({
          TransactItems: batch
        }));
      }
    }

    // Log the synchronization
    await logSyncOperation(userId, 'container_move_sync', inventoryId, {
      containerId,
      newLocationId,
      itemsUpdated: updates.length,
      conflicts: conflicts.length
    });

    return {
      success: true,
      itemsUpdated: updates.length,
      conflicts: [],
      newLocationId
    };
  }

  /**
   * Synchronize item data when moved between containers
   * @param {string[]} itemIds - Array of item IDs
   * @param {string} sourceContainerId - Source container ID
   * @param {string} targetContainerId - Target container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID performing the operation
   * @returns {Promise<object>} Synchronization result
   */
  async synchronizeItemTransfer(itemIds, sourceContainerId, targetContainerId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get source and target containers
    const [sourceContainer, targetContainer] = await Promise.all([
      this._getContainer(sourceContainerId, inventoryId),
      this._getContainer(targetContainerId, inventoryId)
    ]);

    if (!sourceContainer || !targetContainer) {
      throw new Error('Source or target container not found');
    }

    // Get all items to be transferred
    const items = [];
    for (const itemId of itemIds) {
      const item = await this._getItem(itemId, inventoryId);
      if (item) {
        items.push(item);
      }
    }

    const conflicts = [];
    const updates = [];

    // Check for conflicts and prepare updates
    for (const item of items) {
      // Validate item is in source container
      if (item.data.containerId !== sourceContainerId) {
        conflicts.push({
          type: 'container_mismatch',
          itemId: item.sk,
          expected: sourceContainerId,
          actual: item.data.containerId,
          message: `Item ${item.sk} is not in source container ${sourceContainerId}`
        });
        continue;
      }

      // Check for location conflicts
      const locationConflict = await this._detectLocationConflict(item, targetContainer.locationId, inventoryId);
      if (locationConflict) {
        conflicts.push(locationConflict);
        continue;
      }

      // Prepare item update
      const updatedItem = {
        ...item,
        data: {
          ...item.data,
          containerId: targetContainerId,
          locationId: targetContainer.locationId,
          previousLocationId: item.data.locationId,
          packedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncedAt: new Date().toISOString()
        }
      };
      updates.push(updatedItem);
    }

    // If there are conflicts, return them for resolution
    if (conflicts.length > 0) {
      return {
        success: false,
        conflicts,
        requiresResolution: true,
        affectedItems: items.length
      };
    }

    // Execute updates in transaction
    if (updates.length > 0) {
      const transactItems = updates.map(item => ({
        Put: {
          TableName: TABLE_NAME,
          Item: item
        }
      }));

      // Split into batches of 25 (DynamoDB transaction limit)
      const batches = this._chunkArray(transactItems, 25);
      
      for (const batch of batches) {
        await docClient.send(new TransactWriteCommand({
          TransactItems: batch
        }));
      }
    }

    // Log the synchronization
    await logSyncOperation(userId, 'item_transfer_sync', inventoryId, {
      sourceContainerId,
      targetContainerId,
      itemIds: updates.map(item => item.sk),
      itemsUpdated: updates.length,
      conflicts: conflicts.length
    });

    return {
      success: true,
      itemsUpdated: updates.length,
      conflicts: [],
      sourceContainerId,
      targetContainerId
    };
  }

  /**
   * Validate data consistency between inventory and container modules
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID performing validation
   * @returns {Promise<object>} Validation result with inconsistencies
   */
  async validateDataConsistency(inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const inconsistencies = [];
    let totalItems = 0;
    let totalContainers = 0;

    // Get all containers
    const containersResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#CONTAINERS`
      }
    }));

    const containers = containersResult.Items || [];
    totalContainers = containers.length;

    // Get all items
    const itemsResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#THINGS`
      }
    }));

    const items = itemsResult.Items || [];
    totalItems = items.length;

    // Check container-item consistency
    for (const container of containers) {
      const containerItems = items.filter(item => item.data.containerId === container.id);
      const actualItemCount = containerItems.length;
      const actualValue = containerItems.reduce((sum, item) => sum + (item.data.value || 0), 0);

      // Check item count consistency
      if (container.itemCount !== actualItemCount) {
        inconsistencies.push({
          type: 'item_count_mismatch',
          containerId: container.id,
          containerName: container.name,
          expected: container.itemCount,
          actual: actualItemCount,
          severity: 'high'
        });
      }

      // Check estimated value consistency (allow small rounding differences)
      const valueDifference = Math.abs(container.estimatedValue - actualValue);
      if (valueDifference > 0.01) {
        inconsistencies.push({
          type: 'value_mismatch',
          containerId: container.id,
          containerName: container.name,
          expected: container.estimatedValue,
          actual: actualValue,
          difference: valueDifference,
          severity: 'medium'
        });
      }

      // Check location consistency for items in container
      for (const item of containerItems) {
        if (item.data.locationId !== container.locationId) {
          inconsistencies.push({
            type: 'location_mismatch',
            itemId: item.sk,
            itemName: item.data.name,
            containerId: container.id,
            containerName: container.name,
            itemLocation: item.data.locationId,
            containerLocation: container.locationId,
            severity: 'high'
          });
        }
      }
    }

    // Check for orphaned items (items with containerId but container doesn't exist)
    const containerIds = new Set(containers.map(c => c.id));
    const orphanedItems = items.filter(item => 
      item.data.containerId && !containerIds.has(item.data.containerId)
    );

    for (const item of orphanedItems) {
      inconsistencies.push({
        type: 'orphaned_item',
        itemId: item.sk,
        itemName: item.data.name,
        containerId: item.data.containerId,
        severity: 'high'
      });
    }

    // Log the validation
    await logDataAccess(userId, 'validate', 'data_consistency', inventoryId, inventoryId);

    return {
      isConsistent: inconsistencies.length === 0,
      inconsistencies,
      summary: {
        totalItems,
        totalContainers,
        inconsistencyCount: inconsistencies.length,
        highSeverity: inconsistencies.filter(i => i.severity === 'high').length,
        mediumSeverity: inconsistencies.filter(i => i.severity === 'medium').length,
        lowSeverity: inconsistencies.filter(i => i.severity === 'low').length
      }
    };
  }

  /**
   * Resolve data inconsistencies automatically where possible
   * @param {string} inventoryId - Inventory ID
   * @param {object[]} inconsistencies - Array of inconsistencies to resolve
   * @param {string} userId - User ID performing resolution
   * @returns {Promise<object>} Resolution result
   */
  async resolveInconsistencies(inventoryId, inconsistencies, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const resolved = [];
    const failed = [];
    const updates = [];

    for (const inconsistency of inconsistencies) {
      try {
        switch (inconsistency.type) {
          case 'item_count_mismatch':
            await this._resolveItemCountMismatch(inconsistency, inventoryId, updates);
            resolved.push(inconsistency);
            break;

          case 'value_mismatch':
            await this._resolveValueMismatch(inconsistency, inventoryId, updates);
            resolved.push(inconsistency);
            break;

          case 'location_mismatch':
            await this._resolveLocationMismatch(inconsistency, inventoryId, updates);
            resolved.push(inconsistency);
            break;

          case 'orphaned_item':
            await this._resolveOrphanedItem(inconsistency, inventoryId, updates);
            resolved.push(inconsistency);
            break;

          default:
            failed.push({
              ...inconsistency,
              reason: 'Unknown inconsistency type'
            });
        }
      } catch (error) {
        failed.push({
          ...inconsistency,
          reason: error.message
        });
      }
    }

    // Execute all updates in batches
    if (updates.length > 0) {
      const transactItems = updates.map(update => ({
        Put: {
          TableName: TABLE_NAME,
          Item: update
        }
      }));

      const batches = this._chunkArray(transactItems, 25);
      
      for (const batch of batches) {
        await docClient.send(new TransactWriteCommand({
          TransactItems: batch
        }));
      }
    }

    // Log the resolution
    await logSyncOperation(userId, 'resolve_inconsistencies', inventoryId, {
      totalInconsistencies: inconsistencies.length,
      resolved: resolved.length,
      failed: failed.length,
      updatesApplied: updates.length
    });

    return {
      resolved,
      failed,
      updatesApplied: updates.length,
      summary: {
        total: inconsistencies.length,
        resolved: resolved.length,
        failed: failed.length,
        successRate: ((resolved.length / inconsistencies.length) * 100).toFixed(1)
      }
    };
  }

  /**
   * Detect concurrent update conflicts
   * @param {string} entityType - Type of entity (item, container)
   * @param {string} entityId - Entity ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} expectedVersion - Expected version/timestamp
   * @returns {Promise<object|null>} Conflict details or null if no conflict
   */
  async detectConcurrentUpdateConflict(entityType, entityId, inventoryId, expectedVersion) {
    let pk;
    switch (entityType) {
      case 'item':
        pk = `INVENTORY#${inventoryId}#THINGS`;
        break;
      case 'container':
        pk = `INVENTORY#${inventoryId}#CONTAINERS`;
        break;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }

    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk, sk: entityId }
    }));

    if (!result.Item) {
      return {
        type: 'entity_not_found',
        entityType,
        entityId,
        message: `${entityType} ${entityId} not found`
      };
    }

    const currentVersion = result.Item.updatedAt || result.Item.createdAt;
    if (currentVersion !== expectedVersion) {
      return {
        type: 'concurrent_update',
        entityType,
        entityId,
        expectedVersion,
        currentVersion,
        message: `${entityType} ${entityId} was modified by another user`
      };
    }

    return null;
  }

  /**
   * Resolve concurrent update conflicts using merge strategies
   * @param {object} conflict - Conflict details
   * @param {object} localChanges - Local changes to apply
   * @param {string} strategy - Resolution strategy ('merge', 'overwrite', 'reject')
   * @param {string} userId - User ID performing resolution
   * @returns {Promise<object>} Resolution result
   */
  async resolveConcurrentUpdateConflict(conflict, localChanges, strategy, userId) {
    const { entityType, entityId, inventoryId } = conflict;

    // Get current entity state
    let pk;
    switch (entityType) {
      case 'item':
        pk = `INVENTORY#${inventoryId}#THINGS`;
        break;
      case 'container':
        pk = `INVENTORY#${inventoryId}#CONTAINERS`;
        break;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }

    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk, sk: entityId }
    }));

    if (!result.Item) {
      throw new Error(`${entityType} ${entityId} not found`);
    }

    const currentEntity = result.Item;
    let resolvedEntity;

    switch (strategy) {
      case 'merge':
        resolvedEntity = this._mergeEntityChanges(currentEntity, localChanges);
        break;
      case 'overwrite':
        resolvedEntity = { ...currentEntity, ...localChanges };
        break;
      case 'reject':
        return {
          success: false,
          message: 'Local changes rejected due to conflict',
          currentEntity
        };
      default:
        throw new Error(`Unsupported resolution strategy: ${strategy}`);
    }

    // Update entity with resolved changes
    resolvedEntity.updatedAt = new Date().toISOString();
    resolvedEntity.resolvedConflictAt = new Date().toISOString();

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: resolvedEntity
    }));

    // Log the conflict resolution
    await logSyncOperation(userId, 'resolve_conflict', inventoryId, {
      entityType,
      entityId,
      strategy,
      conflictType: conflict.type
    });

    return {
      success: true,
      resolvedEntity,
      strategy,
      message: `Conflict resolved using ${strategy} strategy`
    };
  }

  // Private helper methods

  /**
   * Detect location conflicts for an item
   * @param {object} item - Item object
   * @param {string} newLocationId - New location ID
   * @param {string} inventoryId - Inventory ID
   * @returns {Promise<object|null>} Conflict details or null
   * @private
   */
  async _detectLocationConflict(item, newLocationId, inventoryId) {
    // For now, we'll implement basic conflict detection
    // Future enhancements could include location capacity checks, etc.
    
    // Check if location exists
    const locationResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `INVENTORY#${inventoryId}#LOCATIONS`,
        sk: newLocationId
      }
    }));

    if (!locationResult.Item) {
      return {
        type: 'location_not_found',
        itemId: item.sk,
        locationId: newLocationId,
        message: `Location ${newLocationId} not found`
      };
    }

    return null; // No conflict detected
  }

  /**
   * Get container by ID
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @returns {Promise<object|null>} Container or null
   * @private
   */
  async _getContainer(containerId, inventoryId) {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `INVENTORY#${inventoryId}#CONTAINERS`,
        sk: containerId
      }
    }));

    return result.Item || null;
  }

  /**
   * Get item by ID
   * @param {string} itemId - Item ID
   * @param {string} inventoryId - Inventory ID
   * @returns {Promise<object|null>} Item or null
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

    return result.Item || null;
  }

  /**
   * Resolve item count mismatch
   * @param {object} inconsistency - Inconsistency details
   * @param {string} inventoryId - Inventory ID
   * @param {object[]} updates - Array to collect updates
   * @private
   */
  async _resolveItemCountMismatch(inconsistency, inventoryId, updates) {
    const container = await this._getContainer(inconsistency.containerId, inventoryId);
    if (container) {
      container.itemCount = inconsistency.actual;
      container.updatedAt = new Date().toISOString();
      updates.push(container);
    }
  }

  /**
   * Resolve value mismatch
   * @param {object} inconsistency - Inconsistency details
   * @param {string} inventoryId - Inventory ID
   * @param {object[]} updates - Array to collect updates
   * @private
   */
  async _resolveValueMismatch(inconsistency, inventoryId, updates) {
    const container = await this._getContainer(inconsistency.containerId, inventoryId);
    if (container) {
      container.estimatedValue = inconsistency.actual;
      container.updatedAt = new Date().toISOString();
      updates.push(container);
    }
  }

  /**
   * Resolve location mismatch
   * @param {object} inconsistency - Inconsistency details
   * @param {string} inventoryId - Inventory ID
   * @param {object[]} updates - Array to collect updates
   * @private
   */
  async _resolveLocationMismatch(inconsistency, inventoryId, updates) {
    const item = await this._getItem(inconsistency.itemId, inventoryId);
    if (item) {
      item.data.locationId = inconsistency.containerLocation;
      item.data.updatedAt = new Date().toISOString();
      updates.push(item);
    }
  }

  /**
   * Resolve orphaned item
   * @param {object} inconsistency - Inconsistency details
   * @param {string} inventoryId - Inventory ID
   * @param {object[]} updates - Array to collect updates
   * @private
   */
  async _resolveOrphanedItem(inconsistency, inventoryId, updates) {
    const item = await this._getItem(inconsistency.itemId, inventoryId);
    if (item) {
      // Remove container reference and restore previous location
      item.data.containerId = null;
      item.data.packedAt = null;
      if (item.data.previousLocationId) {
        item.data.locationId = item.data.previousLocationId;
        item.data.previousLocationId = null;
      }
      item.data.updatedAt = new Date().toISOString();
      updates.push(item);
    }
  }

  /**
   * Merge entity changes intelligently
   * @param {object} currentEntity - Current entity state
   * @param {object} localChanges - Local changes to merge
   * @returns {object} Merged entity
   * @private
   */
  _mergeEntityChanges(currentEntity, localChanges) {
    // Simple merge strategy - can be enhanced with field-specific logic
    const merged = { ...currentEntity };
    
    // Merge non-conflicting fields
    Object.keys(localChanges).forEach(key => {
      if (key !== 'updatedAt' && key !== 'createdAt') {
        merged[key] = localChanges[key];
      }
    });

    return merged;
  }

  /**
   * Split array into chunks
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array[]} Array of chunks
   * @private
   */
  _chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

module.exports = new DataSynchronizationService();