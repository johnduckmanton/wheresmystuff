const notificationService = require('../services/notificationService');
const { success, error } = require('../utils/response');

/**
 * Get notifications for the current user
 */
exports.getUserNotifications = async (event) => {
  try {
    const userId = event.requestContext.authorizer.claims.sub;
    
    // Parse query parameters
    const {
      limit = '50',
      unreadOnly = 'false'
    } = event.queryStringParameters || {};
    
    // Validate limit
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return error('Limit must be between 1 and 100', 400);
    }
    
    const notifications = await notificationService.getUserNotifications(userId, {
      limit: limitNum,
      unreadOnly: unreadOnly === 'true'
    });
    
    return success({
      notifications,
      count: notifications.length,
      unreadCount: notifications.filter(n => !n.read).length
    });
    
  } catch (err) {
    console.error('Error getting user notifications:', err);
    return error('Failed to get notifications', 500);
  }
};

/**
 * Mark a notification as read
 */
exports.markNotificationAsRead = async (event) => {
  try {
    const { notificationId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    await notificationService.markNotificationAsRead(userId, notificationId);
    
    return success({ message: 'Notification marked as read' });
    
  } catch (err) {
    console.error('Error marking notification as read:', err);
    if (err.message === 'Notification not found') {
      return error('Notification not found', 404);
    }
    return error('Failed to mark notification as read', 500);
  }
};

/**
 * Mark all notifications as read
 */
exports.markAllNotificationsAsRead = async (event) => {
  try {
    const userId = event.requestContext.authorizer.claims.sub;
    
    const markedCount = await notificationService.markAllNotificationsAsRead(userId);
    
    return success({ 
      message: 'All notifications marked as read',
      markedCount 
    });
    
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    return error('Failed to mark all notifications as read', 500);
  }
};

/**
 * Delete a notification
 */
exports.deleteNotification = async (event) => {
  try {
    const { notificationId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    await notificationService.deleteNotification(userId, notificationId);
    
    return success({ message: 'Notification deleted' });
    
  } catch (err) {
    console.error('Error deleting notification:', err);
    if (err.message === 'Notification not found') {
      return error('Notification not found', 404);
    }
    return error('Failed to delete notification', 500);
  }
};