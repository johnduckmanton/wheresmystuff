const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { hasInventoryAccess } = require('./dynamodb');
const { logDataAccess } = require('./auditLogService');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';

/**
 * Collaboration Service
 * Handles multi-user packing sessions, activity feeds, and user assignments
 */
class CollaborationService {
  /**
   * Create a new packing session for collaborative work
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User creating the session
   * @param {object} sessionData - Session configuration
   * @returns {Promise<object>} Created session
   */
  async createPackingSession(inventoryId, userId, sessionData) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const sessionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const session = {
      pk: `INV#${inventoryId}`,
      sk: `SESSION#${sessionId}`,
      id: sessionId,
      inventoryId,
      name: sessionData.name || 'Packing Session',
      description: sessionData.description || '',
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'active',
      participants: [userId],
      containerIds: sessionData.containerIds || [],
      settings: {
        allowMultipleUsers: sessionData.allowMultipleUsers !== false,
        autoAssignItems: sessionData.autoAssignItems || false,
        notifyOnChanges: sessionData.notifyOnChanges !== false,
        maxParticipants: sessionData.maxParticipants || 10
      },
      stats: {
        itemsPacked: 0,
        containersUsed: 0,
        participantCount: 1
      }
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: session,
      ConditionExpression: 'attribute_not_exists(pk)'
    }));

    // Log session creation
    await logDataAccess(userId, 'create', 'packing_session', sessionId, inventoryId);

    return session;
  }

  /**
   * Join an existing packing session
   * @param {string} sessionId - Session ID to join
   * @param {string} userId - User joining the session
   * @returns {Promise<object>} Updated session
   */
  async joinPackingSession(sessionId, userId) {
    // Get the session
    const sessionResponse = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'SessionIndex',
      KeyConditionExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: {
        ':sessionId': sessionId
      }
    }));

    if (!sessionResponse.Items || sessionResponse.Items.length === 0) {
      throw new Error('Packing session not found');
    }

    const session = sessionResponse.Items[0];
    
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, session.inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Check if user is already a participant
    if (session.participants.includes(userId)) {
      return session;
    }

    // Check participant limit
    if (session.participants.length >= session.settings.maxParticipants) {
      throw new Error('Session has reached maximum participants');
    }

    // Add user to participants
    const updatedParticipants = [...session.participants, userId];
    
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: session.pk,
        sk: session.sk
      },
      UpdateExpression: 'SET participants = :participants, #stats.participantCount = :count, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#stats': 'stats'
      },
      ExpressionAttributeValues: {
        ':participants': updatedParticipants,
        ':count': updatedParticipants.length,
        ':updatedAt': new Date().toISOString()
      }
    }));

    // Log session join
    await logDataAccess(userId, 'update', 'packing_session_join', sessionId, session.inventoryId);

    // Create activity entry
    await this.createActivityEntry(session.inventoryId, {
      type: 'session_join',
      userId,
      sessionId,
      details: {
        sessionName: session.name
      }
    });

    return {
      ...session,
      participants: updatedParticipants,
      stats: {
        ...session.stats,
        participantCount: updatedParticipants.length
      }
    };
  }

  /**
   * Leave a packing session
   * @param {string} sessionId - Session ID to leave
   * @param {string} userId - User leaving the session
   * @returns {Promise<object>} Updated session
   */
  async leavePackingSession(sessionId, userId) {
    // Get the session
    const sessionResponse = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'SessionIndex',
      KeyConditionExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: {
        ':sessionId': sessionId
      }
    }));

    if (!sessionResponse.Items || sessionResponse.Items.length === 0) {
      throw new Error('Packing session not found');
    }

    const session = sessionResponse.Items[0];
    
    // Remove user from participants
    const updatedParticipants = session.participants.filter(id => id !== userId);
    
    // If no participants left, mark session as inactive
    const newStatus = updatedParticipants.length === 0 ? 'inactive' : session.status;
    
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: session.pk,
        sk: session.sk
      },
      UpdateExpression: 'SET participants = :participants, #stats.participantCount = :count, #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#stats': 'stats',
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':participants': updatedParticipants,
        ':count': updatedParticipants.length,
        ':status': newStatus,
        ':updatedAt': new Date().toISOString()
      }
    }));

    // Log session leave
    await logDataAccess(userId, 'update', 'packing_session_leave', sessionId, session.inventoryId);

    // Create activity entry
    await this.createActivityEntry(session.inventoryId, {
      type: 'session_leave',
      userId,
      sessionId,
      details: {
        sessionName: session.name
      }
    });

    return {
      ...session,
      participants: updatedParticipants,
      status: newStatus,
      stats: {
        ...session.stats,
        participantCount: updatedParticipants.length
      }
    };
  }

  /**
   * Get active packing sessions for an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User requesting sessions
   * @returns {Promise<Array>} Array of active sessions
   */
  async getActivePackingSessions(inventoryId, userId) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const response = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':pk': `INV#${inventoryId}`,
        ':sk': 'SESSION#',
        ':status': 'active'
      }
    }));

    // Log access
    await logDataAccess(userId, 'read', 'packing_sessions', inventoryId, inventoryId);

    return response.Items || [];
  }

  /**
   * Create an activity entry for the activity feed
   * @param {string} inventoryId - Inventory ID
   * @param {object} activityData - Activity data
   * @returns {Promise<object>} Created activity entry
   */
  async createActivityEntry(inventoryId, activityData) {
    const activityId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const activity = {
      pk: `INV#${inventoryId}`,
      sk: `ACTIVITY#${timestamp}#${activityId}`,
      id: activityId,
      inventoryId,
      type: activityData.type,
      userId: activityData.userId,
      timestamp,
      details: activityData.details || {},
      metadata: {
        sessionId: activityData.sessionId,
        containerId: activityData.containerId,
        itemIds: activityData.itemIds
      }
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: activity
    }));

    return activity;
  }

  /**
   * Get activity feed for an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User requesting feed
   * @param {object} options - Query options
   * @returns {Promise<Array>} Array of activity entries
   */
  async getActivityFeed(inventoryId, userId, options = {}) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    const { limit = 50, startTime, endTime, activityType } = options;
    
    let keyConditionExpression = 'pk = :pk AND begins_with(sk, :sk)';
    let filterExpression = '';
    const expressionAttributeValues = {
      ':pk': `INV#${inventoryId}`,
      ':sk': 'ACTIVITY#'
    };

    // Add time range filter if specified
    if (startTime || endTime) {
      if (startTime && endTime) {
        keyConditionExpression += ' AND sk BETWEEN :startTime AND :endTime';
        expressionAttributeValues[':startTime'] = `ACTIVITY#${startTime}`;
        expressionAttributeValues[':endTime'] = `ACTIVITY#${endTime}#ZZZZ`;
      } else if (startTime) {
        keyConditionExpression += ' AND sk >= :startTime';
        expressionAttributeValues[':startTime'] = `ACTIVITY#${startTime}`;
      } else if (endTime) {
        keyConditionExpression += ' AND sk <= :endTime';
        expressionAttributeValues[':endTime'] = `ACTIVITY#${endTime}#ZZZZ`;
      }
    }

    // Add activity type filter if specified
    if (activityType) {
      filterExpression = '#type = :type';
      expressionAttributeValues[':type'] = activityType;
    }

    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ScanIndexForward: false, // Most recent first
      Limit: limit
    };

    if (filterExpression) {
      queryParams.FilterExpression = filterExpression;
      queryParams.ExpressionAttributeNames = { '#type': 'type' };
    }

    const response = await docClient.send(new QueryCommand(queryParams));

    // Log access
    await logDataAccess(userId, 'read', 'activity_feed', inventoryId, inventoryId);

    return response.Items || [];
  }

  /**
   * Assign a user to work on specific containers
   * @param {string} inventoryId - Inventory ID
   * @param {string} assignedUserId - User being assigned
   * @param {string[]} containerIds - Container IDs to assign
   * @param {string} assignedBy - User making the assignment
   * @returns {Promise<object>} Assignment result
   */
  async assignUserToContainers(inventoryId, assignedUserId, containerIds, assignedBy) {
    // Validate inventory access for both users
    const hasAccessAssigner = await hasInventoryAccess(assignedBy, inventoryId);
    const hasAccessAssigned = await hasInventoryAccess(assignedUserId, inventoryId);
    
    if (!hasAccessAssigner || !hasAccessAssigned) {
      throw new Error('Access denied to inventory');
    }

    const assignmentId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const assignment = {
      pk: `INV#${inventoryId}`,
      sk: `ASSIGNMENT#${assignmentId}`,
      id: assignmentId,
      inventoryId,
      assignedUserId,
      assignedBy,
      containerIds,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      dueDate: null,
      notes: ''
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: assignment
    }));

    // Log assignment
    await logDataAccess(assignedBy, 'create', 'user_assignment', assignmentId, inventoryId);

    // Create activity entry
    await this.createActivityEntry(inventoryId, {
      type: 'user_assignment',
      userId: assignedBy,
      details: {
        assignedUserId,
        containerIds,
        containerCount: containerIds.length
      }
    });

    return assignment;
  }

  /**
   * Get user assignments for an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User requesting assignments
   * @param {string} filterUserId - Optional user ID to filter assignments
   * @returns {Promise<Array>} Array of assignments
   */
  async getUserAssignments(inventoryId, userId, filterUserId = null) {
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    let queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `INV#${inventoryId}`,
        ':sk': 'ASSIGNMENT#'
      }
    };

    // Filter by specific user if requested
    if (filterUserId) {
      queryParams.FilterExpression = 'assignedUserId = :userId';
      queryParams.ExpressionAttributeValues[':userId'] = filterUserId;
    }

    const response = await docClient.send(new QueryCommand(queryParams));

    // Log access
    await logDataAccess(userId, 'read', 'user_assignments', inventoryId, inventoryId);

    return response.Items || [];
  }

  /**
   * Update assignment status
   * @param {string} assignmentId - Assignment ID
   * @param {string} status - New status (active, completed, cancelled)
   * @param {string} userId - User updating the assignment
   * @returns {Promise<object>} Updated assignment
   */
  async updateAssignmentStatus(assignmentId, status, userId) {
    // Get the assignment first to validate access
    const assignmentResponse = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'AssignmentIndex',
      KeyConditionExpression: 'assignmentId = :assignmentId',
      ExpressionAttributeValues: {
        ':assignmentId': assignmentId
      }
    }));

    if (!assignmentResponse.Items || assignmentResponse.Items.length === 0) {
      throw new Error('Assignment not found');
    }

    const assignment = assignmentResponse.Items[0];
    
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, assignment.inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied to inventory');
    }

    // Update assignment
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: assignment.pk,
        sk: assignment.sk
      },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': new Date().toISOString()
      }
    }));

    // Log status update
    await logDataAccess(userId, 'update', 'assignment_status', assignmentId, assignment.inventoryId);

    // Create activity entry
    await this.createActivityEntry(assignment.inventoryId, {
      type: 'assignment_status_change',
      userId,
      details: {
        assignmentId,
        newStatus: status,
        assignedUserId: assignment.assignedUserId
      }
    });

    return {
      ...assignment,
      status,
      updatedAt: new Date().toISOString()
    };
  }
}

module.exports = new CollaborationService();