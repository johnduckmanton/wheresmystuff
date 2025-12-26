// Mock DynamoDB client to avoid actual database calls during testing
const mockSend = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend }))
  },
  PutCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'PutCommand' } })),
  QueryCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'QueryCommand' } })),
  UpdateCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'UpdateCommand' } })),
  DeleteCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'DeleteCommand' } }))
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn()
}));

const notificationService = require('../services/notificationService');

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  describe('createNotification', () => {
    test('should create a notification successfully', async () => {
      const notificationData = {
        type: 'session_update',
        title: 'Test Notification',
        message: 'This is a test notification',
        data: { sessionId: 'session1' }
      };

      const result = await notificationService.createNotification('user1', 'inv1', notificationData);

      expect(result.userId).toBe('user1');
      expect(result.inventoryId).toBe('inv1');
      expect(result.type).toBe('session_update');
      expect(result.title).toBe('Test Notification');
      expect(result.message).toBe('This is a test notification');
      expect(result.data).toEqual({ sessionId: 'session1' });
      expect(result.read).toBe(false);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        constructor: { name: 'PutCommand' }
      }));
    });

    test('should use default values for optional fields', async () => {
      const result = await notificationService.createNotification('user1', 'inv1', {
        type: 'test',
        title: 'Test',
        message: 'Test message'
      });

      expect(result.data).toEqual({});
      expect(result.expiresAt).toBeDefined();
    });
  });

  describe('getUserNotifications', () => {
    test('should return user notifications', async () => {
      const mockNotifications = [
        { id: 'notif1', title: 'Notification 1', read: false },
        { id: 'notif2', title: 'Notification 2', read: true }
      ];

      mockSend.mockResolvedValueOnce({ Items: mockNotifications });

      const result = await notificationService.getUserNotifications('user1');

      expect(result).toEqual(mockNotifications);
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        constructor: { name: 'QueryCommand' }
      }));
    });

    test('should filter unread notifications when requested', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      await notificationService.getUserNotifications('user1', { unreadOnly: true });

      const call = mockSend.mock.calls[0][0];
      expect(call.input.FilterExpression).toBe('#read = :read');
      expect(call.input.ExpressionAttributeNames['#read']).toBe('read');
      expect(call.input.ExpressionAttributeValues[':read']).toBe(false);
    });

    test('should apply limit correctly', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      await notificationService.getUserNotifications('user1', { limit: 25 });

      const call = mockSend.mock.calls[0][0];
      expect(call.input.Limit).toBe(25);
    });

    test('should return empty array when no notifications found', async () => {
      mockSend.mockResolvedValueOnce({ Items: null });

      const result = await notificationService.getUserNotifications('user1');

      expect(result).toEqual([]);
    });
  });

  describe('markNotificationAsRead', () => {
    test('should mark notification as read successfully', async () => {
      const mockNotifications = [
        { 
          id: 'notif1', 
          title: 'Test', 
          read: false,
          pk: 'USER#user1',
          sk: 'NOTIFICATION#2024-01-01T10:00:00.000Z#notif1'
        }
      ];

      mockSend.mockResolvedValueOnce({ Items: mockNotifications }); // Get notifications
      mockSend.mockResolvedValueOnce({}); // Update notification

      await notificationService.markNotificationAsRead('user1', 'notif1');

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend).toHaveBeenLastCalledWith(expect.objectContaining({
        constructor: { name: 'UpdateCommand' }
      }));
    });

    test('should throw error if notification not found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      await expect(
        notificationService.markNotificationAsRead('user1', 'nonexistent')
      ).rejects.toThrow('Notification not found');
    });
  });

  describe('markAllNotificationsAsRead', () => {
    test('should mark all unread notifications as read', async () => {
      const mockUnreadNotifications = [
        { 
          id: 'notif1', 
          read: false,
          pk: 'USER#user1',
          sk: 'NOTIFICATION#2024-01-01T10:00:00.000Z#notif1'
        },
        { 
          id: 'notif2', 
          read: false,
          pk: 'USER#user1',
          sk: 'NOTIFICATION#2024-01-01T09:00:00.000Z#notif2'
        }
      ];

      mockSend.mockResolvedValueOnce({ Items: mockUnreadNotifications }); // Get unread notifications
      mockSend.mockResolvedValue({}); // Update notifications

      const result = await notificationService.markAllNotificationsAsRead('user1');

      expect(result).toBe(2);
      expect(mockSend).toHaveBeenCalledTimes(3); // 1 query + 2 updates
    });

    test('should return 0 when no unread notifications', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      const result = await notificationService.markAllNotificationsAsRead('user1');

      expect(result).toBe(0);
      expect(mockSend).toHaveBeenCalledTimes(1); // Only the query
    });

    test('should handle errors gracefully and continue processing', async () => {
      const mockUnreadNotifications = [
        { 
          id: 'notif1', 
          read: false,
          pk: 'USER#user1',
          sk: 'NOTIFICATION#2024-01-01T10:00:00.000Z#notif1'
        },
        { 
          id: 'notif2', 
          read: false,
          pk: 'USER#user1',
          sk: 'NOTIFICATION#2024-01-01T09:00:00.000Z#notif2'
        }
      ];

      mockSend.mockResolvedValueOnce({ Items: mockUnreadNotifications }); // Get unread notifications
      mockSend.mockRejectedValueOnce(new Error('Update failed')); // First update fails
      mockSend.mockResolvedValueOnce({}); // Second update succeeds

      const result = await notificationService.markAllNotificationsAsRead('user1');

      expect(result).toBe(1); // Only one succeeded
    });
  });

  describe('deleteNotification', () => {
    test('should delete notification successfully', async () => {
      const mockNotifications = [
        { 
          id: 'notif1', 
          title: 'Test',
          pk: 'USER#user1',
          sk: 'NOTIFICATION#2024-01-01T10:00:00.000Z#notif1'
        }
      ];

      mockSend.mockResolvedValueOnce({ Items: mockNotifications }); // Get notifications
      mockSend.mockResolvedValueOnce({}); // Delete notification

      await notificationService.deleteNotification('user1', 'notif1');

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend).toHaveBeenLastCalledWith(expect.objectContaining({
        constructor: { name: 'DeleteCommand' }
      }));
    });

    test('should throw error if notification not found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      await expect(
        notificationService.deleteNotification('user1', 'nonexistent')
      ).rejects.toThrow('Notification not found');
    });
  });

  describe('notifySessionParticipants', () => {
    test('should create notifications for all participants', async () => {
      const participantIds = ['user1', 'user2', 'user3'];
      const eventData = {
        inventoryId: 'inv1',
        sessionName: 'Test Session',
        userName: 'John Doe'
      };

      const result = await notificationService.notifySessionParticipants(
        'session1',
        participantIds,
        'user_joined',
        eventData
      );

      expect(result).toHaveLength(3);
      expect(mockSend).toHaveBeenCalledTimes(3); // One PutCommand for each participant
      
      result.forEach(notification => {
        expect(notification.type).toBe('session_update');
        expect(notification.title).toBe('User Joined Session');
        expect(notification.message).toContain('John Doe joined the packing session "Test Session"');
        expect(notification.data.sessionId).toBe('session1');
        expect(notification.data.eventType).toBe('user_joined');
      });
    });

    test('should handle different event types correctly', async () => {
      const testCases = [
        {
          eventType: 'user_left',
          expectedTitle: 'User Left Session',
          expectedMessage: 'A user left the packing session "Test Session"'
        },
        {
          eventType: 'items_packed',
          expectedTitle: 'Items Packed',
          expectedMessage: '5 items were packed in "Box 1"'
        },
        {
          eventType: 'container_moved',
          expectedTitle: 'Container Moved',
          expectedMessage: 'Container "Box 1" was moved to Living Room'
        },
        {
          eventType: 'session_completed',
          expectedTitle: 'Session Completed',
          expectedMessage: 'Packing session "Test Session" has been completed'
        }
      ];

      for (const testCase of testCases) {
        mockSend.mockClear();
        
        const eventData = {
          inventoryId: 'inv1',
          sessionName: 'Test Session',
          itemCount: 5,
          containerName: 'Box 1',
          newLocation: 'Living Room'
        };

        const result = await notificationService.notifySessionParticipants(
          'session1',
          ['user1'],
          testCase.eventType,
          eventData
        );

        expect(result[0].title).toBe(testCase.expectedTitle);
        expect(result[0].message).toBe(testCase.expectedMessage);
      }
    });

    test('should handle errors gracefully and continue processing', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('Failed to create notification'))
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await notificationService.notifySessionParticipants(
        'session1',
        ['user1', 'user2', 'user3'],
        'user_joined',
        { inventoryId: 'inv1', sessionName: 'Test Session' }
      );

      expect(result).toHaveLength(2); // Only 2 succeeded
    });
  });

  describe('notifyAssignmentUpdate', () => {
    test('should create assignment notification successfully', async () => {
      const eventData = {
        containerCount: 3,
        assignmentId: 'assignment1'
      };

      const result = await notificationService.notifyAssignmentUpdate(
        'user1',
        'inv1',
        'assigned',
        eventData
      );

      expect(result.type).toBe('assignment_update');
      expect(result.title).toBe('New Assignment');
      expect(result.message).toBe('You have been assigned to work on 3 container(s)');
      expect(result.data.eventType).toBe('assigned');
      expect(result.data.containerCount).toBe(3);
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        constructor: { name: 'PutCommand' }
      }));
    });

    test('should handle different assignment event types', async () => {
      const testCases = [
        {
          eventType: 'assignment_completed',
          expectedTitle: 'Assignment Completed',
          expectedMessage: 'Assignment for 2 container(s) has been completed'
        },
        {
          eventType: 'assignment_cancelled',
          expectedTitle: 'Assignment Cancelled',
          expectedMessage: 'Assignment for 2 container(s) has been cancelled'
        },
        {
          eventType: 'unknown',
          expectedTitle: 'Assignment Update',
          expectedMessage: 'Your assignment has been updated'
        }
      ];

      for (const testCase of testCases) {
        mockSend.mockClear();
        
        const result = await notificationService.notifyAssignmentUpdate(
          'user1',
          'inv1',
          testCase.eventType,
          { containerCount: 2 }
        );

        expect(result.title).toBe(testCase.expectedTitle);
        expect(result.message).toBe(testCase.expectedMessage);
      }
    });
  });

  describe('getDefaultExpiry', () => {
    test('should return date 30 days from now', () => {
      const result = notificationService.getDefaultExpiry();
      const expiryDate = new Date(result);
      const now = new Date();
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 30);

      expect(expiryDate.getTime()).toBeCloseTo(expectedDate.getTime(), -1000); // Within 1 second
    });
  });
});