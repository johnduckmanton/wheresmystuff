const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, BatchWriteCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { Container, ContainerType, ContainerStatus } = require('../models/container');
const { hasInventoryAccess } = require('./dynamodb');
const { logDataAccess, logMigrationOperation } = require('./auditLogService');
const containerService = require('./containerService');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) {
  throw new Error('TABLE_NAME environment variable is required');
}

/**
 * Data Migration Service
 * Handles migration of existing inventory data to support moving & storage features
 */
class DataMigrationService {
  /**
   * Migrate existing inventory to support container features
   * @param {string} inventoryId - Inventory ID to migrate
   * @param {string} userId - User ID performing the migration
   * @param {object} options - Migration options
   * @returns {Promise<object>} Migration result
   */
  async migrateInventoryToContainerSupport(inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const {
      createDefaultContainers = true,
      groupByLocation = true,
      groupByCategory = false,
      maxItemsPerContainer = 50,
      dryRun = false
    } = options;

    const migrationResult = {
      inventoryId,
      startTime: new Date().toISOString(),
      dryRun,
      summary: {
        totalItems: 0,
        itemsProcessed: 0,
        containersCreated: 0,
        itemsAssigned: 0,
        errors: []
      },
      containers: [],
      itemUpdates: [],
      errors: []
    };

    try {
      // Get all items in the inventory
      const itemsResult = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `INVENTORY#${inventoryId}#THINGS`
        }
      }));

      const items = itemsResult.Items || [];
      migrationResult.summary.totalItems = items.length;

      // Filter items that don't already have containers
      const unpackedItems = items.filter(item => !item.data.containerId);
      
      if (unpackedItems.length === 0) {
        migrationResult.summary.message = 'No items need migration - all items already have container assignments';
        return migrationResult;
      }

      // Group items for container creation
      const itemGroups = this._groupItemsForContainers(unpackedItems, {
        groupByLocation,
        groupByCategory,
        maxItemsPerContainer
      });

      // Create containers and assign items
      for (const group of itemGroups) {
        try {
          const containerData = this._createContainerFromGroup(group, inventoryId, userId);
          
          if (!dryRun) {
            // Create the container
            const container = await containerService.createContainer(containerData, userId);
            migrationResult.containers.push(container);
            migrationResult.summary.containersCreated++;

            // Assign items to the container
            const itemIds = group.items.map(item => item.sk);
            const assignmentResult = await this._assignItemsToContainer(
              container.id,
              inventoryId,
              group.items,
              userId
            );

            migrationResult.itemUpdates.push(...assignmentResult.updates);
            migrationResult.summary.itemsAssigned += assignmentResult.updates.length;
          } else {
            // Dry run - just record what would be created
            migrationResult.containers.push({
              ...containerData,
              id: `DRY_RUN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              itemCount: group.items.length,
              estimatedValue: group.items.reduce((sum, item) => sum + (item.data.value || 0), 0)
            });
            migrationResult.summary.containersCreated++;
            migrationResult.summary.itemsAssigned += group.items.length;
          }

          migrationResult.summary.itemsProcessed += group.items.length;
        } catch (error) {
          const errorInfo = {
            type: 'container_creation_error',
            group: group.name,
            itemCount: group.items.length,
            error: error.message
          };
          migrationResult.errors.push(errorInfo);
          migrationResult.summary.errors.push(errorInfo);
        }
      }

      migrationResult.endTime = new Date().toISOString();
      migrationResult.duration = new Date(migrationResult.endTime) - new Date(migrationResult.startTime);

      // Log the migration
      if (!dryRun) {
        await logMigrationOperation(userId, 'inventory_container_migration', inventoryId, {
          totalItems: migrationResult.summary.totalItems,
          itemsProcessed: migrationResult.summary.itemsProcessed,
          containersCreated: migrationResult.summary.containersCreated,
          itemsAssigned: migrationResult.summary.itemsAssigned,
          errors: migrationResult.errors.length
        });
      }

      return migrationResult;
    } catch (error) {
      migrationResult.errors.push({
        type: 'migration_error',
        error: error.message
      });
      migrationResult.endTime = new Date().toISOString();
      throw error;
    }
  }

  /**
   * Create containers from existing items grouped by location
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID performing the operation
   * @param {object} options - Creation options
   * @returns {Promise<object>} Creation result
   */
  async createContainersFromLocations(inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const {
      containerPrefix = 'Location Container',
      maxItemsPerContainer = 50,
      dryRun = false
    } = options;

    // Get all locations
    const locationsResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#LOCATIONS`
      }
    }));

    const locations = locationsResult.Items || [];
    const results = [];

    for (const location of locations) {
      try {
        // Get items at this location that don't have containers
        const itemsResult = await docClient.send(new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'pk = :pk',
          FilterExpression: 'locationId = :locationId AND attribute_not_exists(containerId)',
          ExpressionAttributeValues: {
            ':pk': `INVENTORY#${inventoryId}#THINGS`,
            ':locationId': location.sk
          }
        }));

        const items = itemsResult.Items || [];
        
        if (items.length === 0) {
          continue;
        }

        // Create containers for this location
        const containerGroups = this._chunkArray(items, maxItemsPerContainer);
        const locationContainers = [];

        for (let i = 0; i < containerGroups.length; i++) {
          const group = containerGroups[i];
          const containerName = containerGroups.length > 1 
            ? `${containerPrefix} - ${location.data.name} (${i + 1})`
            : `${containerPrefix} - ${location.data.name}`;

          const containerData = {
            inventoryId,
            name: containerName,
            type: ContainerType.BOX,
            description: `Auto-generated container for items at ${location.data.name}`,
            locationId: location.sk,
            status: ContainerStatus.PACKED
          };

          if (!dryRun) {
            const container = await containerService.createContainer(containerData, userId);
            
            // Assign items to container
            const assignmentResult = await this._assignItemsToContainer(
              container.id,
              inventoryId,
              group,
              userId
            );

            locationContainers.push({
              container,
              itemsAssigned: assignmentResult.updates.length
            });
          } else {
            locationContainers.push({
              container: {
                ...containerData,
                id: `DRY_RUN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                itemCount: group.length,
                estimatedValue: group.reduce((sum, item) => sum + (item.data.value || 0), 0)
              },
              itemsAssigned: group.length
            });
          }
        }

        results.push({
          location: {
            id: location.sk,
            name: location.data.name
          },
          totalItems: items.length,
          containers: locationContainers
        });
      } catch (error) {
        results.push({
          location: {
            id: location.sk,
            name: location.data.name
          },
          error: error.message
        });
      }
    }

    // Log the operation
    if (!dryRun) {
      await logMigrationOperation(userId, 'create_containers_from_locations', inventoryId, {
        locationsProcessed: locations.length,
        containersCreated: results.reduce((sum, r) => sum + (r.containers?.length || 0), 0),
        totalItemsAssigned: results.reduce((sum, r) => 
          sum + (r.containers?.reduce((s, c) => s + c.itemsAssigned, 0) || 0), 0
        )
      });
    }

    return {
      results,
      summary: {
        locationsProcessed: locations.length,
        containersCreated: results.reduce((sum, r) => sum + (r.containers?.length || 0), 0),
        totalItemsAssigned: results.reduce((sum, r) => 
          sum + (r.containers?.reduce((s, c) => s + c.itemsAssigned, 0) || 0), 0
        ),
        errors: results.filter(r => r.error).length
      }
    };
  }

  /**
   * Bulk create containers from a list of specifications
   * @param {string} inventoryId - Inventory ID
   * @param {object[]} containerSpecs - Array of container specifications
   * @param {string} userId - User ID performing the operation
   * @returns {Promise<object>} Creation result
   */
  async bulkCreateContainers(inventoryId, containerSpecs, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    if (!Array.isArray(containerSpecs) || containerSpecs.length === 0) {
      throw new Error('Container specifications must be a non-empty array');
    }

    if (containerSpecs.length > 100) {
      throw new Error('Cannot create more than 100 containers at once');
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const spec of containerSpecs) {
      try {
        // Validate container specification
        const validation = this._validateContainerSpec(spec);
        if (!validation.isValid) {
          results.push({
            spec,
            success: false,
            error: `Validation failed: ${validation.errors.join(', ')}`
          });
          errorCount++;
          continue;
        }

        // Create container
        const containerData = {
          inventoryId,
          ...spec
        };

        const container = await containerService.createContainer(containerData, userId);
        
        results.push({
          spec,
          success: true,
          container
        });
        successCount++;
      } catch (error) {
        results.push({
          spec,
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }

    // Log the bulk creation
    await logMigrationOperation(userId, 'bulk_create_containers', inventoryId, {
      totalSpecs: containerSpecs.length,
      successCount,
      errorCount
    });

    return {
      results,
      summary: {
        total: containerSpecs.length,
        successful: successCount,
        failed: errorCount,
        successRate: ((successCount / containerSpecs.length) * 100).toFixed(1)
      }
    };
  }

  /**
   * Validate and cleanup existing data
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID performing the operation
   * @param {object} options - Cleanup options
   * @returns {Promise<object>} Cleanup result
   */
  async validateAndCleanupData(inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const {
      fixOrphanedItems = true,
      updateContainerCounts = true,
      removeEmptyContainers = false,
      dryRun = false
    } = options;

    const cleanupResult = {
      inventoryId,
      startTime: new Date().toISOString(),
      dryRun,
      actions: [],
      summary: {
        orphanedItemsFixed: 0,
        containerCountsUpdated: 0,
        emptyContainersRemoved: 0,
        errors: 0
      }
    };

    try {
      // Get all containers and items
      const [containersResult, itemsResult] = await Promise.all([
        docClient.send(new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: {
            ':pk': `INVENTORY#${inventoryId}#CONTAINERS`
          }
        })),
        docClient.send(new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: {
            ':pk': `INVENTORY#${inventoryId}#THINGS`
          }
        }))
      ]);

      const containers = containersResult.Items || [];
      const items = itemsResult.Items || [];

      // Create lookup maps
      const containerMap = new Map(containers.map(c => [c.id, c]));
      const itemsByContainer = new Map();

      // Group items by container
      for (const item of items) {
        const containerId = item.data.containerId;
        if (containerId) {
          if (!itemsByContainer.has(containerId)) {
            itemsByContainer.set(containerId, []);
          }
          itemsByContainer.get(containerId).push(item);
        }
      }

      // Fix orphaned items
      if (fixOrphanedItems) {
        const orphanedItems = items.filter(item => 
          item.data.containerId && !containerMap.has(item.data.containerId)
        );

        for (const item of orphanedItems) {
          const action = {
            type: 'fix_orphaned_item',
            itemId: item.sk,
            itemName: item.data.name,
            orphanedContainerId: item.data.containerId
          };

          if (!dryRun) {
            // Remove container reference and restore previous location
            const updatedItem = {
              ...item,
              data: {
                ...item.data,
                containerId: null,
                packedAt: null,
                locationId: item.data.previousLocationId || item.data.locationId,
                previousLocationId: null,
                updatedAt: new Date().toISOString()
              }
            };

            await docClient.send(new PutCommand({
              TableName: TABLE_NAME,
              Item: updatedItem
            }));

            action.fixed = true;
          } else {
            action.wouldFix = true;
          }

          cleanupResult.actions.push(action);
          cleanupResult.summary.orphanedItemsFixed++;
        }
      }

      // Update container counts
      if (updateContainerCounts) {
        for (const container of containers) {
          const containerItems = itemsByContainer.get(container.id) || [];
          const actualCount = containerItems.length;
          const actualValue = containerItems.reduce((sum, item) => sum + (item.data.value || 0), 0);

          if (container.itemCount !== actualCount || Math.abs(container.estimatedValue - actualValue) > 0.01) {
            const action = {
              type: 'update_container_counts',
              containerId: container.id,
              containerName: container.name,
              oldCount: container.itemCount,
              newCount: actualCount,
              oldValue: container.estimatedValue,
              newValue: actualValue
            };

            if (!dryRun) {
              const updatedContainer = {
                ...container,
                itemCount: actualCount,
                estimatedValue: actualValue,
                updatedAt: new Date().toISOString()
              };

              await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: updatedContainer
              }));

              action.updated = true;
            } else {
              action.wouldUpdate = true;
            }

            cleanupResult.actions.push(action);
            cleanupResult.summary.containerCountsUpdated++;
          }
        }
      }

      // Remove empty containers
      if (removeEmptyContainers) {
        const emptyContainers = containers.filter(container => {
          const containerItems = itemsByContainer.get(container.id) || [];
          return containerItems.length === 0;
        });

        for (const container of emptyContainers) {
          const action = {
            type: 'remove_empty_container',
            containerId: container.id,
            containerName: container.name
          };

          if (!dryRun) {
            await docClient.send(new DeleteCommand({
              TableName: TABLE_NAME,
              Key: {
                pk: `INVENTORY#${inventoryId}#CONTAINERS`,
                sk: container.id
              }
            }));

            action.removed = true;
          } else {
            action.wouldRemove = true;
          }

          cleanupResult.actions.push(action);
          cleanupResult.summary.emptyContainersRemoved++;
        }
      }

      cleanupResult.endTime = new Date().toISOString();

      // Log the cleanup
      if (!dryRun) {
        await logMigrationOperation(userId, 'data_cleanup', inventoryId, {
          orphanedItemsFixed: cleanupResult.summary.orphanedItemsFixed,
          containerCountsUpdated: cleanupResult.summary.containerCountsUpdated,
          emptyContainersRemoved: cleanupResult.summary.emptyContainersRemoved
        });
      }

      return cleanupResult;
    } catch (error) {
      cleanupResult.error = error.message;
      cleanupResult.endTime = new Date().toISOString();
      throw error;
    }
  }

  // Private helper methods

  /**
   * Group items for container creation
   * @param {object[]} items - Array of items
   * @param {object} options - Grouping options
   * @returns {object[]} Array of item groups
   * @private
   */
  _groupItemsForContainers(items, options) {
    const { groupByLocation, groupByCategory, maxItemsPerContainer } = options;
    const groups = [];

    if (groupByLocation) {
      // Group by location
      const locationGroups = new Map();
      
      for (const item of items) {
        const locationId = item.data.locationId || 'no-location';
        if (!locationGroups.has(locationId)) {
          locationGroups.set(locationId, []);
        }
        locationGroups.get(locationId).push(item);
      }

      for (const [locationId, locationItems] of locationGroups) {
        // Split large groups into smaller containers
        const chunks = this._chunkArray(locationItems, maxItemsPerContainer);
        
        chunks.forEach((chunk, index) => {
          groups.push({
            name: chunks.length > 1 
              ? `Location ${locationId} Container ${index + 1}`
              : `Location ${locationId} Container`,
            type: 'location',
            locationId: locationId !== 'no-location' ? locationId : null,
            items: chunk
          });
        });
      }
    } else if (groupByCategory) {
      // Group by category
      const categoryGroups = new Map();
      
      for (const item of items) {
        const categoryId = item.data.categoryId || 'no-category';
        if (!categoryGroups.has(categoryId)) {
          categoryGroups.set(categoryId, []);
        }
        categoryGroups.get(categoryId).push(item);
      }

      for (const [categoryId, categoryItems] of categoryGroups) {
        const chunks = this._chunkArray(categoryItems, maxItemsPerContainer);
        
        chunks.forEach((chunk, index) => {
          groups.push({
            name: chunks.length > 1 
              ? `Category ${categoryId} Container ${index + 1}`
              : `Category ${categoryId} Container`,
            type: 'category',
            categoryId: categoryId !== 'no-category' ? categoryId : null,
            items: chunk
          });
        });
      }
    } else {
      // Create general containers
      const chunks = this._chunkArray(items, maxItemsPerContainer);
      
      chunks.forEach((chunk, index) => {
        groups.push({
          name: chunks.length > 1 
            ? `Migration Container ${index + 1}`
            : `Migration Container`,
          type: 'general',
          items: chunk
        });
      });
    }

    return groups;
  }

  /**
   * Create container data from item group
   * @param {object} group - Item group
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @returns {object} Container data
   * @private
   */
  _createContainerFromGroup(group, inventoryId, userId) {
    const totalValue = group.items.reduce((sum, item) => sum + (item.data.value || 0), 0);
    
    // Determine location - use most common location in the group
    let locationId = null;
    if (group.locationId) {
      locationId = group.locationId;
    } else {
      const locationCounts = new Map();
      for (const item of group.items) {
        if (item.data.locationId) {
          locationCounts.set(item.data.locationId, (locationCounts.get(item.data.locationId) || 0) + 1);
        }
      }
      
      if (locationCounts.size > 0) {
        locationId = [...locationCounts.entries()].reduce((a, b) => a[1] > b[1] ? a : b)[0];
      }
    }

    return {
      inventoryId,
      name: group.name,
      type: ContainerType.BOX,
      description: `Auto-generated container from migration containing ${group.items.length} items`,
      locationId,
      status: ContainerStatus.PACKED,
      itemCount: group.items.length,
      estimatedValue: totalValue
    };
  }

  /**
   * Assign items to a container
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {object[]} items - Array of items
   * @param {string} userId - User ID
   * @returns {Promise<object>} Assignment result
   * @private
   */
  async _assignItemsToContainer(containerId, inventoryId, items, userId) {
    const updates = [];
    
    // Get container to use its location
    const container = await containerService.getContainer(containerId, inventoryId, userId);
    
    for (const item of items) {
      const updatedItem = {
        ...item,
        data: {
          ...item.data,
          containerId,
          packedAt: new Date().toISOString(),
          previousLocationId: item.data.locationId,
          locationId: container.locationId,
          updatedAt: new Date().toISOString()
        }
      };
      
      updates.push(updatedItem);
    }

    // Execute updates in batches
    const batches = this._chunkArray(updates, 25);
    
    for (const batch of batches) {
      const transactItems = batch.map(item => ({
        Put: {
          TableName: TABLE_NAME,
          Item: item
        }
      }));

      await docClient.send(new TransactWriteCommand({
        TransactItems: transactItems
      }));
    }

    return { updates };
  }

  /**
   * Validate container specification
   * @param {object} spec - Container specification
   * @returns {object} Validation result
   * @private
   */
  _validateContainerSpec(spec) {
    const errors = [];

    if (!spec.name || typeof spec.name !== 'string' || spec.name.trim().length === 0) {
      errors.push('Name is required and must be a non-empty string');
    }

    if (spec.type && !Object.values(ContainerType).includes(spec.type)) {
      errors.push(`Type must be one of: ${Object.values(ContainerType).join(', ')}`);
    }

    if (spec.status && !Object.values(ContainerStatus).includes(spec.status)) {
      errors.push(`Status must be one of: ${Object.values(ContainerStatus).join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
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

module.exports = new DataMigrationService();