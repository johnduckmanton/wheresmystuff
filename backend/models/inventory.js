const { v4: uuidv4 } = require('uuid');

/**
 * Inventory model
 * Represents a collection of entities that can be shared among multiple users
 */
class Inventory {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.description = data.description || '';
    this.ownerId = data.ownerId;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Validate inventory data
   * @returns {object} Validation result with isValid and errors
   */
  validate() {
    const errors = [];

    if (!this.name || typeof this.name !== 'string' || this.name.trim().length === 0) {
      errors.push('Name is required and must be a non-empty string');
    }

    if (this.name && this.name.length > 100) {
      errors.push('Name must be 100 characters or less');
    }

    if (!this.ownerId || typeof this.ownerId !== 'string') {
      errors.push('Owner ID is required and must be a string');
    }

    if (this.description && typeof this.description !== 'string') {
      errors.push('Description must be a string');
    }

    if (this.description && this.description.length > 500) {
      errors.push('Description must be 500 characters or less');
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
      pk: `INVENTORY#${this.id}`,
      sk: 'METADATA',
      id: this.id,
      name: this.name,
      description: this.description,
      ownerId: this.ownerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Create from DynamoDB item
   * @param {object} item - DynamoDB item
   * @returns {Inventory} Inventory instance
   */
  static fromDynamoDBItem(item) {
    return new Inventory({
      id: item.id,
      name: item.name,
      description: item.description,
      ownerId: item.ownerId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    });
  }

  /**
   * Update inventory data
   * @param {object} updates - Fields to update
   */
  update(updates) {
    if (updates.name !== undefined) {
      this.name = updates.name;
    }
    if (updates.description !== undefined) {
      this.description = updates.description;
    }
    this.updatedAt = new Date().toISOString();
  }
}

module.exports = Inventory;