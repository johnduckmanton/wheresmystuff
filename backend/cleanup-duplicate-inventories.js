#!/usr/bin/env node

/**
 * Cleanup script to remove duplicate inventories and keep only the one with data
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory-dev';
const DRY_RUN = process.env.DRY_RUN === 'true';

console.log('🧹 Cleanup Duplicate Inventories');
console.log('=================================');
console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE CLEANUP'}`);
console.log(`🗄️  Table: ${TABLE_NAME}`);
console.log('');

async function findInventoriesWithData() {
  console.log('🔍 Finding inventories with actual data...');
  
  // Find all inventories for the user
  const membershipResult = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(pk, :inventoryPrefix) AND sk = :memberSk',
    ExpressionAttributeValues: {
      ':inventoryPrefix': 'INVENTORY#',
      ':memberSk': 'MEMBER#f438c408-90e1-7041-3068-c2f110cf3980'
    }
  }));

  const inventories = [];
  
  for (const membership of membershipResult.Items || []) {
    const inventoryId = membership.inventoryId;
    
    // Get inventory metadata
    const inventoryResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `INVENTORY#${inventoryId}`,
        sk: 'METADATA'
      }
    }));
    
    if (inventoryResult.Item) {
      // Check if this inventory has any data (things, locations, etc.)
      const dataResult = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(pk, :inventoryPrefix)',
        ExpressionAttributeValues: {
          ':inventoryPrefix': `INVENTORY#${inventoryId}#`
        },
        Limit: 1 // Just check if any data exists
      }));
      
      inventories.push({
        id: inventoryId,
        name: inventoryResult.Item.name,
        description: inventoryResult.Item.description,
        hasData: (dataResult.Items && dataResult.Items.length > 0)
      });
    }
  }
  
  return inventories;
}

async function deleteInventory(inventoryId) {
  console.log(`   🗑️  Deleting inventory: ${inventoryId}`);
  
  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would delete inventory ${inventoryId}`);
    return;
  }
  
  // Delete inventory metadata
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      pk: `INVENTORY#${inventoryId}`,
      sk: 'METADATA'
    }
  }));
  
  // Delete membership
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      pk: `INVENTORY#${inventoryId}`,
      sk: 'MEMBER#f438c408-90e1-7041-3068-c2f110cf3980'
    }
  }));
}

async function cleanupDuplicates() {
  try {
    const inventories = await findInventoriesWithData();
    
    console.log(`📊 Found ${inventories.length} inventories:`);
    
    let inventoryWithData = null;
    const emptyInventories = [];
    
    for (const inventory of inventories) {
      console.log(`   - ${inventory.name} (${inventory.id}) - ${inventory.hasData ? 'HAS DATA' : 'EMPTY'}`);
      
      if (inventory.hasData) {
        if (inventoryWithData) {
          console.log(`   ⚠️  Multiple inventories with data found!`);
        } else {
          inventoryWithData = inventory;
        }
      } else {
        emptyInventories.push(inventory);
      }
    }
    
    console.log('');
    
    if (inventoryWithData) {
      console.log(`✅ Keeping inventory with data: ${inventoryWithData.name} (${inventoryWithData.id})`);
    } else {
      console.log(`⚠️  No inventory with data found! Keeping the first one.`);
      if (inventories.length > 0) {
        inventoryWithData = inventories[0];
        emptyInventories.splice(0, 1); // Remove from empty list
      }
    }
    
    console.log(`🗑️  Deleting ${emptyInventories.length} empty inventories:`);
    
    for (const inventory of emptyInventories) {
      await deleteInventory(inventory.id);
    }
    
    console.log('');
    console.log('🎉 Cleanup Summary:');
    console.log(`   Kept: ${inventoryWithData ? inventoryWithData.name : 'None'}`);
    console.log(`   Deleted: ${emptyInventories.length} empty inventories`);
    
    if (!DRY_RUN) {
      console.log('');
      console.log('🚀 Cleanup completed! Refresh your browser to see the clean inventory list.');
    } else {
      console.log('');
      console.log('🔍 Dry run completed. Run without DRY_RUN=true to perform actual cleanup.');
    }
    
  } catch (error) {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node cleanup-duplicate-inventories.js [options]

This script removes duplicate "My Inventory" entries and keeps only the one with data.

Environment Variables:
  TABLE_NAME    DynamoDB table name (default: home-inventory-dev)
  DRY_RUN       Set to 'true' for dry run mode (default: false)

Examples:
  # Dry run to see what would be deleted
  DRY_RUN=true node cleanup-duplicate-inventories.js
  
  # Run actual cleanup
  node cleanup-duplicate-inventories.js
`);
    process.exit(0);
  }
  
  cleanupDuplicates();
}

module.exports = { cleanupDuplicates };