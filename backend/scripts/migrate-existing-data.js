#!/usr/bin/env node

/**
 * Migration script for existing data structure
 * Migrates data from old format (PK: "PEOPLE") to new format (PK: "INVENTORY#uuid#PEOPLE")
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory-dev';
const DRY_RUN = process.env.DRY_RUN === 'true';

console.log('🔄 Migrate Existing Data to Inventory System');
console.log('============================================');
console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE MIGRATION'}`);
console.log(`🗄️  Table: ${TABLE_NAME}`);
console.log('');

// Entity types to migrate
const ENTITY_TYPES = ['THINGS', 'LOCATIONS', 'ROOMS', 'CATEGORIES', 'PEOPLE'];

/**
 * Find the first available inventory for a user
 */
async function findUserInventory(userId) {
  console.log(`🔍 Looking for inventory for user: ${userId}`);
  
  // Query for inventories where the user is a member
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(pk, :inventoryPrefix) AND sk = :memberSk',
    ExpressionAttributeValues: {
      ':inventoryPrefix': 'INVENTORY#',
      ':memberSk': `MEMBER#${userId}`
    }
  }));
  
  if (result.Items && result.Items.length > 0) {
    const inventoryId = result.Items[0].inventoryId;
    console.log(`✅ Found inventory: ${inventoryId}`);
    return inventoryId;
  }
  
  // If no inventory found, create a default one
  console.log('📦 No inventory found, creating default inventory...');
  return await createDefaultInventory(userId);
}

/**
 * Create a default inventory for a user
 */
async function createDefaultInventory(userId) {
  const { v4: uuidv4 } = require('uuid');
  const inventoryId = uuidv4();
  const now = new Date().toISOString();
  
  const inventory = {
    pk: `INVENTORY#${inventoryId}`,
    sk: 'METADATA',
    id: inventoryId,
    name: 'My Inventory',
    description: 'Default inventory for migrated data',
    ownerId: userId,
    createdAt: now,
    updatedAt: now
  };
  
  const membership = {
    pk: `INVENTORY#${inventoryId}`,
    sk: `MEMBER#${userId}`,
    inventoryId,
    userId,
    role: 'owner',
    addedAt: now,
    addedBy: userId
  };
  
  if (!DRY_RUN) {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: inventory
    }));
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: membership
    }));
  }
  
  console.log(`✅ Created inventory: ${inventoryId}`);
  return inventoryId;
}

/**
 * Find all entities that need migration
 */
async function findEntitiesNeedingMigration() {
  console.log('🔍 Scanning for entities that need migration...');
  
  const entitiesByType = {};
  
  for (const entityType of ENTITY_TYPES) {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': entityType
      }
    }));
    
    entitiesByType[entityType] = result.Items || [];
    console.log(`   ${entityType}: ${entitiesByType[entityType].length} items`);
  }
  
  return entitiesByType;
}

/**
 * Migrate an entity to the new inventory-based structure
 */
async function migrateEntity(entity, entityType, inventoryId) {
  // Create new item with inventory-based structure
  const newItem = {
    pk: `INVENTORY#${inventoryId}#${entityType}`,
    sk: entity.sk,
    data: {
      ...entity.data,
      inventoryId,
      id: entity.sk // Ensure ID is preserved
    }
  };
  
  if (!DRY_RUN) {
    // Put the new item
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: newItem
    }));
    
    // Delete the old item
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: entity.pk,
        sk: entity.sk
      }
    }));
  }
  
  return newItem;
}

/**
 * Main migration function
 */
async function runMigration() {
  try {
    // Step 1: Find entities that need migration
    const entitiesByType = await findEntitiesNeedingMigration();
    
    const totalEntities = Object.values(entitiesByType).reduce((sum, entities) => sum + entities.length, 0);
    
    if (totalEntities === 0) {
      console.log('✅ No entities found that need migration!');
      return;
    }
    
    console.log(`📊 Found ${totalEntities} entities to migrate`);
    
    // Step 2: Determine user ID and inventory
    // For simplicity, we'll use a default user ID and find/create an inventory
    const DEFAULT_USER_ID = 'f438c408-90e1-7041-3068-c2f110cf3980'; // From the diagnostic output
    
    const inventoryId = await findUserInventory(DEFAULT_USER_ID);
    
    console.log(`🎯 Using inventory: ${inventoryId}`);
    console.log('');
    
    // Step 3: Migrate each entity type
    let totalMigrated = 0;
    let totalErrors = 0;
    
    for (const [entityType, entities] of Object.entries(entitiesByType)) {
      if (entities.length === 0) continue;
      
      console.log(`🔄 Migrating ${entities.length} ${entityType}...`);
      
      for (const entity of entities) {
        try {
          await migrateEntity(entity, entityType, inventoryId);
          totalMigrated++;
          
          if (DRY_RUN) {
            console.log(`   [DRY RUN] Would migrate: ${entity.pk}#${entity.sk} -> INVENTORY#${inventoryId}#${entityType}#${entity.sk}`);
          } else {
            console.log(`   ✅ Migrated: ${entity.data?.name || entity.sk}`);
          }
        } catch (error) {
          console.error(`   ❌ Error migrating ${entity.pk}#${entity.sk}:`, error.message);
          totalErrors++;
        }
      }
    }
    
    // Step 4: Summary
    console.log('');
    console.log('🎉 Migration Summary:');
    console.log(`   Total entities: ${totalEntities}`);
    console.log(`   Successfully migrated: ${totalMigrated}`);
    console.log(`   Errors: ${totalErrors}`);
    console.log(`   Target inventory: ${inventoryId}`);
    
    if (totalErrors === 0 && !DRY_RUN) {
      console.log('');
      console.log('🚀 Migration completed successfully!');
      console.log('   Your data should now be visible in the application.');
      console.log('   Refresh your browser and check the entity pages.');
    } else if (DRY_RUN) {
      console.log('');
      console.log('🔍 Dry run completed. Run without DRY_RUN=true to perform actual migration.');
    } else {
      console.log('');
      console.log('⚠️  Migration completed with errors. Check the logs above.');
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node migrate-existing-data.js [options]

This script migrates existing data from the old format to the new inventory-based format.

Options:
  --help, -h    Show this help message

Environment Variables:
  TABLE_NAME    DynamoDB table name (default: home-inventory-dev)
  DRY_RUN       Set to 'true' for dry run mode (default: false)

Examples:
  # Dry run to see what would be migrated
  DRY_RUN=true node migrate-existing-data.js
  
  # Run actual migration
  node migrate-existing-data.js
`);
    process.exit(0);
  }
  
  runMigration();
}

module.exports = { runMigration };