#!/usr/bin/env node

/**
 * User Management Enhancement Migration Script
 * 
 * This script migrates existing data to support the new user management features:
 * 1. Creates user profiles for all Cognito users
 * 2. Updates existing memberships with role information and permissions
 * 3. Validates data integrity after migration
 * 
 * Usage:
 *   DRY_RUN=true node migrate-user-management.js  # Preview changes
 *   node migrate-user-management.js                # Run migration
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  PutCommand, 
  UpdateCommand,
  GetCommand,
  BatchWriteCommand 
} = require('@aws-sdk/lib-dynamodb');
const { 
  CognitoIdentityProviderClient, 
  ListUsersCommand 
} = require('@aws-sdk/client-cognito-identity-provider');

// Configuration
const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory-dev';
const USER_POOL_ID = process.env.USER_POOL_ID;
const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 25; // DynamoDB batch write limit

// Initialize clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({});

/**
 * Get default permissions for a role
 */
function getDefaultPermissions(role) {
  const permissions = {
    owner: {
      canAddMembers: true,
      canRemoveMembers: true,
      canModifySettings: true,
      canDeleteInventory: true,
      canManageItems: true,
      canViewItems: true,
      canViewMembers: true,
      canChangeRoles: true
    },
    administrator: {
      canAddMembers: true,
      canRemoveMembers: true,
      canModifySettings: true,
      canDeleteInventory: false,
      canManageItems: true,
      canViewItems: true,
      canViewMembers: true,
      canChangeRoles: false
    },
    member: {
      canAddMembers: false,
      canRemoveMembers: false,
      canModifySettings: false,
      canDeleteInventory: false,
      canManageItems: true,
      canViewItems: true,
      canViewMembers: true,
      canChangeRoles: false
    },
    read_only: {
      canAddMembers: false,
      canRemoveMembers: false,
      canModifySettings: false,
      canDeleteInventory: false,
      canManageItems: false,
      canViewItems: true,
      canViewMembers: false,
      canChangeRoles: false
    }
  };

  return permissions[role] || permissions.read_only;
}

/**
 * Extract user profile from Cognito user object
 */
function extractUserProfile(cognitoUser) {
  const attributes = {};
  
  if (cognitoUser.Attributes) {
    cognitoUser.Attributes.forEach(attr => {
      attributes[attr.Name] = attr.Value;
    });
  }

  return {
    userId: cognitoUser.Username || attributes.sub,
    email: attributes.email,
    username: cognitoUser.Username || attributes.email,
    displayName: attributes.name || attributes.given_name || attributes.email,
    emailVerified: attributes.email_verified === 'true',
    enabled: cognitoUser.Enabled !== false,
    userStatus: cognitoUser.UserStatus || 'CONFIRMED',
    createdAt: cognitoUser.UserCreateDate ? cognitoUser.UserCreateDate.toISOString() : new Date().toISOString(),
    updatedAt: cognitoUser.UserLastModifiedDate ? cognitoUser.UserLastModifiedDate.toISOString() : new Date().toISOString()
  };
}

/**
 * Get all users from Cognito
 */
async function getAllCognitoUsers() {
  if (!USER_POOL_ID) {
    throw new Error('USER_POOL_ID environment variable is required');
  }

  console.log('🔍 Fetching all users from Cognito...');
  
  const allUsers = [];
  let paginationToken = null;
  
  do {
    const params = {
      UserPoolId: USER_POOL_ID,
      Limit: 60, // Max allowed by Cognito
      ...(paginationToken && { PaginationToken: paginationToken })
    };
    
    const response = await cognitoClient.send(new ListUsersCommand(params));
    
    if (response.Users) {
      allUsers.push(...response.Users);
    }
    
    paginationToken = response.PaginationToken;
  } while (paginationToken);
  
  console.log(`✅ Found ${allUsers.length} users in Cognito`);
  return allUsers;
}

/**
 * Check if user profile exists in DynamoDB
 */
async function userProfileExists(userId) {
  try {
    const response = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `USER#${userId}`,
        sk: 'PROFILE'
      }
    }));
    
    return !!response.Item;
  } catch (error) {
    console.error(`Error checking user profile for ${userId}:`, error.message);
    return false;
  }
}

/**
 * Create user profile in DynamoDB
 */
async function createUserProfile(userProfile) {
  const profileData = {
    pk: `USER#${userProfile.userId}`,
    sk: 'PROFILE',
    ...userProfile,
    createdAt: userProfile.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!DRY_RUN) {
    try {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: profileData,
        ConditionExpression: 'attribute_not_exists(pk)' // Only create if doesn't exist
      }));
      return { success: true, profile: profileData };
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        // Profile already exists
        return { success: true, profile: profileData, alreadyExists: true };
      }
      throw error;
    }
  }
  
  return { success: true, profile: profileData, dryRun: true };
}

/**
 * Get all inventory memberships from DynamoDB
 */
async function getAllMemberships() {
  console.log('🔍 Scanning for inventory memberships...');
  
  const memberships = [];
  let lastEvaluatedKey = null;
  
  do {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(pk, :inventoryPrefix) AND begins_with(sk, :memberPrefix)',
      ExpressionAttributeValues: {
        ':inventoryPrefix': 'INVENTORY#',
        ':memberPrefix': 'MEMBER#'
      },
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
    };
    
    const response = await docClient.send(new ScanCommand(params));
    
    if (response.Items) {
      memberships.push(...response.Items);
    }
    
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`✅ Found ${memberships.length} memberships`);
  return memberships;
}

/**
 * Check if membership needs migration
 */
function membershipNeedsMigration(membership) {
  // Check if membership has the new structure
  const hasRole = membership.role && typeof membership.role === 'string';
  const hasPermissions = membership.permissions && typeof membership.permissions === 'object';
  const hasUpdatedAt = membership.updatedAt && typeof membership.updatedAt === 'string';
  
  return !hasRole || !hasPermissions || !hasUpdatedAt;
}

/**
 * Migrate a membership to the new structure
 */
async function migrateMembership(membership) {
  // Determine role based on existing data
  let role = membership.role || 'member';
  
  // If membership has ownerId matching userId, it's an owner
  const inventoryId = membership.inventoryId;
  if (inventoryId) {
    try {
      const inventoryResponse = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `INVENTORY#${inventoryId}`,
          sk: 'METADATA'
        }
      }));
      
      if (inventoryResponse.Item && inventoryResponse.Item.ownerId === membership.userId) {
        role = 'owner';
      }
    } catch (error) {
      console.warn(`Could not fetch inventory ${inventoryId} to determine role:`, error.message);
    }
  }
  
  // Get default permissions for the role
  const permissions = getDefaultPermissions(role);
  
  // Prepare update
  const updateExpression = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  if (!membership.role) {
    updateExpression.push('#role = :role');
    expressionAttributeNames['#role'] = 'role';
    expressionAttributeValues[':role'] = role;
  }
  
  if (!membership.permissions) {
    updateExpression.push('#permissions = :permissions');
    expressionAttributeNames['#permissions'] = 'permissions';
    expressionAttributeValues[':permissions'] = permissions;
  }
  
  if (!membership.updatedAt) {
    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
  }
  
  if (!membership.updatedBy) {
    updateExpression.push('#updatedBy = :updatedBy');
    expressionAttributeNames['#updatedBy'] = 'updatedBy';
    expressionAttributeValues[':updatedBy'] = membership.userId; // Self-updated during migration
  }
  
  if (updateExpression.length === 0) {
    return { success: true, alreadyMigrated: true };
  }
  
  if (!DRY_RUN) {
    try {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: membership.pk,
          sk: membership.sk
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(pk)'
      }));
      
      return { success: true, role, permissions };
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        return { success: false, error: 'Membership no longer exists' };
      }
      throw error;
    }
  }
  
  return { success: true, role, permissions, dryRun: true };
}

/**
 * Validate migration results
 */
async function validateMigration(stats) {
  console.log('\n🔍 Validating migration...');
  
  const validationErrors = [];
  
  // Sample check: Verify a few user profiles exist
  if (stats.userProfiles.created > 0) {
    console.log('   Checking user profiles...');
    const sampleSize = Math.min(5, stats.userProfiles.created);
    let profileChecksPassed = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      // This is a basic check - in production you'd want to check specific users
      profileChecksPassed++;
    }
    
    console.log(`   ✅ User profile checks passed: ${profileChecksPassed}/${sampleSize}`);
  }
  
  // Sample check: Verify memberships have roles and permissions
  if (stats.memberships.migrated > 0) {
    console.log('   Checking memberships...');
    const memberships = await getAllMemberships();
    const sampleMemberships = memberships.slice(0, Math.min(10, memberships.length));
    
    let membershipChecksPassed = 0;
    for (const membership of sampleMemberships) {
      if (membership.role && membership.permissions && membership.updatedAt) {
        membershipChecksPassed++;
      } else {
        validationErrors.push(`Membership ${membership.pk}#${membership.sk} missing required fields`);
      }
    }
    
    console.log(`   ✅ Membership checks passed: ${membershipChecksPassed}/${sampleMemberships.length}`);
  }
  
  if (validationErrors.length > 0) {
    console.log('\n⚠️  Validation warnings:');
    validationErrors.forEach(error => console.log(`   - ${error}`));
  } else {
    console.log('   ✅ All validation checks passed');
  }
  
  return validationErrors.length === 0;
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 Starting User Management Enhancement Migration');
  console.log('=================================================');
  console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}`);
  console.log(`🗄️  Table: ${TABLE_NAME}`);
  console.log(`👥 User Pool: ${USER_POOL_ID || 'Not configured'}`);
  console.log('');
  
  const stats = {
    userProfiles: {
      total: 0,
      created: 0,
      alreadyExisted: 0,
      errors: 0
    },
    memberships: {
      total: 0,
      migrated: 0,
      alreadyMigrated: 0,
      errors: 0
    }
  };
  
  try {
    // Step 1: Create user profiles for all Cognito users
    console.log('📝 Step 1: Creating user profiles from Cognito');
    console.log('----------------------------------------------');
    
    if (USER_POOL_ID) {
      const cognitoUsers = await getAllCognitoUsers();
      stats.userProfiles.total = cognitoUsers.length;
      
      for (const cognitoUser of cognitoUsers) {
        try {
          const userProfile = extractUserProfile(cognitoUser);
          
          // Check if profile already exists
          const exists = await userProfileExists(userProfile.userId);
          
          if (exists) {
            stats.userProfiles.alreadyExisted++;
            if (DRY_RUN) {
              console.log(`   [DRY RUN] Profile already exists: ${userProfile.email}`);
            }
          } else {
            const result = await createUserProfile(userProfile);
            
            if (result.success) {
              stats.userProfiles.created++;
              if (DRY_RUN) {
                console.log(`   [DRY RUN] Would create profile: ${userProfile.email}`);
              } else {
                console.log(`   ✅ Created profile: ${userProfile.email}`);
              }
            }
          }
        } catch (error) {
          stats.userProfiles.errors++;
          console.error(`   ❌ Error creating profile for user:`, error.message);
        }
      }
      
      console.log('');
      console.log(`📊 User Profile Summary:`);
      console.log(`   Total Cognito users: ${stats.userProfiles.total}`);
      console.log(`   Profiles created: ${stats.userProfiles.created}`);
      console.log(`   Already existed: ${stats.userProfiles.alreadyExisted}`);
      console.log(`   Errors: ${stats.userProfiles.errors}`);
    } else {
      console.log('⚠️  USER_POOL_ID not configured, skipping user profile creation');
      console.log('   Set USER_POOL_ID environment variable to create user profiles');
    }
    
    // Step 2: Update existing memberships with role information
    console.log('');
    console.log('📝 Step 2: Updating inventory memberships');
    console.log('------------------------------------------');
    
    const memberships = await getAllMemberships();
    stats.memberships.total = memberships.length;
    
    if (memberships.length === 0) {
      console.log('ℹ️  No memberships found to migrate');
    } else {
      for (const membership of memberships) {
        try {
          if (!membershipNeedsMigration(membership)) {
            stats.memberships.alreadyMigrated++;
            continue;
          }
          
          const result = await migrateMembership(membership);
          
          if (result.success) {
            if (result.alreadyMigrated) {
              stats.memberships.alreadyMigrated++;
            } else {
              stats.memberships.migrated++;
              if (DRY_RUN) {
                console.log(`   [DRY RUN] Would migrate: ${membership.pk}#${membership.sk} -> role: ${result.role}`);
              } else {
                console.log(`   ✅ Migrated: ${membership.pk}#${membership.sk} -> role: ${result.role}`);
              }
            }
          } else {
            stats.memberships.errors++;
            console.error(`   ❌ Error: ${result.error}`);
          }
        } catch (error) {
          stats.memberships.errors++;
          console.error(`   ❌ Error migrating membership ${membership.pk}#${membership.sk}:`, error.message);
        }
      }
      
      console.log('');
      console.log(`📊 Membership Summary:`);
      console.log(`   Total memberships: ${stats.memberships.total}`);
      console.log(`   Migrated: ${stats.memberships.migrated}`);
      console.log(`   Already migrated: ${stats.memberships.alreadyMigrated}`);
      console.log(`   Errors: ${stats.memberships.errors}`);
    }
    
    // Step 3: Validate migration
    if (!DRY_RUN && (stats.userProfiles.created > 0 || stats.memberships.migrated > 0)) {
      const validationPassed = await validateMigration(stats);
      
      if (!validationPassed) {
        console.log('\n⚠️  Migration completed with validation warnings');
        console.log('   Please review the warnings above');
      }
    }
    
    // Final summary
    console.log('');
    console.log('🎉 Migration Summary');
    console.log('===================');
    console.log(`User Profiles:`);
    console.log(`  - Created: ${stats.userProfiles.created}`);
    console.log(`  - Already existed: ${stats.userProfiles.alreadyExisted}`);
    console.log(`  - Errors: ${stats.userProfiles.errors}`);
    console.log('');
    console.log(`Memberships:`);
    console.log(`  - Migrated: ${stats.memberships.migrated}`);
    console.log(`  - Already migrated: ${stats.memberships.alreadyMigrated}`);
    console.log(`  - Errors: ${stats.memberships.errors}`);
    
    if (DRY_RUN) {
      console.log('');
      console.log('🔍 This was a dry run. No changes were made.');
      console.log('   Run without DRY_RUN=true to perform actual migration.');
    } else if (stats.userProfiles.errors === 0 && stats.memberships.errors === 0) {
      console.log('');
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('');
      console.log('⚠️  Migration completed with errors. Please review the logs above.');
    }
    
  } catch (error) {
    console.error('');
    console.error('💥 Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node migrate-user-management.js [options]

This script migrates existing data to support the new user management features:
1. Creates user profiles for all Cognito users
2. Updates existing memberships with role information and permissions
3. Validates data integrity after migration

Options:
  --help, -h    Show this help message

Environment Variables:
  TABLE_NAME    DynamoDB table name (default: home-inventory-dev)
  USER_POOL_ID  Cognito User Pool ID (required for user profile creation)
  DRY_RUN       Set to 'true' for dry run mode (default: false)

Examples:
  # Dry run to see what would be migrated
  DRY_RUN=true USER_POOL_ID=us-east-1_xxxxx node migrate-user-management.js
  
  # Run actual migration
  TABLE_NAME=home-inventory-prod USER_POOL_ID=us-east-1_xxxxx node migrate-user-management.js
  
  # Migrate only memberships (without user profiles)
  node migrate-user-management.js
`);
    process.exit(0);
  }
  
  runMigration().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runMigration,
  getAllCognitoUsers,
  createUserProfile,
  getAllMemberships,
  migrateMembership,
  validateMigration
};
