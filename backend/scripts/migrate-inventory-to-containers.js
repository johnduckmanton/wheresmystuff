#!/usr/bin/env node

/**
 * Migration script to add container support to existing inventories
 * This script can be run to migrate existing inventory data to support the Moving & Storage System
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const dataMigrationService = require('../services/dataMigrationService');

// Configuration
const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';
const AWS_REGION = process.env.AWS_REGION || 'eu-west-1';

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting inventory-to-containers migration...');
  console.log(`📊 Using table: ${TABLE_NAME}`);
  console.log(`🌍 Using region: ${AWS_REGION}`);
  
  try {
    // Parse command line arguments
    const args = parseArguments();
    
    if (args.help) {
      printHelp();
      return;
    }

    // Get all inventories
    const inventories = await getAllInventories();
    console.log(`📦 Found ${inventories.length} inventories`);

    if (inventories.length === 0) {
      console.log('✅ No inventories found to migrate');
      return;
    }

    // Filter inventories if specific ones were requested
    let inventoriesToMigrate = inventories;
    if (args.inventoryId) {
      inventoriesToMigrate = inventories.filter(inv => inv.id === args.inventoryId);
      if (inventoriesToMigrate.length === 0) {
        console.error(`❌ Inventory ${args.inventoryId} not found`);
        process.exit(1);
      }
    }

    console.log(`🎯 Migrating ${inventoriesToMigrate.length} inventories`);

    // Migration options
    const migrationOptions = {
      createDefaultContainers: args.createContainers,
      groupByLocation: args.groupByLocation,
      groupByCategory: args.groupByCategory,
      maxItemsPerContainer: args.maxItems,
      dryRun: args.dryRun
    };

    console.log('⚙️  Migration options:', migrationOptions);

    if (args.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
    }

    // Migrate each inventory
    const results = [];
    for (const inventory of inventoriesToMigrate) {
      console.log(`\n📋 Migrating inventory: ${inventory.name} (${inventory.id})`);
      
      try {
        // Use the inventory owner as the user ID for the migration
        const result = await dataMigrationService.migrateInventoryToContainerSupport(
          inventory.id,
          inventory.ownerId,
          migrationOptions
        );

        results.push({
          inventory,
          result,
          success: true
        });

        console.log(`✅ Migration completed for ${inventory.name}`);
        console.log(`   📦 Containers created: ${result.summary.containersCreated}`);
        console.log(`   📄 Items processed: ${result.summary.itemsProcessed}`);
        console.log(`   🔗 Items assigned: ${result.summary.itemsAssigned}`);
        
        if (result.errors.length > 0) {
          console.log(`   ⚠️  Errors: ${result.errors.length}`);
        }
      } catch (error) {
        console.error(`❌ Failed to migrate ${inventory.name}: ${error.message}`);
        results.push({
          inventory,
          error: error.message,
          success: false
        });
      }
    }

    // Print summary
    console.log('\n📊 Migration Summary:');
    console.log('='.repeat(50));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful migrations: ${successful.length}`);
    console.log(`❌ Failed migrations: ${failed.length}`);
    
    if (successful.length > 0) {
      const totalContainers = successful.reduce((sum, r) => sum + r.result.summary.containersCreated, 0);
      const totalItems = successful.reduce((sum, r) => sum + r.result.summary.itemsAssigned, 0);
      
      console.log(`📦 Total containers created: ${totalContainers}`);
      console.log(`📄 Total items assigned: ${totalItems}`);
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed inventories:');
      failed.forEach(f => {
        console.log(`   - ${f.inventory.name}: ${f.error}`);
      });
    }

    if (args.outputFile) {
      await writeResultsToFile(args.outputFile, results);
      console.log(`📄 Results written to: ${args.outputFile}`);
    }

    console.log('\n🎉 Migration completed!');
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Get all inventories from the database
 */
async function getAllInventories() {
  const inventories = [];
  let lastEvaluatedKey;

  do {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(pk, :inventoryPrefix) AND sk = :metadataSk',
      ExpressionAttributeValues: {
        ':inventoryPrefix': 'INVENTORY#',
        ':metadataSk': 'METADATA'
      }
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await docClient.send(new ScanCommand(params));
    
    if (result.Items) {
      inventories.push(...result.Items);
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return inventories;
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = {
    help: false,
    dryRun: false,
    inventoryId: null,
    createContainers: true,
    groupByLocation: true,
    groupByCategory: false,
    maxItems: 50,
    outputFile: null
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--inventory-id':
        args.inventoryId = process.argv[++i];
        break;
      case '--no-create-containers':
        args.createContainers = false;
        break;
      case '--group-by-category':
        args.groupByLocation = false;
        args.groupByCategory = true;
        break;
      case '--max-items':
        args.maxItems = parseInt(process.argv[++i]);
        break;
      case '--output':
        args.outputFile = process.argv[++i];
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return args;
}

/**
 * Print help information
 */
function printHelp() {
  console.log(`
📦 Inventory to Containers Migration Script

Usage: node migrate-inventory-to-containers.js [options]

Options:
  --help, -h                 Show this help message
  --dry-run                  Run in dry-run mode (no changes made)
  --inventory-id <id>        Migrate only the specified inventory
  --no-create-containers     Don't create default containers
  --group-by-category        Group items by category instead of location
  --max-items <number>       Maximum items per container (default: 50)
  --output <file>            Write results to JSON file

Environment Variables:
  TABLE_NAME                 DynamoDB table name (default: home-inventory)
  AWS_REGION                 AWS region (default: eu-west-1)

Examples:
  # Dry run migration for all inventories
  node migrate-inventory-to-containers.js --dry-run

  # Migrate specific inventory
  node migrate-inventory-to-containers.js --inventory-id abc-123-def

  # Group by category with smaller containers
  node migrate-inventory-to-containers.js --group-by-category --max-items 25

  # Save results to file
  node migrate-inventory-to-containers.js --output migration-results.json
`);
}

/**
 * Write results to a JSON file
 */
async function writeResultsToFile(filename, results) {
  const fs = require('fs').promises;
  
  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    },
    results: results.map(r => ({
      inventory: {
        id: r.inventory.id,
        name: r.inventory.name,
        ownerId: r.inventory.ownerId
      },
      success: r.success,
      error: r.error,
      summary: r.result?.summary
    }))
  };

  await fs.writeFile(filename, JSON.stringify(output, null, 2));
}

// Run the migration if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { main, getAllInventories };