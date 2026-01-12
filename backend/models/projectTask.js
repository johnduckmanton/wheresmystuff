const { v4: uuidv4 } = require('uuid');

/**
 * Task priority enumeration
 */
const TaskPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

/**
 * Task status enumeration
 */
const TaskStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
  CANCELLED: 'cancelled'
};

/**
 * Task category enumeration
 */
const TaskCategory = {
  PLANNING: 'planning',
  PACKING: 'packing',
  LOGISTICS: 'logistics',
  MOVING_DAY: 'moving_day',
  UNPACKING: 'unpacking',
  SETUP: 'setup',
  ADMIN: 'admin',
  OTHER: 'other'
};

/**
 * ProjectTask model
 * Represents a task within a moving project
 */
class ProjectTask {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.projectId = data.projectId;
    this.title = data.title;
    this.description = data.description || '';
    this.category = data.category || TaskCategory.OTHER;
    this.priority = data.priority || TaskPriority.MEDIUM;
    this.status = data.status || TaskStatus.NOT_STARTED;
    this.dueDate = data.dueDate || null;
    this.assignedTo = data.assignedTo || null;
    this.completed = data.completed || false;
    this.completedAt = data.completedAt || null;
    this.estimatedHours = data.estimatedHours || 0;
    this.actualHours = data.actualHours || 0;
    this.notes = data.notes || '';
    this.tags = data.tags || [];
    this.dependencies = data.dependencies || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Validate task data
   * @returns {object} Validation result with isValid and errors
   */
  validate() {
    const errors = [];

    // Required fields
    if (!this.projectId || typeof this.projectId !== 'string') {
      errors.push('Project ID is required and must be a string');
    }

    if (!this.title || typeof this.title !== 'string' || this.title.trim().length === 0) {
      errors.push('Title is required and must be a non-empty string');
    }

    // Field length validations
    if (this.title && this.title.length > 200) {
      errors.push('Title must be 200 characters or less');
    }

    if (this.description && typeof this.description !== 'string') {
      errors.push('Description must be a string');
    }

    if (this.description && this.description.length > 2000) {
      errors.push('Description must be 2000 characters or less');
    }

    if (this.notes && typeof this.notes !== 'string') {
      errors.push('Notes must be a string');
    }

    if (this.notes && this.notes.length > 2000) {
      errors.push('Notes must be 2000 characters or less');
    }

    // Enum validations
    if (this.priority && !Object.values(TaskPriority).includes(this.priority)) {
      errors.push(`Priority must be one of: ${Object.values(TaskPriority).join(', ')}`);
    }

    if (this.status && !Object.values(TaskStatus).includes(this.status)) {
      errors.push(`Status must be one of: ${Object.values(TaskStatus).join(', ')}`);
    }

    if (this.category && !Object.values(TaskCategory).includes(this.category)) {
      errors.push(`Category must be one of: ${Object.values(TaskCategory).join(', ')}`);
    }

    // Date validation
    if (this.dueDate && !this._isValidISODate(this.dueDate)) {
      errors.push('Due date must be a valid ISO date string');
    }

    if (this.completedAt && !this._isValidISODate(this.completedAt)) {
      errors.push('Completed at must be a valid ISO date string');
    }

    // Completion logic validation
    if (this.completed && !this.completedAt) {
      errors.push('Completed at is required when task is marked as completed');
    }

    if (this.completedAt && !this.completed) {
      errors.push('Completed must be true when completed at is set');
    }

    // Boolean validation
    if (typeof this.completed !== 'boolean') {
      errors.push('Completed must be a boolean');
    }

    // Numeric validations
    if (typeof this.estimatedHours !== 'number' || this.estimatedHours < 0) {
      errors.push('Estimated hours must be a non-negative number');
    }

    if (typeof this.actualHours !== 'number' || this.actualHours < 0) {
      errors.push('Actual hours must be a non-negative number');
    }

    // Array validations
    if (!Array.isArray(this.tags)) {
      errors.push('Tags must be an array');
    }

    if (!Array.isArray(this.dependencies)) {
      errors.push('Dependencies must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Mark task as completed
   * @returns {object} Update result with success and errors
   */
  markCompleted() {
    if (this.completed) {
      return { success: false, errors: ['Task is already completed'] };
    }

    this.completed = true;
    this.completedAt = new Date().toISOString();
    this.status = TaskStatus.COMPLETED;
    this.updatedAt = new Date().toISOString();

    return { success: true, errors: [] };
  }

  /**
   * Mark task as incomplete
   * @returns {object} Update result with success and errors
   */
  markIncomplete() {
    if (!this.completed) {
      return { success: false, errors: ['Task is not completed'] };
    }

    this.completed = false;
    this.completedAt = null;
    this.status = TaskStatus.NOT_STARTED;
    this.updatedAt = new Date().toISOString();

    return { success: true, errors: [] };
  }

  /**
   * Check if task is overdue
   * @returns {boolean} True if task is overdue and not completed
   */
  isOverdue() {
    if (this.completed || !this.dueDate) {
      return false;
    }

    const dueTime = new Date(this.dueDate).getTime();
    const nowTime = new Date().getTime();

    return dueTime < nowTime;
  }

  /**
   * Check if task is due soon (within 3 days)
   * @returns {boolean} True if task is due within 3 days
   */
  isDueSoon() {
    if (this.completed || !this.dueDate) {
      return false;
    }

    const dueTime = new Date(this.dueDate).getTime();
    const nowTime = new Date().getTime();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    return dueTime > nowTime && (dueTime - nowTime) <= threeDaysMs;
  }

  /**
   * Get days until due date
   * @returns {number} Number of days until due date (negative if overdue)
   */
  getDaysUntilDue() {
    if (!this.dueDate) {
      return null;
    }

    const dueTime = new Date(this.dueDate).getTime();
    const nowTime = new Date().getTime();
    const diffMs = dueTime - nowTime;
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    return diffDays;
  }

  /**
   * Get progress percentage
   * @returns {number} Progress percentage (0-100)
   */
  getProgress() {
    if (this.completed) {
      return 100;
    }

    if (this.status === TaskStatus.IN_PROGRESS) {
      return 50;
    }

    if (this.status === TaskStatus.BLOCKED) {
      return 25;
    }

    return 0;
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
      pk: `PROJECT#${this.projectId}#TASKS`,
      sk: this.id,
      gsi1pk: `PROJECT#${this.projectId}`,
      gsi1sk: `TASK#${this.status}#${this.priority}`,
      gsi2pk: `PROJECT#${this.projectId}#CATEGORY#${this.category}`,
      gsi2sk: `TASK#${this.dueDate || 'NO_DATE'}`,
      id: this.id,
      projectId: this.projectId,
      title: this.title,
      description: this.description,
      category: this.category,
      priority: this.priority,
      status: this.status,
      dueDate: this.dueDate,
      assignedTo: this.assignedTo,
      completed: this.completed,
      completedAt: this.completedAt,
      estimatedHours: this.estimatedHours,
      actualHours: this.actualHours,
      notes: this.notes,
      tags: this.tags,
      dependencies: this.dependencies,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isOverdue: this.isOverdue(),
      isDueSoon: this.isDueSoon(),
      progress: this.getProgress()
    };

    return item;
  }

  /**
   * Create from DynamoDB item
   * @param {object} item - DynamoDB item
   * @returns {ProjectTask} ProjectTask instance
   */
  static fromDynamoDBItem(item) {
    return new ProjectTask({
      id: item.id,
      projectId: item.projectId,
      title: item.title,
      description: item.description,
      category: item.category,
      priority: item.priority,
      status: item.status,
      dueDate: item.dueDate,
      assignedTo: item.assignedTo,
      completed: item.completed,
      completedAt: item.completedAt,
      estimatedHours: item.estimatedHours,
      actualHours: item.actualHours,
      notes: item.notes,
      tags: item.tags,
      dependencies: item.dependencies,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    });
  }

  /**
   * Update task data
   * @param {object} updates - Fields to update
   */
  update(updates) {
    const allowedUpdates = ['title', 'description', 'category', 'priority', 'status', 'dueDate', 'assignedTo', 'estimatedHours', 'actualHours', 'notes', 'tags', 'dependencies'];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        this[field] = updates[field];
      }
    });

    this.updatedAt = new Date().toISOString();
  }
}

module.exports = {
  ProjectTask,
  TaskPriority,
  TaskStatus,
  TaskCategory
};
