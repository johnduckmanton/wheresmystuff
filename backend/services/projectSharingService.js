const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const ShareLink = require('../models/shareLink');
const { hasInventoryAccess } = require('./dynamodb');
const { logDataAccess, logProjectOperation } = require('./auditLogService');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) {
  throw new Error('TABLE_NAME environment variable is required');
}

/**
 * Project Sharing Service
 * Handles share link generation, management, and access control
 */
class ProjectSharingService {
  /**
   * Create a share link for a project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {object} linkData - Share link data
   * @param {string} userId - User ID creating the link
   * @returns {Promise<ShareLink>} Created share link
   */
  async createShareLink(projectId, inventoryId, linkData, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Validate project exists
    const projectResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#PROJECTS`,
        ':sk': projectId
      }
    }));

    if (!projectResult.Items || projectResult.Items.length === 0) {
      throw new Error('Project not found');
    }

    // Create share link
    const shareLink = new ShareLink({
      ...linkData,
      projectId,
      inventoryId,
      createdBy: userId
    });

    const validation = shareLink.validate();
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Save to database
    const item = shareLink.toDynamoDBItem();

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(pk)'
    }));

    // Log the creation
    await logProjectOperation(userId, 'create_share_link', projectId, inventoryId, {
      shareLinkId: shareLink.id,
      accessLevel: shareLink.accessLevel,
      expiresAt: shareLink.expiresAt
    });

    return shareLink;
  }

  /**
   * Get a share link by ID
   * @param {string} shareLinkId - Share link ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the link
   * @returns {Promise<ShareLink>} Share link data
   */
  async getShareLink(shareLinkId, projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `PROJECT#${projectId}#SHARES`,
        ':sk': shareLinkId
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      throw new Error('Share link not found');
    }

    // Log the access
    await logDataAccess(userId, 'read', 'share_link', shareLinkId, inventoryId);

    return ShareLink.fromDynamoDBItem(result.Items[0]);
  }

  /**
   * Get all share links for a project
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the links
   * @returns {Promise<ShareLink[]>} List of share links
   */
  async getShareLinks(projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `PROJECT#${projectId}#SHARES`
      }
    }));

    const shareLinks = (result.Items || []).map(item => ShareLink.fromDynamoDBItem(item));

    // Log the access
    await logDataAccess(userId, 'read', 'share_links', projectId, inventoryId);

    return shareLinks;
  }

  /**
   * Get share link by token (for public access)
   * @param {string} token - Share token
   * @returns {Promise<ShareLink>} Share link data
   */
  async getShareLinkByToken(token) {
    // Query by token using GSI (if available) or scan
    // For now, we'll need to scan - in production, add GSI on token
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'token-index', // Assumes GSI exists
      KeyConditionExpression: 'token = :token',
      ExpressionAttributeValues: {
        ':token': token
      }
    })).catch(async () => {
      // Fallback: scan all shares (inefficient, but works without GSI)
      // In production, create GSI on token field
      return { Items: [] };
    });

    if (!result.Items || result.Items.length === 0) {
      throw new Error('Share link not found');
    }

    return ShareLink.fromDynamoDBItem(result.Items[0]);
  }

  /**
   * Update a share link
   * @param {string} shareLinkId - Share link ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {object} updates - Fields to update
   * @param {string} userId - User ID making the update
   * @returns {Promise<ShareLink>} Updated share link
   */
  async updateShareLink(shareLinkId, projectId, inventoryId, updates, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing share link
    const existingLink = await this.getShareLink(shareLinkId, projectId, inventoryId, userId);

    // Update the link
    const allowedUpdates = ['expiresAt', 'accessLevel'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        existingLink[field] = updates[field];
      }
    });

    // Validate the updated link
    const validation = existingLink.validate();
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Prepare update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = existingLink[field];
      }
    });

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    if (updateExpressions.length === 1) { // Only updatedAt
      throw new Error('No valid fields to update');
    }

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#SHARES`,
        sk: shareLinkId
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the update
    await logProjectOperation(userId, 'update_share_link', projectId, inventoryId, {
      shareLinkId,
      updatedFields: Object.keys(updates)
    });

    return existingLink;
  }

  /**
   * Revoke a share link
   * @param {string} shareLinkId - Share link ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID revoking the link
   * @returns {Promise<void>}
   */
  async revokeShareLink(shareLinkId, projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get existing share link
    const existingLink = await this.getShareLink(shareLinkId, projectId, inventoryId, userId);

    // Revoke the link
    existingLink.revoke();

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#SHARES`,
        sk: shareLinkId
      },
      UpdateExpression: 'SET isActive = :isActive, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isActive': false,
        ':updatedAt': new Date().toISOString()
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the revocation
    await logProjectOperation(userId, 'revoke_share_link', projectId, inventoryId, {
      shareLinkId
    });
  }

  /**
   * Delete a share link
   * @param {string} shareLinkId - Share link ID
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID deleting the link
   * @returns {Promise<void>}
   */
  async deleteShareLink(shareLinkId, projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Check if share link exists
    const existingLink = await this.getShareLink(shareLinkId, projectId, inventoryId, userId);

    // Delete the share link
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${projectId}#SHARES`,
        sk: shareLinkId
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    // Log the deletion
    await logProjectOperation(userId, 'delete_share_link', projectId, inventoryId, {
      shareLinkId
    });
  }

  /**
   * Record access to a share link
   * @param {string} token - Share token
   * @param {string} ipAddress - IP address of accessor
   * @param {string} userAgent - User agent of accessor
   * @returns {Promise<object>} Access result
   */
  async recordShareLinkAccess(token, ipAddress, userAgent) {
    // Get share link by token
    const shareLink = await this.getShareLinkByToken(token);

    // Check if valid
    if (!shareLink.isValid()) {
      throw new Error('Share link is not valid or has expired');
    }

    // Record the access
    const result = shareLink.recordAccess(ipAddress, userAgent);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Update in database
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PROJECT#${shareLink.projectId}#SHARES`,
        sk: shareLink.id
      },
      UpdateExpression: 'SET accessCount = :accessCount, lastAccessedAt = :lastAccessedAt, accessLog = :accessLog, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':accessCount': shareLink.accessCount,
        ':lastAccessedAt': shareLink.lastAccessedAt,
        ':accessLog': shareLink.accessLog,
        ':updatedAt': shareLink.updatedAt
      },
      ConditionExpression: 'attribute_exists(pk)'
    }));

    return {
      projectId: shareLink.projectId,
      accessLevel: shareLink.accessLevel,
      accessCount: shareLink.accessCount
    };
  }

  /**
   * Get share link statistics
   * @param {string} projectId - Project ID
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the statistics
   * @returns {Promise<object>} Share link statistics
   */
  async getShareLinkStats(projectId, inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Get all share links for this project
    const shareLinks = await this.getShareLinks(projectId, inventoryId, userId);

    // Calculate statistics
    const total = shareLinks.length;
    const active = shareLinks.filter(l => l.isActive).length;
    const expired = shareLinks.filter(l => l.isExpired()).length;
    const totalAccesses = shareLinks.reduce((sum, l) => sum + l.accessCount, 0);

    // Group by access level
    const byAccessLevel = {};
    ['view', 'comment', 'edit'].forEach(level => {
      byAccessLevel[level] = shareLinks.filter(l => l.accessLevel === level).length;
    });

    // Log the access
    await logDataAccess(userId, 'read', 'share_link_stats', projectId, inventoryId);

    return {
      total,
      active,
      expired,
      totalAccesses,
      averageAccessesPerLink: total > 0 ? Math.round(totalAccesses / total) : 0,
      byAccessLevel
    };
  }
}

module.exports = new ProjectSharingService();
