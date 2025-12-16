const { 
  createInventory: dbCreateInventory,
  getInventory: dbGetInventory,
  updateInventory: dbUpdateInventory,
  deleteInventory: dbDeleteInventory,
  addInventoryMember: dbAddInventoryMember,
  removeInventoryMember: dbRemoveInventoryMember,
  getInventoryMembership: dbGetInventoryMembership,
  listInventoryMembers: dbListInventoryMembers,
  hasInventoryAccess: dbHasInventoryAccess
} = require('./dynamodb');

/**
 * Inventory Management Service
 * Provides business logic for inventory operations
 */
class InventoryService {
  
  /**
   * Create a new inventory
   * @param {string} userId - User ID of the owner
   * @param {object} inventoryData - Inventory data (name, description)
   * @returns {Promise<object>} Created inventory
   */
  async createInventory(userId, inventoryData) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const data = {
      ...inventoryData,
      ownerId: userId
    };

    return await dbCreateInventory(data);
  }

  /**
   * Get inventories for a user (where they are owner or member)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of inventories
   */
  async getUserInventories(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
    
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);
    const tableName = process.env.TABLE_NAME || 'home-inventory-dev';

    try {
      // Find all inventory memberships for this user
      const membershipResult = await docClient.send(new ScanCommand({
        TableName: tableName,
        FilterExpression: 'begins_with(pk, :inventoryPrefix) AND sk = :memberSk',
        ExpressionAttributeValues: {
          ':inventoryPrefix': 'INVENTORY#',
          ':memberSk': `MEMBER#${userId}`
        }
      }));

      if (!membershipResult.Items || membershipResult.Items.length === 0) {
        return [];
      }

      // Get the inventory metadata for each membership
      const inventories = [];
      for (const membership of membershipResult.Items) {
        const inventoryId = membership.inventoryId;
        
        try {
          const inventoryResult = await docClient.send(new GetCommand({
            TableName: tableName,
            Key: {
              pk: `INVENTORY#${inventoryId}`,
              sk: 'METADATA'
            }
          }));

          if (inventoryResult.Item) {
            inventories.push({
              id: inventoryResult.Item.id,
              name: inventoryResult.Item.name,
              description: inventoryResult.Item.description,
              ownerId: inventoryResult.Item.ownerId,
              createdAt: inventoryResult.Item.createdAt,
              updatedAt: inventoryResult.Item.updatedAt
            });
          }
        } catch (error) {
          console.error(`Error fetching inventory ${inventoryId}:`, error);
          // Continue with other inventories
        }
      }

      return inventories;
    } catch (error) {
      console.error('Error getting user inventories:', error);
      throw new Error('Failed to retrieve user inventories');
    }
  }

  /**
   * Update an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the update
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Updated inventory
   */
  async updateInventory(inventoryId, userId, updates) {
    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Check if user has access to this inventory
    const hasAccess = await dbHasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied: User does not have access to this inventory');
    }

    // Check if user is owner (only owners can update inventory metadata)
    const membership = await dbGetInventoryMembership(inventoryId, userId);
    if (!membership || !membership.isOwner()) {
      throw new Error('Access denied: Only inventory owners can update inventory details');
    }

    return await dbUpdateInventory(inventoryId, updates);
  }

  /**
   * Delete an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the deletion
   * @returns {Promise<void>}
   */
  async deleteInventory(inventoryId, userId) {
    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Check if user is owner (only owners can delete inventory)
    const membership = await dbGetInventoryMembership(inventoryId, userId);
    if (!membership || !membership.isOwner()) {
      throw new Error('Access denied: Only inventory owners can delete inventories');
    }

    return await dbDeleteInventory(inventoryId);
  }

  /**
   * Add a member to an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} ownerId - Owner user ID (must be owner)
   * @param {string} memberUserId - User ID to add as member
   * @returns {Promise<object>} Created membership
   */
  async addInventoryMember(inventoryId, ownerId, memberUserId) {
    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }
    if (!ownerId) {
      throw new Error('Owner ID is required');
    }
    if (!memberUserId) {
      throw new Error('Member user ID is required');
    }

    // Check if requesting user is owner
    const ownerMembership = await dbGetInventoryMembership(inventoryId, ownerId);
    if (!ownerMembership || !ownerMembership.isOwner()) {
      throw new Error('Access denied: Only inventory owners can add members');
    }

    // Check if user is already a member
    const existingMembership = await dbGetInventoryMembership(inventoryId, memberUserId);
    if (existingMembership) {
      throw new Error('User is already a member of this inventory');
    }

    return await dbAddInventoryMember(inventoryId, memberUserId, ownerId, 'member');
  }

  /**
   * Remove a member from an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} ownerId - Owner user ID (must be owner)
   * @param {string} memberUserId - User ID to remove
   * @returns {Promise<void>}
   */
  async removeInventoryMember(inventoryId, ownerId, memberUserId) {
    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }
    if (!ownerId) {
      throw new Error('Owner ID is required');
    }
    if (!memberUserId) {
      throw new Error('Member user ID is required');
    }

    // Check if requesting user is owner
    const ownerMembership = await dbGetInventoryMembership(inventoryId, ownerId);
    if (!ownerMembership || !ownerMembership.isOwner()) {
      throw new Error('Access denied: Only inventory owners can remove members');
    }

    // Check if member exists
    const memberMembership = await dbGetInventoryMembership(inventoryId, memberUserId);
    if (!memberMembership) {
      throw new Error('User is not a member of this inventory');
    }

    // Prevent owner from removing themselves
    if (memberUserId === ownerId) {
      throw new Error('Inventory owner cannot remove themselves');
    }

    return await dbRemoveInventoryMember(inventoryId, memberUserId);
  }

  /**
   * Get members of an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the list (must have access)
   * @returns {Promise<Array>} Array of memberships
   */
  async getInventoryMembers(inventoryId, userId) {
    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Check if user has access to this inventory
    const hasAccess = await dbHasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied: User does not have access to this inventory');
    }

    return await dbListInventoryMembers(inventoryId);
  }

  /**
   * Check if a user has access to an inventory
   * @param {string} userId - User ID
   * @param {string} inventoryId - Inventory ID
   * @returns {Promise<boolean>} True if user has access
   */
  async hasInventoryAccess(userId, inventoryId) {
    if (!userId || !inventoryId) {
      return false;
    }

    return await dbHasInventoryAccess(userId, inventoryId);
  }
}

module.exports = new InventoryService();