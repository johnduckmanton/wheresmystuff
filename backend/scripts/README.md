# Migration Scripts

This directory contains scripts for migrating the Home Inventory System to the new inventory-based multi-user architecture.

## Scripts

### `add-user-by-email.js`

Admin script for adding users to inventories by their email address with administrator role.

**What it does:**
1. Looks up user in Cognito by email address
2. Adds user to specified inventory with administrator role
3. Logs the operation for audit purposes

**Usage:**

```bash
# Using the shell wrapper (recommended)
./backend/scripts/add-admin-user.sh <email> <inventoryId> <adminUserId>

# Using Node.js directly
node backend/scripts/add-user-by-email.js <email> <inventoryId> <adminUserId>

# Example
./backend/scripts/add-admin-user.sh johnduckmanton@hotmail.com inv-abc123 admin-user-id
```

**Requirements:**
- User must already exist in Cognito
- Admin user must have permission to add members
- Environment variables: `TABLE_NAME`, `USER_POOL_ID`

**See also:** [ADD_USER_BY_EMAIL.md](./ADD_USER_BY_EMAIL.md) for detailed documentation

### `migrate-to-inventory-system.js`

Main migration script that converts existing single-user data to the new multi-user inventory system.

**What it does:**
1. Scans existing data to identify unique users
2. Creates a default inventory for each user
3. Creates owner membership records
4. Updates all existing entities to include `inventoryId`
5. Validates the migration

**Usage:**

```bash
# Dry run (recommended first)
DRY_RUN=true node backend/scripts/migrate-to-inventory-system.js

# Test with sample data
node backend/scripts/migrate-to-inventory-system.js --test

# Run actual migration
TABLE_NAME=your-table-name node backend/scripts/migrate-to-inventory-system.js

# Production migration
TABLE_NAME=home-inventory-prod node backend/scripts/migrate-to-inventory-system.js
```

**Environment Variables:**
- `TABLE_NAME`: DynamoDB table name (default: `home-inventory-dev`)
- `DRY_RUN`: Set to `'true'` to run without making changes

### `test-migration.js`

Simple test script to validate migration logic without touching DynamoDB.

```bash
node backend/scripts/test-migration.js
```

## Migration Process

### Pre-Migration Checklist

1. **Backup your data**: Create a backup of your DynamoDB table
2. **Test in development**: Run the migration in a development environment first
3. **Dry run**: Always run with `DRY_RUN=true` first to see what will be changed
4. **Validate**: Use the test script to validate logic

### Migration Steps

1. **Backup**: 
   ```bash
   # Create backup (adjust table name and region)
   aws dynamodb create-backup \
     --table-name home-inventory-prod \
     --backup-name pre-inventory-migration-$(date +%Y%m%d)
   ```

2. **Dry Run**:
   ```bash
   DRY_RUN=true TABLE_NAME=home-inventory-prod node backend/scripts/migrate-to-inventory-system.js
   ```

3. **Test Migration**:
   ```bash
   TABLE_NAME=home-inventory-dev node backend/scripts/migrate-to-inventory-system.js --test
   ```

4. **Run Migration**:
   ```bash
   TABLE_NAME=home-inventory-prod node backend/scripts/migrate-to-inventory-system.js
   ```

### Data Structure Changes

**Before Migration:**
```
pk: USER#<userId>#<ENTITY_TYPE>
sk: <entityId>
data: {
  name: "...",
  userId: "<userId>",
  // other fields
}
```

**After Migration:**
```
pk: INVENTORY#<inventoryId>#<ENTITY_TYPE>
sk: <entityId>
data: {
  name: "...",
  inventoryId: "<inventoryId>",
  // other fields (userId removed)
}
```

**New Records Added:**
```
# Inventory metadata
pk: INVENTORY#<inventoryId>
sk: METADATA
{
  id: "<inventoryId>",
  name: "My Inventory",
  description: "Default inventory created during migration",
  ownerId: "<userId>",
  createdAt: "...",
  updatedAt: "..."
}

# Inventory membership
pk: INVENTORY#<inventoryId>
sk: MEMBER#<userId>
{
  inventoryId: "<inventoryId>",
  userId: "<userId>",
  role: "owner",
  addedAt: "...",
  addedBy: "<userId>"
}
```

## Troubleshooting

### Common Issues

1. **"No users found to migrate"**
   - Check that your table contains data
   - Verify the `TABLE_NAME` environment variable
   - Ensure entities have `userId` fields

2. **"Inventory already exists"**
   - The script prevents overwriting existing inventories
   - Check if migration was already run
   - Use different user IDs for testing

3. **"Entity update failed"**
   - Check DynamoDB permissions
   - Verify table capacity (consider increasing for large migrations)
   - Check for malformed entity data

### Recovery

If migration fails partway through:

1. **Identify what was migrated**: Check the logs for successful users
2. **Manual cleanup**: Remove partially migrated data if needed
3. **Restore from backup**: If necessary, restore from pre-migration backup
4. **Fix issues**: Address the root cause of failure
5. **Re-run**: Run migration again (script handles existing data gracefully)

## Performance Considerations

- **Batch size**: Script processes entities in batches of 25 (DynamoDB limit)
- **Rate limiting**: Small delays between batches to avoid throttling
- **Large datasets**: For very large datasets, consider running during off-peak hours
- **Monitoring**: Watch DynamoDB metrics during migration

## Validation

The script includes built-in validation:

1. **Inventory creation**: Verifies inventory exists after creation
2. **Membership creation**: Verifies membership record exists
3. **Entity migration**: Checks that entities have new structure
4. **Data integrity**: Validates that all required fields are present

Additional manual validation recommended:
- Spot-check migrated entities
- Verify user can access their data through the application
- Test inventory sharing functionality