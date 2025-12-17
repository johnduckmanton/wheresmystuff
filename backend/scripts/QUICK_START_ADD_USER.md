# Quick Start: Add User by Email

This guide shows how to quickly add a user to an inventory using their email address.

## For the Immediate Need

To add `johnduckmanton@hotmail.com` as an administrator to an inventory:

### Step 1: Set Environment Variables

```bash
export USER_POOL_ID="your-cognito-user-pool-id"
export TABLE_NAME="your-dynamodb-table-name"
export AWS_REGION="us-east-1"  # or your region
```

You can find these values in:
- **USER_POOL_ID**: AWS Console → Cognito → User Pools → Your Pool → Pool ID
- **TABLE_NAME**: AWS Console → DynamoDB → Tables → Your Table Name
- **AWS_REGION**: The region where your resources are deployed

### Step 2: Get the Inventory ID

You need the ID of the inventory you want to add the user to. You can find this by:

1. Looking in DynamoDB for records with `pk` starting with `INVENTORY#`
2. Checking the application UI (usually visible in URLs or settings)
3. Running a query to list inventories

### Step 3: Get Your Admin User ID

You need your own User ID (the person running this script). You can find this by:

1. Looking at your Cognito user attributes (the `sub` field)
2. Checking the application's user profile page
3. Running: `aws cognito-idp admin-get-user --user-pool-id YOUR_POOL_ID --username YOUR_EMAIL`

### Step 4: Run the Script

```bash
# Using the shell wrapper
./backend/scripts/add-admin-user.sh johnduckmanton@hotmail.com <inventory-id> <your-user-id>

# Or using Node.js directly
node backend/scripts/add-user-by-email.js johnduckmanton@hotmail.com <inventory-id> <your-user-id>
```

### Example

```bash
# Set environment variables
export USER_POOL_ID="us-east-1_ABC123XYZ"
export TABLE_NAME="home-inventory-prod"
export AWS_REGION="us-east-1"

# Run the script
./backend/scripts/add-admin-user.sh \
  johnduckmanton@hotmail.com \
  550e8400-e29b-41d4-a716-446655440000 \
  123e4567-e89b-12d3-a456-426614174000
```

## What Happens

The script will:

1. ✓ Look up the user in Cognito by email
2. ✓ Verify the user exists
3. ✓ Add them to the inventory with administrator role
4. ✓ Log the operation for audit purposes
5. ✓ Display the permissions granted

## Administrator Permissions

The user will be able to:

- ✓ Add and remove members
- ✓ Modify inventory settings
- ✓ Manage all items (create, edit, delete)
- ✓ View all items and members
- ✗ Delete the inventory (owner only)
- ✗ Change user roles (owner only)

## Troubleshooting

### User Not Found

If you get "User not found", ensure:
- The email address is correct
- The user has signed up for the application
- You're using the correct Cognito User Pool

### Permission Denied

If you get "Access denied", ensure:
- Your admin user ID is correct
- Your admin user is a member of the inventory
- Your admin user has permission to add members (owner or administrator role)

### Environment Variable Errors

If you get environment variable errors:
- Double-check all three variables are set
- Ensure there are no typos in the variable names
- Try running `echo $USER_POOL_ID` to verify they're set

## Next Steps

After adding the user:

1. The user can now log in to the application
2. They will see the inventory in their inventory list
3. They can add/remove members and manage items
4. Check the audit logs to verify the operation was recorded

## Support

For detailed documentation, see:
- [ADD_USER_BY_EMAIL.md](./ADD_USER_BY_EMAIL.md) - Full documentation
- [README.md](./README.md) - All available scripts
