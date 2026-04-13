const userService = require('../services/userService');
const invitationService = require('../services/invitationService');
const inventoryService = require('../services/inventoryService');
const { validateRequired, validateUUID, sanitizeInput, validateAndSanitize, validateEmail, validateUserRole, validateInvitationToken } = require('../utils/validation');
const { success, error, secureError, getAllHeaders } = require('../utils/response');
const { createValidationErrorResponse } = require('../utils/errorHandler');
const { authenticate } = require('../middleware/auth');
const { withRateLimit } = require('../middleware/rateLimit');
const { withCorsValidation } = require('../middleware/corsValidation');
const { logDataAccess } = require('../services/auditLogService');

/**
 * Lambda handler for User Management operations
 * Handles user lookup, invitation management, member role management, and user profiles
 */
const userHandler = async (event) => {
  const origin = event.headers?.Origin || event.headers?.origin;
  const context = {
    endpoint: '/users',
    method: event.requestContext.http.method,
    userId: event.user?.userId,
    ipAddress: event.requestContext.http.sourceIp,
    userAgent: event.headers?.['user-agent'],
    requestData: {
      pathParameters: event.pathParameters,
      queryStringParameters: event.queryStringParameters,
      body: event.body ? JSON.parse(event.body) : null
    }
  };

  try {
    // Authenticate the request
    await authenticate(event);
    
    const httpMethod = event.requestContext.http.method;
    const pathParameters = event.pathParameters || {};
    const path = event.requestContext.http.path;
    
    // Route to appropriate handler based on HTTP method and path
    if (path.includes('/lookup')) {
      // User lookup routes
      switch (httpMethod) {
        case 'GET':
          return await handleUserLookup(event, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/invitations/accept')) {
      // Invitation acceptance route
      switch (httpMethod) {
        case 'POST':
          return await handleAcceptInvitation(event, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/invitations')) {
      // Invitation management routes
      const inventoryId = pathParameters.inventoryId;
      const invitationId = pathParameters.invitationId;
      
      switch (httpMethod) {
        case 'GET':
          return await handleListInvitations(event, inventoryId, origin);
        case 'POST':
          return await handleCreateInvitation(event, inventoryId, origin);
        case 'DELETE':
          return await handleCancelInvitation(event, inventoryId, invitationId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/members') && path.includes('/role')) {
      // Member role management routes
      const inventoryId = pathParameters.inventoryId;
      const userId = pathParameters.userId;
      
      switch (httpMethod) {
        case 'PUT':
          return await handleUpdateMemberRole(event, inventoryId, userId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else if (path.includes('/profile')) {
      // User profile routes
      const userId = pathParameters.userId || event.user.userId;
      
      switch (httpMethod) {
        case 'GET':
          return await handleGetUserProfile(event, userId, origin);
        case 'PUT':
          return await handleUpdateUserProfile(event, userId, origin);
        default:
          return error('Method not allowed', 405, origin);
      }
    } else {
      return error('Route not found', 404, origin);
    }
  } catch (err) {
    // Use secure error handling
    return secureError(err, context, origin);
  }
};

/**
 * Handle GET request - Look up user by email
 */
async function handleUserLookup(event, origin) {
  try {
    const queryParams = event.queryStringParameters || {};
    const email = queryParams.email;
    
    // Enhanced email validation
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return error(emailValidation.error, 400, origin);
    }
    
    // Look up user by email (service handles normalization)
    const user = await userService.lookupUserByEmail(emailValidation.normalizedEmail);
    
    if (!user) {
      return success({ 
        found: false, 
        message: 'User not found',
        email: emailValidation.normalizedEmail
      }, 200, origin);
    }
    
    // Return user profile (excluding sensitive information)
    const userProfile = {
      userId: user.userId,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      userStatus: user.userStatus,
      found: true
    };
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'user_lookup', user.userId, null);
    
    return success(userProfile, 200, origin);
  } catch (err) {
    console.error('Error looking up user:', err);
    
    // Enhanced error handling
    if (err.message.includes('Invalid email') || 
        err.message.includes('required') ||
        err.message.includes('format')) {
      return error(err.message, 400, origin);
    }
    
    if (err.message.includes('Too many requests')) {
      return error(err.message, 429, origin);
    }
    
    if (err.message.includes('Service temporarily unavailable') ||
        err.message.includes('temporarily unavailable')) {
      return error(err.message, 503, origin);
    }
    
    throw new Error('Failed to lookup user');
  }
}

/**
 * Handle GET request - List pending invitations for an inventory
 */
async function handleListInvitations(event, inventoryId, origin) {
  try {
    // Validate inventory ID parameter
    if (!inventoryId || !validateUUID(inventoryId)) {
      return error('Invalid inventory ID', 400, origin);
    }
    
    // Check if user has permission to view invitations (must be able to add members)
    const permissions = await inventoryService.getMemberPermissions(inventoryId, event.user.userId);
    if (!permissions || !permissions.permissions.canAddMembers) {
      return error('Access denied: Insufficient permissions to view invitations', 403, origin);
    }
    
    // Get pending invitations
    const invitations = await invitationService.listPendingInvitations(inventoryId);
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'invitations', 'list', inventoryId);
    
    return success(invitations, 200, origin);
  } catch (err) {
    console.error('Error listing invitations:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    throw new Error('Failed to retrieve invitations');
  }
}

/**
 * Handle POST request - Create a new invitation
 */
async function handleCreateInvitation(event, inventoryId, origin) {
  try {
    // Validate inventory ID parameter
    if (!inventoryId || !validateUUID(inventoryId)) {
      return error('Invalid inventory ID format', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Enhanced validation using new validation functions
    const emailValidation = validateEmail(body.email);
    if (!emailValidation.valid) {
      return error(emailValidation.error, 400, origin);
    }
    
    const roleValidation = validateUserRole(body.role);
    if (!roleValidation.valid) {
      return error(roleValidation.error, 400, origin);
    }
    
    // Sanitize optional inputs
    const inventoryName = body.inventoryName ? sanitizeInput(body.inventoryName) : undefined;
    const inviterName = body.inviterName ? sanitizeInput(body.inviterName) : undefined;
    
    // Validate optional inputs
    if (inventoryName && inventoryName.trim().length === 0) {
      return error('Inventory name cannot be empty', 400, origin);
    }
    
    if (inviterName && inviterName.trim().length === 0) {
      return error('Inviter name cannot be empty', 400, origin);
    }
    
    // Check if user has permission to add members
    const permissions = await inventoryService.getMemberPermissions(inventoryId, event.user.userId);
    if (!permissions || !permissions.permissions.canAddMembers) {
      return error('Access denied: You do not have permission to send invitations for this inventory', 403, origin);
    }
    
    // Create invitation
    const invitationDetails = {};
    if (inventoryName) invitationDetails.inventoryName = inventoryName;
    if (inviterName) invitationDetails.inviterName = inviterName;
    
    const invitation = await invitationService.createInvitation(
      inventoryId, 
      emailValidation.normalizedEmail, 
      roleValidation.normalizedRole, 
      event.user.userId,
      invitationDetails
    );
    
    // Log data access
    await logDataAccess(event.user.userId, 'create', 'invitations', invitation.invitationId, inventoryId);
    
    return success(invitation, 201, origin);
  } catch (err) {
    console.error('Error creating invitation:', err);
    
    // Enhanced error handling with specific status codes
    if (err.message.includes('Access denied') || err.message.includes('permission')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Invalid') || 
        err.message.includes('required') ||
        err.message.includes('format') ||
        err.message.includes('must be') ||
        err.message.includes('cannot be empty')) {
      return error(err.message, 400, origin);
    }
    
    if (err.message.includes('already exists')) {
      return error(err.message, 409, origin);
    }
    
    if (err.message.includes('Too many requests')) {
      return error(err.message, 429, origin);
    }
    
    if (err.message.includes('Service temporarily unavailable') ||
        err.message.includes('temporarily unavailable')) {
      return error(err.message, 503, origin);
    }
    
    throw new Error('Failed to create invitation');
  }
}

/**
 * Handle DELETE request - Cancel an invitation
 */
async function handleCancelInvitation(event, inventoryId, invitationId, origin) {
  try {
    // Validate parameters
    if (!inventoryId || !validateUUID(inventoryId)) {
      return error('Invalid inventory ID', 400, origin);
    }
    
    if (!invitationId || !validateUUID(invitationId)) {
      return error('Invalid invitation ID', 400, origin);
    }
    
    // Check if user has permission to manage invitations
    const permissions = await inventoryService.getMemberPermissions(inventoryId, event.user.userId);
    if (!permissions || !permissions.permissions.canAddMembers) {
      return error('Access denied: Insufficient permissions to cancel invitations', 403, origin);
    }
    
    // Cancel invitation
    await invitationService.cancelInvitation(invitationId, event.user.userId);
    
    // Log data access
    await logDataAccess(event.user.userId, 'delete', 'invitations', invitationId, inventoryId);
    
    return success({ message: 'Invitation cancelled successfully' }, 200, origin);
  } catch (err) {
    console.error('Error cancelling invitation:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('not found')) {
      return error('Invitation not found', 404, origin);
    }
    
    throw new Error('Failed to cancel invitation');
  }
}

/**
 * Handle PUT request - Update member role
 */
async function handleUpdateMemberRole(event, inventoryId, userId, origin) {
  try {
    // Validate parameters
    if (!inventoryId || !validateUUID(inventoryId)) {
      return error('Invalid inventory ID', 400, origin);
    }
    
    if (!userId || !validateUUID(userId)) {
      return error('Invalid user ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.role) {
      return error('Role is required', 400, origin);
    }
    
    // Sanitize inputs
    const newRole = sanitizeInput(body.role);
    const reason = body.reason ? sanitizeInput(body.reason) : '';
    
    // Update member role
    const updatedMembership = await inventoryService.updateMemberRole(
      inventoryId, 
      event.user.userId, 
      userId, 
      newRole, 
      reason
    );
    
    // Log data access
    await logDataAccess(event.user.userId, 'update', 'member_roles', userId, inventoryId);
    
    return success(updatedMembership, 200, origin);
  } catch (err) {
    console.error('Error updating member role:', err);
    
    if (err.message.includes('Access denied')) {
      return error(err.message, 403, origin);
    }
    
    if (err.message.includes('Invalid role')) {
      return error(err.message, 400, origin);
    }
    
    if (err.message.includes('not a member')) {
      return error('User is not a member of this inventory', 404, origin);
    }
    
    throw new Error('Failed to update member role');
  }
}

/**
 * Handle GET request - Get user profile
 */
async function handleGetUserProfile(event, userId, origin) {
  try {
    // Users can only view their own profile unless they have admin permissions
    if (userId !== event.user.userId) {
      return error('Access denied: Can only view your own profile', 403, origin);
    }
    
    // Validate user ID parameter
    if (!userId || !validateUUID(userId)) {
      return error('Invalid user ID', 400, origin);
    }
    
    // Get user profile
    const userProfile = await userService.getUserProfile(userId);
    
    if (!userProfile) {
      return error('User profile not found', 404, origin);
    }
    
    // Return profile with User ID visible (since it's their own profile)
    const profileData = {
      userId: userProfile.userId,
      email: userProfile.email,
      username: userProfile.username,
      displayName: userProfile.displayName,
      emailVerified: userProfile.emailVerified,
      userStatus: userProfile.userStatus,
      createdAt: userProfile.createdAt,
      updatedAt: userProfile.updatedAt,
      lastLoginAt: userProfile.lastLoginAt
    };
    
    // Log data access
    await logDataAccess(event.user.userId, 'read', 'user_profile', userId, null);
    
    return success(profileData, 200, origin);
  } catch (err) {
    console.error('Error getting user profile:', err);
    throw new Error('Failed to retrieve user profile');
  }
}

/**
 * Handle PUT request - Update user profile
 */
async function handleUpdateUserProfile(event, userId, origin) {
  try {
    // Users can only update their own profile
    if (userId !== event.user.userId) {
      return error('Access denied: Can only update your own profile', 403, origin);
    }
    
    // Validate user ID parameter
    if (!userId || !validateUUID(userId)) {
      return error('Invalid user ID', 400, origin);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate and sanitize updates
    const updates = {};
    if (body.displayName) {
      updates.displayName = sanitizeInput(body.displayName);
    }
    if (body.avatarUrl !== undefined) {
      updates.avatarUrl = body.avatarUrl ? sanitizeInput(body.avatarUrl) : '';
    }
    
    if (Object.keys(updates).length === 0) {
      return error('No valid updates provided', 400, origin);
    }
    
    // Update user profile
    const updatedProfile = await userService.updateUserProfile(userId, updates);
    
    // Log data access
    await logDataAccess(event.user.userId, 'update', 'user_profile', userId, null);
    
    return success(updatedProfile, 200, origin);
  } catch (err) {
    console.error('Error updating user profile:', err);
    
    if (err.message.includes('No valid updates')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to update user profile');
  }
}

/**
 * Handle POST request - Accept invitation
 */
async function handleAcceptInvitation(event, origin) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Enhanced token validation
    const tokenValidation = validateInvitationToken(body.token);
    if (!tokenValidation.valid) {
      return error(tokenValidation.error, 400, origin);
    }
    
    // Process invitation
    const invitationResult = await invitationService.processInvitation(body.token.trim(), event.user.userId);
    
    // Add user to inventory with the specified role
    const membership = await inventoryService.addMemberByUserId(
      invitationResult.inventoryId,
      event.user.userId,
      invitationResult.role,
      invitationResult.invitedBy
    );
    
    // Log data access
    await logDataAccess(event.user.userId, 'create', 'invitation_acceptance', invitationResult.inventoryId, null);
    
    return success({
      message: 'Invitation accepted successfully! You now have access to the inventory.',
      inventoryId: invitationResult.inventoryId,
      role: invitationResult.role,
      membership: membership
    }, 200, origin);
  } catch (err) {
    console.error('Error accepting invitation:', err);
    
    // Enhanced error handling with specific messages
    if (err.message.includes('Invalid invitation') || 
        err.message.includes('Invalid token') ||
        err.message.includes('required') ||
        err.message.includes('format')) {
      return error(err.message, 400, origin);
    }
    
    if (err.message.includes('already been') || 
        err.message.includes('already accepted')) {
      return error(err.message, 409, origin);
    }
    
    if (err.message.includes('expired') || 
        err.message.includes('no longer valid')) {
      return error(err.message, 410, origin);
    }
    
    if (err.message.includes('cancelled')) {
      return error(err.message, 410, origin);
    }
    
    if (err.message.includes('cannot accept')) {
      return error(err.message, 400, origin);
    }
    
    throw new Error('Failed to accept invitation');
  }
}

// Export the handler wrapped with rate limiting and CORS validation
exports.handler = withCorsValidation(withRateLimit(userHandler));