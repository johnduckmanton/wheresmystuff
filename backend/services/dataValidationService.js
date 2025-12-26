const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { logDataValidation } = require('./auditLogService');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Data Validation Service
 * Provides tools for detecting and correcting data inconsistencies in the moving system
 */
class DataValidationService {
  /**
   * Validate container-item consistency
   * @param {string} inventoryId - Inventory ID to validate
   * @param {string} userId - User performing validation
   * @returns {Promise<object>} Validation results with inconsistencies found
   */
  async validateContainerItemConsistency(inventoryId, userId) {
    const inconsistencies = [];
    
    try {
      // Get all containers in the inventory
      const containersResponse = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `INV#${inventoryId}`,
          ':sk': 'CONTAINER#'
        }
      }));
      
      const containers = containersResponse.Items || [];
      
      // Get all items in the inventory
      const itemsResponse = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `INV#${inventoryId}`,
          ':sk': 'THING#'
        }
      }));
      
      const items = itemsResponse.Items || [];
      
      // Check for orphaned items (items with containerId but container doesn't exist)
      const containerIds = new Set(containers.map(c => c.id));
      const orphanedItems = items.filter(item => 
        item.containerId && !containerIds.has(item.containerId)
      );
      
      if (orphanedItems.length > 0) {
        inconsistencies.push({
          type: 'orphaned_items',
          description: 'Items reference containers that no longer exist',
          count: orphanedItems.length,
          items: orphanedItems.map(item => ({
            id: item.id,
            name: item.name,
            containerId: item.containerId
          }))
        });
      }
      
      // Check for container item count mismatches
      const itemsByContainer = {};
      items.forEach(item => {
        if (item.containerId) {
          if (!itemsByContainer[item.containerId]) {
            itemsByContainer[item.containerId] = [];
          }
          itemsByContainer[item.containerId].push(item);
        }
      });
      
      const containerMismatches = [];
      containers.forEach(container => {
        const actualItemCount = itemsByContainer[container.id]?.length || 0;
        const recordedItemCount = container.itemCount || 0;
        
        if (actualItemCount !== recordedItemCount) {
          containerMismatches.push({
            containerId: container.id,
            containerName: container.name,
            recordedCount: recordedItemCount,
            actualCount: actualItemCount,
            difference: actualItemCount - recordedItemCount
          });
        }
      });
      
      if (containerMismatches.length > 0) {
        inconsistencies.push({
          type: 'container_count_mismatch',
          description: 'Container item counts do not match actual items',
          count: containerMismatches.length,
          containers: containerMismatches
        });
      }
      
      // Check for location inconsistencies (items in containers but different locations)
      const locationInconsistencies = [];
      containers.forEach(container => {
        const containerItems = itemsByContainer[container.id] || [];
        const itemsWithWrongLocation = containerItems.filter(item => 
          item.locationId && container.locationId && item.locationId !== container.locationId
        );
        
        if (itemsWithWrongLocation.length > 0) {
          locationInconsistencies.push({
            containerId: container.id,
            containerName: container.name,
            containerLocation: container.locationId,
            items: itemsWithWrongLocation.map(item => ({
              id: item.id,
              name: item.name,
              itemLocation: item.locationId
            }))
          });
        }
      });
      
      if (locationInconsistencies.length > 0) {
        inconsistencies.push({
          type: 'location_inconsistency',
          description: 'Items in containers have different locations than their containers',
          count: locationInconsistencies.length,
          containers: locationInconsistencies
        });
      }
      
      const validationResult = {
        inventoryId,
        timestamp: new Date().toISOString(),
        totalInconsistencies: inconsistencies.length,
        inconsistencies,
        summary: {
          orphanedItems: orphanedItems.length,
          containerCountMismatches: containerMismatches.length,
          locationInconsistencies: locationInconsistencies.length
        }
      };
      
      // Log the validation
      await logDataValidation(userId, 'validate_consistency', inventoryId, {
        totalInconsistencies: inconsistencies.length,
        inconsistencyTypes: inconsistencies.map(i => i.type),
        summary: validationResult.summary
      });
      
      return validationResult;
      
    } catch (error) {
      console.error('Error validating container-item consistency:', error);
      
      await logDataValidation(userId, 'validate_consistency', inventoryId, {
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Correct orphaned items by removing their container references
   * @param {string} inventoryId - Inventory ID
   * @param {string[]} itemIds - Array of item IDs to correct
   * @param {string} userId - User performing correction
   * @returns {Promise<object>} Correction results
   */
  async correctOrphanedItems(inventoryId, itemIds, userId) {
    if (!itemIds || itemIds.length === 0) {
      throw new Error('No items specified for correction');
    }
    
    const correctedItems = [];
    const errors = [];
    
    try {
      // Process items in batches of 25 (DynamoDB batch limit)
      for (let i = 0; i < itemIds.length; i += 25) {
        const batch = itemIds.slice(i, i + 25);
        const writeRequests = [];
        
        for (const itemId of batch) {
          writeRequests.push({
            Update: {
              TableName: TABLE_NAME,
              Key: {
                pk: `INV#${inventoryId}`,
                sk: `THING#${itemId}`
              },
              UpdateExpression: 'REMOVE containerId, packedAt SET updatedAt = :updatedAt, updatedBy = :updatedBy',
              ExpressionAttributeValues: {
                ':updatedAt': new Date().toISOString(),
                ':updatedBy': userId
              },
              ConditionExpression: 'attribute_exists(pk)'
            }
          });
        }
        
        if (writeRequests.length > 0) {
          await docClient.send(new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: writeRequests
            }
          }));
          
          correctedItems.push(...batch);
        }
      }
      
      const result = {
        inventoryId,
        correctedItemsCount: correctedItems.length,
        correctedItems,
        errors,
        timestamp: new Date().toISOString()
      };
      
      // Log the correction
      await logDataValidation(userId, 'correct_orphaned_items', inventoryId, {
        correctedItemsCount: correctedItems.length,
        itemIds: correctedItems,
        errorsCount: errors.length
      });
      
      return result;
      
    } catch (error) {
      console.error('Error correcting orphaned items:', error);
      
      await logDataValidation(userId, 'correct_orphaned_items', inventoryId, {
        success: false,
        error: error.message,
        attemptedItemsCount: itemIds.length
      });
      
      throw error;
    }
  }
  
  /**
   * Correct container item count mismatches
   * @param {string} inventoryId - Inventory ID
   * @param {string[]} containerIds - Array of container IDs to correct
   * @param {string} userId - User performing correction
   * @returns {Promise<object>} Correction results
   */
  async correctContainerCounts(inventoryId, containerIds, userId) {
    if (!containerIds || containerIds.length === 0) {
      throw new Error('No containers specified for correction');
    }
    
    const correctedContainers = [];
    const errors = [];
    
    try {
      for (const containerId of containerIds) {
        try {
          // Get actual item count for this container
          const itemsResponse = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'ContainerItemsIndex',
            KeyConditionExpression: 'containerId = :containerId',
            ExpressionAttributeValues: {
              ':containerId': containerId
            },
            Select: 'COUNT'
          }));
          
          const actualCount = itemsResponse.Count || 0;
          
          // Update container with correct count
          await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              pk: `INV#${inventoryId}`,
              sk: `CONTAINER#${containerId}`
            },
            UpdateExpression: 'SET itemCount = :itemCount, updatedAt = :updatedAt, updatedBy = :updatedBy',
            ExpressionAttributeValues: {
              ':itemCount': actualCount,
              ':updatedAt': new Date().toISOString(),
              ':updatedBy': userId
            },
            ConditionExpression: 'attribute_exists(pk)'
          }));
          
          correctedContainers.push({
            containerId,
            correctedCount: actualCount
          });
          
        } catch (error) {
          errors.push({
            containerId,
            error: error.message
          });
        }
      }
      
      const result = {
        inventoryId,
        correctedContainersCount: correctedContainers.length,
        correctedContainers,
        errors,
        timestamp: new Date().toISOString()
      };
      
      // Log the correction
      await logDataValidation(userId, 'correct_container_counts', inventoryId, {
        correctedContainersCount: correctedContainers.length,
        containerIds: correctedContainers.map(c => c.containerId),
        errorsCount: errors.length
      });
      
      return result;
      
    } catch (error) {
      console.error('Error correcting container counts:', error);
      
      await logDataValidation(userId, 'correct_container_counts', inventoryId, {
        success: false,
        error: error.message,
        attemptedContainersCount: containerIds.length
      });
      
      throw error;
    }
  }
  
  /**
   * Correct location inconsistencies by updating item locations to match their containers
   * @param {string} inventoryId - Inventory ID
   * @param {string[]} containerIds - Array of container IDs to correct
   * @param {string} userId - User performing correction
   * @returns {Promise<object>} Correction results
   */
  async correctLocationInconsistencies(inventoryId, containerIds, userId) {
    if (!containerIds || containerIds.length === 0) {
      throw new Error('No containers specified for correction');
    }
    
    const correctedItems = [];
    const errors = [];
    
    try {
      for (const containerId of containerIds) {
        try {
          // Get container location
          const containerResponse = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'pk = :pk AND sk = :sk',
            ExpressionAttributeValues: {
              ':pk': `INV#${inventoryId}`,
              ':sk': `CONTAINER#${containerId}`
            }
          }));
          
          const container = containerResponse.Items?.[0];
          if (!container) {
            errors.push({
              containerId,
              error: 'Container not found'
            });
            continue;
          }
          
          // Get items in this container
          const itemsResponse = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'ContainerItemsIndex',
            KeyConditionExpression: 'containerId = :containerId',
            ExpressionAttributeValues: {
              ':containerId': containerId
            }
          }));
          
          const items = itemsResponse.Items || [];
          const itemsToUpdate = items.filter(item => 
            item.locationId !== container.locationId
          );
          
          // Update item locations in batches
          for (let i = 0; i < itemsToUpdate.length; i += 25) {
            const batch = itemsToUpdate.slice(i, i + 25);
            const writeRequests = [];
            
            for (const item of batch) {
              writeRequests.push({
                Update: {
                  TableName: TABLE_NAME,
                  Key: {
                    pk: `INV#${inventoryId}`,
                    sk: `THING#${item.id}`
                  },
                  UpdateExpression: 'SET locationId = :locationId, updatedAt = :updatedAt, updatedBy = :updatedBy',
                  ExpressionAttributeValues: {
                    ':locationId': container.locationId,
                    ':updatedAt': new Date().toISOString(),
                    ':updatedBy': userId
                  },
                  ConditionExpression: 'attribute_exists(pk)'
                }
              });
            }
            
            if (writeRequests.length > 0) {
              await docClient.send(new BatchWriteCommand({
                RequestItems: {
                  [TABLE_NAME]: writeRequests
                }
              }));
              
              correctedItems.push(...batch.map(item => ({
                itemId: item.id,
                itemName: item.name,
                containerId,
                oldLocation: item.locationId,
                newLocation: container.locationId
              })));
            }
          }
          
        } catch (error) {
          errors.push({
            containerId,
            error: error.message
          });
        }
      }
      
      const result = {
        inventoryId,
        correctedItemsCount: correctedItems.length,
        correctedItems,
        errors,
        timestamp: new Date().toISOString()
      };
      
      // Log the correction
      await logDataValidation(userId, 'correct_location_inconsistencies', inventoryId, {
        correctedItemsCount: correctedItems.length,
        containerIds,
        errorsCount: errors.length
      });
      
      return result;
      
    } catch (error) {
      console.error('Error correcting location inconsistencies:', error);
      
      await logDataValidation(userId, 'correct_location_inconsistencies', inventoryId, {
        success: false,
        error: error.message,
        attemptedContainersCount: containerIds.length
      });
      
      throw error;
    }
  }
}

module.exports = new DataValidationService();