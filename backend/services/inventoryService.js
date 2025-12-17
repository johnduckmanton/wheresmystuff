const { 
  createInventory: dbCreateInventory,
  getInventory: dbGetInventory,
  updateInventory: dbUpdateInventory,
  deleteInventory: dbDeleteInventory,
  addInventoryMember: dbAddInventoryMember,
  removeInventoryMember: dbRemoveInventoryMember,
  getInventoryMembership: dbGetInventoryMembership,
  listInventoryMembers: dbListInventoryMembers,
  hasInventoryAccess: dbHasInventoryAccess
} = require('./dynamodb');

const auditLogService = require('./auditLogService');

/**
 * Inventory Management Service
 * Provides business logic for inventory operations with role-based access control
 */
class InventoryService {

  /**
   * Define role permissions
   */
  getRolePermissions(role) {
    const permissions = {
      owner: {
        canAddMembers: true,
        canRemoveMembers: true,
        canModifySettings: true,
        canDeleteInventory: true,
        canManageItems: true,
        canViewItems: true,
        canViewMembers: true,
        canChangeRoles: true
      },
      administrator: {
        canAddMembers: true,
        canRemoveMembers: true,
        canModifySettings: true,
        canDeleteInventory: false,
        canManageItems: true,
        canViewItems: true,
        canViewMembers: true,
        canChangeRoles: false
      },
      member: {
        canAddMembers: false,
        canRemoveMembers: false,
        canModifySettings: false,
        canDeleteInventory: false,
        canManageItems: true,
        canViewItems: true,
        canViewMembers: true,
        canChangeRoles: false
      },
      read_only: {
        canAddMembers: false,
        canRemoveMembers: false,
        canModifySettings: false,
        canDeleteInventory: false,
        canManageItems: false,
        canViewItems: true,
        canViewMembers: false,
        canChangeRoles: false
      }
    };

    return permissions[role] || permissions.read_only;
  }

  /**
   * Validate role permissions for an action
   * @param {string} role - User role
   * @param {string} action - Action to validate
   * @returns {boolean} True if role has permission
   */
  validateRolePermissions(role, action) {
    const permissions = this.getRolePermissions(role);
    return permissions[action] === true;
  }

  /**
   * Validate if a role transition is allowed
   * @param {string} currentRole - Current role of the user making the change
   * @param {string} targetCurrentRole - Current role of the target user
   * @param {string} targetNewRole - New role to assign to target user
   * @returns {object} Validation result with isValid and reason
   */
  validateRoleTransition(currentRole, targetCurrentRole, targetNewRole) {
    // Only owners can assign owner role
    if (targetNewRole === 'owner' && currentRole !== 'owner') {
      return {
        isValid: false,
        reason: 'Only owners can assign owner role'
      };
    }

    // Only owners can change owner roles
    if (targetCurrentRole === 'owner' && currentRole !== 'owner') {
      return {
        isValid: false,
        reason: 'Only owners can change owner roles'
      };
    }

    // Administrators can manage member and read_only roles
    if (currentRole === 'administrator') {
      const allowedRoles = ['member', 'read_only'];
      if (!allowedRoles.includes(targetNewRole)) {
        return {
          isValid: false,
          reason: 'Administrators can only assign member or read_only roles'
        };
      }
      
      if (targetCurrentRole === 'owner') {
        return {
          isValid: false,
          reason: 'Administrators cannot change owner roles'
        };
      }
    }

    // Members and read_only users cannot change roles
    if (['member', 'read_only'].includes(currentRole)) {
      return {
        isValid: false,
        reason: 'Members and read-only users cannot change roles'
      };
    }

    return {
      isValid: true,
      reason: 'Role transition is valid'
    };
  }

  /**
   * Get role hierarchy level (higher number = more permissions)
   * @param {string} role - Role to get level for
   * @returns {number} Role level
   */
  getRoleLevel(role) {
    const levels = {
      'read_only': 1,
      'member': 2,
      'administrator': 3,
      'owner': 4
    };
    return levels[role] || 0;
  }
  
  /**
   * Create a new inventory
   * @param {string} userId - User ID of the owner
   * @param {object} inventoryData - Inventory data (name, description)
   * @returns {Promise<object>} Created inventory
   */
  async createInventory(userId, inventoryData) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const data = {
      ...inventoryData,
      ownerId: userId
    };

    return await dbCreateInventory(data);
  }

  /**
   * Get a specific inventory by ID (with access control)
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Inventory object
   */
  async getInventory(inventoryId, userId) {
    if (!inventoryId || !userId) {
      throw new Error('Inventory ID and User ID are required');
    }

    // Check if user has access to this inventory
    const hasAccess = await dbHasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied: User does not have access to this inventory');
    }

    // Get the inventory
    const inventory = await dbGetInventory(inventoryId);
    if (!inventory) {
      throw new Error('Inventory not found');
    }

    return inventory;
  }

  /**
   * Get inventories for a user (where they are owner or member)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of inventories
   */
  async getUserInventories(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
    
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);
    const tableName = process.env.TABLE_NAME || 'home-inventory-dev';

    try {
      // Find all inventory memberships for this user
      const membershipResult = await docClient.send(new ScanCommand({
        TableName: tableName,
        FilterExpression: 'begins_with(pk, :inventoryPrefix) AND sk = :memberSk',
        ExpressionAttributeValues: {
          ':inventoryPrefix': 'INVENTORY#',
          ':memberSk': `MEMBER#${userId}`
        }
      }));

      if (!membershipResult.Items || membershipResult.Items.length === 0) {
        return [];
      }

      // Get the inventory metadata for each membership
      const inventories = [];
      for (const membership of membershipResult.Items) {
        const inventoryId = membership.inventoryId;
        
        try {
          const inventoryResult = await docClient.send(new GetCommand({
            TableName: tableName,
            Key: {
              pk: `INVENTORY#${inventoryId}`,
              sk: 'METADATA'
            }
          }));

          if (inventoryResult.Item) {
            inventories.push({
              id: inventoryResult.Item.id,
              name: inventoryResult.Item.name,
              description: inventoryResult.Item.description,
              ownerId: inventoryResult.Item.ownerId,
              createdAt: inventoryResult.Item.createdAt,
              updatedAt: inventoryResult.Item.updatedAt
            });
          }
        } catch (error) {
          console.error(`Error fetching inventory ${inventoryId}:`, error);
          // Continue with other inventories
        }
      }

      return inventories;
    } catch (error) {
      console.error('Error getting user inventories:', error);
      throw new Error('Failed to retrieve user inventories');
    }
  }

  /**
   * Update an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the update
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Updated inventory
   */
  async updateInventory(inventoryId, userId, updates) {
    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Check if user has access to this inventory
    const hasAccess = await dbHasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied: User does not have access to this inventory');
    }

    // Check if user is owner (only owners can update inventory metadata)
    const membership = await dbGetInventoryMembership(inventoryId, userId);
    if (!membership || !membership.isOwner()) {
      throw new Error('Access denied: Only inventory owners can update inventory details');
    }

    return await dbUpdateInventory(inventoryId, updates);
  }

  /**
   * Delete an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the deletion
   * @returns {Promise<void>}
   */
  async deleteInventory(inventoryId, userId) {
    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Check if user is owner (only owners can delete inventory)
    const membership = await dbGetInventoryMembership(inventoryId, userId);
    if (!membership || !membership.isOwner()) {
      throw new Error('Access denied: Only inventory owners can delete inventories');
    }

    return await dbDeleteInventory(inventoryId);
  }

  /**
   * Add a member to an inventory with specified role
   * @param {string} inventoryId - Inventory ID
   * @param {string} requesterId - User ID making the request
   * @param {string} memberUserId - User ID to add as member
   * @param {string} role - Role to assign (member, administrator, read_only)
   * @returns {Promise<object>} Created membership
   */
  async addInventoryMember(inventoryId, requesterId, memberUserId, role = 'member') {
    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }
    if (!requesterId) {
      throw new Error('Requester ID is required');
    }
    if (!memberUserId) {
      throw new Error('Member user ID is required');
    }

    // Validate role
    const validRoles = ['member', 'administrator', 'read_only'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Check if requesting user has permission to add members
    const requesterMembership = await dbGetInventoryMembership(inventoryId, requesterId);
    if (!requesterMembership) {
      // Log authorization failure
      await auditLogService.logAuthzFailure(
        requesterId, 
        'add_member', 
        `inventory#${inventoryId}`, 
        'User does not have access to inventory'
      );
      throw new Error('Access denied: User does not have access to this inventory');
    }

    if (!this.validateRolePermissions(requesterMembership.role, 'canAddMembers')) {
      // Log authorization failure
      await auditLogService.logAuthzFailure(
        requesterId, 
        'add_member', 
        `inventory#${inventoryId}`, 
        'User does not have permission to add members'
      );
      throw new Error('Access denied: User does not have permission to add members');
    }

    // Check if user is already a member
    const existingMembership = await dbGetInventoryMembership(inventoryId, memberUserId);
    if (existingMembership) {
      throw new Error('User is already a member of this inventory');
    }

    const result = await dbAddInventoryMember(inventoryId, memberUserId, requesterId, role);
    
    // Log successful member addition
    await auditLogService.logMemberAddition(memberUserId, requesterId, inventoryId, role, 'user_id');
    
    return result;
  }

  /**
   * Add a member by user ID (for invitation acceptance)
   * @param {string} inventoryId - Inventory ID
   * @param {string} memberUserId - User ID to add
   * @param {string} role - Role to assign
   * @param {string} addedBy - User ID who originally invited (for audit trail)
   * @returns {Promise<object>} Created membership
   */
  async addMemberByUserId(inventoryId, memberUserId, role, addedBy) {
    if (!inventoryId || !memberUserId || !role || !addedBy) {
      throw new Error('All parameters are required: inventoryId, memberUserId, role, addedBy');
    }

    // Validate role
    const validRoles = ['member', 'administrator', 'read_only'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Check if user is already a member
    const existingMembership = await dbGetInventoryMembership(inventoryId, memberUserId);
    if (existingMembership) {
      throw new Error('User is already a member of this inventory');
    }

    // Add member directly (bypass permission check since this is for invitation acceptance)
    const result = await dbAddInventoryMember(inventoryId, memberUserId, addedBy, role);
    
    // Log successful member addition via invitation
    await auditLogService.logMemberAddition(memberUserId, addedBy, inventoryId, role, 'invitation');
    
    return result;
  }

  /**
   * Add a member by email address
   * @param {string} inventoryId - Inventory ID
   * @param {string} email - Email address to add
   * @param {string} role - Role to assign
   * @param {string} addedBy - User ID adding the member
   * @param {object} invitationDetails - Details for invitation email (inventoryName, inviterName)
   * @returns {Promise<object>} Created membership or invitation
   */
  async addMemberByEmail(inventoryId, email, role, addedBy, invitationDetails = {}) {
    if (!inventoryId || !email || !role || !addedBy) {
      throw new Error('All parameters are required: inventoryId, email, role, addedBy');
    }

    // Check if requesting user has permission to add members
    const requesterMembership = await dbGetInventoryMembership(inventoryId, addedBy);
    if (!requesterMembership) {
      throw new Error('Access denied: User does not have access to this inventory');
    }

    if (!this.validateRolePermissions(requesterMembership.role, 'canAddMembers')) {
      // Log authorization failure
      await auditLogService.logAuthzFailure(
        addedBy, 
        'add_member_by_email', 
        `inventory#${inventoryId}`, 
        'User does not have permission to add members'
      );
      throw new Error('Access denied: User does not have permission to add members');
    }

    // Try to find user by email
    const userService = require('./userService');
    const user = await userService.lookupUserByEmail(email);

    if (user) {
      // User exists, check if they're already a member
      const existingMembership = await dbGetInventoryMembership(inventoryId, user.userId);
      if (existingMembership) {
        throw new Error('User is already a member of this inventory');
      }
      
      // Add them directly
      const result = await this.addInventoryMember(inventoryId, addedBy, user.userId, role);
      
      // Log successful member addition by email (the addInventoryMember method already logs, 
      // but we want to note it was added by email)
      await auditLogService.logMemberAddition(user.userId, addedBy, inventoryId, role, 'email');
      
      return result;
    } else {
      // User doesn't exist, create invitation
      const invitationService = require('./invitationService');
      
      // Get inventory details for email if not provided
      if (!invitationDetails.inventoryName) {
        const inventory = await dbGetInventory(inventoryId);
        if (inventory) {
          invitationDetails.inventoryName = inventory.name;
        }
      }
      
      // Get inviter details if not provided
      if (!invitationDetails.inviterName) {
        const inviterProfile = await userService.getUserProfile(addedBy);
        if (inviterProfile) {
          invitationDetails.inviterName = inviterProfile.displayName || inviterProfile.email;
        }
      }
      
      return await invitationService.createInvitation(inventoryId, email, role, addedBy, invitationDetails);
    }
  }

  /**
   * Remove a member from an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} requesterId - User ID making the request
   * @param {string} memberUserId - User ID to remove
   * @returns {Promise<void>}
   */
  async removeInventoryMember(inventoryId, requesterId, memberUserId) {
    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }
    if (!requesterId) {
      throw new Error('Requester ID is required');
    }
    if (!memberUserId) {
      throw new Error('Member user ID is required');
    }

    // Check if requesting user has permission to remove members
    const requesterMembership = await dbGetInventoryMembership(inventoryId, requesterId);
    if (!requesterMembership) {
      // Log authorization failure
      await auditLogService.logAuthzFailure(
        requesterId, 
        'remove_member', 
        `inventory#${inventoryId}`, 
        'User does not have access to inventory'
      );
      throw new Error('Access denied: User does not have access to this inventory');
    }

    if (!this.validateRolePermissions(requesterMembership.role, 'canRemoveMembers')) {
      // Log authorization failure
      await auditLogService.logAuthzFailure(
        requesterId, 
        'remove_member', 
        `inventory#${inventoryId}`, 
        'User does not have permission to remove members'
      );
      throw new Error('Access denied: User does not have permission to remove members');
    }

    // Check if member exists
    const memberMembership = await dbGetInventoryMembership(inventoryId, memberUserId);
    if (!memberMembership) {
      throw new Error('User is not a member of this inventory');
    }

    // Prevent user from removing themselves (except owners can delete inventory)
    if (memberUserId === requesterId && requesterMembership.role !== 'owner') {
      throw new Error('Users cannot remove themselves from inventory');
    }

    // Prevent removing the last owner
    if (memberMembership.role === 'owner') {
      const allMembers = await dbListInventoryMembers(inventoryId);
      const owners = allMembers.filter(m => m.role === 'owner');
      if (owners.length <= 1) {
        throw new Error('Cannot remove the last owner from inventory');
      }
    }

    const result = await dbRemoveInventoryMember(inventoryId, memberUserId);
    
    // Log successful member removal
    await auditLogService.logMemberRemoval(memberUserId, requesterId, inventoryId, memberMembership.role);
    
    return result;
  }

  /**
   * Update member role
   * @param {string} inventoryId - Inventory ID
   * @param {string} requesterId - User ID making the request
   * @param {string} memberUserId - User ID whose role to update
   * @param {string} newRole - New role to assign
   * @param {string} reason - Optional reason for the role change
   * @returns {Promise<object>} Updated membership
   */
  async updateMemberRole(inventoryId, requesterId, memberUserId, newRole, reason = '') {
    if (!inventoryId || !requesterId || !memberUserId || !newRole) {
      throw new Error('All parameters are required: inventoryId, requesterId, memberUserId, newRole');
    }

    // Validate role
    const validRoles = ['owner', 'administrator', 'member', 'read_only'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Check if requesting user has permission to change roles
    const requesterMembership = await dbGetInventoryMembership(inventoryId, requesterId);
    if (!requesterMembership) {
      // Log authorization failure
      await auditLogService.logAuthzFailure(
        requesterId, 
        'update_member_role', 
        `inventory#${inventoryId}#member#${memberUserId}`, 
        'User does not have access to inventory'
      );
      throw new Error('Access denied: User does not have access to this inventory');
    }

    if (!this.validateRolePermissions(requesterMembership.role, 'canChangeRoles')) {
      // Log authorization failure
      await auditLogService.logAuthzFailure(
        requesterId, 
        'update_member_role', 
        `inventory#${inventoryId}#member#${memberUserId}`, 
        'User does not have permission to change roles'
      );
      throw new Error('Access denied: User does not have permission to change roles');
    }

    // Check if member exists
    const memberMembership = await dbGetInventoryMembership(inventoryId, memberUserId);
    if (!memberMembership) {
      throw new Error('User is not a member of this inventory');
    }

    // Store old role for audit logging
    const oldRole = memberMembership.role;

    // Prevent changing own role (except owners can transfer ownership)
    if (memberUserId === requesterId && newRole !== 'owner') {
      throw new Error('Users cannot change their own role');
    }

    // Validate role transition
    const roleTransitionValidation = this.validateRoleTransition(
      requesterMembership.role, 
      memberMembership.role, 
      newRole
    );
    
    if (!roleTransitionValidation.isValid) {
      // Log authorization failure
      await auditLogService.logAuthzFailure(
        requesterId, 
        'update_member_role', 
        `inventory#${inventoryId}#member#${memberUserId}`, 
        roleTransitionValidation.reason
      );
      throw new Error(`Access denied: ${roleTransitionValidation.reason}`);
    }

    // Update the membership role
    const result = await this.updateMembershipRole(inventoryId, memberUserId, newRole, requesterId);
    
    // Log successful role change
    await auditLogService.logRoleChange(memberUserId, requesterId, inventoryId, oldRole, newRole, reason);
    
    return result;
  }

  /**
   * Get member permissions for a user in an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} User permissions
   */
  async getMemberPermissions(inventoryId, userId) {
    if (!inventoryId || !userId) {
      throw new Error('Inventory ID and user ID are required');
    }

    const membership = await dbGetInventoryMembership(inventoryId, userId);
    if (!membership) {
      return null; // User is not a member
    }

    return {
      role: membership.role,
      permissions: this.getRolePermissions(membership.role),
      roleLevel: this.getRoleLevel(membership.role),
      addedAt: membership.addedAt,
      addedBy: membership.addedBy,
      updatedAt: membership.updatedAt,
      updatedBy: membership.updatedBy
    };
  }

  /**
   * Get detailed role information including what roles a user can assign
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} Detailed role information
   */
  async getDetailedRoleInfo(inventoryId, userId) {
    if (!inventoryId || !userId) {
      throw new Error('Inventory ID and user ID are required');
    }

    const membership = await dbGetInventoryMembership(inventoryId, userId);
    if (!membership) {
      return null; // User is not a member
    }

    const userRole = membership.role;
    const userPermissions = this.getRolePermissions(userRole);
    
    // Determine what roles this user can assign to others
    let assignableRoles = [];
    if (userRole === 'owner') {
      assignableRoles = ['owner', 'administrator', 'member', 'read_only'];
    } else if (userRole === 'administrator') {
      assignableRoles = ['member', 'read_only'];
    }
    // Members and read_only users cannot assign roles

    return {
      role: userRole,
      permissions: userPermissions,
      roleLevel: this.getRoleLevel(userRole),
      assignableRoles,
      canManageRoles: assignableRoles.length > 0,
      addedAt: membership.addedAt,
      addedBy: membership.addedBy,
      updatedAt: membership.updatedAt,
      updatedBy: membership.updatedBy
    };
  }

  /**
   * Get members of an inventory
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID requesting the list (must have access)
   * @returns {Promise<Array>} Array of memberships with user profile information
   */
  async getInventoryMembers(inventoryId, userId) {
    if (!inventoryId) {
      throw new Error('Inventory ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Check if user has access to this inventory
    const hasAccess = await dbHasInventoryAccess(userId, inventoryId);
    if (!hasAccess) {
      throw new Error('Access denied: User does not have access to this inventory');
    }

    const members = await dbListInventoryMembers(inventoryId);
    
    // Enrich member data with user profile information
    const userService = require('./userService');
    const enrichedMembers = await Promise.all(
      members.map(async (member) => {
        try {
          const userProfile = await userService.getUserProfile(member.userId);
          return {
            ...member,
            userProfile: userProfile ? {
              email: userProfile.email,
              displayName: userProfile.displayName,
              username: userProfile.username
            } : null
          };
        } catch (error) {
          console.warn(`Failed to get profile for user ${member.userId}:`, error.message);
          return {
            ...member,
            userProfile: null
          };
        }
      })
    );

    // Also enrich addedBy and updatedBy fields with user profiles
    const enrichedMembersWithAddedBy = await Promise.all(
      enrichedMembers.map(async (member) => {
        try {
          const addedByProfile = member.addedBy ? await userService.getUserProfile(member.addedBy) : null;
          const updatedByProfile = (member.updatedBy && member.updatedBy !== member.addedBy) 
            ? await userService.getUserProfile(member.updatedBy) 
            : null;
          
          return {
            ...member,
            addedByProfile: addedByProfile ? {
              email: addedByProfile.email,
              displayName: addedByProfile.displayName,
              username: addedByProfile.username
            } : null,
            updatedByProfile: updatedByProfile ? {
              email: updatedByProfile.email,
              displayName: updatedByProfile.displayName,
              username: updatedByProfile.username
            } : null
          };
        } catch (error) {
          console.warn(`Failed to get profiles for addedBy/updatedBy for member ${member.userId}:`, error.message);
          return member;
        }
      })
    );

    return enrichedMembersWithAddedBy;
  }

  /**
   * Check if a user has access to an inventory
   * @param {string} userId - User ID
   * @param {string} inventoryId - Inventory ID
   * @returns {Promise<boolean>} True if user has access
   */
  async hasInventoryAccess(userId, inventoryId) {
    if (!userId || !inventoryId) {
      return false;
    }

    return await dbHasInventoryAccess(userId, inventoryId);
  }

  /**
   * Validate if a user can perform an action on an item
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @param {string} action - Action to validate (create, read, update, delete)
   * @param {string} itemType - Type of item (things, locations, rooms, categories, people)
   * @returns {Promise<boolean>} True if user can perform action
   */
  async validateItemPermission(inventoryId, userId, action, itemType = 'items') {
    if (!inventoryId || !userId || !action) {
      return false;
    }

    const membership = await dbGetInventoryMembership(inventoryId, userId);
    if (!membership) {
      return false; // User is not a member
    }

    const permissions = this.getRolePermissions(membership.role);
    
    // Map actions to permission checks
    switch (action.toLowerCase()) {
      case 'create':
      case 'add':
        return permissions.canManageItems;
      case 'read':
      case 'view':
      case 'list':
        return permissions.canViewItems;
      case 'update':
      case 'edit':
      case 'modify':
        return permissions.canManageItems;
      case 'delete':
      case 'remove':
        return permissions.canManageItems;
      default:
        return false;
    }
  }

  /**
   * Validate if a user can perform an action on inventory settings
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @param {string} action - Action to validate
   * @returns {Promise<boolean>} True if user can perform action
   */
  async validateSettingsPermission(inventoryId, userId, action) {
    if (!inventoryId || !userId || !action) {
      return false;
    }

    const membership = await dbGetInventoryMembership(inventoryId, userId);
    if (!membership) {
      return false; // User is not a member
    }

    const permissions = this.getRolePermissions(membership.role);
    
    switch (action.toLowerCase()) {
      case 'modify_settings':
      case 'update_inventory':
        return permissions.canModifySettings;
      case 'delete_inventory':
        return permissions.canDeleteInventory;
      case 'view_settings':
        return permissions.canViewItems; // Basic access required
      default:
        return false;
    }
  }

  /**
   * Update membership role in database
   * @param {string} inventoryId - Inventory ID
   * @param {string} userId - User ID
   * @param {string} newRole - New role
   * @param {string} updatedBy - User ID who made the change
   * @returns {Promise<object>} Updated membership
   */
  async updateMembershipRole(inventoryId, userId, newRole, updatedBy) {
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
    
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);
    const tableName = process.env.TABLE_NAME || 'home-inventory-dev';

    try {
      const command = new UpdateCommand({
        TableName: tableName,
        Key: {
          pk: `INVENTORY#${inventoryId}`,
          sk: `MEMBER#${userId}`
        },
        UpdateExpression: 'SET #role = :role, #permissions = :permissions, #updatedAt = :updatedAt, #updatedBy = :updatedBy',
        ExpressionAttributeNames: {
          '#role': 'role',
          '#permissions': 'permissions',
          '#updatedAt': 'updatedAt',
          '#updatedBy': 'updatedBy'
        },
        ExpressionAttributeValues: {
          ':role': newRole,
          ':permissions': this.getRolePermissions(newRole),
          ':updatedAt': new Date().toISOString(),
          ':updatedBy': updatedBy
        },
        ReturnValues: 'ALL_NEW',
        ConditionExpression: 'attribute_exists(pk)'
      });

      const response = await docClient.send(command);
      return response.Attributes;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('Membership not found');
      }
      
      console.error('Error updating membership role:', error);
      throw new Error(`Failed to update membership role: ${error.message}`);
    }
  }
}

module.exports = new InventoryService();