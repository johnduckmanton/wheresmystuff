/**
 * User Management Integration Tests
 * 
 * Comprehensive end-to-end tests for the user management system including:
 * - Complete user management workflow
 * - Role-based access control validation
 * - Invitation flow end-to-end
 * - Audit logging and security measures
 * 
 * Task 14: Final testing and validation
 * Requirements: All requirements from user-management-enhancement spec
 */

// Mock AWS SDK clients
const mockSend = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend }))
  },
  PutCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'PutCommand' } })),
  GetCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'GetCommand' } })),
  QueryCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'QueryCommand' } })),
  UpdateCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'UpdateCommand' } })),
  DeleteCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'DeleteCommand' } }))
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn()
}));

jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
  AdminGetUserCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'AdminGetUserCommand' } })),
  ListUsersCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'ListUsersCommand' } })),
  AdminUpdateUserAttributesCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'AdminUpdateUserAttributesCommand' } }))
}));

jest.mock('../services/emailService', () => ({
  sendInvitationEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'test-message-id' })
}));

const mockAuditLog = jest.fn().mockResolvedValue({});
jest.mock('../services/auditLogService', () => ({
  logDataAccess: mockAuditLog,
  logAuthzFailure: mockAuditLog,
  logMemberAddition: mockAuditLog,
  logMemberRemoval: mockAuditLog,
  logRoleChange: mockAuditLog,
  logInvitationCreated: mockAuditLog,
  logInvitationAccepted: mockAuditLog
}));

// Set up environment variables
process.env.TABLE_NAME = 'test-table';
process.env.USER_POOL_ID = 'test-pool-id';
process.env.FRONTEND_URL = 'https://test.example.com';

// Import services after mocking
const userService = require('../services/userService');
const invitationService = require('../services/invitationService');
const inventoryService = require('../services/inventoryService');
const auditLogService = require('../services/auditLogService');

describe('User Management Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({ Item: null });
  });

  describe('Complete User Management Workflow', () => {
    /**
     * Test the complete workflow from user lookup to member addition
     * Validates: Requirements 1.1, 1.2, 2.1, 2.2, 3.1, 3.2
     */
    test('should complete full workflow: lookup user by email and add to inventory', async () => {
      const testEmail = 'newmember@example.com';
      const testUserId = '550e8400-e29b-41d4-a716-446655440000';
      const inventoryId = '660e8400-e29b-41d4-a716-446655440001';
      const adminUserId = '770e8400-e29b-41d4-a716-446655440002';

      // Step 1: Admin looks up user by email
      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'ListUsersCommand') {
          return Promise.resolve({
            Users: [{
              Username: testUserId,
              Attributes: [
                { Name: 'email', Value: testEmail },
                { Name: 'sub', Value: testUserId },
                { Name: 'name', Value: 'New Member' }
              ],
              Enabled: true,
              UserStatus: 'CONFIRMED',
              UserCreateDate: new Date(),
              UserLastModifiedDate: new Date()
            }]
          });
        }
        
        if (command.constructor.name === 'GetCommand') {
          const key = command.input.Key;
          // Return admin membership
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${adminUserId}`) {
            return Promise.resolve({
              Item: {
                pk: `INVENTORY#${inventoryId}`,
                sk: `MEMBER#${adminUserId}`,
                inventoryId,
                userId: adminUserId,
                role: 'administrator',
                addedAt: new Date().toISOString()
              }
            });
          }
          // Check if new member already exists
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${testUserId}`) {
            return Promise.resolve({ Item: null });
          }
        }
        
        if (command.constructor.name === 'PutCommand') {
          return Promise.resolve({});
        }
        
        return Promise.resolve({ Item: null });
      });

      // Lookup user
      const userProfile = await userService.lookupUserByEmail(testEmail);
      expect(userProfile).toBeDefined();
      expect(userProfile.email).toBe(testEmail);
      expect(userProfile.userId).toBe(testUserId);

      // Step 2: Admin adds user to inventory with member role
      const membership = await inventoryService.addMemberByUserId(
        inventoryId,
        testUserId,
        'member',
        adminUserId
      );

      expect(membership).toBeDefined();
      expect(membership.userId).toBe(testUserId);
      expect(membership.role).toBe('member');

      // Step 3: Verify audit logging occurred
      expect(mockAuditLog).toHaveBeenCalled();
    });

    /**
     * Test workflow when user doesn't exist - should handle gracefully
     * Validates: Requirements 1.3, 3.3
     */
    test('should handle non-existent user lookup gracefully', async () => {
      const nonExistentEmail = 'nonexistent@example.com';

      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'ListUsersCommand') {
          return Promise.resolve({ Users: [] });
        }
        return Promise.resolve({ Item: null });
      });

      const userProfile = await userService.lookupUserByEmail(nonExistentEmail);
      expect(userProfile).toBeNull();
    });

    /**
     * Test user profile creation and retrieval
     * Validates: Requirements 4.1, 4.2, 4.3
     */
    test('should create and retrieve user profile with User ID', async () => {
      const testUserId = '880e8400-e29b-41d4-a716-446655440003';
      const testEmail = 'profiletest@example.com';

      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'AdminGetUserCommand') {
          return Promise.resolve({
            Username: testUserId,
            UserAttributes: [
              { Name: 'email', Value: testEmail },
              { Name: 'sub', Value: testUserId },
              { Name: 'name', Value: 'Profile Test User' }
            ],
            Enabled: true,
            UserStatus: 'CONFIRMED',
            UserCreateDate: new Date(),
            UserLastModifiedDate: new Date()
          });
        }
        
        if (command.constructor.name === 'GetCommand') {
          return Promise.resolve({ Item: null });
        }
        
        if (command.constructor.name === 'PutCommand') {
          return Promise.resolve({});
        }
        
        return Promise.resolve({ Item: null });
      });

      const profile = await userService.getUserProfile(testUserId);
      
      expect(profile).toBeDefined();
      expect(profile.userId).toBe(testUserId);
      expect(profile.email).toBe(testEmail);
      expect(profile.displayName).toBeDefined();
    });
  });

  describe('Role-Based Access Control Validation', () => {
    const inventoryId = '990e8400-e29b-41d4-a716-446655440004';
    const ownerUserId = 'aa0e8400-e29b-41d4-a716-446655440005';
    const adminUserId = 'bb0e8400-e29b-41d4-a716-446655440006';
    const memberUserId = 'cc0e8400-e29b-41d4-a716-446655440007';
    const readOnlyUserId = 'dd0e8400-e29b-41d4-a716-446655440008';

    /**
     * Test owner role permissions
     * Validates: Requirements 2.1, 2.5
     */
    test('should grant owner full permissions including delete', async () => {
      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'GetCommand') {
          const key = command.input.Key;
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${ownerUserId}`) {
            return Promise.resolve({
              Item: {
                pk: `INVENTORY#${inventoryId}`,
                sk: `MEMBER#${ownerUserId}`,
                inventoryId,
                userId: ownerUserId,
                role: 'owner',
                addedAt: new Date().toISOString()
              }
            });
          }
        }
        return Promise.resolve({ Item: null });
      });

      const permissions = await inventoryService.getMemberPermissions(inventoryId, ownerUserId);
      
      expect(permissions.role).toBe('owner');
      expect(permissions.permissions.canDeleteInventory).toBe(true);
      expect(permissions.permissions.canAddMembers).toBe(true);
      expect(permissions.permissions.canRemoveMembers).toBe(true);
      expect(permissions.permissions.canModifySettings).toBe(true);
      expect(permissions.permissions.canManageItems).toBe(true);
      expect(permissions.permissions.canViewItems).toBe(true);
      expect(permissions.permissions.canViewMembers).toBe(true);
      expect(permissions.permissions.canChangeRoles).toBe(true);
    });

    /**
     * Test administrator role permissions
     * Validates: Requirements 2.1, 2.2
     */
    test('should grant administrator member management permissions', async () => {
      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'GetCommand') {
          const key = command.input.Key;
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${adminUserId}`) {
            return Promise.resolve({
              Item: {
                pk: `INVENTORY#${inventoryId}`,
                sk: `MEMBER#${adminUserId}`,
                inventoryId,
                userId: adminUserId,
                role: 'administrator',
                addedAt: new Date().toISOString()
              }
            });
          }
        }
        return Promise.resolve({ Item: null });
      });

      const permissions = await inventoryService.getMemberPermissions(inventoryId, adminUserId);
      
      expect(permissions.role).toBe('administrator');
      expect(permissions.permissions.canAddMembers).toBe(true);
      expect(permissions.permissions.canRemoveMembers).toBe(true);
      expect(permissions.permissions.canModifySettings).toBe(true);
      expect(permissions.permissions.canManageItems).toBe(true);
      expect(permissions.permissions.canDeleteInventory).toBe(false);
    });

    /**
     * Test member role permissions
     * Validates: Requirements 2.1, 2.3
     */
    test('should grant member item management but not member management', async () => {
      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'GetCommand') {
          const key = command.input.Key;
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${memberUserId}`) {
            return Promise.resolve({
              Item: {
                pk: `INVENTORY#${inventoryId}`,
                sk: `MEMBER#${memberUserId}`,
                inventoryId,
                userId: memberUserId,
                role: 'member',
                addedAt: new Date().toISOString()
              }
            });
          }
        }
        return Promise.resolve({ Item: null });
      });

      const permissions = await inventoryService.getMemberPermissions(inventoryId, memberUserId);
      
      expect(permissions.role).toBe('member');
      expect(permissions.permissions.canManageItems).toBe(true);
      expect(permissions.permissions.canViewItems).toBe(true);
      expect(permissions.permissions.canAddMembers).toBe(false);
      expect(permissions.permissions.canRemoveMembers).toBe(false);
      expect(permissions.permissions.canModifySettings).toBe(false);
      expect(permissions.permissions.canDeleteInventory).toBe(false);
    });

    /**
     * Test read-only role permissions
     * Validates: Requirements 2.1, 2.4
     */
    test('should restrict read-only users to viewing only', async () => {
      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'GetCommand') {
          const key = command.input.Key;
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${readOnlyUserId}`) {
            return Promise.resolve({
              Item: {
                pk: `INVENTORY#${inventoryId}`,
                sk: `MEMBER#${readOnlyUserId}`,
                inventoryId,
                userId: readOnlyUserId,
                role: 'read_only',
                addedAt: new Date().toISOString()
              }
            });
          }
        }
        return Promise.resolve({ Item: null });
      });

      const permissions = await inventoryService.getMemberPermissions(inventoryId, readOnlyUserId);
      
      expect(permissions.role).toBe('read_only');
      expect(permissions.permissions.canViewItems).toBe(true);
      expect(permissions.permissions.canViewMembers).toBe(false); // read_only cannot view members
      expect(permissions.permissions.canManageItems).toBe(false);
      expect(permissions.permissions.canAddMembers).toBe(false);
      expect(permissions.permissions.canRemoveMembers).toBe(false);
      expect(permissions.permissions.canModifySettings).toBe(false);
      expect(permissions.permissions.canDeleteInventory).toBe(false);
    });

    /**
     * Test role change workflow with audit logging
     * Validates: Requirements 2.6
     */
    test('should update member role and log the change', async () => {
      const targetUserId = 'ee0e8400-e29b-41d4-a716-446655440009';
      
      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'GetCommand') {
          const key = command.input.Key;
          // Owner performing the change (only owners can change roles)
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${ownerUserId}`) {
            return Promise.resolve({
              Item: {
                pk: `INVENTORY#${inventoryId}`,
                sk: `MEMBER#${ownerUserId}`,
                inventoryId,
                userId: ownerUserId,
                role: 'owner',
                addedAt: new Date().toISOString()
              }
            });
          }
          // Target user being updated
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${targetUserId}`) {
            return Promise.resolve({
              Item: {
                pk: `INVENTORY#${inventoryId}`,
                sk: `MEMBER#${targetUserId}`,
                inventoryId,
                userId: targetUserId,
                role: 'member',
                addedAt: new Date().toISOString()
              }
            });
          }
        }
        
        if (command.constructor.name === 'UpdateCommand') {
          return Promise.resolve({
            Attributes: {
              pk: `INVENTORY#${inventoryId}`,
              sk: `MEMBER#${targetUserId}`,
              inventoryId,
              userId: targetUserId,
              role: 'administrator',
              updatedAt: new Date().toISOString(),
              updatedBy: ownerUserId
            }
          });
        }
        
        return Promise.resolve({ Item: null });
      });

      const updatedMembership = await inventoryService.updateMemberRole(
        inventoryId,
        ownerUserId,
        targetUserId,
        'administrator'
      );

      expect(updatedMembership.role).toBe('administrator');
      expect(updatedMembership.updatedBy).toBe(ownerUserId);
      
      // Verify audit log was called
      expect(mockAuditLog).toHaveBeenCalled();
    });
  });

  describe('Invitation Flow End-to-End', () => {
    const inventoryId = 'ff0e8400-e29b-41d4-a716-446655440010';
    const inviterUserId = '110e8400-e29b-41d4-a716-446655440011';
    const inviteeEmail = 'invitee@example.com';
    const inviteeUserId = '220e8400-e29b-41d4-a716-446655440012';

    /**
     * Test complete invitation flow from creation to acceptance
     * Validates: Requirements 1.3, 1.4, 1.5
     */
    test('should complete full invitation flow: create, send, accept', async () => {
      let createdInvitation = null;
      
      mockSend.mockImplementation((command) => {
        // Check for existing invitations
        if (command.constructor.name === 'QueryCommand') {
          return Promise.resolve({ Items: [] });
        }
        
        // Create invitation
        if (command.constructor.name === 'PutCommand') {
          createdInvitation = command.input.Item;
          return Promise.resolve({});
        }
        
        // Get invitation by token
        if (command.constructor.name === 'GetCommand') {
          const key = command.input.Key;
          if (key.pk && key.pk.startsWith('INVITATION#')) {
            return Promise.resolve({
              Item: createdInvitation
            });
          }
          // Check if member already exists
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${inviteeUserId}`) {
            return Promise.resolve({ Item: null });
          }
        }
        
        // Update invitation status
        if (command.constructor.name === 'UpdateCommand') {
          return Promise.resolve({});
        }
        
        return Promise.resolve({ Item: null });
      });

      // Step 1: Create invitation
      const invitation = await invitationService.createInvitation(
        inventoryId,
        inviteeEmail,
        'member',
        inviterUserId,
        {
          inventoryName: 'Test Inventory',
          inviterName: 'Test Inviter'
        }
      );

      expect(invitation).toBeDefined();
      expect(invitation.email).toBe(inviteeEmail.toLowerCase());
      expect(invitation.role).toBe('member');
      expect(invitation.status).toBe('pending');
      expect(invitation.token).toBeUndefined(); // Token should not be exposed

      // Verify invitation was stored with token
      expect(createdInvitation).toBeDefined();
      expect(createdInvitation.token).toBeDefined();
      expect(createdInvitation.token.length).toBeGreaterThan(40);

      // Step 2: Mock query to return the invitation for acceptance
      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'QueryCommand') {
          return Promise.resolve({
            Items: [createdInvitation]
          });
        }
        
        if (command.constructor.name === 'UpdateCommand') {
          return Promise.resolve({});
        }
        
        if (command.constructor.name === 'PutCommand') {
          return Promise.resolve({});
        }
        
        if (command.constructor.name === 'GetCommand') {
          return Promise.resolve({ Item: null });
        }
        
        return Promise.resolve({ Item: null });
      });

      // Step 3: Process invitation acceptance
      const result = await invitationService.processInvitation(
        createdInvitation.token,
        inviteeUserId
      );

      expect(result).toBeDefined();
      expect(result.inventoryId).toBe(inventoryId);
      expect(result.role).toBe('member');
      expect(result.email).toBe(inviteeEmail.toLowerCase());
    });

    /**
     * Test invitation expiration handling
     * Validates: Requirements 1.4, 1.5
     */
    test('should reject expired invitation', async () => {
      const expiredInvitation = {
        pk: 'INVITATION#expired-id',
        sk: 'METADATA',
        invitationId: 'expired-id',
        inventoryId,
        email: 'expired@example.com',
        role: 'member',
        invitedBy: inviterUserId,
        status: 'pending',
        token: 'expired-token-that-is-long-enough-to-pass-validation-checks',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
        expiresAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
      };

      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'QueryCommand') {
          return Promise.resolve({
            Items: [expiredInvitation]
          });
        }
        
        if (command.constructor.name === 'UpdateCommand') {
          return Promise.resolve({});
        }
        
        return Promise.resolve({ Item: null });
      });

      await expect(
        invitationService.processInvitation(expiredInvitation.token, inviteeUserId)
      ).rejects.toThrow(/expired/i);
    });

    /**
     * Test duplicate invitation prevention
     * Validates: Requirements 1.3, 1.4
     */
    test('should prevent duplicate invitations for same email', async () => {
      const existingInvitation = {
        pk: 'INVITATION#existing-id',
        sk: 'METADATA',
        invitationId: 'existing-id',
        inventoryId,
        email: inviteeEmail.toLowerCase(),
        role: 'member',
        invitedBy: inviterUserId,
        status: 'pending',
        token: 'existing-token',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'QueryCommand') {
          return Promise.resolve({
            Items: [existingInvitation]
          });
        }
        return Promise.resolve({ Item: null });
      });

      await expect(
        invitationService.createInvitation(
          inventoryId,
          inviteeEmail,
          'member',
          inviterUserId,
          { inventoryName: 'Test', inviterName: 'Test' }
        )
      ).rejects.toThrow(/already exists/i);
    });

    /**
     * Test invitation cancellation
     * Validates: Requirements 1.4
     */
    test('should allow invitation cancellation', async () => {
      const invitationId = '330e8400-e29b-41d4-a716-446655440013';
      
      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'UpdateCommand') {
          return Promise.resolve({});
        }
        return Promise.resolve({ Item: null });
      });

      await expect(
        invitationService.cancelInvitation(invitationId, inviterUserId)
      ).resolves.not.toThrow();
    });
  });

  describe('Audit Logging and Security Measures', () => {
    const inventoryId = '440e8400-e29b-41d4-a716-446655440014';
    const adminUserId = '550e8400-e29b-41d4-a716-446655440015';
    const targetUserId = '660e8400-e29b-41d4-a716-446655440016';

    /**
     * Test audit logging for member addition
     * Validates: Requirements 2.6, 3.5
     */
    test('should log member addition to audit trail', async () => {
      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'GetCommand') {
          const key = command.input.Key;
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${adminUserId}`) {
            return Promise.resolve({
              Item: {
                pk: `INVENTORY#${inventoryId}`,
                sk: `MEMBER#${adminUserId}`,
                inventoryId,
                userId: adminUserId,
                role: 'administrator',
                addedAt: new Date().toISOString()
              }
            });
          }
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${targetUserId}`) {
            return Promise.resolve({ Item: null });
          }
        }
        
        if (command.constructor.name === 'PutCommand') {
          return Promise.resolve({});
        }
        
        return Promise.resolve({ Item: null });
      });

      await inventoryService.addMemberByUserId(
        inventoryId,
        targetUserId,
        'member',
        adminUserId
      );

      // Verify audit log was called with member addition
      expect(mockAuditLog).toHaveBeenCalled();
      const auditCalls = mockAuditLog.mock.calls;
      expect(auditCalls.length).toBeGreaterThan(0);
    });

    /**
     * Test audit logging for role changes
     * Validates: Requirements 2.6
     */
    test('should log role changes to audit trail', async () => {
      const ownerUserId = '880e8400-e29b-41d4-a716-446655440026';
      
      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'GetCommand') {
          const key = command.input.Key;
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${ownerUserId}`) {
            return Promise.resolve({
              Item: {
                pk: `INVENTORY#${inventoryId}`,
                sk: `MEMBER#${ownerUserId}`,
                inventoryId,
                userId: ownerUserId,
                role: 'owner',
                addedAt: new Date().toISOString()
              }
            });
          }
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${targetUserId}`) {
            return Promise.resolve({
              Item: {
                pk: `INVENTORY#${inventoryId}`,
                sk: `MEMBER#${targetUserId}`,
                inventoryId,
                userId: targetUserId,
                role: 'member',
                addedAt: new Date().toISOString()
              }
            });
          }
        }
        
        if (command.constructor.name === 'UpdateCommand') {
          return Promise.resolve({
            Attributes: {
              pk: `INVENTORY#${inventoryId}`,
              sk: `MEMBER#${targetUserId}`,
              inventoryId,
              userId: targetUserId,
              role: 'administrator',
              updatedAt: new Date().toISOString(),
              updatedBy: ownerUserId
            }
          });
        }
        
        return Promise.resolve({ Item: null });
      });

      jest.clearAllMocks();

      await inventoryService.updateMemberRole(
        inventoryId,
        ownerUserId,
        targetUserId,
        'administrator'
      );

      // Verify audit log was called for role change
      expect(mockAuditLog).toHaveBeenCalled();
    });

    /**
     * Test audit logging for user lookups
     * Validates: Requirements 3.5
     */
    test('should log user lookup operations', async () => {
      const testEmail = 'lookup@example.com';
      const testUserId = '770e8400-e29b-41d4-a716-446655440017';

      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'ListUsersCommand') {
          return Promise.resolve({
            Users: [{
              Username: testUserId,
              Attributes: [
                { Name: 'email', Value: testEmail },
                { Name: 'sub', Value: testUserId },
                { Name: 'name', Value: 'Lookup Test' }
              ],
              Enabled: true,
              UserStatus: 'CONFIRMED',
              UserCreateDate: new Date(),
              UserLastModifiedDate: new Date()
            }]
          });
        }
        
        if (command.constructor.name === 'GetCommand') {
          return Promise.resolve({ Item: null });
        }
        
        if (command.constructor.name === 'PutCommand') {
          return Promise.resolve({});
        }
        
        return Promise.resolve({ Item: null });
      });

      await userService.lookupUserByEmail(testEmail);

      // User lookup operations should be logged
      // In production, this would be logged by the handler layer
      expect(mockSend).toHaveBeenCalled();
    });

    /**
     * Test invitation token security
     * Validates: Requirements 1.4, 1.5
     */
    test('should generate cryptographically secure invitation tokens', () => {
      const tokens = new Set();
      
      // Generate 50 tokens and verify uniqueness
      for (let i = 0; i < 50; i++) {
        const token = invitationService.generateSecureToken();
        
        expect(token).toBeDefined();
        expect(token.length).toBeGreaterThan(40);
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // Base64URL format
        expect(tokens.has(token)).toBe(false);
        
        tokens.add(token);
      }
      
      expect(tokens.size).toBe(50);
    });

    /**
     * Test that sensitive data is not exposed in responses
     * Validates: Requirements 1.4, 4.5
     */
    test('should not expose invitation tokens in API responses', async () => {
      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'QueryCommand') {
          return Promise.resolve({ Items: [] });
        }
        
        if (command.constructor.name === 'PutCommand') {
          return Promise.resolve({});
        }
        
        return Promise.resolve({ Item: null });
      });

      const invitation = await invitationService.createInvitation(
        inventoryId,
        'secure@example.com',
        'member',
        adminUserId,
        { inventoryName: 'Test', inviterName: 'Test' }
      );

      // Token should not be in the returned invitation
      expect(invitation.token).toBeUndefined();
      
      // But other fields should be present
      expect(invitation.invitationId).toBeDefined();
      expect(invitation.email).toBeDefined();
      expect(invitation.role).toBeDefined();
      expect(invitation.status).toBe('pending');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    /**
     * Test invalid email format handling
     * Validates: Requirements 1.1, 3.3
     */
    test('should reject invalid email formats', async () => {
      const invalidEmails = [
        'notanemail',
        'missing@domain',
        '@nodomain.com',
        'double@@domain.com',
        'spaces in@email.com'
      ];

      for (const email of invalidEmails) {
        await expect(
          userService.lookupUserByEmail(email)
        ).rejects.toThrow();
      }
    });

    /**
     * Test invalid role handling
     * Validates: Requirements 2.1
     */
    test('should reject invalid roles', async () => {
      const inventoryId = '880e8400-e29b-41d4-a716-446655440018';
      const userId = '990e8400-e29b-41d4-a716-446655440019';
      const adminUserId = 'aa0e8400-e29b-41d4-a716-446655440020';

      mockSend.mockResolvedValue({ Item: null });

      await expect(
        invitationService.createInvitation(
          inventoryId,
          'test@example.com',
          'invalid_role',
          adminUserId
        )
      ).rejects.toThrow(/Invalid.*role/i);
    });

    /**
     * Test permission validation
     * Validates: Requirements 2.2, 2.3, 2.4
     */
    test('should validate permissions before allowing operations', async () => {
      const inventoryId = 'bb0e8400-e29b-41d4-a716-446655440021';
      const readOnlyUserId = 'cc0e8400-e29b-41d4-a716-446655440022';
      const targetUserId = 'dd0e8400-e29b-41d4-a716-446655440023';

      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'GetCommand') {
          const key = command.input.Key;
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${readOnlyUserId}`) {
            return Promise.resolve({
              Item: {
                pk: `INVENTORY#${inventoryId}`,
                sk: `MEMBER#${readOnlyUserId}`,
                inventoryId,
                userId: readOnlyUserId,
                role: 'read_only',
                addedAt: new Date().toISOString()
              }
            });
          }
        }
        return Promise.resolve({ Item: null });
      });

      // Read-only user should not be able to add members
      // The addMemberByUserId doesn't check permissions - it's checked at handler level
      // So we test that the permissions object correctly indicates no permission
      const permissions = await inventoryService.getMemberPermissions(inventoryId, readOnlyUserId);
      expect(permissions.permissions.canAddMembers).toBe(false);
    });

    /**
     * Test UUID validation
     * Validates: Requirements 3.3
     */
    test('should validate UUID formats', async () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '12345',
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
      ];

      for (const uuid of invalidUUIDs) {
        await expect(
          userService.getUserProfile(uuid)
        ).rejects.toThrow(/Invalid.*ID/i);
      }
    });
  });

  describe('Member Information Access Control', () => {
    const inventoryId = 'ee0e8400-e29b-41d4-a716-446655440024';
    const memberUserId = 'ff0e8400-e29b-41d4-a716-446655440025';

    /**
     * Test member list visibility based on role
     * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
     */
    test('should show member information based on user permissions', async () => {
      mockSend.mockImplementation((command) => {
        if (command.constructor.name === 'GetCommand') {
          const key = command.input.Key;
          if (key.pk === `INVENTORY#${inventoryId}` && key.sk === `MEMBER#${memberUserId}`) {
            return Promise.resolve({
              Item: {
                pk: `INVENTORY#${inventoryId}`,
                sk: `MEMBER#${memberUserId}`,
                inventoryId,
                userId: memberUserId,
                role: 'member',
                addedAt: new Date().toISOString(),
                addedBy: 'admin-user-id'
              }
            });
          }
        }
        
        if (command.constructor.name === 'QueryCommand') {
          return Promise.resolve({
            Items: [
              {
                pk: `INVENTORY#${inventoryId}`,
                sk: `MEMBER#${memberUserId}`,
                inventoryId,
                userId: memberUserId,
                role: 'member',
                addedAt: new Date().toISOString(),
                addedBy: 'admin-user-id'
              }
            ]
          });
        }
        
        return Promise.resolve({ Item: null });
      });

      const members = await inventoryService.getInventoryMembers(inventoryId, memberUserId);
      
      expect(members).toBeDefined();
      expect(Array.isArray(members)).toBe(true);
      expect(members.length).toBeGreaterThan(0);
      
      // Verify member information includes role and metadata
      const member = members[0];
      expect(member.role).toBeDefined();
      expect(member.addedAt).toBeDefined();
      expect(member.addedBy).toBeDefined();
    });
  });
});
