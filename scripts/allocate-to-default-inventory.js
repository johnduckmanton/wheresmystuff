#!/usr/bin/env node

/**
 * Simple script to allocate all existing data to a default inventory
 * 
 * This script:
 * 1. Creates a default inventory for the current user
 * 2. Updates all existing entities to include the default inventoryId
 * 3. Shows progress and results
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, UpdateCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Configuration
const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory-dev';
const DRY_RUN = process.env.DRY_RUN === 'true';
const DEFAULT_USER_ID = process.env.USER_ID || 'default-user';

console.log('🏠 Home Inventory - Allocate Data to Default Inventory');
console.log('=====================================================');
console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE MIGRATION'}`);
console.log(`🗄️  Table: ${TABLE_NAME}`);
console.log(`👤 User ID: ${DEFAULT_USER_ID}`);
console.log('');

/**
 * Create a default inventory
 */
async function createDefaultInventory() {
  const inventoryId = uuidv4();
  const now = new Date().toISOString();
  
  const inventory = {
    pk: `INVENTORY#${inventoryId}`,
    sk: 'METADATA',
    data: {
      id: inventoryId,
      name: 'My Inventory',
      description: 'Default inventory created for existing data',
      ownerId: DEFAULT_USER_ID,
      createdAt: now,
      updatedAt: now
    }
  };
  
  if (!DRY_RUN) {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: inventory,
      ConditionExpression: 'attribute_not_exists(pk)'
    }));
  }
  
  console.log(`✅ Created default inventory: ${inventoryId}`);
  return inventoryId;
}

/**
 * Create inventory membership for the user
 */
async function createInventoryMembership(inventoryId) {
  const membership = {
    pk: `INVENTORY#${inventoryId}`,
    sk: `MEMBER#${DEFAULT_USER_ID}`,
    data: {
      inventoryId,
      userId: DEFAULT_USER_ID,
      role: 'owner',
      addedAt: new Date().toISOString(),
      addedBy: DEFAULT_USER_ID
    }
  };
  
  if (!DRY_RUN) {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: membership,
      ConditionExpression: 'attribute_not_exists(pk)'
    }));
  }
  
  console.log(`✅ Created inventory membership for user: ${DEFAULT_USER_ID}`);
}

/**
 * Find all entities that need inventoryId
 */
async function findEntitiesNeedingInventoryId() {
  console.log('🔍 Scanning for entities without inventoryId...');
  
  const entities = [];
  let lastEvaluatedKey = null;
  let totalScanned = 0;
  
  do {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'attribute_not_exists(#data.#inventoryId) AND attribute_exists(#data)',
      ExpressionAttributeNames: {
        '#data': 'data',
        '#inventoryId': 'inventoryId'
      },
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
    };
    
    const result = await docClient.send(new ScanCommand(params));
    totalScanned += result.Items?.length || 0;
    
    for (const item of result.Items || []) {
      // Skip system items (inventories, rate limits, audit logs)
      if (item.pk && (
        item.pk.startsWith('INVENTORY#') || 
        item.pk.startsWith('RATELIMIT#') || 
        item.pk.startsWith('AUDITLOG#')
      )) {
        continue;
      }
      
      // Only include items that look like user entities
      if (item.data && (
        item.data.name || 
        item.data.description || 
        item.data.address ||
        item.data.email
      )) {
        entities.push(item);
      }
    }
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`📊 Scanned ${totalScanned} items, found ${entities.length} entities needing inventoryId`);
  return entities;
}

/**
 * Update entity to include inventoryId
 */
async function updateEntityWithInventoryId(entity, inventoryId) {
  const updatedData = {
    ...entity.data,
    inventoryId
  };
  
  if (!DRY_RUN) {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: entity.pk,
        sk: entity.sk
      },
      UpdateExpression: 'SET #data = :data',
      ExpressionAttributeNames: {
        '#data': 'data'
      },
      ExpressionAttributeValues: {
        ':data': updatedData
      }
    }));
  }
  
  return updatedData;
}

/**
 * Process entities in batches
 */
async function processEntities(entities, inventoryId) {
  console.log(`🔄 Processing ${entities.length} entities...`);
  
  let processed = 0;
  let errors = 0;
  
  for (const entity of entities) {
    try {
      await updateEntityWithInventoryId(entity, inventoryId);
      processed++;
      
      if (processed % 10 === 0) {
        console.log(`   Processed ${processed}/${entities.length} entities...`);
      }
    } catch (error) {
      console.error(`❌ Error updating entity ${entity.pk}#${entity.sk}:`, error.message);
      errors++;
    }
  }
  
  console.log(`✅ Processed ${processed} entities successfully`);
  if (errors > 0) {
    console.log(`⚠️  ${errors} entities had errors`);
  }
  
  return { processed, errors };
}

/**
 * Show sample of what would be updated
 */
function showSample(entities) {
  console.log('\n📋 Sample of entities that will be updated:');
  console.log('==========================================');
  
  const sample = entities.slice(0, 5);
  for (const entity of sample) {
    console.log(`📦 ${entity.pk}#${entity.sk}`);
    console.log(`   Name: ${entity.data?.name || 'N/A'}`);
    console.log(`   Type: ${entity.data?.description ? 'Has description' : 'No description'}`);
    console.log('');
  }
  
  if (entities.length > 5) {
    console.log(`... and ${entities.length - 5} more entities`);
  }
  console.log('');
}

/**
 * Main function
 */
async function main() {
  try {
    // Step 1: Find entities that need inventoryId
    const entities = await findEntitiesNeedingInventoryId();
    
    if (entities.length === 0) {
      console.log('✅ No entities found that need inventoryId. All data is already allocated!');
      return;
    }
    
    // Show sample of what will be updated
    showSample(entities);
    
    if (DRY_RUN) {
      console.log('🔍 DRY RUN: Would update these entities with inventoryId');
      console.log('   Run without DRY_RUN=true to perform actual updates');
      return;
    }
    
    // Step 2: Create default inventory
    const inventoryId = await createDefaultInventory();
    
    // Step 3: Create inventory membership
    await createInventoryMembership(inventoryId);
    
    // Step 4: Update all entities
    const result = await processEntities(entities, inventoryId);
    
    // Step 5: Summary
    console.log('\n🎉 Migration Complete!');
    console.log('======================');
    console.log(`📦 Created inventory: ${inventoryId}`);
    console.log(`✅ Updated ${result.processed} entities`);
    console.log(`❌ Errors: ${result.errors}`);
    
    if (result.errors === 0) {
      console.log('\n🚀 Your data should now be visible in the application!');
      console.log('   Refresh your browser and check the Things, Locations, Categories, and People pages.');
    } else {
      console.log('\n⚠️  Some entities had errors. Check the logs above for details.');
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
Usage: node allocate-to-default-inventory.js [options]

This script allocates all existing data to a default inventory.

Options:
  --help, -h    Show this help message

Environment Variables:
  TABLE_NAME    DynamoDB table name (default: home-inventory-dev)
  DRY_RUN       Set to 'true' for dry run mode (default: false)
  USER_ID       User ID for the default inventory owner (default: default-user)

Examples:
  # Dry run to see what would be updated
  DRY_RUN=true node allocate-to-default-inventory.js
  
  # Run actual migration
  node allocate-to-default-inventory.js
  
  # Use custom table and user
  TABLE_NAME=my-table USER_ID=my-user-id node allocate-to-default-inventory.js
`);
    process.exit(0);
  }
  
  main();
}

module.exports = { main };