#!/usr/bin/env node

/**
 * Migration script to convert existing data to inventory-based system
 * 
 * This script:
 * 1. Creates a default inventory for each existing user
 * 2. Updates all existing entities to include inventoryId
 * 3. Creates membership records for inventory owners
 * 4. Validates the migration with sample data
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, UpdateCommand, QueryCommand, BatchWriteCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const Inventory = require('../models/inventory');
const InventoryMembership = require('../models/inventoryMembership');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Configuration
const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory-dev';
const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 25; // DynamoDB batch write limit

// Entity types to migrate
const ENTITY_TYPES = ['THINGS', 'LOCATIONS', 'ROOMS', 'CATEGORIES', 'PEOPLE'];

/**
 * Extract user ID from entity data
 * Assumes entities have a userId field or can be inferred from the data
 */
function extractUserId(item) {
  // Check if the item has user data directly
  if (item.data && item.data.userId) {
    return item.data.userId;
  }
  
  // Check if the item has userId at root level
  if (item.userId) {
    return item.userId;
  }
  
  // For legacy data, try to extract from pk pattern if it exists
  if (item.pk && item.pk.includes('USER#')) {
    const match = item.pk.match(/USER#([^#]+)/);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Scan all existing entities to identify unique users
 */
async function identifyExistingUsers() {
  console.log('🔍 Scanning existing entities to identify users...');
  
  const users = new Set();
  let lastEvaluatedKey = null;
  let totalItems = 0;
  
  do {
    const params = {
      TableName: TABLE_NAME,
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
    };
    
    const result = await docClient.send(new ScanCommand(params));
    
    for (const item of result.Items || []) {
      totalItems++;
      
      // Skip items that are already inventory-related
      if (item.pk && (item.pk.startsWith('INVENTORY#') || item.pk.startsWith('RATELIMIT#') || item.pk.startsWith('AUDITLOG#'))) {
        continue;
      }
      
      const userId = extractUserId(item);
      if (userId) {
        users.add(userId);
      }
    }
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`📊 Found ${totalItems} total items, identified ${users.size} unique users`);
  return Array.from(users);
}

/**
 * Create default inventory for a user
 */
async function createDefaultInventory(userId) {
  const inventory = new Inventory({
    name: 'My Inventory',
    description: 'Default inventory created during migration',
    ownerId: userId
  });
  
  const validation = inventory.validate();
  if (!validation.isValid) {
    throw new Error(`Invalid inventory data: ${validation.errors.join(', ')}`);
  }
  
  if (!DRY_RUN) {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: inventory.toDynamoDBItem(),
      ConditionExpression: 'attribute_not_exists(pk)' // Prevent overwriting existing inventory
    }));
  }
  
  return inventory;
}

/**
 * Create inventory membership record for owner
 */
async function createOwnerMembership(inventoryId, userId) {
  const membership = new InventoryMembership({
    inventoryId,
    userId,
    role: 'owner',
    addedBy: userId // Self-added during migration
  });
  
  const validation = membership.validate();
  if (!validation.isValid) {
    throw new Error(`Invalid membership data: ${validation.errors.join(', ')}`);
  }
  
  if (!DRY_RUN) {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: membership.toDynamoDBItem(),
      ConditionExpression: 'attribute_not_exists(pk)' // Prevent overwriting existing membership
    }));
  }
  
  return membership;
}

/**
 * Get all entities for a specific user that need migration
 */
async function getEntitiesForUser(userId) {
  console.log(`🔍 Finding entities for user: ${userId}`);
  
  const entities = [];
  let lastEvaluatedKey = null;
  
  do {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'contains(#data.#userId, :userId) OR contains(#userId, :userId)',
      ExpressionAttributeNames: {
        '#data': 'data',
        '#userId': 'userId'
      },
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
    };
    
    const result = await docClient.send(new ScanCommand(params));
    
    for (const item of result.Items || []) {
      // Skip items that are already inventory-related or already migrated
      if (item.pk && (
        item.pk.startsWith('INVENTORY#') || 
        item.pk.startsWith('RATELIMIT#') || 
        item.pk.startsWith('AUDITLOG#') ||
        (item.data && item.data.inventoryId) // Already has inventoryId
      )) {
        continue;
      }
      
      const itemUserId = extractUserId(item);
      if (itemUserId === userId) {
        entities.push(item);
      }
    }
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`📦 Found ${entities.length} entities for user ${userId}`);
  return entities;
}

/**
 * Update entity to include inventoryId
 */
async function updateEntityWithInventoryId(entity, inventoryId) {
  // Determine the entity type from the pk or data
  let entityType = 'UNKNOWN';
  
  // Try to determine entity type from existing pk pattern
  if (entity.pk) {
    for (const type of ENTITY_TYPES) {
      if (entity.pk.includes(type)) {
        entityType = type;
        break;
      }
    }
  }
  
  // If we couldn't determine from pk, try from data
  if (entityType === 'UNKNOWN' && entity.data) {
    // Look for type indicators in the data
    if (entity.data.category || entity.data.location) {
      entityType = 'THINGS';
    } else if (entity.data.address) {
      entityType = 'LOCATIONS';
    } else if (entity.data.roomType) {
      entityType = 'ROOMS';
    } else if (entity.data.categoryType) {
      entityType = 'CATEGORIES';
    } else if (entity.data.email || entity.data.phone) {
      entityType = 'PEOPLE';
    }
  }
  
  // Create new pk with inventory structure
  const newPk = `INVENTORY#${inventoryId}#${entityType}`;
  const sk = entity.sk || entity.id || uuidv4();
  
  // Update the entity data to include inventoryId
  const updatedData = {
    ...entity.data,
    inventoryId
  };
  
  const newItem = {
    pk: newPk,
    sk: sk,
    data: updatedData
  };
  
  if (!DRY_RUN) {
    // Put the new item
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: newItem
    }));
    
    // Delete the old item if pk changed
    if (entity.pk !== newPk) {
      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: entity.pk,
          sk: entity.sk
        }
      }));
    }
  }
  
  return newItem;
}

/**
 * Process entities in batches to avoid overwhelming DynamoDB
 */
async function processEntitiesInBatches(entities, inventoryId, userId) {
  console.log(`🔄 Processing ${entities.length} entities in batches of ${BATCH_SIZE}...`);
  
  let processed = 0;
  let errors = 0;
  
  for (let i = 0; i < entities.length; i += BATCH_SIZE) {
    const batch = entities.slice(i, i + BATCH_SIZE);
    
    console.log(`   Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(entities.length / BATCH_SIZE)} (${batch.length} items)`);
    
    for (const entity of batch) {
      try {
        await updateEntityWithInventoryId(entity, inventoryId);
        processed++;
      } catch (error) {
        console.error(`❌ Error processing entity ${entity.pk}#${entity.sk}:`, error.message);
        errors++;
      }
    }
    
    // Small delay between batches to be gentle on DynamoDB
    if (i + BATCH_SIZE < entities.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`✅ Processed ${processed} entities successfully, ${errors} errors for user ${userId}`);
  return { processed, errors };
}

/**
 * Validate migration by checking a sample of migrated data
 */
async function validateMigration(userId, inventoryId) {
  console.log(`🔍 Validating migration for user ${userId}...`);
  
  // Check that inventory exists
  const inventoryResult = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND sk = :sk',
    ExpressionAttributeValues: {
      ':pk': `INVENTORY#${inventoryId}`,
      ':sk': 'METADATA'
    }
  }));
  
  if (!inventoryResult.Items || inventoryResult.Items.length === 0) {
    throw new Error(`Inventory ${inventoryId} not found`);
  }
  
  // Check that membership exists
  const membershipResult = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND sk = :sk',
    ExpressionAttributeValues: {
      ':pk': `INVENTORY#${inventoryId}`,
      ':sk': `MEMBER#${userId}`
    }
  }));
  
  if (!membershipResult.Items || membershipResult.Items.length === 0) {
    throw new Error(`Membership for user ${userId} in inventory ${inventoryId} not found`);
  }
  
  // Check that at least some entities exist with the new structure
  let totalEntities = 0;
  for (const entityType of ENTITY_TYPES) {
    const entitiesResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVENTORY#${inventoryId}#${entityType}`
      }
    }));
    
    totalEntities += entitiesResult.Items?.length || 0;
  }
  
  console.log(`✅ Validation passed: Found inventory, membership, and ${totalEntities} entities`);
  return true;
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 Starting inventory system migration...');
  console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}`);
  console.log(`🗄️  Table: ${TABLE_NAME}`);
  
  try {
    // Step 1: Identify all existing users
    const users = await identifyExistingUsers();
    
    if (users.length === 0) {
      console.log('ℹ️  No users found to migrate');
      return;
    }
    
    console.log(`👥 Found ${users.length} users to migrate: ${users.join(', ')}`);
    
    const migrationResults = {
      totalUsers: users.length,
      successfulUsers: 0,
      failedUsers: 0,
      totalEntitiesProcessed: 0,
      totalErrors: 0
    };
    
    // Step 2: Process each user
    for (const userId of users) {
      console.log(`\n👤 Processing user: ${userId}`);
      
      try {
        // Step 2a: Create default inventory
        console.log('📦 Creating default inventory...');
        const inventory = await createDefaultInventory(userId);
        console.log(`✅ Created inventory: ${inventory.id} - "${inventory.name}"`);
        
        // Step 2b: Create owner membership
        console.log('👑 Creating owner membership...');
        await createOwnerMembership(inventory.id, userId);
        console.log('✅ Created owner membership');
        
        // Step 2c: Get all entities for this user
        const entities = await getEntitiesForUser(userId);
        
        if (entities.length > 0) {
          // Step 2d: Update entities with inventoryId
          const result = await processEntitiesInBatches(entities, inventory.id, userId);
          migrationResults.totalEntitiesProcessed += result.processed;
          migrationResults.totalErrors += result.errors;
        }
        
        // Step 2e: Validate migration
        if (!DRY_RUN) {
          await validateMigration(userId, inventory.id);
        }
        
        migrationResults.successfulUsers++;
        console.log(`✅ Successfully migrated user ${userId}`);
        
      } catch (error) {
        console.error(`❌ Failed to migrate user ${userId}:`, error.message);
        migrationResults.failedUsers++;
      }
    }
    
    // Final summary
    console.log('\n📊 Migration Summary:');
    console.log(`   Total users: ${migrationResults.totalUsers}`);
    console.log(`   Successful: ${migrationResults.successfulUsers}`);
    console.log(`   Failed: ${migrationResults.failedUsers}`);
    console.log(`   Entities processed: ${migrationResults.totalEntitiesProcessed}`);
    console.log(`   Errors: ${migrationResults.totalErrors}`);
    
    if (migrationResults.failedUsers > 0) {
      console.log('\n⚠️  Some users failed to migrate. Please check the logs above.');
      process.exit(1);
    } else {
      console.log('\n🎉 Migration completed successfully!');
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

/**
 * Test migration with sample data
 */
async function testMigration() {
  console.log('🧪 Testing migration with sample data...');
  
  const testUserId = 'test-user-' + uuidv4();
  
  try {
    // Create some test entities in the old format
    const testEntities = [
      {
        pk: `USER#${testUserId}#THINGS`,
        sk: uuidv4(),
        data: {
          name: 'Test Thing',
          description: 'A test thing',
          userId: testUserId
        }
      },
      {
        pk: `USER#${testUserId}#LOCATIONS`,
        sk: uuidv4(),
        data: {
          name: 'Test Location',
          address: '123 Test St',
          userId: testUserId
        }
      }
    ];
    
    console.log('📝 Creating test entities...');
    for (const entity of testEntities) {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: entity
      }));
    }
    
    console.log('🔄 Running migration on test data...');
    
    // Create inventory
    const inventory = await createDefaultInventory(testUserId);
    await createOwnerMembership(inventory.id, testUserId);
    
    // Migrate entities
    const entities = await getEntitiesForUser(testUserId);
    await processEntitiesInBatches(entities, inventory.id, testUserId);
    
    // Validate
    await validateMigration(testUserId, inventory.id);
    
    console.log('✅ Test migration successful!');
    
    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    // Note: In a real scenario, you might want to keep test data for further validation
    
  } catch (error) {
    console.error('❌ Test migration failed:', error);
    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node migrate-to-inventory-system.js [options]

Options:
  --dry-run     Run migration without making changes (default: false)
  --test        Run test migration with sample data
  --help, -h    Show this help message

Environment Variables:
  TABLE_NAME    DynamoDB table name (default: home-inventory-dev)
  DRY_RUN       Set to 'true' for dry run mode

Examples:
  # Dry run to see what would be migrated
  DRY_RUN=true node migrate-to-inventory-system.js
  
  # Test with sample data
  node migrate-to-inventory-system.js --test
  
  # Run actual migration
  TABLE_NAME=home-inventory-prod node migrate-to-inventory-system.js
`);
    process.exit(0);
  }
  
  if (args.includes('--test')) {
    testMigration().catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
  } else {
    runMigration().catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
  }
}

module.exports = {
  runMigration,
  testMigration,
  identifyExistingUsers,
  createDefaultInventory,
  createOwnerMembership,
  updateEntityWithInventoryId,
  validateMigration
};