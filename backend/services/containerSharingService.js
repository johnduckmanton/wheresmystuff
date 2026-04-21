const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const containerService = require('./containerService');
const { logDataAccess } = require('./auditLogService');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) {
  throw new Error('TABLE_NAME environment variable is required');
}

/**
 * Container Sharing Service
 * Handles creation and management of shareable container links
 */
class ContainerSharingService {
  /**
   * Generate a secure sharing token
   * @returns {string} Secure random token
   */
  generateSharingToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a shareable link for a container
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID creating the share
   * @param {object} options - Sharing options
   * @returns {Promise<object>} Sharing link details
   */
  async createSharingLink(containerId, inventoryId, userId, options = {}) {
    // Validate that user has access to the container
    const container = await containerService.getContainer(containerId, inventoryId, userId);
    if (!container) {
      throw new Error('Container not found or access denied');
    }

    const {
      expiresAt = null, // null means no expiration
      includeItemDetails = true,
      includePhotos = false,
      includeSensitiveData = false,
      allowedDomains = [],
      maxAccesses = null,
      description = ''
    } = options;

    const shareId = uuidv4();
    const token = this.generateSharingToken();
    const createdAt = new Date().toISOString();

    // Calculate expiration date if duration is provided
    let expirationDate = null;
    if (expiresAt) {
      expirationDate = new Date(expiresAt).toISOString();
    }

    const sharingLink = {
      pk: `CONTAINER_SHARE#${shareId}`,
      sk: 'METADATA',
      shareId,
      token,
      containerId,
      inventoryId,
      createdBy: userId,
      createdAt,
      expiresAt: expirationDate,
      accessCount: 0,
      maxAccesses,
      isActive: true,
      privacySettings: {
        includeItemDetails,
        includePhotos,
        includeSensitiveData
      },
      allowedDomains,
      description,
      lastAccessedAt: null,
      lastAccessedBy: null
    };

    // Save sharing link to DynamoDB
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: sharingLink,
      ConditionExpression: 'attribute_not_exists(pk)'
    }));

    // Log the sharing link creation
    await logDataAccess(userId, 'create', 'container_share', shareId, inventoryId);

    return {
      shareId,
      token,
      shareUrl: `${process.env.FRONTEND_URL || 'https://app.example.com'}/shared/container/${shareId}?token=${token}`,
      expiresAt: expirationDate,
      allowDownload: options.allowDownload || false,
      description: description,
      privacySettings: sharingLink.privacySettings,
      createdAt
    };
  }

  /**
   * Get sharing link details by token (for backward compatibility)
   * @param {string} token - Sharing token
   * @param {string} accessorInfo - Information about who is accessing (IP, user agent, etc.)
   * @returns {Promise<object>} Sharing link details and container data
   */
  async getSharingLink(token, accessorInfo = {}) {
    // If first parameter looks like a shareId (UUID format), handle the old signature
    if (arguments.length > 1 && typeof arguments[1] === 'string' && arguments[1].length === 64) {
      return this.getSharingLinkByShareId(arguments[0], arguments[1], arguments[2] || {});
    }
    
    // New signature: find by token
    return this.getSharingLinkByToken(token, accessorInfo);
  }

  /**
   * Get sharing link details by share ID and token
   * @param {string} shareId - Share ID
   * @param {string} token - Sharing token
   * @param {string} accessorInfo - Information about who is accessing (IP, user agent, etc.)
   * @returns {Promise<object>} Sharing link details and container data
   */
  async getSharingLinkByShareId(shareId, token, accessorInfo = {}) {
    // Get sharing link metadata
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `CONTAINER_SHARE#${shareId}`,
        sk: 'METADATA'
      }
    }));

    if (!result.Item) {
      throw new Error('Sharing link not found');
    }

    const sharingLink = result.Item;

    // Validate token
    if (sharingLink.token !== token) {
      throw new Error('Invalid sharing token');
    }

    // Check if link is active
    if (!sharingLink.isActive) {
      throw new Error('Sharing link has been deactivated');
    }

    // Check expiration
    if (sharingLink.expiresAt && new Date(sharingLink.expiresAt) < new Date()) {
      throw new Error('Sharing link has expired');
    }

    // Check access limits
    if (sharingLink.maxAccesses && sharingLink.accessCount >= sharingLink.maxAccesses) {
      throw new Error('Sharing link access limit exceeded');
    }

    // Get container data with privacy filtering
    const containerData = await this.getFilteredContainerData(
      sharingLink.containerId,
      sharingLink.inventoryId,
      sharingLink.privacySettings
    );

    // Update access tracking
    await this.updateAccessTracking(shareId, accessorInfo);

    // Log the access
    await this.logSharingAccess(shareId, sharingLink.inventoryId, accessorInfo);

    return {
      shareId,
      container: containerData.container,
      items: containerData.items,
      itemCount: containerData.itemCount,
      privacySettings: sharingLink.privacySettings,
      description: sharingLink.description,
      createdAt: sharingLink.createdAt,
      expiresAt: sharingLink.expiresAt,
      accessCount: sharingLink.accessCount + 1
    };
  }

  /**
   * Get sharing link details by token only
   * @param {string} token - Sharing token
   * @param {string} accessorInfo - Information about who is accessing (IP, user agent, etc.)
   * @returns {Promise<object>} Sharing link details and container data
   */
  async getSharingLinkByToken(token, accessorInfo = {}) {
    // Scan for sharing link by token (not efficient, but works for now)
    // In production, you'd want a GSI on token
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: '#token = :token',
      ExpressionAttributeNames: {
        '#token': 'token'
      },
      ExpressionAttributeValues: {
        ':token': token
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      throw new Error('Sharing link not found');
    }

    const sharingLink = result.Items[0];
    const shareId = sharingLink.shareId;

    // Use the existing logic
    return this.getSharingLinkByShareId(shareId, token, accessorInfo);
  }

  /**
   * Get container data with privacy filtering applied
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {object} privacySettings - Privacy settings to apply
   * @returns {Promise<object>} Filtered container data
   */
  async getFilteredContainerData(containerId, inventoryId, privacySettings) {
    // Get container contents using a system-level access (no user validation)
    const containerResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `INVENTORY#${inventoryId}#CONTAINERS`,
        sk: containerId
      }
    }));

    if (!containerResult.Item) {
      throw new Error('Container not found');
    }

    const container = containerResult.Item;

    // Get items in container if item details are allowed
    let items = [];
    if (privacySettings.includeItemDetails) {
      const itemsResult = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        FilterExpression: 'containerId = :containerId',
        ExpressionAttributeValues: {
          ':pk': `INVENTORY#${inventoryId}#THINGS`,
          ':containerId': containerId
        }
      }));

      items = itemsResult.Items ? itemsResult.Items.map(item => {
        const itemData = {
          id: item.sk,
          name: item.data?.name || 'Unknown Item',
          category: item.data?.category || 'Uncategorized',
          description: item.data?.description || ''
        };

        // Include photos if allowed
        if (privacySettings.includePhotos && item.data?.photos) {
          itemData.photos = item.data.photos;
        }

        // Include sensitive data if allowed (value, serial numbers, etc.)
        if (privacySettings.includeSensitiveData) {
          itemData.value = item.data?.value;
          itemData.serialNumber = item.data?.serialNumber;
          itemData.model = item.data?.model;
          itemData.brand = item.data?.brand;
          itemData.purchasePrice = item.data?.purchasePrice;
          itemData.datePurchased = item.data?.datePurchased;
        }

        return itemData;
      }) : [];
    }

    // Filter container data based on privacy settings
    const filteredContainer = {
      id: container.sk,
      name: container.name,
      type: container.type,
      description: container.description,
      status: container.status,
      itemCount: container.itemCount || items.length,
      handlingFlags: container.handlingFlags || [],
      createdAt: container.createdAt
    };

    // Include location info if not sensitive
    if (container.locationId && !privacySettings.includeSensitiveData) {
      filteredContainer.locationId = container.locationId;
    }

    // Include estimated value if sensitive data is allowed
    if (privacySettings.includeSensitiveData) {
      filteredContainer.estimatedValue = container.estimatedValue;
      filteredContainer.storageStartDate = container.storageStartDate;
      filteredContainer.storageRate = container.storageRate;
    }

    return {
      container: filteredContainer,
      items,
      itemCount: items.length
    };
  }

  /**
   * Update access tracking for a sharing link
   * @param {string} shareId - Share ID
   * @param {object} accessorInfo - Information about the accessor
   * @returns {Promise<void>}
   */
  async updateAccessTracking(shareId, accessorInfo) {
    const now = new Date().toISOString();
    
    try {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `CONTAINER_SHARE#${shareId}`,
          sk: 'METADATA',
          lastAccessedAt: now,
          lastAccessedBy: accessorInfo.ipAddress || 'unknown',
          accessCount: (accessorInfo.currentAccessCount || 0) + 1
        },
        ConditionExpression: 'attribute_exists(pk)' // Only update if exists
      }));
    } catch (error) {
      console.error('Error updating access tracking:', error);
      // Don't throw - access tracking failure shouldn't break sharing
    }
  }

  /**
   * Log sharing access for audit purposes
   * @param {string} shareId - Share ID
   * @param {string} inventoryId - Inventory ID
   * @param {object} accessorInfo - Information about the accessor
   * @returns {Promise<void>}
   */
  async logSharingAccess(shareId, inventoryId, accessorInfo) {
    try {
      // Create a pseudo-user ID for anonymous access logging
      const pseudoUserId = `anonymous_${accessorInfo.ipAddress || 'unknown'}`;
      
      await logDataAccess(
        pseudoUserId,
        'read',
        'container_shared_access',
        shareId,
        inventoryId
      );
    } catch (error) {
      console.error('Error logging sharing access:', error);
      // Don't throw - logging failure shouldn't break sharing
    }
  }

  /**
   * List sharing links for a container
   * @param {string} containerId - Container ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the list
   * @returns {Promise<Array>} List of sharing links
   */
  async listSharingLinks(containerId, inventoryId, userId) {
    // Validate user has access to the container
    const container = await containerService.getContainer(containerId, inventoryId, userId);
    if (!container) {
      throw new Error('Container not found or access denied');
    }

    // Query sharing links for this container
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'ContainerShareIndex', // Would need to be created
      KeyConditionExpression: 'containerId = :containerId',
      ExpressionAttributeValues: {
        ':containerId': containerId
      }
    }));

    const sharingLinks = result.Items ? result.Items.map(item => ({
      shareId: item.shareId,
      shareUrl: `${process.env.FRONTEND_URL || 'https://app.example.com'}/shared/container/${item.shareId}?token=${item.token}`,
      description: item.description,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
      accessCount: item.accessCount,
      maxAccesses: item.maxAccesses,
      isActive: item.isActive,
      privacySettings: item.privacySettings,
      lastAccessedAt: item.lastAccessedAt
    })) : [];

    // Log the list access
    await logDataAccess(userId, 'read', 'container_sharing_links', containerId, inventoryId);

    return sharingLinks;
  }

  /**
   * Update a sharing link
   * @param {string} shareId - Share ID
   * @param {object} updates - Updates to apply
   * @param {string} userId - User ID updating the link
   * @returns {Promise<object>} Updated sharing link
   */
  async updateSharingLink(shareId, updates, userId) {
    // Get sharing link to validate ownership
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `CONTAINER_SHARE#${shareId}`,
        sk: 'METADATA'
      }
    }));

    if (!result.Item) {
      throw new Error('Sharing link not found');
    }

    const sharingLink = result.Item;

    // Validate user created this link or has access to the inventory
    if (sharingLink.createdBy !== userId) {
      // Additional check: verify user has access to the inventory
      const containerService = require('./containerService');
      try {
        await containerService.getContainer(sharingLink.containerId, sharingLink.inventoryId, userId);
      } catch (error) {
        throw new Error('Access denied: Cannot update this sharing link');
      }
    }

    // Apply updates
    const updatedSharingLink = {
      ...sharingLink,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    // Update the sharing link
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: updatedSharingLink
    }));

    // Log the update
    await logDataAccess(userId, 'update', 'container_share', shareId, sharingLink.inventoryId);

    return {
      shareId: updatedSharingLink.shareId,
      token: updatedSharingLink.token,
      shareUrl: `${process.env.FRONTEND_URL || 'https://app.example.com'}/shared/container/${shareId}?token=${updatedSharingLink.token}`,
      isActive: updatedSharingLink.isActive,
      expiresAt: updatedSharingLink.expiresAt,
      description: updatedSharingLink.description,
      privacySettings: updatedSharingLink.privacySettings,
      updatedAt: updatedSharingLink.updatedAt
    };
  }

  /**
   * Deactivate a sharing link
   * @param {string} shareId - Share ID
   * @param {string} userId - User ID deactivating the link
   * @returns {Promise<void>}
   */
  async deactivateSharingLink(shareId, userId) {
    // Get sharing link to validate ownership
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `CONTAINER_SHARE#${shareId}`,
        sk: 'METADATA'
      }
    }));

    if (!result.Item) {
      throw new Error('Sharing link not found');
    }

    const sharingLink = result.Item;

    // Validate user created this link or has access to the inventory
    if (sharingLink.createdBy !== userId) {
      // Additional check: verify user has access to the inventory
      const containerService = require('./containerService');
      try {
        await containerService.getContainer(sharingLink.containerId, sharingLink.inventoryId, userId);
      } catch (error) {
        throw new Error('Access denied: Cannot deactivate this sharing link');
      }
    }

    // Update the sharing link to inactive
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...sharingLink,
        isActive: false,
        deactivatedAt: new Date().toISOString(),
        deactivatedBy: userId
      }
    }));

    // Log the deactivation
    await logDataAccess(userId, 'update', 'container_share_deactivate', shareId, sharingLink.inventoryId);
  }

  /**
   * Delete a sharing link permanently
   * @param {string} shareId - Share ID
   * @param {string} userId - User ID deleting the link
   * @returns {Promise<void>}
   */
  async deleteSharingLink(shareId, userId) {
    // Get sharing link to validate ownership
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `CONTAINER_SHARE#${shareId}`,
        sk: 'METADATA'
      }
    }));

    if (!result.Item) {
      throw new Error('Sharing link not found');
    }

    const sharingLink = result.Item;

    // Validate user created this link or has access to the inventory
    if (sharingLink.createdBy !== userId) {
      // Additional check: verify user has access to the inventory
      const containerService = require('./containerService');
      try {
        await containerService.getContainer(sharingLink.containerId, sharingLink.inventoryId, userId);
      } catch (error) {
        throw new Error('Access denied: Cannot delete this sharing link');
      }
    }

    // Delete the sharing link
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `CONTAINER_SHARE#${shareId}`,
        sk: 'METADATA'
      }
    }));

    // Log the deletion
    await logDataAccess(userId, 'delete', 'container_share', shareId, sharingLink.inventoryId);
  }

  /**
   * Clean up expired sharing links
   * @returns {Promise<number>} Number of links cleaned up
   */
  async cleanupExpiredLinks() {
    const now = new Date().toISOString();
    let cleanedCount = 0;

    try {
      // This would require a GSI on expiresAt to be efficient
      // For now, we'll scan (not efficient for production)
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'expiresAt < :now AND isActive = :active',
        ExpressionAttributeValues: {
          ':now': now,
          ':active': true
        }
      }));

      if (result.Items && result.Items.length > 0) {
        for (const item of result.Items) {
          await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
              ...item,
              isActive: false,
              expiredAt: now
            }
          }));
          cleanedCount++;
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired sharing links:', error);
    }

    return cleanedCount;
  }
}

module.exports = new ContainerSharingService();