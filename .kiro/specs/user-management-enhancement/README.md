# User Management Enhancement

## Overview

This specification defines the comprehensive user management system for the Home Inventory Management application. The enhancement enables email-based user lookup, role-based access control, user invitations, and improved member management.

## Documentation Structure

### Specification Documents

1. **[requirements.md](requirements.md)** - Detailed requirements with EARS-compliant acceptance criteria
   - User stories for all user management features
   - Acceptance criteria for email lookup, invitations, roles, and profiles
   - Glossary of terms

2. **[design.md](design.md)** - System architecture and design decisions
   - Component architecture and interfaces
   - Data models for users, invitations, and memberships
   - Correctness properties for property-based testing
   - Security and performance considerations

3. **[tasks.md](tasks.md)** - Implementation task list
   - Incremental implementation steps
   - Property-based testing tasks
   - Migration and documentation tasks
   - Task completion status

### User Documentation

Located in the project root:

1. **[USER_MANAGEMENT.md](../../../USER_MANAGEMENT.md)** - Complete user guide
   - Getting started guide
   - Role descriptions and permissions
   - Step-by-step instructions for all features
   - Best practices and tips

2. **[USER_MANAGEMENT_TROUBLESHOOTING.md](../../../USER_MANAGEMENT_TROUBLESHOOTING.md)** - Troubleshooting guide
   - Common issues and solutions
   - Diagnostic commands
   - Error message explanations
   - Prevention checklists

3. **[USER_MANAGEMENT_QUICK_REFERENCE.md](../../../USER_MANAGEMENT_QUICK_REFERENCE.md)** - Quick reference card
   - One-page reference for common tasks
   - Role permission matrix
   - Quick fixes for common problems
   - Keyboard shortcuts

### Technical Documentation

1. **[frontend/src/components/USER_MANAGEMENT_COMPONENTS.md](../../../frontend/src/components/USER_MANAGEMENT_COMPONENTS.md)** - Component documentation
   - Component API reference
   - Usage examples
   - Integration patterns
   - Type definitions

2. **[backend/scripts/USER_MANAGEMENT_MIGRATION.md](../../../backend/scripts/USER_MANAGEMENT_MIGRATION.md)** - Migration guide
   - Migration process overview
   - Step-by-step instructions
   - Troubleshooting migration issues
   - Rollback procedures

3. **[frontend/src/utils/userManagementHelp.ts](../../../frontend/src/utils/userManagementHelp.ts)** - Help text utilities
   - Centralized help text and tooltips
   - Validation functions
   - Error message helpers
   - Formatting utilities

4. **[frontend/src/components/UserManagementHelp.tsx](../../../frontend/src/components/UserManagementHelp.tsx)** - Help components
   - Reusable help UI components
   - Role badges and tooltips
   - Permission comparison tables
   - Contextual help sections

## Key Features

### 1. Email-Based User Lookup
- Search for users by email address
- Add users directly if they exist
- Send invitations if they don't exist
- Validates: Requirements 1.1, 3.1, 3.2

### 2. User Invitations
- Send email invitations to non-users
- Automatic membership on signup
- 7-day expiration for security
- Invitation management (cancel, resend)
- Validates: Requirements 1.3, 1.4, 1.5

### 3. Role-Based Access Control
- Four distinct roles: Owner, Administrator, Member, Read-only
- Granular permission system
- Role change audit trail
- Permission validation at API level
- Validates: Requirements 2.1-2.6

### 4. User Profiles
- Display User ID with copy functionality
- Profile editing capabilities
- Account information display
- Context about User ID usage
- Validates: Requirements 4.1-4.5

### 5. Member Management
- View all inventory members
- Display roles and permissions
- Change member roles
- Remove members
- View member addition history
- Validates: Requirements 5.1-5.5

## User Roles

### Owner
- **Full control** over inventory
- Can delete inventory
- Can manage all members and settings
- At least one owner required per inventory

### Administrator
- Can manage members and settings
- Cannot delete inventory
- Cannot change their own role
- Good for trusted co-managers

### Member
- Can create, edit, and delete items
- Can view all items and basic member info
- Cannot manage members or settings
- Default role for most users

### Read-only
- Can only view items
- No modification capabilities
- Limited member visibility
- Good for sharing without risk

## Implementation Status

### Completed Tasks ✅

- [x] Backend user management infrastructure
- [x] Invitation system backend
- [x] Role-based access control
- [x] User management API endpoints
- [x] User lookup and invitation frontend
- [x] Member management interface
- [x] User profile management
- [x] Email-based member addition
- [x] Invitation acceptance flow
- [x] Error handling and validation
- [x] Data migration scripts
- [x] Documentation and help text

### Optional Tasks (Not Implemented)

- [ ] Property-based tests (marked optional)
- [ ] Integration tests (marked optional)
- [ ] Unit tests for some components (marked optional)

## Getting Started

### For Users

1. Read the [User Management Guide](../../../USER_MANAGEMENT.md)
2. Check the [Quick Reference](../../../USER_MANAGEMENT_QUICK_REFERENCE.md) for common tasks
3. Refer to [Troubleshooting Guide](../../../USER_MANAGEMENT_TROUBLESHOOTING.md) if you encounter issues

### For Developers

1. Review the [requirements](requirements.md) and [design](design.md) documents
2. Check the [component documentation](../../../frontend/src/components/USER_MANAGEMENT_COMPONENTS.md)
3. Review the [task list](tasks.md) for implementation details
4. Use the help utilities in [userManagementHelp.ts](../../../frontend/src/utils/userManagementHelp.ts)

### For Administrators

1. Follow the [Migration Guide](../../../backend/scripts/USER_MANAGEMENT_MIGRATION.md) to upgrade
2. Review the [Troubleshooting Guide](../../../USER_MANAGEMENT_TROUBLESHOOTING.md) for common issues
3. Monitor audit logs for security events
4. Set up CloudWatch alarms for errors

## Architecture Overview

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
                       │ - Memberships    │
                       └──────────────────┘
```

## Data Models

### User Profile
```javascript
{
  pk: "USER#<userId>",
  sk: "PROFILE",
  userId: "<cognito-user-id>",
  email: "user@example.com",
  displayName: "John Doe",
  // ... additional fields
}
```

### Invitation
```javascript
{
  pk: "INVITATION#<invitationId>",
  sk: "METADATA",
  email: "invitee@example.com",
  role: "member|administrator|read_only",
  status: "pending|accepted|expired|cancelled",
  expiresAt: "2024-01-08T00:00:00.000Z",
  // ... additional fields
}
```

### Membership (Enhanced)
```javascript
{
  pk: "INVENTORY#<inventoryId>",
  sk: "MEMBER#<userId>",
  role: "owner|administrator|member|read_only",
  permissions: {
    canAddMembers: true,
    canRemoveMembers: true,
    // ... additional permissions
  },
  // ... additional fields
}
```

## API Endpoints

### User Management
- `GET /users/lookup?email={email}` - Look up user by email
- `GET /users/profile` - Get current user profile
- `PUT /users/profile` - Update user profile

### Invitation Management
- `GET /inventories/{id}/invitations` - List pending invitations
- `POST /inventories/{id}/invitations` - Create invitation
- `DELETE /inventories/{id}/invitations/{invitationId}` - Cancel invitation
- `POST /invitations/accept` - Accept invitation

### Member Management
- `GET /inventories/{id}/members` - List members
- `POST /inventories/{id}/members` - Add member
- `PUT /inventories/{id}/members/{userId}/role` - Update member role
- `DELETE /inventories/{id}/members/{userId}` - Remove member

## Testing

### Property-Based Tests (Optional)

The design includes 7 correctness properties:
1. Email-based user lookup accuracy
2. Role permission consistency
3. Invitation token security
4. User ID visibility control
5. Member information access control
6. Read-only access restrictions
7. Audit trail completeness

These are marked as optional tasks and can be implemented for additional confidence in correctness.

### Unit Tests (Optional)

Unit tests for API endpoints, services, and components are marked as optional in the task list.

## Security Considerations

- All operations require authentication
- Role-based permissions enforced at API level
- Invitation tokens are cryptographically secure
- User lookup operations logged for audit
- Email addresses encrypted in transit and at rest
- Invitation tokens have limited lifetime (7 days)

## Migration

If upgrading from a previous version:

1. **Backup your data** before migration
2. Run the migration script in **dry-run mode** first
3. Review the migration output
4. Run the actual migration
5. Validate the results
6. Test user access and permissions

See the [Migration Guide](../../../backend/scripts/USER_MANAGEMENT_MIGRATION.md) for detailed instructions.

## Support

### Documentation
- User guide: [USER_MANAGEMENT.md](../../../USER_MANAGEMENT.md)
- Troubleshooting: [USER_MANAGEMENT_TROUBLESHOOTING.md](../../../USER_MANAGEMENT_TROUBLESHOOTING.md)
- Quick reference: [USER_MANAGEMENT_QUICK_REFERENCE.md](../../../USER_MANAGEMENT_QUICK_REFERENCE.md)

### Technical Support
- Component docs: [USER_MANAGEMENT_COMPONENTS.md](../../../frontend/src/components/USER_MANAGEMENT_COMPONENTS.md)
- Migration guide: [USER_MANAGEMENT_MIGRATION.md](../../../backend/scripts/USER_MANAGEMENT_MIGRATION.md)
- Help utilities: [userManagementHelp.ts](../../../frontend/src/utils/userManagementHelp.ts)

## Contributing

When making changes to user management:

1. Update the relevant specification documents
2. Update user documentation if user-facing changes
3. Update component documentation if API changes
4. Add help text to userManagementHelp.ts
5. Update troubleshooting guide with new issues
6. Test with all user roles
7. Update migration guide if data model changes

## Version History

- **v1.0** (December 2024) - Initial implementation
  - Email-based user lookup
  - Role-based access control
  - User invitations
  - User profiles
  - Member management
  - Complete documentation

## License

ISC
