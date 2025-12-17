const emailService = require('../services/emailService');

// Mock AWS SES
jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({
      MessageId: 'test-message-id-123'
    })
  })),
  SendEmailCommand: jest.fn(),
  GetSendQuotaCommand: jest.fn()
}));

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendInvitationEmail', () => {
    test('should validate required parameters', async () => {
      await expect(emailService.sendInvitationEmail()).rejects.toThrow(
        'Email, token, and invitation details are required'
      );
    });

    test('should validate invitation details', async () => {
      await expect(
        emailService.sendInvitationEmail('test@example.com', 'token123', {})
      ).rejects.toThrow('Invitation details must include inventoryName, inviterName, and role');
    });

    test('should generate proper email content', () => {
      const params = {
        inventoryName: 'Test Inventory',
        inviterName: 'John Doe',
        role: 'member',
        invitationUrl: 'https://example.com/accept?token=abc123',
        expiryDays: 7
      };

      const htmlContent = emailService.generateInvitationEmailHTML(params);
      const textContent = emailService.generateInvitationEmailText(params);

      // Check HTML content
      expect(htmlContent).toContain('Test Inventory');
      expect(htmlContent).toContain('John Doe');
      expect(htmlContent).toContain('Member');
      expect(htmlContent).toContain('https://example.com/accept?token=abc123');
      expect(htmlContent).toContain('7 days');

      // Check text content
      expect(textContent).toContain('Test Inventory');
      expect(textContent).toContain('John Doe');
      expect(textContent).toContain('Member');
      expect(textContent).toContain('https://example.com/accept?token=abc123');
      expect(textContent).toContain('7 days');
    });

    test('should handle different roles correctly', () => {
      const roles = ['member', 'administrator', 'read_only', 'owner'];
      const expectedDisplayNames = ['Member', 'Administrator', 'Read-Only Member', 'Owner'];

      roles.forEach((role, index) => {
        const displayName = emailService.getRoleDisplayName(role);
        expect(displayName).toBe(expectedDisplayNames[index]);
      });
    });

    test('should handle unknown roles', () => {
      const displayName = emailService.getRoleDisplayName('unknown_role');
      expect(displayName).toBe('Member');
    });
  });

  describe('sendNotificationEmail', () => {
    test('should validate required parameters', async () => {
      await expect(emailService.sendNotificationEmail()).rejects.toThrow(
        'Email, subject, and message are required'
      );
    });
  });

  describe('validateConfiguration', () => {
    test('should validate email service configuration', async () => {
      // Mock environment variables
      const originalFromEmail = process.env.FROM_EMAIL;
      const originalFrontendUrl = process.env.FRONTEND_URL;

      process.env.FROM_EMAIL = 'test@example.com';
      process.env.FRONTEND_URL = 'https://example.com';

      const isValid = await emailService.validateConfiguration();
      expect(isValid).toBe(true);

      // Restore original values
      process.env.FROM_EMAIL = originalFromEmail;
      process.env.FRONTEND_URL = originalFrontendUrl;
    });
  });
});