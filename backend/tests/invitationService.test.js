const invitationService = require('../services/invitationService');
const emailService = require('../services/emailService');

// Mock the email service to avoid sending real emails during tests
jest.mock('../services/emailService', () => ({
  sendInvitationEmail: jest.fn().mockResolvedValue({
    messageId: 'test-message-id',
    email: 'test@example.com',
    subject: 'Test Invitation',
    sentAt: new Date().toISOString()
  })
}));

// Mock DynamoDB operations
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: jest.fn()
    }))
  },
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  QueryCommand: jest.fn(),
  DeleteCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn()
}));

describe('InvitationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createInvitation', () => {
    test('should validate required parameters', async () => {
      await expect(invitationService.createInvitation()).rejects.toThrow(
        'Inventory ID is required'
      );
    });

    test('should validate email format', async () => {
      await expect(
        invitationService.createInvitation('550e8400-e29b-41d4-a716-446655440000', 'invalid-email', 'member', '550e8400-e29b-41d4-a716-446655440001')
      ).rejects.toThrow('Email address must contain exactly one @ symbol');
    });

    test('should validate role', async () => {
      await expect(
        invitationService.createInvitation('550e8400-e29b-41d4-a716-446655440000', 'test@example.com', 'invalid-role', '550e8400-e29b-41d4-a716-446655440001')
      ).rejects.toThrow('Invalid user role');
    });

    test('should generate secure token', () => {
      const token1 = invitationService.generateSecureToken();
      const token2 = invitationService.generateSecureToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(20); // Base64url encoded 32 bytes should be longer
    });
  });

  describe('token generation', () => {
    test('should generate cryptographically secure tokens', () => {
      const tokens = new Set();
      
      // Generate 100 tokens and ensure they're all unique
      for (let i = 0; i < 100; i++) {
        const token = invitationService.generateSecureToken();
        expect(tokens.has(token)).toBe(false);
        tokens.add(token);
      }
      
      expect(tokens.size).toBe(100);
    });
  });

  describe('email integration', () => {
    test('should not fail invitation creation if email fails', async () => {
      // Mock DynamoDB to succeed
      const mockSend = jest.fn().mockResolvedValue({});
      require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from.mockReturnValue({
        send: mockSend
      });

      // Mock email service to fail
      emailService.sendInvitationEmail.mockRejectedValue(new Error('Email service unavailable'));

      // Mock getPendingInvitationByEmail to return null (no existing invitation)
      invitationService.getPendingInvitationByEmail = jest.fn().mockResolvedValue(null);

      const result = await invitationService.createInvitation(
        '550e8400-e29b-41d4-a716-446655440000',
        'test@example.com',
        'member',
        '550e8400-e29b-41d4-a716-446655440001',
        {
          inventoryName: 'Test Inventory',
          inviterName: 'Test User'
        }
      );

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(result.role).toBe('member');
      expect(result.status).toBe('pending');
      expect(result.token).toBeUndefined(); // Token should be removed for security
    });
  });
});