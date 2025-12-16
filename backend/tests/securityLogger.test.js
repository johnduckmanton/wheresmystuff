// Mock AWS SDK
const mockSend = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-cloudwatch-logs', () => ({
  CloudWatchLogsClient: jest.fn().mockImplementation(() => ({
    send: mockSend
  })),
  PutLogEventsCommand: jest.fn(),
  CreateLogStreamCommand: jest.fn()
}));

const { logSecurityEvent, logAuthFailure, logAuthzFailure, logRateLimitViolation } = require('../utils/securityLogger');

describe('Security Logger', () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  describe('logSecurityEvent', () => {
    it('should log security events with correct format', async () => {
      await logSecurityEvent('auth', 'login_failure', {
        userId: 'user123',
        ipAddress: '192.168.1.1',
        requestId: 'req123'
      });

      expect(mockSend).toHaveBeenCalledTimes(2); // CreateLogStream + PutLogEvents
    });

    it('should handle missing details gracefully', async () => {
      await logSecurityEvent('auth', 'login_failure');

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should not throw on AWS errors', async () => {
      mockSend.mockRejectedValue(new Error('AWS Error'));

      await expect(logSecurityEvent('auth', 'login_failure')).resolves.not.toThrow();
    });
  });

  describe('logAuthFailure', () => {
    it('should log authentication failures', async () => {
      await logAuthFailure('user123', 'invalid_credentials', '192.168.1.1', 'req123');

      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('logAuthzFailure', () => {
    it('should log authorization failures', async () => {
      await logAuthzFailure('user123', 'inventory#123', 'read', 'no_access', 'req123');

      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('logRateLimitViolation', () => {
    it('should log rate limit violations', async () => {
      await logRateLimitViolation('user123', '/api/things', '192.168.1.1', 'req123');

      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });
});