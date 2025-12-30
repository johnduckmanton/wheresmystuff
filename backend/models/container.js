const { v4: uuidv4 } = require('uuid');

/**
 * Container types enumeration
 */
const ContainerType = {
  BOX: 'box',
  BAG: 'bag',
  CRATE: 'crate',
  BIN: 'bin',
  SUITCASE: 'suitcase',
  TRUNK: 'trunk',
  CUSTOM: 'custom'
};

/**
 * Handling flags enumeration
 */
const HandlingFlag = {
  FRAGILE: 'fragile',
  HEAVY: 'heavy',
  VALUABLE: 'valuable',
  PRIORITY: 'priority',
  KEEP_UPRIGHT: 'keep_upright',
  TEMPERATURE_SENSITIVE: 'temperature_sensitive'
};

/**
 * Container status enumeration
 */
const ContainerStatus = {
  EMPTY: 'empty',
  PACKING: 'packing',
  PACKED: 'packed',
  IN_TRANSIT: 'in_transit',
  STORED: 'stored',
  UNPACKING: 'unpacking',
  UNPACKED: 'unpacked'
};

/**
 * Container model
 * Represents a physical storage unit (box, bag, crate, etc.) that holds inventory items
 */
class Container {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.inventoryId = data.inventoryId;
    this.projectId = data.projectId;
    this.name = data.name;
    this.type = data.type || ContainerType.BOX;
    this.size = data.size;
    this.color = data.color;
    this.description = data.description || '';
    this.contentsSummary = data.contentsSummary || '';
    this.photos = data.photos || [];
    this.qrCode = data.qrCode || this._generateQRCode();
    this.qrCodeUrl = data.qrCodeUrl;
    this.locationId = data.locationId;
    this.handlingFlags = data.handlingFlags || [];
    this.itemCount = data.itemCount || 0;
    this.estimatedValue = data.estimatedValue || 0;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.createdBy = data.createdBy;
    this.updatedBy = data.updatedBy;
    this.status = data.status || ContainerStatus.EMPTY;
    this.storageStartDate = data.storageStartDate;
    this.storageRate = data.storageRate;
    this.metadata = data.metadata || {};
  }

  /**
   * Generate a unique QR code identifier
   * @returns {string} QR code identifier
   * @private
   */
  _generateQRCode() {
    return `CONTAINER_${uuidv4().replace(/-/g, '').toUpperCase()}`;
  }

  /**
   * Validate container data
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

    if (this.description && this.description.length > 500) {
      errors.push('Description must be 500 characters or less');
    }

    // Contents summary validation
    if (this.contentsSummary && typeof this.contentsSummary !== 'string') {
      errors.push('Contents summary must be a string');
    }

    if (this.contentsSummary && this.contentsSummary.length > 200) {
      errors.push('Contents summary must be 200 characters or less');
    }

    // Type validation
    if (this.type && !Object.values(ContainerType).includes(this.type)) {
      errors.push(`Type must be one of: ${Object.values(ContainerType).join(', ')}`);
    }

    // Status validation
    if (this.status && !Object.values(ContainerStatus).includes(this.status)) {
      errors.push(`Status must be one of: ${Object.values(ContainerStatus).join(', ')}`);
    }

    // Handling flags validation
    if (this.handlingFlags && Array.isArray(this.handlingFlags)) {
      const invalidFlags = this.handlingFlags.filter(flag => !Object.values(HandlingFlag).includes(flag));
      if (invalidFlags.length > 0) {
        errors.push(`Invalid handling flags: ${invalidFlags.join(', ')}`);
      }
    } else if (this.handlingFlags && !Array.isArray(this.handlingFlags)) {
      errors.push('Handling flags must be an array');
    }

    // Numeric validations
    if (this.itemCount !== undefined && (typeof this.itemCount !== 'number' || this.itemCount < 0)) {
      errors.push('Item count must be a non-negative number');
    }

    if (this.estimatedValue !== undefined && (typeof this.estimatedValue !== 'number' || this.estimatedValue < 0)) {
      errors.push('Estimated value must be a non-negative number');
    }

    if (this.storageRate !== undefined && (typeof this.storageRate !== 'number' || this.storageRate < 0)) {
      errors.push('Storage rate must be a non-negative number');
    }

    // Color validation (hex color)
    if (this.color && !/^#[0-9A-Fa-f]{6}$/.test(this.color)) {
      errors.push('Color must be a valid hex color code (e.g., #FF5733)');
    }

    // Photos validation
    if (this.photos && !Array.isArray(this.photos)) {
      errors.push('Photos must be an array');
    }

    if (this.photos && Array.isArray(this.photos)) {
      if (this.photos.length > 10) {
        errors.push('Maximum 10 photos allowed per container');
      }
      // Validate each photo is a string (S3 key)
      const invalidPhotos = this.photos.filter(photo => typeof photo !== 'string');
      if (invalidPhotos.length > 0) {
        errors.push('All photos must be valid S3 keys (strings)');
      }
    }

    // Size validation
    if (this.size && typeof this.size !== 'string') {
      errors.push('Size must be a string');
    }

    if (this.size && this.size.length > 50) {
      errors.push('Size must be 50 characters or less');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate container status transition
   * @param {string} newStatus - New status to transition to
   * @returns {object} Validation result with isValid and errors
   */
  validateStatusTransition(newStatus) {
    const errors = [];

    if (!Object.values(ContainerStatus).includes(newStatus)) {
      errors.push(`Invalid status: ${newStatus}`);
      return { isValid: false, errors };
    }

    // Define valid status transitions
    const validTransitions = {
      [ContainerStatus.EMPTY]: [ContainerStatus.PACKING],
      [ContainerStatus.PACKING]: [ContainerStatus.PACKED, ContainerStatus.EMPTY],
      [ContainerStatus.PACKED]: [ContainerStatus.IN_TRANSIT, ContainerStatus.STORED, ContainerStatus.UNPACKING],
      [ContainerStatus.IN_TRANSIT]: [ContainerStatus.STORED, ContainerStatus.UNPACKING],
      [ContainerStatus.STORED]: [ContainerStatus.IN_TRANSIT, ContainerStatus.UNPACKING],
      [ContainerStatus.UNPACKING]: [ContainerStatus.UNPACKED, ContainerStatus.PACKED],
      [ContainerStatus.UNPACKED]: [ContainerStatus.PACKING]
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
   * Update container status with validation
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
    this.updatedBy = updatedBy;
    this.updatedAt = new Date().toISOString();

    // Set storage start date when moving to stored status
    if (newStatus === ContainerStatus.STORED && !this.storageStartDate) {
      this.storageStartDate = new Date().toISOString();
    }

    return { success: true, errors: [] };
  }

  /**
   * Convert to DynamoDB item format
   * @returns {object} DynamoDB item
   */
  toDynamoDBItem() {
    const item = {
      pk: `INVENTORY#${this.inventoryId}#CONTAINERS`,
      sk: this.id,
      gsi1pk: `INVENTORY#${this.inventoryId}`,
      gsi1sk: `CONTAINER#${this.id}`,
      id: this.id,
      inventoryId: this.inventoryId,
      name: this.name,
      type: this.type,
      description: this.description,
      contentsSummary: this.contentsSummary,
      photos: this.photos,
      qrCode: this.qrCode,
      handlingFlags: this.handlingFlags,
      itemCount: this.itemCount,
      estimatedValue: this.estimatedValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      status: this.status,
      metadata: this.metadata
    };

    // Add optional fields if they exist
    if (this.projectId) item.projectId = this.projectId;
    if (this.size) item.size = this.size;
    if (this.color) item.color = this.color;
    if (this.qrCodeUrl) item.qrCodeUrl = this.qrCodeUrl;
    if (this.locationId) item.locationId = this.locationId;
    if (this.storageStartDate) item.storageStartDate = this.storageStartDate;
    if (this.storageRate) item.storageRate = this.storageRate;

    return item;
  }

  /**
   * Create from DynamoDB item
   * @param {object} item - DynamoDB item
   * @returns {Container} Container instance
   */
  static fromDynamoDBItem(item) {
    return new Container({
      id: item.id,
      inventoryId: item.inventoryId,
      projectId: item.projectId,
      name: item.name,
      type: item.type,
      size: item.size,
      color: item.color,
      description: item.description,
      contentsSummary: item.contentsSummary,
      photos: item.photos || [],
      qrCode: item.qrCode,
      qrCodeUrl: item.qrCodeUrl,
      locationId: item.locationId,
      handlingFlags: item.handlingFlags || [],
      itemCount: item.itemCount || 0,
      estimatedValue: item.estimatedValue || 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createdBy: item.createdBy,
      updatedBy: item.updatedBy,
      status: item.status,
      storageStartDate: item.storageStartDate,
      storageRate: item.storageRate,
      metadata: item.metadata || {}
    });
  }

  /**
   * Update container data
   * @param {object} updates - Fields to update
   * @param {string} updatedBy - User ID making the update
   */
  update(updates, updatedBy) {
    const allowedUpdates = [
      'name', 'description', 'contentsSummary', 'type', 'size', 'color', 'photos', 'locationId',
      'handlingFlags', 'projectId', 'storageRate', 'metadata'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        this[field] = updates[field];
      }
    });

    this.updatedBy = updatedBy;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Update item count and estimated value
   * @param {number} itemCount - New item count
   * @param {number} estimatedValue - New estimated value
   * @param {string} updatedBy - User ID making the update
   */
  updateContents(itemCount, estimatedValue, updatedBy) {
    this.itemCount = itemCount || 0;
    this.estimatedValue = estimatedValue || 0;
    this.updatedBy = updatedBy;
    this.updatedAt = new Date().toISOString();

    // Update status based on item count
    if (this.itemCount === 0 && this.status === ContainerStatus.PACKING) {
      this.status = ContainerStatus.EMPTY;
    } else if (this.itemCount > 0 && this.status === ContainerStatus.EMPTY) {
      this.status = ContainerStatus.PACKING;
    }
  }
}

// Export the class and enums
module.exports = {
  Container,
  ContainerType,
  HandlingFlag,
  ContainerStatus
};