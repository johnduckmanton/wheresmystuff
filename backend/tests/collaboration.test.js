// Mock DynamoDB client to avoid actual database calls during testing
const mockSend = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend }))
  },
  PutCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'PutCommand' } })),
  GetCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'GetCommand' } })),
  QueryCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'QueryCommand' } })),
  UpdateCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'UpdateCommand' } })),
  DeleteCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'DeleteCommand' } }))
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn()
}));

// Mock services
jest.mock('../services/dynamodb', () => ({
  hasInventoryAccess: jest.fn()
}));

jest.mock('../services/auditLogService', () => ({
  logDataAccess: jest.fn()
}));

const collaborationService = require('../services/collaborationService');
const { hasInventoryAccess } = require('../services/dynamodb');
const { logDataAccess } = require('../services/auditLogService');

describe('Collaboration Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
    hasInventoryAccess.mockResolvedValue(true);
  });

  describe('createPackingSession', () => {
    test('should create a packing session successfully', async () => {
      const sessionData = {
        name: 'Test Session',
        description: 'Test description',
        containerIds: ['container1', 'container2'],
        allowMultipleUsers: true
      };

      const result = await collaborationService.createPackingSession('inv1', 'user1', sessionData);

      expect(result.name).toBe('Test Session');
      expect(result.description).toBe('Test description');
      expect(result.createdBy).toBe('user1');
      expect(result.participants).toEqual(['user1']);
      expect(result.containerIds).toEqual(['container1', 'container2']);
      expect(result.status).toBe('active');
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        constructor: { name: 'PutCommand' }
      }));
      expect(logDataAccess).toHaveBeenCalledWith('user1', 'create', 'packing_session', expect.any(String), 'inv1');
    });

    test('should deny access for unauthorized users', async () => {
      hasInventoryAccess.mockResolvedValue(false);

      await expect(
        collaborationService.createPackingSession('inv1', 'user1', { name: 'Test' })
      ).rejects.toThrow('Access denied to inventory');
    });

    test('should use default values for optional fields', async () => {
      const result = await collaborationService.createPackingSession('inv1', 'user1', {});

      expect(result.name).toBe('Packing Session');
      expect(result.description).toBe('');
      expect(result.containerIds).toEqual([]);
      expect(result.settings.allowMultipleUsers).toBe(true);
      expect(result.settings.maxParticipants).toBe(10);
    });
  });

  describe('joinPackingSession', () => {
    test('should join a session successfully', async () => {
      const mockSession = {
        id: 'session1',
        inventoryId: 'inv1',
        name: 'Test Session',
        participants: ['user1'],
        settings: { maxParticipants: 10 },
        stats: { participantCount: 1 },
        pk: 'INV#inv1',
        sk: 'SESSION#session1'
      };

      mockSend.mockResolvedValueOnce({ Items: [mockSession] }); // Query session
      mockSend.mockResolvedValueOnce({}); // Update session

      const result = await collaborationService.joinPackingSession('session1', 'user2');

      expect(result.participants).toContain('user2');
      expect(result.stats.participantCount).toBe(2);
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        constructor: { name: 'UpdateCommand' }
      }));
      expect(logDataAccess).toHaveBeenCalledWith('user2', 'update', 'packing_session_join', 'session1', 'inv1');
    });

    test('should not join if user is already a participant', async () => {
      const mockSession = {
        id: 'session1',
        inventoryId: 'inv1',
        participants: ['user1', 'user2'],
        settings: { maxParticipants: 10 }
      };

      mockSend.mockResolvedValueOnce({ Items: [mockSession] });

      const result = await collaborationService.joinPackingSession('session1', 'user2');

      expect(result).toEqual(mockSession);
      // Should not call update since user is already a participant
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('should reject if session is at max participants', async () => {
      const mockSession = {
        id: 'session1',
        inventoryId: 'inv1',
        participants: ['user1', 'user2'],
        settings: { maxParticipants: 2 }
      };

      mockSend.mockResolvedValueOnce({ Items: [mockSession] });

      await expect(
        collaborationService.joinPackingSession('session1', 'user3')
      ).rejects.toThrow('Session has reached maximum participants');
    });

    test('should throw error if session not found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      await expect(
        collaborationService.joinPackingSession('session1', 'user2')
      ).rejects.toThrow('Packing session not found');
    });
  });

  describe('leavePackingSession', () => {
    test('should leave a session successfully', async () => {
      const mockSession = {
        id: 'session1',
        inventoryId: 'inv1',
        name: 'Test Session',
        participants: ['user1', 'user2'],
        status: 'active',
        stats: { participantCount: 2 },
        pk: 'INV#inv1',
        sk: 'SESSION#session1'
      };

      mockSend.mockResolvedValueOnce({ Items: [mockSession] }); // Query session
      mockSend.mockResolvedValueOnce({}); // Update session

      const result = await collaborationService.leavePackingSession('session1', 'user2');

      expect(result.participants).not.toContain('user2');
      expect(result.participants).toContain('user1');
      expect(result.stats.participantCount).toBe(1);
      expect(result.status).toBe('active');
      expect(logDataAccess).toHaveBeenCalledWith('user2', 'update', 'packing_session_leave', 'session1', 'inv1');
    });

    test('should mark session as inactive when last participant leaves', async () => {
      const mockSession = {
        id: 'session1',
        inventoryId: 'inv1',
        participants: ['user1'],
        status: 'active',
        stats: { participantCount: 1 },
        pk: 'INV#inv1',
        sk: 'SESSION#session1'
      };

      mockSend.mockResolvedValueOnce({ Items: [mockSession] });
      mockSend.mockResolvedValueOnce({});

      const result = await collaborationService.leavePackingSession('session1', 'user1');

      expect(result.participants).toHaveLength(0);
      expect(result.status).toBe('inactive');
      expect(result.stats.participantCount).toBe(0);
    });
  });

  describe('getActivePackingSessions', () => {
    test('should return active sessions', async () => {
      const mockSessions = [
        { id: 'session1', status: 'active', name: 'Session 1' },
        { id: 'session2', status: 'active', name: 'Session 2' }
      ];

      mockSend.mockResolvedValueOnce({ Items: mockSessions });

      const result = await collaborationService.getActivePackingSessions('inv1', 'user1');

      expect(result).toEqual(mockSessions);
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        constructor: { name: 'QueryCommand' }
      }));
      expect(logDataAccess).toHaveBeenCalledWith('user1', 'read', 'packing_sessions', 'inv1', 'inv1');
    });

    test('should deny access for unauthorized users', async () => {
      hasInventoryAccess.mockResolvedValue(false);

      await expect(
        collaborationService.getActivePackingSessions('inv1', 'user1')
      ).rejects.toThrow('Access denied to inventory');
    });
  });

  describe('createActivityEntry', () => {
    test('should create an activity entry', async () => {
      const activityData = {
        type: 'items_packed',
        userId: 'user1',
        details: { containerName: 'Box 1', itemCount: 5 }
      };

      const result = await collaborationService.createActivityEntry('inv1', activityData);

      expect(result.type).toBe('items_packed');
      expect(result.userId).toBe('user1');
      expect(result.inventoryId).toBe('inv1');
      expect(result.details).toEqual(activityData.details);
      expect(result.timestamp).toBeDefined();
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        constructor: { name: 'PutCommand' }
      }));
    });
  });

  describe('getActivityFeed', () => {
    test('should return activity feed', async () => {
      const mockActivities = [
        { id: 'activity1', type: 'items_packed', timestamp: '2024-01-01T10:00:00.000Z' },
        { id: 'activity2', type: 'session_join', timestamp: '2024-01-01T09:00:00.000Z' }
      ];

      mockSend.mockResolvedValueOnce({ Items: mockActivities });

      const result = await collaborationService.getActivityFeed('inv1', 'user1');

      expect(result).toEqual(mockActivities);
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        constructor: { name: 'QueryCommand' }
      }));
      expect(logDataAccess).toHaveBeenCalledWith('user1', 'read', 'activity_feed', 'inv1', 'inv1');
    });

    test('should apply filters correctly', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      await collaborationService.getActivityFeed('inv1', 'user1', {
        limit: 25,
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-02T00:00:00.000Z',
        activityType: 'items_packed'
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.input.Limit).toBe(25);
      expect(call.input.FilterExpression).toContain('#type = :type');
      expect(call.input.ExpressionAttributeValues[':type']).toBe('items_packed');
    });
  });

  describe('assignUserToContainers', () => {
    test('should create user assignment successfully', async () => {
      const result = await collaborationService.assignUserToContainers(
        'inv1',
        'user2',
        ['container1', 'container2'],
        'user1'
      );

      expect(result.assignedUserId).toBe('user2');
      expect(result.assignedBy).toBe('user1');
      expect(result.containerIds).toEqual(['container1', 'container2']);
      expect(result.status).toBe('active');
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        constructor: { name: 'PutCommand' }
      }));
      expect(logDataAccess).toHaveBeenCalledWith('user1', 'create', 'user_assignment', expect.any(String), 'inv1');
    });

    test('should deny access if assigner lacks permission', async () => {
      hasInventoryAccess.mockImplementation((userId) => userId !== 'user1');

      await expect(
        collaborationService.assignUserToContainers('inv1', 'user2', ['container1'], 'user1')
      ).rejects.toThrow('Access denied to inventory');
    });

    test('should deny access if assigned user lacks permission', async () => {
      hasInventoryAccess.mockImplementation((userId) => userId !== 'user2');

      await expect(
        collaborationService.assignUserToContainers('inv1', 'user2', ['container1'], 'user1')
      ).rejects.toThrow('Access denied to inventory');
    });
  });

  describe('getUserAssignments', () => {
    test('should return user assignments', async () => {
      const mockAssignments = [
        { id: 'assignment1', assignedUserId: 'user1', status: 'active' },
        { id: 'assignment2', assignedUserId: 'user2', status: 'active' }
      ];

      mockSend.mockResolvedValueOnce({ Items: mockAssignments });

      const result = await collaborationService.getUserAssignments('inv1', 'user1');

      expect(result).toEqual(mockAssignments);
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        constructor: { name: 'QueryCommand' }
      }));
      expect(logDataAccess).toHaveBeenCalledWith('user1', 'read', 'user_assignments', 'inv1', 'inv1');
    });

    test('should filter by user ID when specified', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      await collaborationService.getUserAssignments('inv1', 'user1', 'user2');

      const call = mockSend.mock.calls[0][0];
      expect(call.input.FilterExpression).toBe('assignedUserId = :userId');
      expect(call.input.ExpressionAttributeValues[':userId']).toBe('user2');
    });
  });

  describe('updateAssignmentStatus', () => {
    test('should update assignment status successfully', async () => {
      const mockAssignment = {
        id: 'assignment1',
        inventoryId: 'inv1',
        assignedUserId: 'user2',
        status: 'active',
        pk: 'INV#inv1',
        sk: 'ASSIGNMENT#assignment1'
      };

      mockSend.mockResolvedValueOnce({ Items: [mockAssignment] }); // Query assignment
      mockSend.mockResolvedValueOnce({}); // Update assignment

      const result = await collaborationService.updateAssignmentStatus('assignment1', 'completed', 'user1');

      expect(result.status).toBe('completed');
      expect(result.updatedAt).toBeDefined();
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        constructor: { name: 'UpdateCommand' }
      }));
      expect(logDataAccess).toHaveBeenCalledWith('user1', 'update', 'assignment_status', 'assignment1', 'inv1');
    });

    test('should throw error if assignment not found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      await expect(
        collaborationService.updateAssignmentStatus('assignment1', 'completed', 'user1')
      ).rejects.toThrow('Assignment not found');
    });
  });
});