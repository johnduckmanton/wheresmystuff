/**
 * InventoryMembership model
 * Represents a user's membership in an inventory
 */
class InventoryMembership {
  constructor(data = {}) {
    this.inventoryId = data.inventoryId;
    this.userId = data.userId;
    this.role = data.role || 'member'; // 'owner' or 'member'
    this.addedAt = data.addedAt || new Date().toISOString();
    this.addedBy = data.addedBy;
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

    if (!this.role || !['owner', 'member'].includes(this.role)) {
      errors.push('Role must be either "owner" or "member"');
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
      inventoryId: this.inventoryId,
      userId: this.userId,
      role: this.role,
      addedAt: this.addedAt,
      addedBy: this.addedBy
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
      addedAt: item.addedAt,
      addedBy: item.addedBy
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
   * Check if this membership grants member privileges
   * @returns {boolean} True if user is member or owner
   */
  isMember() {
    return this.role === 'member' || this.role === 'owner';
  }
}

module.exports = InventoryMembership;