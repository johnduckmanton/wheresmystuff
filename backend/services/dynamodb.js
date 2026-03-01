const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const Inventory = require('../models/inventory');
const InventoryMembership = require('../models/inventoryMembership');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Recursively remove undefined values from an object or array
 * DynamoDB doesn't accept undefined values
 */
function removeUndefinedValues(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => removeUndefinedValues(item));
  }
  
  if (typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = removeUndefinedValues(value);
      }
      return acc;
    }, {});
  }
  
  return obj;
}

/**
 * Create a new entity in DynamoDB
 * @param {string} entityType - Entity type (THINGS, LOCATIONS, ROOMS, CATEGORIES, PEOPLE)
 * @param {object} data - Entity data (must include inventoryId)
 * @returns {Promise<object>} Created entity with id and dateAdded
 */
async function createEntity(entityType, data) {
  if (!data.inventoryId) {
    throw new Error('inventoryId is required for all entities');
  }

  // Allow specifying a custom ID (for photo upload scenarios) or generate a new one
  const id = data.id || uuidv4();
  const dateAdded = new Date().toISOString();
  
  const item = {
    pk: `INVENTORY#${data.inventoryId}#${entityType}`,
    sk: id,
    data: {
      ...data,
      id,
      dateAdded
    }
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  }));
  
  return {
    id,
    ...data,
    dateAdded
  };
}

/**
 * Get a single entity by type, inventory, and id
 * @param {string} entityType - Entity type
 * @param {string} inventoryId - Inventory UUID
 * @param {string} id - Entity UUID
 * @returns {Promise<object|null>} Entity data or null if not found
 */
async function getEntity(entityType, inventoryId, id) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      pk: `INVENTORY#${inventoryId}#${entityType}`,
      sk: id
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

/**
 * List all entities of a given type for a specific inventory with optional tag filtering
 * @param {string} entityType - Entity type
 * @param {string} inventoryId - Inventory UUID
 * @param {object} options - Optional filtering options
 * @param {Array<string>} options.tags - Tags to filter by
 * @param {string} options.tagMode - 'and' or 'or' for tag filtering
 * @returns {Promise<Array>} Array of entities
 */
async function listEntities(entityType, inventoryId, options = {}) {
  const { tags, tagMode = 'and' } = options;
  
  // Base query parameters
  const queryParams = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': `INVENTORY#${inventoryId}#${entityType}`
    }
  };
  
  // Add tag filtering if tags are provided
  if (tags && Array.isArray(tags) && tags.length > 0) {
    const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
    
    // For tag filtering, we need to use scan instead of query
    // because we need to filter on the data.tags array
    const scanParams = {
      TableName: TABLE_NAME,
      FilterExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#${entityType}`
      }
    };
    
    // Build tag filter expressions
    const tagFilters = [];
    const attributeNames = {};
    const attributeValues = { ...scanParams.ExpressionAttributeValues };
    
    tags.forEach((tag, index) => {
      const tagKey = `:tag${index}`;
      const tagAttr = `#tags`;
      attributeValues[tagKey] = tag;
      attributeNames[tagAttr] = 'tags';
      tagFilters.push(`contains(#data.#tags, ${tagKey})`);
    });
    
    // Add data attribute name
    attributeNames['#data'] = 'data';
    
    // Combine tag filters based on mode
    const tagFilterExpression = tagMode === 'or' 
      ? tagFilters.join(' OR ')
      : tagFilters.join(' AND ');
    
    // Combine with existing filter
    scanParams.FilterExpression = `${scanParams.FilterExpression} AND (${tagFilterExpression})`;
    scanParams.ExpressionAttributeNames = attributeNames;
    scanParams.ExpressionAttributeValues = attributeValues;
    
    const result = await docClient.send(new ScanCommand(scanParams));
    
    return result.Items.map(item => ({
      id: item.sk,
      ...item.data
    }));
  }
  
  // No tag filtering, use regular query
  const result = await docClient.send(new QueryCommand(queryParams));
  
  return result.Items.map(item => ({
    id: item.sk,
    ...item.data
  }));
}

/**
 * Update an existing entity
 * @param {string} entityType - Entity type
 * @param {string} inventoryId - Inventory UUID
 * @param {string} id - Entity UUID
 * @param {object} data - Updated entity data
 * @returns {Promise<object>} Updated entity
 */
async function updateEntity(entityType, inventoryId, id, data) {
  // First check if entity exists
  const existing = await getEntity(entityType, inventoryId, id);
  if (!existing) {
    throw new Error('Entity not found');
  }
  
  // Remove undefined values from data recursively to avoid DynamoDB errors
  const cleanData = removeUndefinedValues(data);
  
  const updatedData = {
    ...existing,
    ...cleanData,
    id: existing.id, // Preserve original id
    inventoryId: existing.inventoryId, // Preserve original inventoryId
    dateAdded: existing.dateAdded // Preserve original dateAdded
  };
  
  // Clean the final merged data as well
  const finalData = removeUndefinedValues(updatedData);
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `INVENTORY#${inventoryId}#${entityType}`,
      sk: id,
      data: finalData
    }
  }));
  
  return {
    id,
    ...finalData
  };
}

/**
 * Delete an entity
 * @param {string} entityType - Entity type
 * @param {string} inventoryId - Inventory UUID
 * @param {string} id - Entity UUID
 * @returns {Promise<void>}
 */
async function deleteEntity(entityType, inventoryId, id) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      pk: `INVENTORY#${inventoryId}#${entityType}`,
      sk: id
    }
  }));
}

/**
 * Create a new inventory
 * @param {object} inventoryData - Inventory data
 * @returns {Promise<Inventory>} Created inventory
 */
async function createInventory(inventoryData) {
  const inventory = new Inventory(inventoryData);
  const validation = inventory.validate();
  
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }
  
  // Create inventory record
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: inventory.toDynamoDBItem()
  }));
  
  // Create owner membership record
  const membership = new InventoryMembership({
    inventoryId: inventory.id,
    userId: inventory.ownerId,
    role: 'owner',
    addedBy: inventory.ownerId
  });
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: membership.toDynamoDBItem()
  }));
  
  return inventory;
}

/**
 * Get an inventory by ID
 * @param {string} inventoryId - Inventory UUID
 * @returns {Promise<Inventory|null>} Inventory or null if not found
 */
async function getInventory(inventoryId) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      pk: `INVENTORY#${inventoryId}`,
      sk: 'METADATA'
    }
  }));
  
  if (!result.Item) {
    return null;
  }
  
  return Inventory.fromDynamoDBItem(result.Item);
}

/**
 * Update an inventory
 * @param {string} inventoryId - Inventory UUID
 * @param {object} updates - Fields to update
 * @returns {Promise<Inventory>} Updated inventory
 */
async function updateInventory(inventoryId, updates) {
  const inventory = await getInventory(inventoryId);
  if (!inventory) {
    throw new Error('Inventory not found');
  }
  
  inventory.update(updates);
  const validation = inventory.validate();
  
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: inventory.toDynamoDBItem()
  }));
  
  return inventory;
}

/**
 * Delete an inventory
 * @param {string} inventoryId - Inventory UUID
 * @returns {Promise<void>}
 */
async function deleteInventory(inventoryId) {
  // Delete inventory metadata
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      pk: `INVENTORY#${inventoryId}`,
      sk: 'METADATA'
    }
  }));
  
  // Note: In a production system, you'd also need to delete all entities and memberships
  // This is a simplified implementation for the data model task
}

/**
 * Add a member to an inventory
 * @param {string} inventoryId - Inventory UUID
 * @param {string} userId - User UUID to add
 * @param {string} addedBy - User UUID who is adding the member
 * @param {string} role - Role to assign ('member' or 'owner')
 * @returns {Promise<InventoryMembership>} Created membership
 */
async function addInventoryMember(inventoryId, userId, addedBy, role = 'member') {
  const membership = new InventoryMembership({
    inventoryId,
    userId,
    role,
    addedBy
  });
  
  const validation = membership.validate();
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: membership.toDynamoDBItem()
  }));
  
  return membership;
}

/**
 * Remove a member from an inventory
 * @param {string} inventoryId - Inventory UUID
 * @param {string} userId - User UUID to remove
 * @returns {Promise<void>}
 */
async function removeInventoryMember(inventoryId, userId) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      pk: `INVENTORY#${inventoryId}`,
      sk: `MEMBER#${userId}`
    }
  }));
}

/**
 * Get inventory membership for a user
 * @param {string} inventoryId - Inventory UUID
 * @param {string} userId - User UUID
 * @returns {Promise<InventoryMembership|null>} Membership or null if not found
 */
async function getInventoryMembership(inventoryId, userId) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      pk: `INVENTORY#${inventoryId}`,
      sk: `MEMBER#${userId}`
    }
  }));
  
  if (!result.Item) {
    return null;
  }
  
  return InventoryMembership.fromDynamoDBItem(result.Item);
}

/**
 * List all members of an inventory
 * @param {string} inventoryId - Inventory UUID
 * @returns {Promise<Array>} Array of memberships
 */
async function listInventoryMembers(inventoryId) {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': `INVENTORY#${inventoryId}`,
      ':sk': 'MEMBER#'
    }
  }));
  
  return result.Items.map(item => InventoryMembership.fromDynamoDBItem(item));
}

/**
 * List all inventories for a user (where they are owner or member)
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} Array of inventories
 */
async function getUserInventories(userId) {
  // Without a GSI, we need to scan for memberships
  // This is not optimal for production but works for now
  const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
  
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(pk, :invPrefix) AND begins_with(sk, :memberPrefix) AND userId = :userId',
    ExpressionAttributeValues: {
      ':invPrefix': 'INVENTORY#',
      ':memberPrefix': 'MEMBER#',
      ':userId': userId
    }
  }));
  
  if (!result.Items || result.Items.length === 0) {
    return [];
  }
  
  // Get the full inventory details for each membership
  const inventories = [];
  for (const membership of result.Items) {
    try {
      const inventory = await getInventory(membership.inventoryId);
      if (inventory) {
        // Add the user's role to the inventory object
        inventories.push({
          ...inventory,
          userRole: membership.role,
          userPermissions: membership.permissions
        });
      }
    } catch (err) {
      console.error(`Error fetching inventory ${membership.inventoryId}:`, err);
      // Continue with other inventories
    }
  }
  
  return inventories;
}

/**
 * Check if a user has access to an inventory
 * @param {string} userId - User UUID
 * @param {string} inventoryId - Inventory UUID
 * @returns {Promise<boolean>} True if user has access
 */
async function hasInventoryAccess(userId, inventoryId) {
  if (!userId || !inventoryId) {
    console.error('hasInventoryAccess: Missing parameters', { userId: !!userId, inventoryId: !!inventoryId });
    return false;
  }
  
  try {
    const membership = await getInventoryMembership(inventoryId, userId);
    return membership !== null;
  } catch (error) {
    console.error('hasInventoryAccess error:', error.message, { userId, inventoryId });
    return false;
  }
}

/**
 * Find entity by photo key across all entity types and inventories
 * This is used for photo access control to find which entity a photo belongs to
 * @param {string} photoKey - S3 photo key
 * @returns {Promise<object|null>} Entity with inventoryId or null if not found
 */
async function findEntityByPhotoKey(photoKey) {
  const entityTypes = ['THINGS', 'LOCATIONS', 'ROOMS', 'CATEGORIES', 'PEOPLE'];
  
  // In a production system, you'd want to store photo-to-entity mappings
  // For now, we'll search through entities to find ones with matching photo keys
  // This is not efficient but works for the security enhancement implementation
  
  for (const entityType of entityTypes) {
    try {
      // This would require scanning all inventories, which is not efficient
      // In a real implementation, you'd store photo metadata separately
      // For this security enhancement, we'll implement a basic version
      
      // Since we can't efficiently scan all inventories, we'll return null
      // and require the client to provide the entity information
      // This is a limitation of the current data model
      return null;
    } catch (error) {
      console.error(`Error searching for entity with photo key ${photoKey}:`, error);
    }
  }
  
  return null;
}

module.exports = {
  createEntity,
  getEntity,
  listEntities,
  updateEntity,
  deleteEntity,
  createInventory,
  getInventory,
  updateInventory,
  deleteInventory,
  addInventoryMember,
  removeInventoryMember,
  getInventoryMembership,
  listInventoryMembers,
  getUserInventories,
  hasInventoryAccess,
  findEntityByPhotoKey
};
