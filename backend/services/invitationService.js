const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Invitation Management Service
 * Handles user invitations and pending memberships
 */
class InvitationService {
  constructor() {
    this.dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    this.tableName = process.env.TABLE_NAME || 'home-inventory-dev';
    this.invitationExpiryDays = 7; // Invitations expire after 7 days
  }

  /**
   * Create a new invitation
   * @param {string} inventoryId - Inventory ID
   * @param {string} email - Email address to invite
   * @param {string} role - Role to assign (member, administrator, read_only)
   * @param {string} invitedBy - User ID of the person sending invitation
   * @param {object} invitationDetails - Additional details for email (inventoryName, inviterName)
   * @returns {Promise<object>} Created invitation
   */
  async createInvitation(inventoryId, email, role, invitedBy, invitationDetails = {}) {
    // Enhanced parameter validation
    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }
    if (!email) {
      throw new Error('Email address is required');
    }
    if (!role) {
      throw new Error('User role is required');
    }
    if (!invitedBy) {
      throw new Error('Inviter user ID is required');
    }

    // Validate inventory ID format
    const { validateUUID, validateEmail, validateUserRole } = require('../utils/validation');
    if (!validateUUID(inventoryId)) {
      throw new Error('Invalid inventory ID format');
    }

    if (!validateUUID(invitedBy)) {
      throw new Error('Invalid inviter user ID format');
    }

    // Enhanced email validation
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      throw new Error(emailValidation.error);
    }

    // Enhanced role validation
    const roleValidation = validateUserRole(role);
    if (!roleValidation.valid) {
      throw new Error(roleValidation.error);
    }

    try {
      const normalizedEmail = emailValidation.normalizedEmail;
      const normalizedRole = roleValidation.normalizedRole;

      // Check if there's already a pending invitation for this email/inventory
      const existingInvitation = await this.getPendingInvitationByEmail(inventoryId, normalizedEmail);
      if (existingInvitation) {
        throw new Error(`An invitation for ${normalizedEmail} already exists for this inventory. Please cancel the existing invitation first or wait for it to expire.`);
      }

      // Validate invitation details if provided
      if (invitationDetails.inventoryName && typeof invitationDetails.inventoryName !== 'string') {
        throw new Error('Inventory name must be a text value');
      }
      if (invitationDetails.inviterName && typeof invitationDetails.inviterName !== 'string') {
        throw new Error('Inviter name must be a text value');
      }

      const invitationId = uuidv4();
      const token = this.generateSecureToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (this.invitationExpiryDays * 24 * 60 * 60 * 1000));

      const invitation = {
        pk: `INVITATION#${invitationId}`,
        sk: 'METADATA',
        gsi1pk: `INVENTORY#${inventoryId}`,
        gsi1sk: `INVITATION#${invitationId}`,
        invitationId,
        inventoryId,
        email: normalizedEmail,
        role: normalizedRole,
        invitedBy,
        status: 'pending',
        token,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        ttl: Math.floor(expiresAt.getTime() / 1000) // TTL for automatic cleanup
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: invitation,
        ConditionExpression: 'attribute_not_exists(pk)'
      });

      await this.dynamoClient.send(command);

      // Send invitation email if details are provided
      if (invitationDetails.inventoryName && invitationDetails.inviterName) {
        try {
          const emailService = require('./emailService');
          await emailService.sendInvitationEmail(normalizedEmail, token, {
            inventoryName: invitationDetails.inventoryName.trim(),
            inviterName: invitationDetails.inviterName.trim(),
            role: normalizedRole
          });
          
          console.log(`Invitation email sent successfully to ${normalizedEmail}`);
        } catch (emailError) {
          console.error('Failed to send invitation email:', emailError);
          // Don't fail the invitation creation if email fails
          // The invitation is still valid and can be processed manually
          console.warn(`Invitation created but email delivery failed for ${normalizedEmail}. The invitation can still be processed manually.`);
        }
      }

      // Return invitation without the token for security
      const { token: _, ...safeInvitation } = invitation;
      return safeInvitation;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('Unable to create invitation due to a conflict. Please try again.');
      }
      
      // Enhanced error logging
      console.error('Error creating invitation:', {
        inventoryId,
        email: emailValidation.normalizedEmail,
        role: roleValidation.normalizedRole,
        error: error.message,
        stack: error.stack
      });
      
      // Re-throw with enhanced message if it's not already enhanced
      if (error.message.includes('already exists') || 
          error.message.includes('must be') || 
          error.message.includes('required') ||
          error.message.includes('Invalid')) {
        throw error;
      }
      
      throw new Error(`Failed to create invitation: ${error.message}`);
    }
  }

  /**
   * Get invitation by ID
   * @param {string} invitationId - Invitation ID
   * @returns {Promise<object|null>} Invitation or null if not found
   */
  async getInvitation(invitationId) {
    if (!invitationId) {
      throw new Error('Invitation ID is required');
    }

    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: `INVITATION#${invitationId}`,
          sk: 'METADATA'
        }
      });

      const response = await this.dynamoClient.send(command);
      return response.Item || null;
    } catch (error) {
      console.error('Error getting invitation:', error);
      throw new Error(`Failed to get invitation: ${error.message}`);
    }
  }

  /**
   * Get invitation by token (for processing acceptance)
   * @param {string} token - Invitation token
   * @returns {Promise<object|null>} Invitation or null if not found/expired
   */
  async getInvitationByToken(token) {
    if (!token) {
      throw new Error('Invitation token is required');
    }

    try {
      // We need to scan for the token since it's not in the key
      // In a production system, you might want to create a GSI for tokens
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'begins_with(gsi1pk, :prefix)',
        FilterExpression: '#token = :token AND #status = :status AND #expiresAt > :now',
        ExpressionAttributeNames: {
          '#token': 'token',
          '#status': 'status',
          '#expiresAt': 'expiresAt'
        },
        ExpressionAttributeValues: {
          ':prefix': 'INVENTORY#',
          ':token': token,
          ':status': 'pending',
          ':now': new Date().toISOString()
        }
      });

      const response = await this.dynamoClient.send(command);
      
      if (!response.Items || response.Items.length === 0) {
        return null;
      }

      return response.Items[0];
    } catch (error) {
      console.error('Error getting invitation by token:', error);
      throw new Error(`Failed to get invitation: ${error.message}`);
    }
  }

  /**
   * Get pending invitation by email for an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} email - Email address
   * @returns {Promise<object|null>} Pending invitation or null
   */
  async getPendingInvitationByEmail(inventoryId, email) {
    if (!inventoryId || !email) {
      throw new Error('Inventory ID and email are required');
    }

    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'gsi1pk = :inventoryKey',
        FilterExpression: '#email = :email AND #status = :status AND #expiresAt > :now',
        ExpressionAttributeNames: {
          '#email': 'email',
          '#status': 'status',
          '#expiresAt': 'expiresAt'
        },
        ExpressionAttributeValues: {
          ':inventoryKey': `INVENTORY#${inventoryId}`,
          ':email': email.toLowerCase(),
          ':status': 'pending',
          ':now': new Date().toISOString()
        }
      });

      const response = await this.dynamoClient.send(command);
      
      if (!response.Items || response.Items.length === 0) {
        return null;
      }

      return response.Items[0];
    } catch (error) {
      console.error('Error getting pending invitation by email:', error);
      throw new Error(`Failed to get pending invitation: ${error.message}`);
    }
  }

  /**
   * List pending invitations for an inventory
   * @param {string} inventoryId - Inventory ID
   * @returns {Promise<Array>} Array of pending invitations
   */
  async listPendingInvitations(inventoryId) {
    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }

    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'gsi1pk = :inventoryKey',
        FilterExpression: '#status = :status AND #expiresAt > :now',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#expiresAt': 'expiresAt'
        },
        ExpressionAttributeValues: {
          ':inventoryKey': `INVENTORY#${inventoryId}`,
          ':status': 'pending',
          ':now': new Date().toISOString()
        }
      });

      const response = await this.dynamoClient.send(command);
      
      // Remove tokens from response for security
      return (response.Items || []).map(invitation => {
        const { token, ...safeInvitation } = invitation;
        return safeInvitation;
      });
    } catch (error) {
      console.error('Error listing pending invitations:', error);
      throw new Error(`Failed to list pending invitations: ${error.message}`);
    }
  }

  /**
   * Process invitation acceptance
   * @param {string} token - Invitation token
   * @param {string} userId - User ID who is accepting
   * @returns {Promise<object>} Processed invitation result
   */
  async processInvitation(token, userId) {
    // Enhanced parameter validation
    const { validateInvitationToken, validateUUID } = require('../utils/validation');
    
    const tokenValidation = validateInvitationToken(token);
    if (!tokenValidation.valid) {
      throw new Error(tokenValidation.error);
    }

    if (!userId) {
      throw new Error('User ID is required to accept invitation');
    }

    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

    try {
      // Get invitation by token
      const invitation = await this.getInvitationByToken(token.trim());
      if (!invitation) {
        throw new Error('Invalid invitation token. The invitation may have expired or been cancelled.');
      }

      // Check if invitation is still valid
      if (invitation.status !== 'pending') {
        const statusMessages = {
          'accepted': 'This invitation has already been accepted.',
          'cancelled': 'This invitation has been cancelled by the sender.',
          'expired': 'This invitation has expired.'
        };
        throw new Error(statusMessages[invitation.status] || 'This invitation is no longer valid.');
      }

      const now = new Date();
      const expiresAt = new Date(invitation.expiresAt);
      
      if (expiresAt < now) {
        // Mark as expired
        try {
          await this.updateInvitationStatus(invitation.invitationId, 'expired', 'system');
        } catch (updateError) {
          console.warn('Failed to mark invitation as expired:', updateError.message);
        }
        
        const daysExpired = Math.ceil((now - expiresAt) / (1000 * 60 * 60 * 24));
        throw new Error(`This invitation expired ${daysExpired} day${daysExpired === 1 ? '' : 's'} ago. Please request a new invitation.`);
      }

      // Check if user is trying to accept their own invitation (edge case)
      if (invitation.invitedBy === userId) {
        throw new Error('You cannot accept an invitation that you sent to yourself.');
      }

      // Mark invitation as accepted
      await this.updateInvitationStatus(invitation.invitationId, 'accepted', userId);

      return {
        inventoryId: invitation.inventoryId,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        email: invitation.email
      };
    } catch (error) {
      console.error('Error processing invitation:', {
        userId,
        tokenLength: token ? token.length : 0,
        error: error.message
      });
      
      // Re-throw with enhanced message if it's not already enhanced
      if (error.message.includes('Invalid invitation') || 
          error.message.includes('already been') || 
          error.message.includes('expired') ||
          error.message.includes('cancelled') ||
          error.message.includes('cannot accept')) {
        throw error;
      }
      
      throw new Error(`Failed to process invitation: ${error.message}`);
    }
  }

  /**
   * Cancel an invitation
   * @param {string} invitationId - Invitation ID
   * @param {string} cancelledBy - User ID who is cancelling
   * @returns {Promise<void>}
   */
  async cancelInvitation(invitationId, cancelledBy) {
    if (!invitationId || !cancelledBy) {
      throw new Error('Invitation ID and cancelled by user ID are required');
    }

    try {
      await this.updateInvitationStatus(invitationId, 'cancelled', cancelledBy);
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      throw new Error(`Failed to cancel invitation: ${error.message}`);
    }
  }

  /**
   * Update invitation status
   * @param {string} invitationId - Invitation ID
   * @param {string} status - New status (accepted, cancelled, expired)
   * @param {string} updatedBy - User ID who updated the status
   * @returns {Promise<void>}
   */
  async updateInvitationStatus(invitationId, status, updatedBy) {
    if (!invitationId || !status) {
      throw new Error('Invitation ID and status are required');
    }

    const validStatuses = ['pending', 'accepted', 'cancelled', 'expired'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    try {
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: `INVITATION#${invitationId}`,
          sk: 'METADATA'
        },
        UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #updatedBy = :updatedBy',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#updatedAt': 'updatedAt',
          '#updatedBy': 'updatedBy'
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':updatedAt': new Date().toISOString(),
          ':updatedBy': updatedBy
        },
        ConditionExpression: 'attribute_exists(pk)'
      });

      await this.dynamoClient.send(command);
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('Invitation not found');
      }
      
      console.error('Error updating invitation status:', error);
      throw new Error(`Failed to update invitation status: ${error.message}`);
    }
  }

  /**
   * Generate a cryptographically secure invitation token
   * @returns {string} Secure random token
   */
  generateSecureToken() {
    // Generate 32 bytes of random data and encode as base64url
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Clean up expired invitations (called by scheduled job)
   * @returns {Promise<number>} Number of invitations cleaned up
   */
  async cleanupExpiredInvitations() {
    try {
      // This would typically be implemented as a scheduled Lambda function
      // For now, we'll just mark them as expired when we encounter them
      console.log('Expired invitation cleanup would run here');
      return 0;
    } catch (error) {
      console.error('Error cleaning up expired invitations:', error);
      throw new Error(`Failed to cleanup expired invitations: ${error.message}`);
    }
  }

  /**
   * Resend invitation email
   * @param {string} invitationId - Invitation ID
   * @param {object} invitationDetails - Details for email (inventoryName, inviterName)
   * @returns {Promise<object>} Email send result
   */
  async resendInvitationEmail(invitationId, invitationDetails) {
    if (!invitationId) {
      throw new Error('Invitation ID is required');
    }

    if (!invitationDetails.inventoryName || !invitationDetails.inviterName) {
      throw new Error('Invitation details must include inventoryName and inviterName');
    }

    try {
      const invitation = await this.getInvitation(invitationId);
      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Can only resend pending invitations');
      }

      if (new Date(invitation.expiresAt) < new Date()) {
        throw new Error('Cannot resend expired invitation');
      }

      const emailService = require('./emailService');
      const result = await emailService.sendInvitationEmail(invitation.email, invitation.token, {
        inventoryName: invitationDetails.inventoryName,
        inviterName: invitationDetails.inviterName,
        role: invitation.role
      });

      console.log(`Invitation email resent successfully to ${invitation.email}`);
      return result;
    } catch (error) {
      console.error('Error resending invitation email:', error);
      throw new Error(`Failed to resend invitation email: ${error.message}`);
    }
  }

  /**
   * Get invitation statistics for an inventory
   * @param {string} inventoryId - Inventory ID
   * @returns {Promise<object>} Invitation statistics
   */
  async getInvitationStats(inventoryId) {
    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }

    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'gsi1pk = :inventoryKey',
        ExpressionAttributeValues: {
          ':inventoryKey': `INVENTORY#${inventoryId}`
        }
      });

      const response = await this.dynamoClient.send(command);
      const invitations = response.Items || [];

      const stats = {
        total: invitations.length,
        pending: 0,
        accepted: 0,
        cancelled: 0,
        expired: 0
      };

      const now = new Date();
      invitations.forEach(invitation => {
        if (invitation.status === 'pending' && new Date(invitation.expiresAt) < now) {
          stats.expired++;
        } else {
          stats[invitation.status] = (stats[invitation.status] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting invitation stats:', error);
      throw new Error(`Failed to get invitation stats: ${error.message}`);
    }
  }
}

module.exports = new InvitationService();