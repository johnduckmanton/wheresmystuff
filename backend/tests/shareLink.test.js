const ShareLink = require('../models/shareLink');

describe('ShareLink Model', () => {
  const mockProjectId = 'project-123';
  const mockInventoryId = 'inventory-123';
  const mockUserId = 'user-123';

  describe('Constructor', () => {
    it('should create a share link with default values', () => {
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId
      });

      expect(shareLink.id).toBeDefined();
      expect(shareLink.projectId).toBe(mockProjectId);
      expect(shareLink.inventoryId).toBe(mockInventoryId);
      expect(shareLink.createdBy).toBe(mockUserId);
      expect(shareLink.token).toBeDefined();
      expect(shareLink.accessLevel).toBe('view');
      expect(shareLink.isActive).toBe(true);
      expect(shareLink.accessCount).toBe(0);
      expect(shareLink.createdAt).toBeDefined();
      expect(shareLink.updatedAt).toBeDefined();
    });

    it('should create a share link with custom values', () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        accessLevel: 'edit',
        expiresAt
      });

      expect(shareLink.accessLevel).toBe('edit');
      expect(shareLink.expiresAt).toBe(expiresAt);
    });
  });

  describe('Token Generation', () => {
    it('should generate a unique token', () => {
      const shareLink1 = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId
      });

      const shareLink2 = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId
      });

      expect(shareLink1.token).not.toBe(shareLink2.token);
      expect(shareLink1.token.length).toBe(16);
      expect(shareLink2.token.length).toBe(16);
    });
  });

  describe('Expiration', () => {
    it('should detect expired share link', () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        expiresAt: pastDate
      });

      expect(shareLink.isExpired()).toBe(true);
    });

    it('should detect non-expired share link', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        expiresAt: futureDate
      });

      expect(shareLink.isExpired()).toBe(false);
    });

    it('should return false for no expiration date', () => {
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId
      });

      expect(shareLink.isExpired()).toBe(false);
    });
  });

  describe('Validity', () => {
    it('should be valid when active and not expired', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        isActive: true,
        expiresAt: futureDate
      });

      expect(shareLink.isValid()).toBe(true);
    });

    it('should be invalid when inactive', () => {
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        isActive: false
      });

      expect(shareLink.isValid()).toBe(false);
    });

    it('should be invalid when expired', () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        isActive: true,
        expiresAt: pastDate
      });

      expect(shareLink.isValid()).toBe(false);
    });
  });

  describe('Access Recording', () => {
    it('should record access to share link', () => {
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId
      });

      const result = shareLink.recordAccess('192.168.1.1', 'Mozilla/5.0');

      expect(result.success).toBe(true);
      expect(shareLink.accessCount).toBe(1);
      expect(shareLink.lastAccessedAt).toBeDefined();
      expect(shareLink.accessLog.length).toBe(1);
      expect(shareLink.accessLog[0].ipAddress).toBe('192.168.1.1');
      expect(shareLink.accessLog[0].userAgent).toBe('Mozilla/5.0');
    });

    it('should not record access to expired link', () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        expiresAt: pastDate
      });

      const result = shareLink.recordAccess('192.168.1.1', 'Mozilla/5.0');

      expect(result.success).toBe(false);
      expect(shareLink.accessCount).toBe(0);
    });

    it('should not record access to inactive link', () => {
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        isActive: false
      });

      const result = shareLink.recordAccess('192.168.1.1', 'Mozilla/5.0');

      expect(result.success).toBe(false);
      expect(shareLink.accessCount).toBe(0);
    });

    it('should keep only last 100 access logs', () => {
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId
      });

      // Record 150 accesses
      for (let i = 0; i < 150; i++) {
        shareLink.recordAccess(`192.168.1.${i}`, `Mozilla/5.0 ${i}`);
      }

      expect(shareLink.accessLog.length).toBe(100);
      expect(shareLink.accessCount).toBe(150);
    });
  });

  describe('Revocation', () => {
    it('should revoke share link', () => {
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        isActive: true
      });

      shareLink.revoke();

      expect(shareLink.isActive).toBe(false);
      expect(shareLink.isValid()).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate valid share link', () => {
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        token: 'test-token-123',
        accessLevel: 'view'
      });

      const validation = shareLink.validate();

      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should reject missing projectId', () => {
      const shareLink = new ShareLink({
        inventoryId: mockInventoryId,
        createdBy: mockUserId
      });

      const validation = shareLink.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('projectId is required');
    });

    it('should reject missing inventoryId', () => {
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        createdBy: mockUserId
      });

      const validation = shareLink.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('inventoryId is required');
    });

    it('should reject missing createdBy', () => {
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId
      });

      const validation = shareLink.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('createdBy is required');
    });

    it('should reject invalid accessLevel', () => {
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        accessLevel: 'invalid'
      });

      const validation = shareLink.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('accessLevel must be one of: view, comment, edit');
    });

    it('should reject past expiration date', () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        expiresAt: pastDate
      });

      const validation = shareLink.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('expiresAt must be in the future');
    });
  });

  describe('DynamoDB Conversion', () => {
    it('should convert to DynamoDB item', () => {
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId
      });

      const item = shareLink.toDynamoDBItem();

      expect(item.pk).toBe(`PROJECT#${mockProjectId}#SHARES`);
      expect(item.sk).toBe(shareLink.id);
      expect(item.projectId).toBe(mockProjectId);
      expect(item.inventoryId).toBe(mockInventoryId);
      expect(item.createdBy).toBe(mockUserId);
      expect(item.entityType).toBe('SHARE_LINK');
    });

    it('should convert from DynamoDB item', () => {
      const item = {
        pk: `PROJECT#${mockProjectId}#SHARES`,
        sk: 'share-123',
        id: 'share-123',
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        token: 'test-token',
        accessLevel: 'view',
        isActive: true,
        accessCount: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const shareLink = ShareLink.fromDynamoDBItem(item);

      expect(shareLink.id).toBe('share-123');
      expect(shareLink.projectId).toBe(mockProjectId);
      expect(shareLink.inventoryId).toBe(mockInventoryId);
      expect(shareLink.createdBy).toBe(mockUserId);
      expect(shareLink.token).toBe('test-token');
      expect(shareLink.accessCount).toBe(5);
    });
  });

  describe('Public View', () => {
    it('should return public view without sensitive data', () => {
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        accessLog: [{ timestamp: new Date().toISOString(), ipAddress: '192.168.1.1' }]
      });

      const publicView = shareLink.getPublicView();

      expect(publicView.id).toBeDefined();
      expect(publicView.token).toBeDefined();
      expect(publicView.accessLevel).toBeDefined();
      expect(publicView.createdAt).toBeDefined();
      expect(publicView.projectId).toBeUndefined();
      expect(publicView.inventoryId).toBeUndefined();
      expect(publicView.createdBy).toBeUndefined();
      expect(publicView.accessLog).toBeUndefined();
    });
  });

  describe('Admin View', () => {
    it('should return admin view with all data', () => {
      const shareLink = new ShareLink({
        projectId: mockProjectId,
        inventoryId: mockInventoryId,
        createdBy: mockUserId,
        accessLog: [{ timestamp: new Date().toISOString(), ipAddress: '192.168.1.1' }]
      });

      const adminView = shareLink.getAdminView();

      expect(adminView.id).toBeDefined();
      expect(adminView.projectId).toBe(mockProjectId);
      expect(adminView.inventoryId).toBeUndefined();
      expect(adminView.createdBy).toBe(mockUserId);
      expect(adminView.token).toBeDefined();
      expect(adminView.accessLog).toBeDefined();
      expect(adminView.accessLog.length).toBe(1);
    });
  });
});
