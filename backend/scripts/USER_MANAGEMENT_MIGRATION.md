# User Management Enhancement Migration Guide

This guide explains how to migrate your existing Home Inventory data to support the new user management features.

## Overview

The user management enhancement adds the following capabilities:
- Email-based user lookup and invitation
- Role-based access control (owner, administrator, member, read_only)
- User profiles stored in DynamoDB
- Enhanced permission system for inventory members

## What the Migration Does

The migration script performs three main tasks:

### 1. Create User Profiles
- Fetches all users from your Cognito User Pool
- Creates user profile records in DynamoDB for each user
- Stores user information (email, display name, status, etc.)
- Skips users that already have profiles

### 2. Update Memberships
- Scans all existing inventory memberships
- Adds role information (owner, administrator, member, read_only)
- Adds permission objects based on role
- Determines owner role by checking inventory ownership
- Defaults to 'member' role for non-owners

### 3. Validate Migration
- Checks that user profiles were created correctly
- Verifies memberships have required fields (role, permissions)
- Reports any validation issues

## Prerequisites

Before running the migration:

1. **Backup your data** (recommended)
   ```bash
   # Use AWS CLI to create an on-demand backup
   aws dynamodb create-backup \
     --table-name home-inventory-dev \
     --backup-name pre-user-management-migration
   ```

2. **Ensure you have the required permissions**
   - DynamoDB read/write access
   - Cognito read access (for user profile creation)

3. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

## Running the Migration

### Option 1: Using the Helper Script (Recommended)

The helper script automatically detects your AWS SAM stack configuration:

```bash
cd backend/scripts

# Dry run first (recommended)
./run-user-management-migration.sh --dry-run

# Review the output, then run for real
./run-user-management-migration.sh
```

### Option 2: Direct Node Execution

If you prefer to run the script directly:

```bash
cd backend/scripts

# Dry run
DRY_RUN=true \
TABLE_NAME=home-inventory-dev \
USER_POOL_ID=us-east-1_xxxxx \
node migrate-user-management.js

# Actual migration
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

*Note: `USER_POOL_ID` is optional. If not provided, user profile creation will be skipped, but membership migration will still run.

## Migration Output

The script provides detailed output:

```
🚀 Starting User Management Enhancement Migration
=================================================
📋 Mode: LIVE MIGRATION
🗄️  Table: home-inventory-dev
👥 User Pool: us-east-1_xxxxx

📝 Step 1: Creating user profiles from Cognito
----------------------------------------------
🔍 Fetching all users from Cognito...
✅ Found 5 users in Cognito
   ✅ Created profile: user1@example.com
   ✅ Created profile: user2@example.com
   ...

📊 User Profile Summary:
   Total Cognito users: 5
   Profiles created: 5
   Already existed: 0
   Errors: 0

📝 Step 2: Updating inventory memberships
------------------------------------------
🔍 Scanning for inventory memberships...
✅ Found 8 memberships
   ✅ Migrated: INVENTORY#abc123#MEMBER#user1 -> role: owner
   ✅ Migrated: INVENTORY#abc123#MEMBER#user2 -> role: member
   ...

📊 Membership Summary:
   Total memberships: 8
   Migrated: 8
   Already migrated: 0
   Errors: 0

🔍 Validating migration...
   Checking user profiles...
   ✅ User profile checks passed: 5/5
   Checking memberships...
   ✅ Membership checks passed: 8/8
   ✅ All validation checks passed

🎉 Migration Summary
===================
User Profiles:
  - Created: 5
  - Already existed: 0
  - Errors: 0

Memberships:
  - Migrated: 8
  - Already migrated: 0
  - Errors: 0

✅ Migration completed successfully!
```

## Dry Run Mode

Always run in dry run mode first to preview changes:

```bash
./run-user-management-migration.sh --dry-run
```

Dry run mode will:
- Show what would be created/updated
- Not make any actual changes to the database
- Help you verify the migration logic

## Role Assignment Logic

The migration determines roles as follows:

1. **Owner Role**: Assigned to users who are the `ownerId` of an inventory
2. **Member Role**: Default role for all other existing members
3. **Administrator/Read-only**: Not automatically assigned during migration

After migration, you can manually update roles using the inventory management UI or API.

## Permissions by Role

Each role has specific permissions:

### Owner
- Full control over inventory
- Can add/remove members
- Can modify settings
- Can delete inventory
- Can manage items
- Can change roles

### Administrator
- Can add/remove members
- Can modify settings
- Cannot delete inventory
- Can manage items
- Cannot change roles

### Member
- Can manage items (create, edit, delete)
- Can view items and members
- Cannot modify settings or manage members

### Read-only
- Can only view items
- Cannot modify anything
- Cannot view member details

## Troubleshooting

### "USER_POOL_ID not configured"

If you see this warning, user profile creation will be skipped. This is okay if:
- You only want to migrate memberships
- You'll create user profiles later

To fix, set the `USER_POOL_ID` environment variable:
```bash
export USER_POOL_ID=us-east-1_xxxxx
```

### "Error checking user profile"

This usually means:
- DynamoDB permissions issue
- Table name is incorrect
- Network connectivity problem

Verify your AWS credentials and table name.

### "Membership no longer exists"

This can happen if:
- A membership was deleted during migration
- Concurrent modifications occurred

This is usually safe to ignore if only a few memberships are affected.

### Migration Fails Partway Through

The migration is designed to be idempotent:
- User profiles use conditional writes (won't overwrite existing)
- Memberships are updated individually
- You can safely re-run the migration

Simply run the migration again - it will skip already-migrated items.

## Rollback

If you need to rollback:

1. **Restore from backup** (if you created one):
   ```bash
   aws dynamodb restore-table-from-backup \
     --target-table-name home-inventory-dev \
     --backup-arn arn:aws:dynamodb:region:account:table/home-inventory-dev/backup/backup-name
   ```

2. **Manual cleanup** (if no backup):
   - User profiles can be deleted: `USER#<userId>#PROFILE`
   - Membership fields can be removed using UpdateItem

## Post-Migration

After successful migration:

1. **Test the application**
   - Verify users can log in
   - Check inventory access
   - Test member management features

2. **Update roles as needed**
   - Use the inventory settings UI
   - Assign administrator roles where appropriate
   - Set read-only access for view-only users

3. **Monitor audit logs**
   - Check for any authorization failures
   - Verify role-based access is working correctly

## Support

If you encounter issues:

1. Check the migration output for specific error messages
2. Review the troubleshooting section above
3. Verify your AWS credentials and permissions
4. Check the DynamoDB table structure matches the schema

## Migration Script Reference

### Main Script
- **Location**: `backend/scripts/migrate-user-management.js`
- **Purpose**: Core migration logic
- **Can be imported**: Yes (exports functions for testing)

### Helper Script
- **Location**: `backend/scripts/run-user-management-migration.sh`
- **Purpose**: Wrapper with environment detection
- **Requires**: AWS SAM CLI (optional, for auto-detection)

### Functions Exported

The migration script exports these functions for testing:

```javascript
const {
  runMigration,           // Main migration function
  getAllCognitoUsers,     // Fetch users from Cognito
  createUserProfile,      // Create a user profile
  getAllMemberships,      // Get all memberships
  migrateMembership,      // Migrate a single membership
  validateMigration       // Validate migration results
} = require('./migrate-user-management');
```

## Testing

To test the migration logic:

```javascript
// Example test
const migration = require('./migrate-user-management');

// Test user profile creation
const testProfile = {
  userId: 'test-123',
  email: 'test@example.com',
  username: 'test@example.com',
  displayName: 'Test User'
};

await migration.createUserProfile(testProfile);
```

## Best Practices

1. **Always run dry run first**
2. **Create a backup before migrating**
3. **Run during low-traffic periods**
4. **Monitor the migration output**
5. **Validate results after migration**
6. **Test the application thoroughly**

## Migration Checklist

- [ ] Backup database
- [ ] Run dry run migration
- [ ] Review dry run output
- [ ] Set environment variables
- [ ] Run actual migration
- [ ] Verify migration output
- [ ] Test user login
- [ ] Test inventory access
- [ ] Test member management
- [ ] Update roles as needed
- [ ] Monitor for issues
