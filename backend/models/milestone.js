const { v4: uuidv4 } = require('uuid');

/**
 * Milestone type enumeration
 */
const MilestoneType = {
  START_DATE: 'start_date',
  MOVING_OUT_DATE: 'moving_out_date',
  MOVING_IN_DATE: 'moving_in_date',
  CUSTOM: 'custom'
};

/**
 * Milestone model
 * Represents a significant date or event in the moving project timeline
 */
class Milestone {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.projectId = data.projectId;
    this.name = data.name;
    this.type = data.type || MilestoneType.CUSTOM;
    this.date = data.date;
    this.description = data.description || '';
    this.completed = data.completed || false;
    this.completedAt = data.completedAt || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Validate milestone data
   * @returns {object} Validation result with isValid and errors
   */
  validate() {
    const errors = [];

    // Required fields
    if (!this.projectId || typeof this.projectId !== 'string') {
      errors.push('Project ID is required and must be a string');
    }

    if (!this.name || typeof this.name !== 'string' || this.name.trim().length === 0) {
      errors.push('Name is required and must be a non-empty string');
    }

    if (!this.date || typeof this.date !== 'string') {
      errors.push('Date is required and must be a string');
    }

    // Field length validations
    if (this.name && this.name.length > 100) {
      errors.push('Name must be 100 characters or less');
    }

    if (this.description && typeof this.description !== 'string') {
      errors.push('Description must be a string');
    }

    if (this.description && this.description.length > 500) {
      errors.push('Description must be 500 characters or less');
    }

    // Type validation
    if (this.type && !Object.values(MilestoneType).includes(this.type)) {
      errors.push(`Type must be one of: ${Object.values(MilestoneType).join(', ')}`);
    }

    // Date validation
    if (this.date && !this._isValidISODate(this.date)) {
      errors.push('Date must be a valid ISO date string');
    }

    // Completion date validation
    if (this.completedAt && !this._isValidISODate(this.completedAt)) {
      errors.push('Completed at must be a valid ISO date string');
    }

    // Completion logic validation
    if (this.completed && !this.completedAt) {
      errors.push('Completed at is required when milestone is marked as completed');
    }

    if (this.completedAt && !this.completed) {
      errors.push('Completed must be true when completed at is set');
    }

    // Boolean validation
    if (typeof this.completed !== 'boolean') {
      errors.push('Completed must be a boolean');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Mark milestone as completed
   * @returns {object} Update result with success and errors
   */
  markCompleted() {
    if (this.completed) {
      return { success: false, errors: ['Milestone is already completed'] };
    }

    this.completed = true;
    this.completedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();

    return { success: true, errors: [] };
  }

  /**
   * Mark milestone as incomplete
   * @returns {object} Update result with success and errors
   */
  markIncomplete() {
    if (!this.completed) {
      return { success: false, errors: ['Milestone is not completed'] };
    }

    this.completed = false;
    this.completedAt = null;
    this.updatedAt = new Date().toISOString();

    return { success: true, errors: [] };
  }

  /**
   * Check if milestone is overdue
   * @returns {boolean} True if milestone date has passed and not completed
   */
  isOverdue() {
    if (this.completed) {
      return false;
    }

    const milestoneTime = new Date(this.date).getTime();
    const nowTime = new Date().getTime();

    return milestoneTime < nowTime;
  }

  /**
   * Check if milestone is upcoming (within 7 days)
   * @returns {boolean} True if milestone is within 7 days
   */
  isUpcoming() {
    if (this.completed) {
      return false;
    }

    const milestoneTime = new Date(this.date).getTime();
    const nowTime = new Date().getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    return milestoneTime > nowTime && (milestoneTime - nowTime) <= sevenDaysMs;
  }

  /**
   * Get days until milestone
   * @returns {number} Number of days until milestone (negative if overdue)
   */
  getDaysUntil() {
    const milestoneTime = new Date(this.date).getTime();
    const nowTime = new Date().getTime();
    const diffMs = milestoneTime - nowTime;
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    return diffDays;
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
      pk: `PROJECT#${this.projectId}#MILESTONES`,
      sk: this.id,
      gsi1pk: `PROJECT#${this.projectId}`,
      gsi1sk: `MILESTONE#${this.date}`,
      id: this.id,
      projectId: this.projectId,
      name: this.name,
      type: this.type,
      date: this.date,
      description: this.description,
      completed: this.completed,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isOverdue: this.isOverdue(),
      isUpcoming: this.isUpcoming(),
      daysUntil: this.getDaysUntil()
    };

    return item;
  }

  /**
   * Create from DynamoDB item
   * @param {object} item - DynamoDB item
   * @returns {Milestone} Milestone instance
   */
  static fromDynamoDBItem(item) {
    return new Milestone({
      id: item.id,
      projectId: item.projectId,
      name: item.name,
      type: item.type,
      date: item.date,
      description: item.description,
      completed: item.completed,
      completedAt: item.completedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    });
  }

  /**
   * Update milestone data
   * @param {object} updates - Fields to update
   */
  update(updates) {
    const allowedUpdates = ['name', 'type', 'date', 'description'];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        this[field] = updates[field];
      }
    });

    this.updatedAt = new Date().toISOString();
  }
}

module.exports = {
  Milestone,
  MilestoneType
};
