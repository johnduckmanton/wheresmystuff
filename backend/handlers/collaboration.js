const collaborationService = require('../services/collaborationService');
const { hasInventoryAccess } = require('../services/dynamodb');
const { success, error } = require('../utils/response');

/**
 * Simple request validation function
 * @param {string} body - Request body JSON string
 * @param {object} schema - Validation schema
 * @returns {object} Validation result
 */
function validateRequest(body, schema) {
  try {
    const data = JSON.parse(body || '{}');
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      if (rules.required && (!data[field] || (Array.isArray(data[field]) && data[field].length === 0))) {
        errors.push(`${field} is required`);
        continue;
      }
      
      if (data[field] && rules.type === 'array') {
        if (!Array.isArray(data[field])) {
          errors.push(`${field} must be an array`);
        } else {
          if (rules.minItems && data[field].length < rules.minItems) {
            errors.push(`${field} must have at least ${rules.minItems} items`);
          }
          if (rules.maxItems && data[field].length > rules.maxItems) {
            errors.push(`${field} must have at most ${rules.maxItems} items`);
          }
        }
      }
      
      if (data[field] && rules.type === 'string') {
        if (typeof data[field] !== 'string') {
          errors.push(`${field} must be a string`);
        } else {
          if (rules.minLength && data[field].length < rules.minLength) {
            errors.push(`${field} must be at least ${rules.minLength} characters`);
          }
          if (rules.maxLength && data[field].length > rules.maxLength) {
            errors.push(`${field} must be at most ${rules.maxLength} characters`);
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      data
    };
  } catch (err) {
    return {
      isValid: false,
      errors: ['Invalid JSON in request body'],
      data: null
    };
  }
}

/**
 * Create a new packing session
 */
exports.createPackingSession = async (event) => {
  try {
    const { inventoryId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    // Validate inventory access
    const hasAccess = await hasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      return error('Access denied to inventory', 403);
    }
    
    // Validate request body
    const validation = validateRequest(event.body, {
      name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500 },
      containerIds: { type: 'array', maxItems: 50 }
    });
    
    if (!validation.isValid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    const session = await collaborationService.createPackingSession(
      inventoryId,
      userId,
      validation.data
    );
    
    return success(session);
    
  } catch (err) {
    console.error('Error creating packing session:', err);
    return error('Failed to create packing session', 500);
  }
};

/**
 * Join a packing session
 */
exports.joinPackingSession = async (event) => {
  try {
    const { sessionId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    const session = await collaborationService.joinPackingSession(sessionId, userId);
    
    return success(session);
    
  } catch (err) {
    console.error('Error joining packing session:', err);
    if (err.message === 'Packing session not found') {
      return error('Packing session not found', 404);
    }
    if (err.message === 'Access denied to inventory') {
      return error('Access denied to inventory', 403);
    }
    if (err.message === 'Session has reached maximum participants') {
      return error('Session has reached maximum participants', 400);
    }
    return error('Failed to join packing session', 500);
  }
};

/**
 * Leave a packing session
 */
exports.leavePackingSession = async (event) => {
  try {
    const { sessionId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    const session = await collaborationService.leavePackingSession(sessionId, userId);
    
    return success(session);
    
  } catch (err) {
    console.error('Error leaving packing session:', err);
    if (err.message === 'Packing session not found') {
      return error('Packing session not found', 404);
    }
    return error('Failed to leave packing session', 500);
  }
};

/**
 * Get active packing sessions for an inventory
 */
exports.getActivePackingSessions = async (event) => {
  try {
    const { inventoryId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    const sessions = await collaborationService.getActivePackingSessions(inventoryId, userId);
    
    return success({
      sessions,
      count: sessions.length
    });
    
  } catch (err) {
    console.error('Error getting packing sessions:', err);
    if (err.message === 'Access denied to inventory') {
      return error('Access denied to inventory', 403);
    }
    return error('Failed to get packing sessions', 500);
  }
};

/**
 * Get activity feed for an inventory
 */
exports.getActivityFeed = async (event) => {
  try {
    const { inventoryId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    // Parse query parameters
    const {
      limit = '50',
      startTime,
      endTime,
      activityType
    } = event.queryStringParameters || {};
    
    // Validate limit
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return error('Limit must be between 1 and 100', 400);
    }
    
    const activities = await collaborationService.getActivityFeed(inventoryId, userId, {
      limit: limitNum,
      startTime,
      endTime,
      activityType
    });
    
    return success({
      activities,
      count: activities.length,
      filters: {
        limit: limitNum,
        startTime,
        endTime,
        activityType
      }
    });
    
  } catch (err) {
    console.error('Error getting activity feed:', err);
    if (err.message === 'Access denied to inventory') {
      return error('Access denied to inventory', 403);
    }
    return error('Failed to get activity feed', 500);
  }
};

/**
 * Assign a user to work on containers
 */
exports.assignUserToContainers = async (event) => {
  try {
    const { inventoryId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    // Validate request body
    const validation = validateRequest(event.body, {
      assignedUserId: { type: 'string', required: true, minLength: 1 },
      containerIds: { type: 'array', required: true, minItems: 1, maxItems: 20 }
    });
    
    if (!validation.isValid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    const { assignedUserId, containerIds } = validation.data;
    
    const assignment = await collaborationService.assignUserToContainers(
      inventoryId,
      assignedUserId,
      containerIds,
      userId
    );
    
    return success(assignment);
    
  } catch (err) {
    console.error('Error assigning user to containers:', err);
    if (err.message === 'Access denied to inventory') {
      return error('Access denied to inventory', 403);
    }
    return error('Failed to assign user to containers', 500);
  }
};

/**
 * Get user assignments for an inventory
 */
exports.getUserAssignments = async (event) => {
  try {
    const { inventoryId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    // Parse query parameters
    const { filterUserId } = event.queryStringParameters || {};
    
    const assignments = await collaborationService.getUserAssignments(
      inventoryId,
      userId,
      filterUserId
    );
    
    return success({
      assignments,
      count: assignments.length,
      filters: {
        filterUserId
      }
    });
    
  } catch (err) {
    console.error('Error getting user assignments:', err);
    if (err.message === 'Access denied to inventory') {
      return error('Access denied to inventory', 403);
    }
    return error('Failed to get user assignments', 500);
  }
};

/**
 * Update assignment status
 */
exports.updateAssignmentStatus = async (event) => {
  try {
    const { assignmentId } = event.pathParameters;
    const userId = event.requestContext.authorizer.claims.sub;
    
    // Validate request body
    const validation = validateRequest(event.body, {
      status: { type: 'string', required: true }
    });
    
    if (!validation.isValid) {
      return error(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }
    
    const { status } = validation.data;
    
    // Validate status value
    if (!['active', 'completed', 'cancelled'].includes(status)) {
      return error('Status must be one of: active, completed, cancelled', 400);
    }
    
    const assignment = await collaborationService.updateAssignmentStatus(
      assignmentId,
      status,
      userId
    );
    
    return success(assignment);
    
  } catch (err) {
    console.error('Error updating assignment status:', err);
    if (err.message === 'Assignment not found') {
      return error('Assignment not found', 404);
    }
    if (err.message === 'Access denied to inventory') {
      return error('Access denied to inventory', 403);
    }
    return error('Failed to update assignment status', 500);
  }
};