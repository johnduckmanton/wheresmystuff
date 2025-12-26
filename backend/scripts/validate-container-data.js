#!/usr/bin/env node

/**
 * Data validation script for container and inventory consistency
 * This script validates data integrity between inventory and moving modules
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const dataSynchronizationService = require('../services/dataSynchronizationService');
const dataMigrationService = require('../services/dataMigrationService');

// Configuration
const TABLE_NAME = process.env.TABLE_NAME || 'home-inventory';
const AWS_REGION = process.env.AWS_REGION || 'eu-west-1';

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Main validation function
 */
async function main() {
  console.log('🔍 Starting container data validation...');
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
      console.log('✅ No inventories found to validate');
      return;
    }

    // Filter inventories if specific ones were requested
    let inventoriesToValidate = inventories;
    if (args.inventoryId) {
      inventoriesToValidate = inventories.filter(inv => inv.id === args.inventoryId);
      if (inventoriesToValidate.length === 0) {
        console.error(`❌ Inventory ${args.inventoryId} not found`);
        process.exit(1);
      }
    }

    console.log(`🎯 Validating ${inventoriesToValidate.length} inventories`);

    // Validation results
    const results = [];
    let totalInconsistencies = 0;

    // Validate each inventory
    for (const inventory of inventoriesToValidate) {
      console.log(`\n📋 Validating inventory: ${inventory.name} (${inventory.id})`);
      
      try {
        // Validate data consistency
        const validationResult = await dataSynchronizationService.validateDataConsistency(
          inventory.id,
          inventory.ownerId
        );

        results.push({
          inventory,
          validation: validationResult,
          success: true
        });

        console.log(`📊 Validation completed for ${inventory.name}`);
        console.log(`   📄 Total items: ${validationResult.summary.totalItems}`);
        console.log(`   📦 Total containers: ${validationResult.summary.totalContainers}`);
        console.log(`   ⚠️  Inconsistencies: ${validationResult.inconsistencies.length}`);
        
        if (validationResult.inconsistencies.length > 0) {
          totalInconsistencies += validationResult.inconsistencies.length;
          
          // Group inconsistencies by type
          const byType = {};
          validationResult.inconsistencies.forEach(inc => {
            byType[inc.type] = (byType[inc.type] || 0) + 1;
          });
          
          console.log('   📋 Inconsistency breakdown:');
          Object.entries(byType).forEach(([type, count]) => {
            console.log(`      - ${type}: ${count}`);
          });

          // Show high severity issues
          const highSeverity = validationResult.inconsistencies.filter(inc => inc.severity === 'high');
          if (highSeverity.length > 0) {
            console.log(`   🚨 High severity issues: ${highSeverity.length}`);
          }
        }

        // Auto-fix if requested
        if (args.autoFix && validationResult.inconsistencies.length > 0) {
          console.log(`🔧 Auto-fixing inconsistencies...`);
          
          if (!args.dryRun) {
            const fixResult = await dataSynchronizationService.resolveInconsistencies(
              inventory.id,
              validationResult.inconsistencies,
              inventory.ownerId
            );

            console.log(`   ✅ Resolved: ${fixResult.resolved.length}`);
            console.log(`   ❌ Failed: ${fixResult.failed.length}`);
            
            if (fixResult.failed.length > 0) {
              console.log('   🚨 Failed to resolve:');
              fixResult.failed.forEach(failed => {
                console.log(`      - ${failed.type}: ${failed.reason}`);
              });
            }
          } else {
            console.log('   🔍 DRY RUN - Would attempt to fix inconsistencies');
          }
        }
      } catch (error) {
        console.error(`❌ Failed to validate ${inventory.name}: ${error.message}`);
        results.push({
          inventory,
          error: error.message,
          success: false
        });
      }
    }

    // Cleanup if requested
    if (args.cleanup) {
      console.log('\n🧹 Running data cleanup...');
      
      for (const result of results.filter(r => r.success)) {
        try {
          console.log(`🧹 Cleaning up ${result.inventory.name}...`);
          
          const cleanupResult = await dataMigrationService.validateAndCleanupData(
            result.inventory.id,
            result.inventory.ownerId,
            {
              fixOrphanedItems: args.fixOrphaned,
              updateContainerCounts: args.updateCounts,
              removeEmptyContainers: args.removeEmpty,
              dryRun: args.dryRun
            }
          );

          console.log(`   🔧 Actions taken: ${cleanupResult.actions.length}`);
          console.log(`   🗑️  Orphaned items fixed: ${cleanupResult.summary.orphanedItemsFixed}`);
          console.log(`   📊 Container counts updated: ${cleanupResult.summary.containerCountsUpdated}`);
          console.log(`   📦 Empty containers removed: ${cleanupResult.summary.emptyContainersRemoved}`);
        } catch (error) {
          console.error(`❌ Cleanup failed for ${result.inventory.name}: ${error.message}`);
        }
      }
    }

    // Print summary
    console.log('\n📊 Validation Summary:');
    console.log('='.repeat(50));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful validations: ${successful.length}`);
    console.log(`❌ Failed validations: ${failed.length}`);
    console.log(`⚠️  Total inconsistencies found: ${totalInconsistencies}`);
    
    if (successful.length > 0) {
      const totalItems = successful.reduce((sum, r) => sum + r.validation.summary.totalItems, 0);
      const totalContainers = successful.reduce((sum, r) => sum + r.validation.summary.totalContainers, 0);
      const highSeverityIssues = successful.reduce((sum, r) => sum + r.validation.summary.highSeverity, 0);
      
      console.log(`📄 Total items validated: ${totalItems}`);
      console.log(`📦 Total containers validated: ${totalContainers}`);
      console.log(`🚨 High severity issues: ${highSeverityIssues}`);
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed validations:');
      failed.forEach(f => {
        console.log(`   - ${f.inventory.name}: ${f.error}`);
      });
    }

    if (args.outputFile) {
      await writeResultsToFile(args.outputFile, results);
      console.log(`📄 Results written to: ${args.outputFile}`);
    }

    // Exit with error code if there are inconsistencies and strict mode is enabled
    if (args.strict && totalInconsistencies > 0) {
      console.log('\n🚨 Exiting with error code due to inconsistencies (strict mode)');
      process.exit(1);
    }

    console.log('\n🎉 Validation completed!');
  } catch (error) {
    console.error('💥 Validation failed:', error.message);
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
    autoFix: false,
    cleanup: false,
    fixOrphaned: true,
    updateCounts: true,
    removeEmpty: false,
    strict: false,
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
      case '--auto-fix':
        args.autoFix = true;
        break;
      case '--cleanup':
        args.cleanup = true;
        break;
      case '--no-fix-orphaned':
        args.fixOrphaned = false;
        break;
      case '--no-update-counts':
        args.updateCounts = false;
        break;
      case '--remove-empty':
        args.removeEmpty = true;
        break;
      case '--strict':
        args.strict = true;
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
🔍 Container Data Validation Script

Usage: node validate-container-data.js [options]

Options:
  --help, -h                 Show this help message
  --dry-run                  Run in dry-run mode (no changes made)
  --inventory-id <id>        Validate only the specified inventory
  --auto-fix                 Automatically fix inconsistencies where possible
  --cleanup                  Run data cleanup operations
  --no-fix-orphaned          Don't fix orphaned items during cleanup
  --no-update-counts         Don't update container counts during cleanup
  --remove-empty             Remove empty containers during cleanup
  --strict                   Exit with error code if inconsistencies found
  --output <file>            Write results to JSON file

Environment Variables:
  TABLE_NAME                 DynamoDB table name (default: home-inventory)
  AWS_REGION                 AWS region (default: eu-west-1)

Examples:
  # Basic validation
  node validate-container-data.js

  # Validate and auto-fix issues
  node validate-container-data.js --auto-fix

  # Full cleanup with dry run
  node validate-container-data.js --cleanup --remove-empty --dry-run

  # Validate specific inventory with strict mode
  node validate-container-data.js --inventory-id abc-123 --strict

  # Save detailed results
  node validate-container-data.js --output validation-results.json
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
      failed: results.filter(r => !r.success).length,
      totalInconsistencies: results
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.validation.inconsistencies.length, 0)
    },
    results: results.map(r => ({
      inventory: {
        id: r.inventory.id,
        name: r.inventory.name,
        ownerId: r.inventory.ownerId
      },
      success: r.success,
      error: r.error,
      validation: r.validation ? {
        isConsistent: r.validation.isConsistent,
        inconsistencies: r.validation.inconsistencies,
        summary: r.validation.summary
      } : null
    }))
  };

  await fs.writeFile(filename, JSON.stringify(output, null, 2));
}

// Run the validation if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { main, getAllInventories };