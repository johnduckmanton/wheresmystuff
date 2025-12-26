const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Notification Service
 * Handles real-time notifications and updates for collaboration features
 */
class NotificationService {
  /**
   * Create a notification for a user
   * @param {string} userId - User to notify
   * @param {string} inventoryId - Inventory ID
   * @param {object} notificationData - Notification data
   * @returns {Promise<object>} Created notification
   */
  async createNotification(userId, inventoryId, notificationData) {
    const notificationId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const notification = {
      pk: `USER#${userId}`,
      sk: `NOTIFICATION#${timestamp}#${notificationId}`,
      id: notificationId,
      userId,
      inventoryId,
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data || {},
      read: false,
      createdAt: timestamp,
      expiresAt: notificationData.expiresAt || this.getDefaultExpiry()
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: notification
    }));

    return notification;
  }

  /**
   * Get notifications for a user
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {Promise<Array>} Array of notifications
   */
  async getUserNotifications(userId, options = {}) {
    const { limit = 50, unreadOnly = false } = options;
    
    let queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'NOTIFICATION#'
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit
    };

    if (unreadOnly) {
      queryParams.FilterExpression = '#read = :read';
      queryParams.ExpressionAttributeNames = { '#read': 'read' };
      queryParams.ExpressionAttributeValues[':read'] = false;
    }

    const response = await docClient.send(new QueryCommand(queryParams));
    return response.Items || [];
  }

  /**
   * Mark notification as read
   * @param {string} userId - User ID
   * @param {string} notificationId - Notification ID
   * @returns {Promise<void>}
   */
  async markNotificationAsRead(userId, notificationId) {
    // Find the notification
    const notifications = await this.getUserNotifications(userId);
    const notification = notifications.find(n => n.id === notificationId);
    
    if (!notification) {
      throw new Error('Notification not found');
    }

    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: notification.pk,
        sk: notification.sk
      },
      UpdateExpression: 'SET #read = :read',
      ExpressionAttributeNames: {
        '#read': 'read'
      },
      ExpressionAttributeValues: {
        ':read': true
      }
    }));
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of notifications marked as read
   */
  async markAllNotificationsAsRead(userId) {
    const unreadNotifications = await this.getUserNotifications(userId, { unreadOnly: true });
    
    let markedCount = 0;
    
    // Process in batches of 25 (DynamoDB batch limit)
    for (let i = 0; i < unreadNotifications.length; i += 25) {
      const batch = unreadNotifications.slice(i, i + 25);
      
      for (const notification of batch) {
        try {
          await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              pk: notification.pk,
              sk: notification.sk
            },
            UpdateExpression: 'SET #read = :read',
            ExpressionAttributeNames: {
              '#read': 'read'
            },
            ExpressionAttributeValues: {
              ':read': true
            }
          }));
          markedCount++;
        } catch (error) {
          console.error(`Error marking notification ${notification.id} as read:`, error);
        }
      }
    }
    
    return markedCount;
  }

  /**
   * Delete a notification
   * @param {string} userId - User ID
   * @param {string} notificationId - Notification ID
   * @returns {Promise<void>}
   */
  async deleteNotification(userId, notificationId) {
    // Find the notification
    const notifications = await this.getUserNotifications(userId);
    const notification = notifications.find(n => n.id === notificationId);
    
    if (!notification) {
      throw new Error('Notification not found');
    }

    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: notification.pk,
        sk: notification.sk
      }
    }));
  }

  /**
   * Notify users about packing session events
   * @param {string} sessionId - Session ID
   * @param {string[]} participantIds - Participant user IDs
   * @param {string} eventType - Event type
   * @param {object} eventData - Event data
   * @returns {Promise<Array>} Created notifications
   */
  async notifySessionParticipants(sessionId, participantIds, eventType, eventData) {
    const notifications = [];
    
    for (const userId of participantIds) {
      try {
        let title, message;
        
        switch (eventType) {
          case 'user_joined':
            title = 'User Joined Session';
            message = `${eventData.userName || 'A user'} joined the packing session "${eventData.sessionName}"`;
            break;
          case 'user_left':
            title = 'User Left Session';
            message = `${eventData.userName || 'A user'} left the packing session "${eventData.sessionName}"`;
            break;
          case 'items_packed':
            title = 'Items Packed';
            message = `${eventData.itemCount} items were packed in "${eventData.containerName}"`;
            break;
          case 'container_moved':
            title = 'Container Moved';
            message = `Container "${eventData.containerName}" was moved to ${eventData.newLocation}`;
            break;
          case 'session_completed':
            title = 'Session Completed';
            message = `Packing session "${eventData.sessionName}" has been completed`;
            break;
          default:
            title = 'Session Update';
            message = `Update in packing session "${eventData.sessionName}"`;
        }
        
        const notification = await this.createNotification(userId, eventData.inventoryId, {
          type: 'session_update',
          title,
          message,
          data: {
            sessionId,
            eventType,
            ...eventData
          }
        });
        
        notifications.push(notification);
      } catch (error) {
        console.error(`Error creating notification for user ${userId}:`, error);
      }
    }
    
    return notifications;
  }

  /**
   * Notify user about assignment updates
   * @param {string} userId - User to notify
   * @param {string} inventoryId - Inventory ID
   * @param {string} eventType - Event type
   * @param {object} eventData - Event data
   * @returns {Promise<object>} Created notification
   */
  async notifyAssignmentUpdate(userId, inventoryId, eventType, eventData) {
    let title, message;
    
    switch (eventType) {
      case 'assigned':
        title = 'New Assignment';
        message = `You have been assigned to work on ${eventData.containerCount} container(s)`;
        break;
      case 'assignment_completed':
        title = 'Assignment Completed';
        message = `Assignment for ${eventData.containerCount} container(s) has been completed`;
        break;
      case 'assignment_cancelled':
        title = 'Assignment Cancelled';
        message = `Assignment for ${eventData.containerCount} container(s) has been cancelled`;
        break;
      default:
        title = 'Assignment Update';
        message = 'Your assignment has been updated';
    }
    
    return await this.createNotification(userId, inventoryId, {
      type: 'assignment_update',
      title,
      message,
      data: {
        eventType,
        ...eventData
      }
    });
  }

  /**
   * Get default expiry time for notifications (30 days from now)
   * @returns {string} ISO timestamp
   */
  getDefaultExpiry() {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    return expiryDate.toISOString();
  }

  /**
   * Clean up expired notifications
   * @returns {Promise<number>} Number of notifications cleaned up
   */
  async cleanupExpiredNotifications() {
    const now = new Date().toISOString();
    let cleanedCount = 0;
    
    // This would typically be implemented as a scheduled job
    // For now, we'll just provide the structure
    console.log(`Cleanup would remove notifications expired before ${now}`);
    
    return cleanedCount;
  }
}

module.exports = new NotificationService();