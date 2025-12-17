const { validateEmail, validateUserRole, validateInvitationToken } = require('../utils/validation');

describe('Enhanced Validation Functions', () => {
  describe('validateEmail', () => {
    test('should validate correct email addresses', () => {
      const result = validateEmail('test@example.com');
      expect(result.valid).toBe(true);
      expect(result.normalizedEmail).toBe('test@example.com');
      expect(result.error).toBeNull();
    });

    test('should normalize email to lowercase', () => {
      const result = validateEmail('TEST@EXAMPLE.COM');
      expect(result.valid).toBe(true);
      expect(result.normalizedEmail).toBe('test@example.com');
    });

    test('should reject empty email', () => {
      const result = validateEmail('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email address is required');
    });

    test('should reject invalid email format', () => {
      const result = validateEmail('invalid-email');
      expect(result.valid).toBe(false);
      // The error message depends on what's wrong with the email
      expect(result.error).toBeTruthy();
    });

    test('should detect common typos', () => {
      const result = validateEmail('test@gmial.com');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Did you mean gmail.com?');
    });

    test('should reject email without domain', () => {
      const result = validateEmail('test@');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email address must have a domain after the @ symbol');
    });

    test('should reject email without username', () => {
      const result = validateEmail('@example.com');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email address must have a username before the @ symbol');
    });

    test('should reject email without dot in domain', () => {
      const result = validateEmail('test@example');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email domain must contain at least one dot (e.g., example.com)');
    });
  });

  describe('validateUserRole', () => {
    test('should validate correct roles', () => {
      const validRoles = ['owner', 'administrator', 'member', 'read_only'];
      
      validRoles.forEach(role => {
        const result = validateUserRole(role);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    test('should normalize role to lowercase', () => {
      const result = validateUserRole('ADMINISTRATOR');
      expect(result.valid).toBe(true);
      expect(result.normalizedRole).toBe('administrator');
    });

    test('should reject empty role', () => {
      const result = validateUserRole('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('User role is required');
    });

    test('should reject invalid role', () => {
      const result = validateUserRole('invalid-role');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid user role. Must be one of: owner, administrator, member, read_only');
    });

    test('should reject non-string role', () => {
      const result = validateUserRole(123);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('User role must be a text value');
    });
  });

  describe('validateInvitationToken', () => {
    test('should validate correct token format', () => {
      // Generate a proper base64url token (43 characters for 32 bytes)
      const validToken = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO';
      const result = validateInvitationToken(validToken);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    test('should reject empty token', () => {
      const result = validateInvitationToken('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invitation token is required');
    });

    test('should reject token with invalid characters', () => {
      const result = validateInvitationToken('invalid token with spaces');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid invitation token format');
    });

    test('should reject token that is too short', () => {
      const result = validateInvitationToken('short');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid invitation token length');
    });

    test('should reject token that is too long', () => {
      const longToken = 'a'.repeat(101);
      const result = validateInvitationToken(longToken);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid invitation token length');
    });

    test('should reject non-string token', () => {
      const result = validateInvitationToken(123);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invitation token must be a text value');
    });
  });
});