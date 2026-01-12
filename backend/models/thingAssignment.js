const { v4: uuidv4 } = require('uuid');

/**
 * ThingAssignment model
 * Represents the temporary assignment of a thing to a moving project
 * Things do NOT have a permanent project field - assignments are stored separately
 */
class ThingAssignment {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.projectId = data.projectId;
    this.thingId = data.thingId;
    this.inventoryId = data.inventoryId;
    this.assignedAt = data.assignedAt || new Date().toISOString();
    this.unassignedAt = data.unassignedAt || null;
    this.containerizedAt = data.containerizedAt || null;
    this.containerizedContainerId = data.containerizedContainerId || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Validate thing assignment data
   * @returns {object} Validation result with isValid and errors
   */
  validate() {
    const errors = [];

    // Required fields
    if (!this.projectId || typeof this.projectId !== 'string') {
      errors.push('Project ID is required and must be a string');
    }

    if (!this.thingId || typeof this.thingId !== 'string') {
      errors.push('Thing ID is required and must be a string');
    }

    if (!this.inventoryId || typeof this.inventoryId !== 'string') {
      errors.push('Inventory ID is required and must be a string');
    }

    // Date validations
    if (this.assignedAt && !this._isValidISODate(this.assignedAt)) {
      errors.push('Assigned at must be a valid ISO date string');
    }

    if (this.unassignedAt && !this._isValidISODate(this.unassignedAt)) {
      errors.push('Unassigned at must be a valid ISO date string');
    }

    if (this.containerizedAt && !this._isValidISODate(this.containerizedAt)) {
      errors.push('Containerized at must be a valid ISO date string');
    }

    // Date logic validations
    if (this.unassignedAt && this.assignedAt) {
      const assignedTime = new Date(this.assignedAt).getTime();
      const unassignedTime = new Date(this.unassignedAt).getTime();
      if (unassignedTime <= assignedTime) {
        errors.push('Unassigned date must be after assigned date');
      }
    }

    if (this.containerizedAt && this.assignedAt) {
      const assignedTime = new Date(this.assignedAt).getTime();
      const containerizedTime = new Date(this.containerizedAt).getTime();
      if (containerizedTime < assignedTime) {
        errors.push('Containerized date cannot be before assigned date');
      }
    }

    // Container ID validation
    if (this.containerizedContainerId && typeof this.containerizedContainerId !== 'string') {
      errors.push('Containerized container ID must be a string');
    }

    // If containerized, must have containerizedAt and containerizedContainerId
    if (this.containerizedAt && !this.containerizedContainerId) {
      errors.push('Containerized container ID is required when containerized at is set');
    }

    if (this.containerizedContainerId && !this.containerizedAt) {
      errors.push('Containerized at is required when containerized container ID is set');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Mark thing as containerized
   * @param {string} containerId - Container ID
   * @returns {object} Update result with success and errors
   */
  markContainerized(containerId) {
    if (!containerId || typeof containerId !== 'string') {
      return { success: false, errors: ['Container ID is required and must be a string'] };
    }

    if (this.unassignedAt) {
      return { success: false, errors: ['Cannot containerize an unassigned thing'] };
    }

    this.containerizedAt = new Date().toISOString();
    this.containerizedContainerId = containerId;
    this.updatedAt = new Date().toISOString();

    return { success: true, errors: [] };
  }

  /**
   * Mark thing as uncontainerized
   * @returns {object} Update result with success and errors
   */
  markUncontainerized() {
    if (this.unassignedAt) {
      return { success: false, errors: ['Cannot uncontainerize an unassigned thing'] };
    }

    this.containerizedAt = null;
    this.containerizedContainerId = null;
    this.updatedAt = new Date().toISOString();

    return { success: true, errors: [] };
  }

  /**
   * Unassign thing from project
   * @returns {object} Update result with success and errors
   */
  unassign() {
    if (this.unassignedAt) {
      return { success: false, errors: ['Thing is already unassigned'] };
    }

    this.unassignedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();

    return { success: true, errors: [] };
  }

  /**
   * Check if assignment is currently active
   * @returns {boolean} True if assignment is active
   */
  isActive() {
    return !this.unassignedAt;
  }

  /**
   * Check if thing is containerized
   * @returns {boolean} True if thing is containerized
   */
  isContainerized() {
    return !!this.containerizedContainerId;
  }

  /**
   * Check if a date string is a valid ISO date
   * @param {string} dateString - Date string to validate
   * @returns {boolean} True if valid ISO date
   * @private
   */
  _isValidISODate(dateString) {
    if (typeof dateString !== 'string') return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime()) && dateString === date.toISOString();
  }

  /**
   * Convert to DynamoDB item format
   * @returns {object} DynamoDB item
   */
  toDynamoDBItem() {
    const item = {
      pk: `PROJECT#${this.projectId}#THINGS`,
      sk: this.id,
      gsi1pk: `THING#${this.thingId}`,
      gsi1sk: `PROJECT#${this.projectId}`,
      gsi2pk: `INVENTORY#${this.inventoryId}`,
      gsi2sk: `ASSIGNMENT#${this.id}`,
      id: this.id,
      projectId: this.projectId,
      thingId: this.thingId,
      inventoryId: this.inventoryId,
      assignedAt: this.assignedAt,
      unassignedAt: this.unassignedAt,
      containerizedAt: this.containerizedAt,
      containerizedContainerId: this.containerizedContainerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isActive: this.isActive(),
      isContainerized: this.isContainerized()
    };

    return item;
  }

  /**
   * Create from DynamoDB item
   * @param {object} item - DynamoDB item
   * @returns {ThingAssignment} ThingAssignment instance
   */
  static fromDynamoDBItem(item) {
    return new ThingAssignment({
      id: item.id,
      projectId: item.projectId,
      thingId: item.thingId,
      inventoryId: item.inventoryId,
      assignedAt: item.assignedAt,
      unassignedAt: item.unassignedAt,
      containerizedAt: item.containerizedAt,
      containerizedContainerId: item.containerizedContainerId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    });
  }

  /**
   * Update assignment data
   * @param {object} updates - Fields to update
   */
  update(updates) {
    const allowedUpdates = ['containerizedAt', 'containerizedContainerId'];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        this[field] = updates[field];
      }
    });

    this.updatedAt = new Date().toISOString();
  }
}

module.exports = {
  ThingAssignment
};
