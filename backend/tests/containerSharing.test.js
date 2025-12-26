// Mock AWS SDK first
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('../services/containerService');
jest.mock('../services/auditLogService');

// Create mock client
const mockDocClient = {
  send: jest.fn()
};

// Mock the DynamoDB client
require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient = {
  from: jest.fn(() => mockDocClient)
};

const containerSharingService = require('../services/containerSharingService');
const containerService = require('../services/containerService');

describe('Container Sharing Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSharingToken', () => {
    test('should generate a secure token', () => {
      const token = containerSharingService.generateSharingToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes * 2 (hex)
    });

    test('should generate unique tokens', () => {
      const token1 = containerSharingService.generateSharingToken();
      const token2 = containerSharingService.generateSharingToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('createSharingLink', () => {
    test('should create sharing link with default options', async () => {
      // Mock container service to return a valid container
      containerService.getContainer.mockResolvedValue({
        id: 'container-123',
        name: 'Test Container',
        inventoryId: 'inventory-123'
      });

      // Mock DynamoDB put operation
      mockDocClient.send.mockResolvedValue({});

      const result = await containerSharingService.createSharingLink(
        'container-123',
        'inventory-123',
        'user-123'
      );

      expect(result).toHaveProperty('shareId');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('shareUrl');
      expect(result).toHaveProperty('privacySettings');
      expect(result.privacySettings.includeItemDetails).toBe(true);
      expect(result.privacySettings.includePhotos).toBe(false);
      expect(result.privacySettings.includeSensitiveData).toBe(false);
    });

    test('should create sharing link with custom options', async () => {
      containerService.getContainer.mockResolvedValue({
        id: 'container-123',
        name: 'Test Container',
        inventoryId: 'inventory-123'
      });

      // Mock DynamoDB put operation
      mockDocClient.send.mockResolvedValue({});

      const options = {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        includeItemDetails: false,
        includePhotos: true,
        includeSensitiveData: true,
        maxAccesses: 10,
        description: 'Test sharing link'
      };

      const result = await containerSharingService.createSharingLink(
        'container-123',
        'inventory-123',
        'user-123',
        options
      );

      expect(result.expiresAt).toBe(options.expiresAt);
      expect(result.privacySettings.includeItemDetails).toBe(false);
      expect(result.privacySettings.includePhotos).toBe(true);
      expect(result.privacySettings.includeSensitiveData).toBe(true);
    });

    test('should throw error if container not found', async () => {
      containerService.getContainer.mockResolvedValue(null);

      await expect(
        containerSharingService.createSharingLink(
          'nonexistent-container',
          'inventory-123',
          'user-123'
        )
      ).rejects.toThrow('Container not found or access denied');
    });
  });

  describe('getSharingLink', () => {
    test('should return sharing link data for valid token', async () => {
      const mockSharingLink = {
        shareId: 'share-123',
        token: 'valid-token',
        containerId: 'container-123',
        inventoryId: 'inventory-123',
        isActive: true,
        expiresAt: null,
        maxAccesses: null,
        accessCount: 0,
        privacySettings: {
          includeItemDetails: true,
          includePhotos: false,
          includeSensitiveData: false
        }
      };

      mockDocClient.send.mockResolvedValue({ Item: mockSharingLink });

      // Mock getFilteredContainerData
      containerSharingService.getFilteredContainerData = jest.fn().mockResolvedValue({
        container: { id: 'container-123', name: 'Test Container' },
        items: [],
        itemCount: 0
      });

      // Mock updateAccessTracking
      containerSharingService.updateAccessTracking = jest.fn().mockResolvedValue();

      // Mock logSharingAccess
      containerSharingService.logSharingAccess = jest.fn().mockResolvedValue();

      const result = await containerSharingService.getSharingLink(
        'share-123',
        'valid-token',
        { ipAddress: '127.0.0.1' }
      );

      expect(result).toHaveProperty('shareId', 'share-123');
      expect(result).toHaveProperty('container');
      expect(result).toHaveProperty('privacySettings');
    });

    test('should throw error for invalid token', async () => {
      const mockSharingLink = {
        shareId: 'share-123',
        token: 'valid-token',
        isActive: true
      };

      const mockGet = jest.fn().mockResolvedValue({ Item: mockSharingLink });
      require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from.mockReturnValue({
        send: mockGet
      });

      await expect(
        containerSharingService.getSharingLink('share-123', 'invalid-token')
      ).rejects.toThrow('Invalid sharing token');
    });

    test('should throw error for expired link', async () => {
      const mockSharingLink = {
        shareId: 'share-123',
        token: 'valid-token',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000).toISOString() // Expired
      };

      const mockGet = jest.fn().mockResolvedValue({ Item: mockSharingLink });
      require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from.mockReturnValue({
        send: mockGet
      });

      await expect(
        containerSharingService.getSharingLink('share-123', 'valid-token')
      ).rejects.toThrow('Sharing link has expired');
    });

    test('should throw error for inactive link', async () => {
      const mockSharingLink = {
        shareId: 'share-123',
        token: 'valid-token',
        isActive: false
      };

      const mockGet = jest.fn().mockResolvedValue({ Item: mockSharingLink });
      require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from.mockReturnValue({
        send: mockGet
      });

      await expect(
        containerSharingService.getSharingLink('share-123', 'valid-token')
      ).rejects.toThrow('Sharing link has been deactivated');
    });
  });
});