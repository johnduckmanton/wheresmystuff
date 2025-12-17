# Add User by Email - Admin Script

## Overview

This admin script allows administrators to add users to inventories by their email address with the administrator role. It's designed for quick administrative tasks where you need to grant someone access to an inventory without going through the UI.

## Requirements

This script implements:
- **Requirement 1.2**: Add existing Cognito users to inventory by email
- **Requirement 2.2**: Assign administrator role with appropriate permissions

## Features

1. **Email-based User Lookup**: Finds users in Cognito by their email address
2. **Administrator Role Assignment**: Adds users with administrator permissions
3. **Audit Logging**: Logs all operations for security and compliance
4. **Error Handling**: Provides clear error messages and validation

## Prerequisites

- Node.js installed
- AWS credentials configured
- Environment variables set:
  - `TABLE_NAME`: DynamoDB table name (defaults to `home-inventory-dev`)
  - `USER_POOL_ID`: Cognito User Pool ID (required)
  - `AWS_REGION`: AWS region (defaults to `us-east-1`)

## Usage

### Using the Shell Wrapper (Recommended)

```bash
cd backend/scripts
./add-admin-user.sh <email> <inventoryId> <adminUserId>
```

### Using Node.js Directly

```bash
cd backend/scripts
node add-user-by-email.js <email> <inventoryId> <adminUserId>
```

### Parameters

- `email`: Email address of the user to add (must exist in Cognito)
- `inventoryId`: ID of the inventory to add the user to
- `adminUserId`: User ID of the administrator performing this action (for audit trail)

### Example

```bash
# Add johnduckmanton@hotmail.com as administrator to inventory inv-abc123
./add-admin-user.sh johnduckmanton@hotmail.com inv-abc123 admin-user-id-xyz
```

## Administrator Permissions

Users added with the administrator role receive the following permissions:

| Permission | Granted |
|------------|---------|
| Can Add Members | ✓ |
| Can Remove Members | ✓ |
| Can Modify Settings | ✓ |
| Can Delete Inventory | ✗ (Owner only) |
| Can Manage Items | ✓ |
| Can View Items | ✓ |
| Can View Members | ✓ |
| Can Change Roles | ✗ (Owner only) |

## Output

The script provides detailed output including:

1. **User Lookup Results**: Confirms the user was found in Cognito
2. **Membership Details**: Shows the created membership with role and timestamps
3. **Permission Summary**: Lists all permissions granted to the administrator role
4. **Audit Confirmation**: Confirms the operation was logged

### Success Output Example

```
============================================================
Admin Script: Add User by Email to Inventory
============================================================

Parameters:
  Email:        johnduckmanton@hotmail.com
  Inventory ID: inv-abc123
  Admin User:   admin-user-id-xyz

Step 1: Looking up user in Cognito by email...
✓ User found:
  User ID:      user-123-456-789
  Email:        johnduckmanton@hotmail.com
  Display Name: John Duckmanton
  Status:       CONFIRMED

Step 2: Adding user to inventory with administrator role...
✓ User successfully added to inventory:
  Inventory ID: inv-abc123
  User ID:      user-123-456-789
  Role:         administrator
  Added By:     admin-user-id-xyz
  Added At:     2024-01-15T10:30:00.000Z

Step 3: Logging operation for audit trail...
✓ Operation logged successfully

Administrator Permissions:
  Can Add Members:       ✓
  Can Remove Members:    ✓
  Can Modify Settings:   ✓
  Can Delete Inventory:  ✗
  Can Manage Items:      ✓
  Can View Items:        ✓
  Can View Members:      ✓
  Can Change Roles:      ✗

============================================================
SUCCESS: User added to inventory as administrator
============================================================
```

## Error Handling

### User Not Found

If the email address doesn't exist in Cognito:

```
✗ User not found with email: unknown@example.com

The user must have a Cognito account before they can be added to an inventory.
Please ensure the user has signed up for the application first.
```

### Invalid Email Format

If the email format is invalid:

```
ERROR: Failed to add user to inventory

Error Details:
  Message: Invalid email format
```

### User Already a Member

If the user is already a member of the inventory:

```
ERROR: Failed to add user to inventory

Error Details:
  Message: User is already a member of this inventory
```

### Permission Denied

If the admin user doesn't have permission to add members:

```
ERROR: Failed to add user to inventory

Error Details:
  Message: Access denied: User does not have permission to add members
```

## Audit Trail

All operations are logged to the audit log with the following information:

- **Event Type**: `member_addition`
- **Action**: `add_member`
- **Method**: `admin_script`
- **Timestamp**: ISO 8601 format
- **User IDs**: Both the added user and the admin performing the action
- **Inventory ID**: Target inventory
- **Role**: Assigned role (administrator)
- **HMAC**: Integrity signature for tamper detection

Failed operations are also logged with:

- **Event Type**: `authz_failure`
- **Reason**: Error message explaining the failure

## Security Considerations

1. **Authentication**: Ensure the admin user ID is valid and authorized
2. **Audit Logging**: All operations are logged for compliance and security review
3. **Role Validation**: Only valid roles can be assigned
4. **Permission Checks**: The script validates that the admin user has permission to add members

## Troubleshooting

### Environment Variables Not Set

```bash
# Set required environment variables
export USER_POOL_ID="us-east-1_XXXXXXXXX"
export TABLE_NAME="home-inventory-prod"
export AWS_REGION="us-east-1"
```

### AWS Credentials Issues

Ensure your AWS credentials are configured:

```bash
aws configure
# or
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
```

### Script Not Executable

```bash
chmod +x backend/scripts/add-admin-user.sh
chmod +x backend/scripts/add-user-by-email.js
```

## Related Scripts

- `migrate-user-management.js`: Migrate existing users to new role system
- `diagnose-data.js`: Diagnose data issues in the system

## Support

For issues or questions:
1. Check the error message for specific guidance
2. Review the audit logs for detailed operation history
3. Verify environment variables are set correctly
4. Ensure the user exists in Cognito before adding them
