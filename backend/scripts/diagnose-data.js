#!/usr/bin/env node

/**
 * Diagnostic script to see what data exists in the database
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory-dev';

console.log('🔍 Database Diagnostic Tool');
console.log('===========================');
console.log(`🗄️  Table: ${TABLE_NAME}`);
console.log('');

async function scanDatabase() {
  console.log('📊 Scanning database for all items...');
  
  const itemTypes = {};
  const sampleItems = [];
  let totalItems = 0;
  let lastEvaluatedKey = null;
  
  do {
    const params = {
      TableName: TABLE_NAME,
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
    };
    
    const result = await docClient.send(new ScanCommand(params));
    
    for (const item of result.Items || []) {
      totalItems++;
      
      // Categorize items by their pk pattern
      let category = 'OTHER';
      if (item.pk) {
        if (item.pk.startsWith('INVENTORY#')) category = 'INVENTORY';
        else if (item.pk.startsWith('USER#')) category = 'USER_DATA';
        else if (item.pk.startsWith('RATELIMIT#')) category = 'RATE_LIMIT';
        else if (item.pk.startsWith('AUDITLOG#')) category = 'AUDIT_LOG';
        else if (item.pk.includes('THINGS')) category = 'THINGS';
        else if (item.pk.includes('LOCATIONS')) category = 'LOCATIONS';
        else if (item.pk.includes('CATEGORIES')) category = 'CATEGORIES';
        else if (item.pk.includes('PEOPLE')) category = 'PEOPLE';
        else if (item.pk.includes('ROOMS')) category = 'ROOMS';
        else category = `UNKNOWN_PK: ${item.pk.substring(0, 20)}...`;
      } else {
        category = 'NO_PK';
      }
      
      itemTypes[category] = (itemTypes[category] || 0) + 1;
      
      // Collect samples
      if (sampleItems.length < 10 && !item.pk?.startsWith('RATELIMIT#') && !item.pk?.startsWith('AUDITLOG#')) {
        sampleItems.push({
          pk: item.pk,
          sk: item.sk,
          hasData: !!item.data,
          dataKeys: item.data ? Object.keys(item.data) : [],
          hasInventoryId: !!(item.data && item.data.inventoryId),
          fullItem: item // Keep full item for debugging
        });
      }
    }
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`📊 Total items found: ${totalItems}`);
  console.log('');
  
  console.log('📋 Item breakdown by type:');
  for (const [type, count] of Object.entries(itemTypes)) {
    console.log(`   ${type}: ${count}`);
  }
  console.log('');
  
  console.log('🔍 Sample items (first 10 non-system items):');
  for (const item of sampleItems) {
    console.log(`   PK: ${item.pk || 'N/A'}`);
    console.log(`   SK: ${item.sk || 'N/A'}`);
    console.log(`   Has data: ${item.hasData}`);
    console.log(`   Data keys: ${item.dataKeys.join(', ') || 'none'}`);
    console.log(`   Has inventoryId: ${item.hasInventoryId}`);
    
    // Show actual data structure for first few items
    if (sampleItems.indexOf(item) < 3) {
      console.log(`   Full structure: ${JSON.stringify(item.fullItem, null, 2)}`);
    }
    console.log('   ---');
  }
  
  // Look for entities that need inventoryId
  console.log('🎯 Looking for entities that need inventoryId...');
  const needsInventoryId = [];
  
  for (const item of sampleItems) {
    if (item.hasData && !item.hasInventoryId && 
        (item.dataKeys.includes('name') || item.dataKeys.includes('description'))) {
      needsInventoryId.push(item);
    }
  }
  
  console.log(`📦 Found ${needsInventoryId.length} sample items that need inventoryId`);
  
  if (needsInventoryId.length > 0) {
    console.log('');
    console.log('💡 Recommendations:');
    console.log('   1. Your data exists but needs to be migrated to the inventory system');
    console.log('   2. Run the migration script to create inventories and assign data');
    console.log('   3. Use: ./run-migration.sh or cd backend && node scripts/migrate-to-inventory-system.js');
  } else {
    console.log('');
    console.log('✅ Your data appears to already have inventoryId or no migration is needed');
  }
}

async function main() {
  try {
    await scanDatabase();
  } catch (error) {
    console.error('❌ Error scanning database:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}