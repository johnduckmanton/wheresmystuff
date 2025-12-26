const { v4: uuidv4 } = require('uuid');

/**
 * Project status enumeration
 */
const ProjectStatus = {
  PLANNING: 'planning',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

/**
 * MovingProject model
 * Represents a collection of containers and activities related to a specific move or storage event
 */
class MovingProject {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.inventoryId = data.inventoryId;
    this.name = data.name;
    this.description = data.description || '';
    this.startDate = data.startDate || new Date().toISOString();
    this.targetDate = data.targetDate;
    this.completionDate = data.completionDate;
    this.status = data.status || ProjectStatus.PLANNING;
    this.sourceLocation = data.sourceLocation;
    this.destinationLocation = data.destinationLocation;
    this.containerCount = data.containerCount || 0;
    this.itemCount = data.itemCount || 0;
    this.completionPercentage = data.completionPercentage || 0;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.createdBy = data.createdBy;
    this.metadata = data.metadata || {};
  }

  /**
   * Validate moving project data
   * @returns {object} Validation result with isValid and errors
   */
  validate() {
    const errors = [];

    // Required fields
    if (!this.name || typeof this.name !== 'string' || this.name.trim().length === 0) {
      errors.push('Name is required and must be a non-empty string');
    }

    if (!this.inventoryId || typeof this.inventoryId !== 'string') {
      errors.push('Inventory ID is required and must be a string');
    }

    if (!this.createdBy || typeof this.createdBy !== 'string') {
      errors.push('Created by user ID is required and must be a string');
    }

    // Field length validations
    if (this.name && this.name.length > 100) {
      errors.push('Name must be 100 characters or less');
    }

    if (this.description && typeof this.description !== 'string') {
      errors.push('Description must be a string');
    }

    if (this.description && this.description.length > 1000) {
      errors.push('Description must be 1000 characters or less');
    }

    // Status validation
    if (this.status && !Object.values(ProjectStatus).includes(this.status)) {
      errors.push(`Status must be one of: ${Object.values(ProjectStatus).join(', ')}`);
    }

    // Date validations
    if (this.startDate && !this._isValidISODate(this.startDate)) {
      errors.push('Start date must be a valid ISO date string');
    }

    if (this.targetDate && !this._isValidISODate(this.targetDate)) {
      errors.push('Target date must be a valid ISO date string');
    }

    if (this.completionDate && !this._isValidISODate(this.completionDate)) {
      errors.push('Completion date must be a valid ISO date string');
    }

    // Date logic validations
    if (this.targetDate && this.startDate) {
      const startTime = new Date(this.startDate).getTime();
      const targetTime = new Date(this.targetDate).getTime();
      if (targetTime <= startTime) {
        errors.push('Target date must be after start date');
      }
    }

    if (this.completionDate && this.startDate) {
      const startTime = new Date(this.startDate).getTime();
      const completionTime = new Date(this.completionDate).getTime();
      if (completionTime < startTime) {
        errors.push('Completion date cannot be before start date');
      }
    }

    // Numeric validations
    if (this.containerCount !== undefined && (typeof this.containerCount !== 'number' || this.containerCount < 0)) {
      errors.push('Container count must be a non-negative number');
    }

    if (this.itemCount !== undefined && (typeof this.itemCount !== 'number' || this.itemCount < 0)) {
      errors.push('Item count must be a non-negative number');
    }

    if (this.completionPercentage !== undefined && 
        (typeof this.completionPercentage !== 'number' || 
         this.completionPercentage < 0 || 
         this.completionPercentage > 100)) {
      errors.push('Completion percentage must be a number between 0 and 100');
    }

    // Location validations (if provided, should be valid UUIDs or location names)
    if (this.sourceLocation && typeof this.sourceLocation !== 'string') {
      errors.push('Source location must be a string');
    }

    if (this.destinationLocation && typeof this.destinationLocation !== 'string') {
      errors.push('Destination location must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate project status transition
   * @param {string} newStatus - New status to transition to
   * @returns {object} Validation result with isValid and errors
   */
  validateStatusTransition(newStatus) {
    const errors = [];

    if (!Object.values(ProjectStatus).includes(newStatus)) {
      errors.push(`Invalid status: ${newStatus}`);
      return { isValid: false, errors };
    }

    // Define valid status transitions
    const validTransitions = {
      [ProjectStatus.PLANNING]: [ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED],
      [ProjectStatus.ACTIVE]: [ProjectStatus.PAUSED, ProjectStatus.COMPLETED, ProjectStatus.PLANNING],
      [ProjectStatus.PAUSED]: [ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED],
      [ProjectStatus.COMPLETED]: [ProjectStatus.ARCHIVED],
      [ProjectStatus.ARCHIVED]: [] // Cannot transition from archived
    };

    const allowedTransitions = validTransitions[this.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      errors.push(`Cannot transition from ${this.status} to ${newStatus}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Update project status with validation
   * @param {string} newStatus - New status
   * @param {string} updatedBy - User ID making the update
   * @returns {object} Update result with success and errors
   */
  updateStatus(newStatus, updatedBy) {
    const validation = this.validateStatusTransition(newStatus);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    this.status = newStatus;
    this.updatedAt = new Date().toISOString();

    // Set completion date when marking as completed
    if (newStatus === ProjectStatus.COMPLETED && !this.completionDate) {
      this.completionDate = new Date().toISOString();
      this.completionPercentage = 100;
    }

    return { success: true, errors: [] };
  }

  /**
   * Calculate and update completion percentage based on container and item progress
   * @param {number} packedContainers - Number of packed containers
   * @param {number} totalContainers - Total number of containers
   * @param {number} packedItems - Number of packed items
   * @param {number} totalItems - Total number of items
   * @returns {number} Calculated completion percentage
   */
  calculateProgress(packedContainers = 0, totalContainers = 0, packedItems = 0, totalItems = 0) {
    if (totalContainers === 0 && totalItems === 0) {
      return 0;
    }

    // Weight container progress and item progress equally
    const containerProgress = totalContainers > 0 ? (packedContainers / totalContainers) * 50 : 0;
    const itemProgress = totalItems > 0 ? (packedItems / totalItems) * 50 : 0;
    
    const totalProgress = containerProgress + itemProgress;
    this.completionPercentage = Math.min(100, Math.max(0, Math.round(totalProgress)));
    
    return this.completionPercentage;
  }

  /**
   * Update project progress and statistics
   * @param {object} stats - Project statistics
   * @param {string} updatedBy - User ID making the update
   */
  updateProgress(stats, updatedBy) {
    this.containerCount = stats.containerCount || 0;
    this.itemCount = stats.itemCount || 0;
    
    // Calculate completion percentage
    this.calculateProgress(
      stats.packedContainers || 0,
      stats.containerCount || 0,
      stats.packedItems || 0,
      stats.itemCount || 0
    );

    this.updatedAt = new Date().toISOString();

    // Auto-complete project if 100% complete
    if (this.completionPercentage === 100 && this.status === ProjectStatus.ACTIVE) {
      this.updateStatus(ProjectStatus.COMPLETED, updatedBy);
    }
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
      pk: `INVENTORY#${this.inventoryId}#PROJECTS`,
      sk: this.id,
      gsi1pk: `INVENTORY#${this.inventoryId}`,
      gsi1sk: `PROJECT#${this.id}`,
      id: this.id,
      inventoryId: this.inventoryId,
      name: this.name,
      description: this.description,
      startDate: this.startDate,
      status: this.status,
      containerCount: this.containerCount,
      itemCount: this.itemCount,
      completionPercentage: this.completionPercentage,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      metadata: this.metadata
    };

    // Add optional fields if they exist
    if (this.targetDate) item.targetDate = this.targetDate;
    if (this.completionDate) item.completionDate = this.completionDate;
    if (this.sourceLocation) item.sourceLocation = this.sourceLocation;
    if (this.destinationLocation) item.destinationLocation = this.destinationLocation;

    return item;
  }

  /**
   * Create from DynamoDB item
   * @param {object} item - DynamoDB item
   * @returns {MovingProject} MovingProject instance
   */
  static fromDynamoDBItem(item) {
    return new MovingProject({
      id: item.id,
      inventoryId: item.inventoryId,
      name: item.name,
      description: item.description,
      startDate: item.startDate,
      targetDate: item.targetDate,
      completionDate: item.completionDate,
      status: item.status,
      sourceLocation: item.sourceLocation,
      destinationLocation: item.destinationLocation,
      containerCount: item.containerCount || 0,
      itemCount: item.itemCount || 0,
      completionPercentage: item.completionPercentage || 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createdBy: item.createdBy,
      metadata: item.metadata || {}
    });
  }

  /**
   * Update project data
   * @param {object} updates - Fields to update
   * @param {string} updatedBy - User ID making the update
   */
  update(updates, updatedBy) {
    const allowedUpdates = [
      'name', 'description', 'targetDate', 'sourceLocation', 
      'destinationLocation', 'metadata'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        this[field] = updates[field];
      }
    });

    this.updatedAt = new Date().toISOString();
  }
}

// Export the class and enums
module.exports = {
  MovingProject,
  ProjectStatus
};