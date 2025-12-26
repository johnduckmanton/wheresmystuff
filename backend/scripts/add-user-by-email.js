#!/usr/bin/env node

/**
 * Admin Script: Add User by Email to Inventory
 * 
 * This script allows administrators to add a user to an inventory by their email address
 * with the administrator role. It performs the following operations:
 * 1. Looks up the user in Cognito by email
 * 2. Adds the user to the specified inventory with administrator role
 * 3. Logs the operation for audit purposes
 * 
 * Usage:
 *   node add-user-by-email.js <email> <inventoryId> <adminUserId>
 * 
 * Example:
 *   node add-user-by-email.js johnduckmanton@hotmail.com inv-123 admin-user-id
 * 
 * Requirements: 1.2, 2.2
 */

// Check for help flag or invalid arguments before loading services (which require env vars)
const args = process.argv.slice(2);

function showHelp() {
  console.log('Usage: node add-user-by-email.js <email> <inventoryId> <adminUserId>');
  console.log();
  console.log('Arguments:');
  console.log('  email        - Email address of the user to add');
  console.log('  inventoryId  - ID of the inventory to add the user to');
  console.log('  adminUserId  - User ID of the administrator performing this action');
  console.log();
  console.log('Example:');
  console.log('  node add-user-by-email.js johnduckmanton@hotmail.com inv-123 admin-user-id');
  console.log();
  console.log('  # Add as owner instead of administrator');
  console.log('  ROLE=owner node add-user-by-email.js johnduckmanton@hotmail.com inv-123 admin-user-id');
  console.log();
  console.log('By default, the user will be added with the "administrator" role.');
  console.log('Set ROLE environment variable to change: owner, administrator, member, read_only');
  console.log();
  console.log('Administrator Role Permissions:');
  console.log('  - Ability to add and remove members');
  console.log('  - Ability to modify inventory settings');
  console.log('  - Ability to manage all items');
  console.log('  - Cannot delete the inventory (owner only)');
  console.log('  - Cannot change user roles (owner only)');
  console.log();
  console.log('Required Environment Variables:');
  console.log('  TABLE_NAME    - DynamoDB table name (default: home-inventory-dev)');
  console.log('  USER_POOL_ID  - Cognito User Pool ID (required)');
  console.log('  AWS_REGION    - AWS region (default: eu-west-1)');
  console.log('  ROLE          - Role to assign (default: administrator)');
  console.log();
}

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

if (args.length !== 3) {
  console.error('Error: Exactly 3 arguments required');
  console.error();
  showHelp();
  process.exit(1);
}

// Load services after validation
const userService = require('../services/userService');
const inventoryService = require('../services/inventoryService');
const auditLogService = require('../services/auditLogService');

/**
 * Main function to add user by email
 */
async function addUserByEmail(email, inventoryId, adminUserId) {
  console.log('='.repeat(60));
  console.log('Admin Script: Add User by Email to Inventory');
  console.log('='.repeat(60));
  console.log();

  // Validate inputs
  if (!email || !inventoryId || !adminUserId) {
    throw new Error('All parameters are required: email, inventoryId, adminUserId');
  }

  console.log('Parameters:');
  console.log(`  Email:        ${email}`);
  console.log(`  Inventory ID: ${inventoryId}`);
  console.log(`  Admin User:   ${adminUserId}`);
  console.log();

  try {
    // Step 1: Look up user by email
    console.log('Step 1: Looking up user in Cognito by email...');
    const user = await userService.lookupUserByEmail(email);
    
    if (!user) {
      console.error(`✗ User not found with email: ${email}`);
      console.log();
      console.log('The user must have a Cognito account before they can be added to an inventory.');
      console.log('Please ensure the user has signed up for the application first.');
      process.exit(1);
    }

    console.log(`✓ User found:`);
    console.log(`  User ID:      ${user.userId}`);
    console.log(`  Email:        ${user.email}`);
    console.log(`  Display Name: ${user.displayName || 'N/A'}`);
    console.log(`  Status:       ${user.userStatus || 'CONFIRMED'}`);
    console.log();

    // Step 2: Add user to inventory with specified role (default: administrator)
    const requestedRole = process.env.ROLE || 'administrator';
    console.log(`Step 2: Adding user to inventory with ${requestedRole} role...`);
    
    // Note: addInventoryMember doesn't support 'owner' role directly
    // If owner role is requested, we'll add as administrator first, then update to owner
    const initialRole = requestedRole === 'owner' ? 'administrator' : requestedRole;
    
    // Note: We're using a special admin bypass by directly calling the service
    // In production, you might want to verify the adminUserId has proper permissions
    let membership = await inventoryService.addInventoryMember(
      inventoryId,
      adminUserId,
      user.userId,
      initialRole
    );
    
    // If owner role was requested, update the role
    if (requestedRole === 'owner') {
      console.log('  Updating role to owner...');
      membership = await inventoryService.updateMemberRole(
        inventoryId,
        adminUserId,
        user.userId,
        'owner',
        'Admin script: Initial owner assignment'
      );
    }

    console.log(`✓ User successfully added to inventory:`);
    console.log(`  Inventory ID: ${membership.inventoryId}`);
    console.log(`  User ID:      ${membership.userId}`);
    console.log(`  Role:         ${membership.role}`);
    console.log(`  Added By:     ${membership.addedBy}`);
    console.log(`  Added At:     ${membership.addedAt}`);
    console.log();

    // Step 3: Log the operation for audit purposes
    console.log('Step 3: Logging operation for audit trail...');
    await auditLogService.logMemberAddition(
      user.userId,
      adminUserId,
      inventoryId,
      membership.role,
      'admin_script'
    );
    console.log('✓ Operation logged successfully');
    console.log();

    // Display permissions
    console.log(`${membership.role.charAt(0).toUpperCase() + membership.role.slice(1)} Permissions:`);
    const permissions = inventoryService.getRolePermissions(membership.role);
    console.log(`  Can Add Members:       ${permissions.canAddMembers ? '✓' : '✗'}`);
    console.log(`  Can Remove Members:    ${permissions.canRemoveMembers ? '✓' : '✗'}`);
    console.log(`  Can Modify Settings:   ${permissions.canModifySettings ? '✓' : '✗'}`);
    console.log(`  Can Delete Inventory:  ${permissions.canDeleteInventory ? '✓' : '✗'}`);
    console.log(`  Can Manage Items:      ${permissions.canManageItems ? '✓' : '✗'}`);
    console.log(`  Can View Items:        ${permissions.canViewItems ? '✓' : '✗'}`);
    console.log(`  Can View Members:      ${permissions.canViewMembers ? '✓' : '✗'}`);
    console.log(`  Can Change Roles:      ${permissions.canChangeRoles ? '✓' : '✗'}`);
    console.log();

    console.log('='.repeat(60));
    console.log('SUCCESS: User added to inventory as administrator');
    console.log('='.repeat(60));
    
    return {
      success: true,
      user,
      membership
    };

  } catch (error) {
    console.error();
    console.error('='.repeat(60));
    console.error('ERROR: Failed to add user to inventory');
    console.error('='.repeat(60));
    console.error();
    console.error('Error Details:');
    console.error(`  Message: ${error.message}`);
    
    if (error.originalError) {
      console.error(`  Original Error: ${error.originalError.message}`);
      console.error(`  Error Type: ${error.originalError.name}`);
    }
    
    console.error();
    
    // Log the failure for audit purposes
    try {
      await auditLogService.logAuthzFailure(
        adminUserId,
        'add_member_admin_script',
        `inventory#${inventoryId}`,
        error.message
      );
    } catch (logError) {
      console.error('Warning: Failed to log error to audit trail:', logError.message);
    }
    
    throw error;
  }
}

/**
 * Parse command line arguments and execute
 */
async function main() {
  const [email, inventoryId, adminUserId] = args;

  try {
    await addUserByEmail(email, inventoryId, adminUserId);
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

// Export for testing
module.exports = { addUserByEmail };
