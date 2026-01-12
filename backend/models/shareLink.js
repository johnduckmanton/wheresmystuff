const { v4: uuidv4 } = require('uuid');

/**
 * Share Link Model
 * Represents a shareable link for a moving project
 */
class ShareLink {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.projectId = data.projectId;
    this.inventoryId = data.inventoryId;
    this.createdBy = data.createdBy;
    this.token = data.token || this.generateToken();
    this.expiresAt = data.expiresAt;
    this.accessLevel = data.accessLevel || 'view'; // view, comment, edit
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.accessCount = data.accessCount || 0;
    this.lastAccessedAt = data.lastAccessedAt || null;
    this.accessLog = data.accessLog || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Generate a unique share token
   * @returns {string} Share token
   */
  generateToken() {
    return uuidv4().replace(/-/g, '').substring(0, 16);
  }

  /**
   * Check if share link is expired
   * @returns {boolean} True if expired
   */
  isExpired() {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
  }

  /**
   * Check if share link is valid
   * @returns {boolean} True if valid
   */
  isValid() {
    return this.isActive && !this.isExpired();
  }

  /**
   * Record an access to this share link
   * @param {string} ipAddress - IP address of accessor
   * @param {string} userAgent - User agent of accessor
   * @returns {object} Result with success flag
   */
  recordAccess(ipAddress, userAgent) {
    if (!this.isValid()) {
      return {
        success: false,
        error: 'Share link is not valid'
      };
    }

    this.accessCount += 1;
    this.lastAccessedAt = new Date().toISOString();
    this.accessLog.push({
      timestamp: this.lastAccessedAt,
      ipAddress,
      userAgent
    });

    // Keep only last 100 access logs
    if (this.accessLog.length > 100) {
      this.accessLog = this.accessLog.slice(-100);
    }

    this.updatedAt = new Date().toISOString();

    return {
      success: true,
      accessCount: this.accessCount
    };
  }

  /**
   * Revoke this share link
   * @returns {void}
   */
  revoke() {
    this.isActive = false;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Validate share link data
   * @returns {object} Validation result with isValid flag and errors array
   */
  validate() {
    const errors = [];

    if (!this.projectId) {
      errors.push('projectId is required');
    }

    if (!this.inventoryId) {
      errors.push('inventoryId is required');
    }

    if (!this.createdBy) {
      errors.push('createdBy is required');
    }

    if (!this.token) {
      errors.push('token is required');
    }

    if (!['view', 'comment', 'edit'].includes(this.accessLevel)) {
      errors.push('accessLevel must be one of: view, comment, edit');
    }

    if (this.expiresAt && new Date(this.expiresAt) <= new Date()) {
      errors.push('expiresAt must be in the future');
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
      pk: `PROJECT#${this.projectId}#SHARES`,
      sk: this.id,
      id: this.id,
      projectId: this.projectId,
      inventoryId: this.inventoryId,
      createdBy: this.createdBy,
      token: this.token,
      expiresAt: this.expiresAt,
      accessLevel: this.accessLevel,
      isActive: this.isActive,
      accessCount: this.accessCount,
      lastAccessedAt: this.lastAccessedAt,
      accessLog: this.accessLog,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      entityType: 'SHARE_LINK'
    };
  }

  /**
   * Create ShareLink from DynamoDB item
   * @param {object} item - DynamoDB item
   * @returns {ShareLink} ShareLink instance
   */
  static fromDynamoDBItem(item) {
    return new ShareLink({
      id: item.id,
      projectId: item.projectId,
      inventoryId: item.inventoryId,
      createdBy: item.createdBy,
      token: item.token,
      expiresAt: item.expiresAt,
      accessLevel: item.accessLevel,
      isActive: item.isActive,
      accessCount: item.accessCount,
      lastAccessedAt: item.lastAccessedAt,
      accessLog: item.accessLog || [],
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    });
  }

  /**
   * Get public view (safe to send to client)
   * @returns {object} Public view of share link
   */
  getPublicView() {
    return {
      id: this.id,
      token: this.token,
      accessLevel: this.accessLevel,
      expiresAt: this.expiresAt,
      isActive: this.isActive,
      createdAt: this.createdAt
    };
  }

  /**
   * Get admin view (includes access logs)
   * @returns {object} Admin view of share link
   */
  getAdminView() {
    return {
      id: this.id,
      projectId: this.projectId,
      token: this.token,
      expiresAt: this.expiresAt,
      accessLevel: this.accessLevel,
      isActive: this.isActive,
      accessCount: this.accessCount,
      lastAccessedAt: this.lastAccessedAt,
      accessLog: this.accessLog,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = ShareLink;
