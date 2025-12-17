# User Management Migration - Implementation Summary

## Overview

This document summarizes the data migration scripts created for the user management enhancement feature.

## Files Created

### 1. Migration Script
**File**: `backend/scripts/migrate-user-management.js`

Main migration script that:
- Creates user profiles for all Cognito users
- Updates existing memberships with role information and permissions
- Validates data integrity after migration
- Supports dry run mode for safe testing
- Provides detailed progress reporting

**Key Features**:
- Idempotent (can be run multiple times safely)
- Handles pagination for large datasets
- Automatic role detection (owner vs member)
- Comprehensive error handling
- Validation checks after migration

### 2. Helper Script
**File**: `backend/scripts/run-user-management-migration.sh`

Bash wrapper script that:
- Auto-detects configuration from AWS SAM stack
- Provides user-friendly interface
- Includes safety prompts for production runs
- Supports dry run mode
- Exports required environment variables

### 3. Documentation
**File**: `backend/scripts/USER_MANAGEMENT_MIGRATION.md`

Comprehensive guide covering:
- Migration overview and prerequisites
- Step-by-step instructions
- Environment variable configuration
- Troubleshooting guide
- Rollback procedures
- Post-migration checklist

### 4. Test Suite
**File**: `backend/tests/userManagementMigration.test.js`

Test suite validating:
- Permission logic for all roles
- Data structure validation
- Migration logic
- Statistics tracking
- Script exports

## Migration Process

### Phase 1: User Profile Creation
1. Fetches all users from Cognito User Pool
2. Extracts user information (email, display name, status)
3. Creates user profile records in DynamoDB
4. Skips users that already have profiles
5. Reports creation statistics

### Phase 2: Membership Migration
1. Scans all existing inventory memberships
2. Determines appropriate role for each member:
   - **Owner**: User ID matches inventory ownerId
   - **Member**: Default for all other users
3. Adds role and permission fields to memberships
4. Updates timestamps and audit fields
5. Reports migration statistics

### Phase 3: Validation
1. Checks user profiles were created correctly
2. Verifies memberships have required fields
3. Reports any validation issues
4. Provides summary of migration results

## Role and Permission Structure

### Owner Role
```javascript
{
  role: 'owner',
  permissions: {
    canAddMembers: true,
    canRemoveMembers: true,
    canModifySettings: true,
    canDeleteInventory: true,
    canManageItems: true,
    canViewItems: true,
    canViewMembers: true,
    canChangeRoles: true
  }
}
```

### Administrator Role
```javascript
{
  role: 'administrator',
  permissions: {
    canAddMembers: true,
    canRemoveMembers: true,
    canModifySettings: true,
    canDeleteInventory: false,
    canManageItems: true,
    canViewItems: true,
    canViewMembers: true,
    canChangeRoles: false
  }
}
```

### Member Role
```javascript
{
  role: 'member',
  permissions: {
    canAddMembers: false,
    canRemoveMembers: false,
    canModifySettings: false,
    canDeleteInventory: false,
    canManageItems: true,
    canViewItems: true,
    canViewMembers: true,
    canChangeRoles: false
  }
}
```

### Read-only Role
```javascript
{
  role: 'read_only',
  permissions: {
    canAddMembers: false,
    canRemoveMembers: false,
    canModifySettings: false,
    canDeleteInventory: false,
    canManageItems: false,
    canViewItems: true,
    canViewMembers: false,
    canChangeRoles: false
  }
}
```

## Data Structures

### User Profile (DynamoDB)
```javascript
{
  pk: "USER#<userId>",
  sk: "PROFILE",
  userId: "<cognito-user-id>",
  email: "user@example.com",
  username: "user@example.com",
  displayName: "John Doe",
  emailVerified: true,
  enabled: true,
  userStatus: "CONFIRMED",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z"
}
```

### Enhanced Membership (DynamoDB)
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
    canViewMembers: true,
    canChangeRoles: false
  },
  addedAt: "2024-01-01T00:00:00.000Z",
  addedBy: "<adder-user-id>",
  updatedAt: "2024-01-01T00:00:00.000Z",
  updatedBy: "<updater-user-id>"
}
```

## Usage Examples

### Dry Run (Recommended First Step)
```bash
cd backend/scripts
./run-user-management-migration.sh --dry-run
```

### Production Migration
```bash
cd backend/scripts
./run-user-management-migration.sh
```

### Direct Node Execution
```bash
cd backend/scripts
DRY_RUN=true \
TABLE_NAME=home-inventory-dev \
USER_POOL_ID=us-east-1_xxxxx \
node migrate-user-management.js
```

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `TABLE_NAME` | Yes | DynamoDB table name | `home-inventory-dev` |
| `USER_POOL_ID` | No* | Cognito User Pool ID | None |
| `DRY_RUN` | No | Set to `true` for dry run | `false` |

*Note: If `USER_POOL_ID` is not provided, user profile creation will be skipped, but membership migration will still run.

## Safety Features

1. **Dry Run Mode**: Preview changes without modifying data
2. **Idempotent Operations**: Safe to run multiple times
3. **Conditional Writes**: Prevents overwriting existing data
4. **Validation Checks**: Verifies migration success
5. **Detailed Logging**: Tracks all operations
6. **Error Handling**: Graceful failure with clear messages

## Testing

The migration script includes a comprehensive test suite:

```bash
cd backend
npm test -- userManagementMigration.test.js
```

**Test Coverage**:
- ✅ Permission logic for all roles
- ✅ Data structure validation
- ✅ Migration logic
- ✅ Statistics tracking
- ✅ Script exports

## Post-Migration Tasks

After running the migration:

1. **Verify Results**
   - Check migration output for errors
   - Verify user profiles were created
   - Confirm memberships have roles

2. **Test Application**
   - Log in as different users
   - Verify inventory access
   - Test member management features

3. **Update Roles** (if needed)
   - Use inventory settings UI
   - Assign administrator roles
   - Set read-only access where appropriate

4. **Monitor Logs**
   - Check for authorization failures
   - Verify role-based access works
   - Review audit logs

## Rollback Procedure

If issues occur:

1. **Restore from Backup** (if created):
   ```bash
   aws dynamodb restore-table-from-backup \
     --target-table-name home-inventory-dev \
     --backup-arn <backup-arn>
   ```

2. **Manual Cleanup**:
   - Delete user profiles: `USER#<userId>#PROFILE`
   - Remove role/permission fields from memberships

## Integration with Existing System

The migration integrates with:
- **User Service**: Creates profiles for Cognito users
- **Inventory Service**: Updates membership structure
- **Audit Log Service**: Logs migration operations
- **DynamoDB Schema**: Follows existing patterns

## Performance Considerations

- **Batch Size**: 25 items per batch (DynamoDB limit)
- **Pagination**: Handles large datasets efficiently
- **Rate Limiting**: Includes delays between batches
- **Memory Usage**: Streams data to avoid memory issues

## Maintenance

The migration script is designed to be:
- **Self-documenting**: Clear variable names and comments
- **Modular**: Exported functions for testing
- **Extensible**: Easy to add new migration steps
- **Maintainable**: Follows project coding standards

## Support

For issues or questions:
1. Check the troubleshooting guide in `USER_MANAGEMENT_MIGRATION.md`
2. Review migration output for specific errors
3. Verify environment variables are set correctly
4. Check AWS credentials and permissions

## Related Files

- Design Document: `.kiro/specs/user-management-enhancement/design.md`
- Requirements: `.kiro/specs/user-management-enhancement/requirements.md`
- Tasks: `.kiro/specs/user-management-enhancement/tasks.md`
- User Service: `backend/services/userService.js`
- Inventory Service: `backend/services/inventoryService.js`
- Membership Model: `backend/models/inventoryMembership.js`

## Version History

- **v1.0.0** (2024-12-17): Initial migration script implementation
  - User profile creation from Cognito
  - Membership role and permission migration
  - Validation and reporting
  - Comprehensive documentation
