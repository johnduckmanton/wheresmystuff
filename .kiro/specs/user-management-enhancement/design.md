# User Management Enhancement Design

## Overview

This design document outlines the implementation of comprehensive user management capabilities for the Home Inventory Management System. The enhancement will enable email-based user lookup, role-based access control, user invitations, and improved member management interfaces.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   AWS Cognito   │
│                 │    │                  │    │                 │
│ - User Lookup   │◄──►│ - User Service   │◄──►│ - User Pool     │
│ - Role Mgmt     │    │ - Email Service  │    │ - Admin API     │
│ - Invitations   │    │ - Invitation Svc │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   DynamoDB       │
                       │                  │
                       │ - Invitations    │
                       │ - User Profiles  │
                       │ - Role Mappings  │
                       └──────────────────┘
```

## Components and Interfaces

### 1. User Service (Backend)

**Purpose**: Manage user lookup, profile management, and Cognito integration

**Key Methods**:
- `lookupUserByEmail(email)` - Find user in Cognito by email
- `getUserProfile(userId)` - Get user profile information
- `listUsers(filters)` - List users with optional filtering
- `updateUserProfile(userId, updates)` - Update user profile

**Dependencies**: AWS Cognito Admin API, DynamoDB

### 2. Invitation Service (Backend)

**Purpose**: Handle user invitations and pending memberships

**Key Methods**:
- `createInvitation(inventoryId, email, role, invitedBy)` - Create invitation
- `processInvitation(invitationToken)` - Process accepted invitation
- `listPendingInvitations(inventoryId)` - Get pending invitations
- `cancelInvitation(invitationId)` - Cancel pending invitation

**Dependencies**: Email Service, DynamoDB, User Service

### 3. Enhanced Inventory Service (Backend)

**Purpose**: Extended inventory management with role-based access

**Key Methods**:
- `addMemberByEmail(inventoryId, email, role, addedBy)` - Add member by email (role: owner|administrator|member|read_only)
- `updateMemberRole(inventoryId, userId, newRole, updatedBy)` - Update member role
- `getMemberPermissions(inventoryId, userId)` - Get user permissions
- `validateRolePermissions(role, action)` - Validate role permissions

### 4. User Management UI (Frontend)

**Purpose**: User interface for managing users and invitations

**Components**:
- `UserLookupDialog` - Search and select users by email
- `InviteUserDialog` - Send invitations to new users
- `MemberRoleManager` - Manage member roles and permissions
- `UserProfileView` - Display user profile with copyable ID

## Data Models

### User Profile (DynamoDB)

```javascript
{
  pk: "USER#<userId>",
  sk: "PROFILE",
  userId: "<cognito-user-id>",
  email: "user@example.com",
  username: "user@example.com",
  displayName: "John Doe",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  lastLoginAt: "2024-01-01T00:00:00.000Z"
}
```

### Invitation Record (DynamoDB)

```javascript
{
  pk: "INVITATION#<invitationId>",
  sk: "METADATA",
  gsi1pk: "INVENTORY#<inventoryId>",
  gsi1sk: "INVITATION#<invitationId>",
  invitationId: "<uuid>",
  inventoryId: "<inventory-id>",
  email: "invitee@example.com",
  role: "member|administrator|read_only",
  invitedBy: "<inviter-user-id>",
  status: "pending|accepted|expired|cancelled",
  createdAt: "2024-01-01T00:00:00.000Z",
  expiresAt: "2024-01-08T00:00:00.000Z",
  token: "<secure-invitation-token>",
  ttl: 1704672000 // Auto-cleanup expired invitations
}
```

### Enhanced Membership Record (DynamoDB)

```javascript
{
  pk: "INVENTORY#<inventoryId>",
  sk: "MEMBER#<userId>",
  gsi1pk: "USER#<userId>",
  gsi1sk: "MEMBER#<inventoryId>",
  inventoryId: "<inventoryId>",
  userId: "<userId>",
  role: "owner|administrator|member|read_only",
  permissions: {
    canAddMembers: true,
    canRemoveMembers: true,
    canModifySettings: true,
    canDeleteInventory: false,
    canManageItems: true,
    canViewItems: true,
    canViewMembers: true
  },
  addedAt: "2024-01-01T00:00:00.000Z",
  addedBy: "<adder-user-id>",
  updatedAt: "2024-01-01T00:00:00.000Z",
  updatedBy: "<updater-user-id>"
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Email-based user lookup accuracy
*For any* valid email address in the Cognito user pool, looking up the user should return the correct user profile with matching email address
**Validates: Requirements 1.1, 3.2**

### Property 2: Role permission consistency
*For any* user role assignment, the user's effective permissions should match exactly the permissions defined for that role
**Validates: Requirements 2.2, 2.3, 2.4**

### Property 3: Invitation token security
*For any* generated invitation token, it should be cryptographically secure, unique, and expire after the specified time period
**Validates: Requirements 1.4, 1.5**

### Property 4: User ID visibility control
*For any* user profile access, only the authenticated user should be able to view their own User ID
**Validates: Requirements 4.1, 4.5**

### Property 5: Member information access control
*For any* member list access, users should only see member information they have permission to view based on their role
**Validates: Requirements 5.4, 5.5**

### Property 6: Read-only access restrictions
*For any* user with read_only role, they should be unable to perform any create, update, or delete operations on inventory items
**Validates: Requirements 2.4**

### Property 7: Audit trail completeness
*For any* user management operation (role changes, invitations, lookups), the action should be logged with complete audit information
**Validates: Requirements 2.6, 3.5**

## Error Handling

### User Lookup Errors
- **User Not Found**: Return structured error with suggestion to send invitation
- **Invalid Email Format**: Client-side validation with immediate feedback
- **Cognito API Errors**: Graceful degradation with retry logic
- **Permission Denied**: Clear error message about insufficient privileges

### Invitation Errors
- **Duplicate Invitation**: Check existing invitations before creating new ones
- **Invalid Role**: Validate role against allowed values and user permissions
- **Email Delivery Failure**: Queue for retry and notify administrator
- **Expired Invitation**: Clear error message with option to resend

### Role Management Errors
- **Invalid Role Transition**: Validate role changes against business rules
- **Self-Role Modification**: Prevent users from changing their own roles
- **Owner Removal**: Prevent removal of the last owner from inventory
- **Permission Escalation**: Validate that user has permission to assign roles

## Testing Strategy

### Unit Testing
- User lookup functions with various email formats and edge cases
- Role permission validation with all role combinations
- Invitation token generation and validation
- Error handling for all failure scenarios

### Property-Based Testing
- **Email Lookup Property**: Generate random valid emails and verify lookup accuracy
- **Role Permission Property**: Generate random role assignments and verify permission consistency
- **Invitation Security Property**: Generate random invitation scenarios and verify token security
- **Access Control Property**: Generate random user/resource combinations and verify access rules

### Integration Testing
- End-to-end invitation flow from creation to acceptance
- Cognito integration with user lookup and profile management
- Email delivery and invitation processing
- Role-based access control across all inventory operations

## Security Considerations

### Authentication and Authorization
- All user management operations require authentication
- Role-based permissions enforced at API level
- Invitation tokens use cryptographically secure random generation
- User lookup operations logged for audit trail

### Data Protection
- User email addresses encrypted in transit and at rest
- Invitation tokens have limited lifetime and single-use policy
- User profile information access restricted to authorized users
- Audit logs include all user management activities

### Privacy Controls
- Users can only view their own User ID
- Member information visibility based on role permissions
- Email addresses not exposed in client-side code
- Invitation emails use secure, non-guessable tokens

## Performance Considerations

### Caching Strategy
- User profile information cached for 15 minutes
- Role permissions cached per session
- Cognito user lookup results cached for 5 minutes
- Invitation status cached until expiration

### Database Optimization
- GSI for efficient invitation queries by inventory
- TTL for automatic cleanup of expired invitations
- Batch operations for bulk user operations
- Pagination for large member lists

### API Rate Limiting
- Cognito Admin API calls rate limited per user
- Email sending rate limited to prevent abuse
- User lookup operations rate limited per session
- Invitation creation rate limited per inventory

## Migration Strategy

### Phase 1: Backend Infrastructure
1. Create user service with Cognito integration
2. Implement invitation service and data models
3. Add role-based permission system
4. Create user lookup and management APIs

### Phase 2: Frontend Integration
1. Build user lookup and invitation dialogs
2. Enhance member management interface
3. Add user profile view with copyable ID
4. Implement role management controls

### Phase 3: Data Migration
1. Create user profiles for existing Cognito users
2. Migrate existing memberships to new role system
3. Set up audit logging for all operations
4. Validate data integrity and permissions

### Backward Compatibility
- Existing User ID-based operations continue to work
- New email-based operations added alongside existing ones
- Gradual migration of UI to use email-based lookup
- Fallback to User ID input if email lookup fails