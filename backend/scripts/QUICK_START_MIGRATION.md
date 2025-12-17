# Quick Start: User Management Migration

## TL;DR

```bash
# 1. Backup your data (recommended)
aws dynamodb create-backup \
  --table-name home-inventory-dev \
  --backup-name pre-user-management-migration

# 2. Run dry run
cd backend/scripts
./run-user-management-migration.sh --dry-run

# 3. Review output, then run for real
./run-user-management-migration.sh
```

## What This Does

- ✅ Creates user profiles for all Cognito users
- ✅ Adds role information to inventory memberships
- ✅ Adds permission objects based on roles
- ✅ Validates migration success

## Requirements

- AWS credentials configured
- Access to DynamoDB table
- Access to Cognito User Pool (optional, for user profiles)

## Expected Output

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

✅ Migration completed successfully!
```

## Troubleshooting

### "USER_POOL_ID not configured"
- User profile creation will be skipped
- Membership migration will still run
- Set `USER_POOL_ID` environment variable to enable

### "Access denied"
- Check AWS credentials
- Verify DynamoDB permissions
- Verify Cognito permissions

### Migration fails partway
- Safe to re-run (idempotent)
- Already-migrated items will be skipped

## Post-Migration

1. Test user login
2. Verify inventory access
3. Check member management features
4. Update roles as needed in UI

## Need Help?

See full documentation: `USER_MANAGEMENT_MIGRATION.md`
