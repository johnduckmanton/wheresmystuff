/**
 * InventoryMembership model
 * Represents a user's membership in an inventory with role-based permissions
 */
class InventoryMembership {
  constructor(data = {}) {
    this.inventoryId = data.inventoryId;
    this.userId = data.userId;
    this.role = data.role || 'member'; // 'owner', 'administrator', 'member', or 'read_only'
    this.permissions = data.permissions || this.getDefaultPermissions(this.role);
    this.addedAt = data.addedAt || new Date().toISOString();
    this.addedBy = data.addedBy;
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.updatedBy = data.updatedBy;
  }

  /**
   * Get default permissions for a role
   * @param {string} role - User role
   * @returns {object} Default permissions
   */
  getDefaultPermissions(role) {
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
   * Validate membership data
   * @returns {object} Validation result with isValid and errors
   */
  validate() {
    const errors = [];

    if (!this.inventoryId || typeof this.inventoryId !== 'string') {
      errors.push('Inventory ID is required and must be a string');
    }

    if (!this.userId || typeof this.userId !== 'string') {
      errors.push('User ID is required and must be a string');
    }

    const validRoles = ['owner', 'administrator', 'member', 'read_only'];
    if (!this.role || !validRoles.includes(this.role)) {
      errors.push(`Role must be one of: ${validRoles.join(', ')}`);
    }

    if (!this.addedBy || typeof this.addedBy !== 'string') {
      errors.push('Added by is required and must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert to DynamoDB item format
   * @returns {object} DynamoDB item
   */
  toDynamoDBItem() {
    return {
      pk: `INVENTORY#${this.inventoryId}`,
      sk: `MEMBER#${this.userId}`,
      gsi1pk: `USER#${this.userId}`,
      gsi1sk: `MEMBER#${this.inventoryId}`,
      inventoryId: this.inventoryId,
      userId: this.userId,
      role: this.role,
      permissions: this.permissions,
      addedAt: this.addedAt,
      addedBy: this.addedBy,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy
    };
  }

  /**
   * Create from DynamoDB item
   * @param {object} item - DynamoDB item
   * @returns {InventoryMembership} InventoryMembership instance
   */
  static fromDynamoDBItem(item) {
    return new InventoryMembership({
      inventoryId: item.inventoryId,
      userId: item.userId,
      role: item.role,
      permissions: item.permissions,
      addedAt: item.addedAt,
      addedBy: item.addedBy,
      updatedAt: item.updatedAt,
      updatedBy: item.updatedBy
    });
  }

  /**
   * Check if this membership grants owner privileges
   * @returns {boolean} True if user is owner
   */
  isOwner() {
    return this.role === 'owner';
  }

  /**
   * Check if this membership grants administrator privileges
   * @returns {boolean} True if user is administrator or owner
   */
  isAdministrator() {
    return this.role === 'administrator' || this.role === 'owner';
  }

  /**
   * Check if this membership grants member privileges
   * @returns {boolean} True if user is member, administrator, or owner
   */
  isMember() {
    return ['member', 'administrator', 'owner'].includes(this.role);
  }

  /**
   * Check if this membership is read-only
   * @returns {boolean} True if user has read-only access
   */
  isReadOnly() {
    return this.role === 'read_only';
  }

  /**
   * Check if user has a specific permission
   * @param {string} permission - Permission to check
   * @returns {boolean} True if user has permission
   */
  hasPermission(permission) {
    return this.permissions[permission] === true;
  }

  /**
   * Update role and permissions
   * @param {string} newRole - New role to assign
   * @param {string} updatedBy - User ID who made the change
   */
  updateRole(newRole, updatedBy) {
    this.role = newRole;
    this.permissions = this.getDefaultPermissions(newRole);
    this.updatedAt = new Date().toISOString();
    this.updatedBy = updatedBy;
  }
}

module.exports = InventoryMembership;