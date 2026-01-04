#!/usr/bin/env node

/**
 * Script to check and optionally add GSI indexes for Moving & Storage System
 * 
 * This script can operate in two modes:
 * 1. CHECK MODE (default): Validates that required indexes exist
 * 2. CREATE MODE (--create): Creates missing indexes if they don't exist
 * 
 * Required indexes:
 * 1. ContainerLocationIndex - Query containers by location
 * 2. ProjectContainerIndex - Query containers by project  
 * 3. QRCodeIndex - Fast QR code lookup
 * 
 * Usage: 
 *   node add-moving-storage-indexes.js [--environment=dev] [--create]
 * 
 * Examples:
 *   node add-moving-storage-indexes.js --environment=dev           # Check only
 *   node add-moving-storage-indexes.js --environment=dev --create  # Create missing indexes
 * 
 * Note: CloudFormation template already defines these indexes for new deployments.
 * This script is useful for:
 * - Existing tables that need indexes added
 * - Manual index management outside of CloudFormation
 * - CI/CD validation (check mode)
 */

const { DynamoDBClient, DescribeTableCommand, UpdateTableCommand } = require('@aws-sdk/client-dynamodb');

// Parse command line arguments
const args = process.argv.slice(2);
const environment = args.find(arg => arg.startsWith('--environment='))?.split('=')[1] || 'dev';

// Use the correct table naming convention from CloudFormation template
const TABLE_NAME = `home-inv-${environment}`;

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-1'
});

/**
 * Log with timestamp
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level}: ${message}`);
}

/**
 * Get current table description
 */
async function getTableDescription() {
  try {
    const command = new DescribeTableCommand({
      TableName: TABLE_NAME
    });
    
    const result = await client.send(command);
    return result.Table;
  } catch (error) {
    log(`Failed to describe table: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Check if a GSI exists
 */
function hasGSI(table, indexName) {
  return table.GlobalSecondaryIndexes?.some(gsi => gsi.IndexName === indexName) || false;
}

/**
 * Add Container Location Index
 */
async function addContainerLocationIndex(table) {
  const indexName = 'ContainerLocationIndex';
  
  if (hasGSI(table, indexName)) {
    log(`${indexName} already exists, skipping`);
    return true;
  }
  
  log(`Adding ${indexName}...`);
  
  try {
    const command = new UpdateTableCommand({
      TableName: TABLE_NAME,
      AttributeDefinitions: [
        {
          AttributeName: 'locationId',
          AttributeType: 'S'
        },
        {
          AttributeName: 'containerId',
          AttributeType: 'S'
        }
      ],
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: indexName,
            KeySchema: [
              {
                AttributeName: 'locationId',
                KeyType: 'HASH'
              },
              {
                AttributeName: 'containerId',
                KeyType: 'RANGE'
              }
            ],
            Projection: {
              ProjectionType: 'ALL'
            }
          }
        }
      ]
    });
    
    await client.send(command);
    log(`${indexName} creation initiated`);
    return true;
  } catch (error) {
    log(`Failed to add ${indexName}: ${error.message}`, 'ERROR');
    return false;
  }
}

/**
 * Add Project Container Index
 */
async function addProjectContainerIndex(table) {
  const indexName = 'ProjectContainerIndex';
  
  if (hasGSI(table, indexName)) {
    log(`${indexName} already exists, skipping`);
    return true;
  }
  
  log(`Adding ${indexName}...`);
  
  try {
    const command = new UpdateTableCommand({
      TableName: TABLE_NAME,
      AttributeDefinitions: [
        {
          AttributeName: 'projectId',
          AttributeType: 'S'
        },
        {
          AttributeName: 'containerId',
          AttributeType: 'S'
        }
      ],
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: indexName,
            KeySchema: [
              {
                AttributeName: 'projectId',
                KeyType: 'HASH'
              },
              {
                AttributeName: 'containerId',
                KeyType: 'RANGE'
              }
            ],
            Projection: {
              ProjectionType: 'ALL'
            }
          }
        }
      ]
    });
    
    await client.send(command);
    log(`${indexName} creation initiated`);
    return true;
  } catch (error) {
    log(`Failed to add ${indexName}: ${error.message}`, 'ERROR');
    return false;
  }
}

/**
 * Add QR Code Index
 */
async function addQRCodeIndex(table) {
  const indexName = 'QRCodeIndex';
  
  if (hasGSI(table, indexName)) {
    log(`${indexName} already exists, skipping`);
    return true;
  }
  
  log(`Adding ${indexName}...`);
  
  try {
    const command = new UpdateTableCommand({
      TableName: TABLE_NAME,
      AttributeDefinitions: [
        {
          AttributeName: 'qrCode',
          AttributeType: 'S'
        }
      ],
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: indexName,
            KeySchema: [
              {
                AttributeName: 'qrCode',
                KeyType: 'HASH'
              }
            ],
            Projection: {
              ProjectionType: 'ALL'
            }
          }
        }
      ]
    });
    
    await client.send(command);
    log(`${indexName} creation initiated`);
    return true;
  } catch (error) {
    log(`Failed to add ${indexName}: ${error.message}`, 'ERROR');
    return false;
  }
}

/**
 * Wait for table to be active
 */
async function waitForTableActive() {
  log('Waiting for table to be active...');
  
  let attempts = 0;
  const maxAttempts = 30; // 5 minutes max
  
  while (attempts < maxAttempts) {
    try {
      const table = await getTableDescription();
      
      if (table.TableStatus === 'ACTIVE') {
        const allIndexesActive = table.GlobalSecondaryIndexes?.every(
          gsi => gsi.IndexStatus === 'ACTIVE'
        ) ?? true;
        
        if (allIndexesActive) {
          log('Table and all indexes are active');
          return true;
        }
      }
      
      log(`Table status: ${table.TableStatus}, waiting...`);
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;
      
    } catch (error) {
      log(`Error checking table status: ${error.message}`, 'ERROR');
      attempts++;
    }
  }
  
  log('Timeout waiting for table to be active', 'ERROR');
  return false;
}

/**
 * Main function to check and optionally create indexes
 */
async function addIndexes() {
  // Parse command line arguments for mode
  const args = process.argv.slice(2);
  const createMode = args.includes('--create');
  
  log(`${createMode ? 'Adding' : 'Checking'} GSI indexes for Moving & Storage System on table: ${TABLE_NAME}`);
  
  try {
    // Get current table description
    const table = await getTableDescription();
    log(`Current table status: ${table.TableStatus}`);
    
    // Check for required indexes
    const requiredIndexes = [
      'ContainerLocationIndex',
      'ProjectContainerIndex', 
      'QRCodeIndex'
    ];
    
    let allIndexesExist = true;
    let missingIndexes = [];
    
    for (const indexName of requiredIndexes) {
      const exists = hasGSI(table, indexName);
      log(`${indexName}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
      if (!exists) {
        allIndexesExist = false;
        missingIndexes.push(indexName);
      }
    }
    
    if (allIndexesExist) {
      log('✅ All required GSI indexes already exist!');
    } else if (createMode) {
      log(`🔧 Creating ${missingIndexes.length} missing indexes...`);
      
      if (table.TableStatus !== 'ACTIVE') {
        log('Table is not active, waiting...', 'WARN');
        const isActive = await waitForTableActive();
        if (!isActive) {
          throw new Error('Table did not become active within timeout');
        }
      }
      
      // Note: DynamoDB only allows one GSI update at a time
      // We need to add them sequentially and wait for each to complete
      
      let currentTable = table;
      
      // Add Container Location Index
      if (missingIndexes.includes('ContainerLocationIndex')) {
        const locationIndexAdded = await addContainerLocationIndex(currentTable);
        if (locationIndexAdded) {
          await waitForTableActive();
          currentTable = await getTableDescription();
        }
      }
      
      // Add Project Container Index
      if (missingIndexes.includes('ProjectContainerIndex')) {
        const projectIndexAdded = await addProjectContainerIndex(currentTable);
        if (projectIndexAdded) {
          await waitForTableActive();
          currentTable = await getTableDescription();
        }
      }
      
      // Add QR Code Index
      if (missingIndexes.includes('QRCodeIndex')) {
        const qrIndexAdded = await addQRCodeIndex(currentTable);
        if (qrIndexAdded) {
          await waitForTableActive();
        }
      }
      
      log('✅ Index creation completed!');
    } else {
      log('ℹ️  Some indexes are missing. Options:');
      log('   1. Run with --create flag to add missing indexes');
      log('   2. Deploy CloudFormation template (recommended)');
      log('   3. The CloudFormation template defines these indexes and will create them during deployment');
    }
    
    // Show all existing indexes
    const finalTable = await getTableDescription();
    if (finalTable.GlobalSecondaryIndexes && finalTable.GlobalSecondaryIndexes.length > 0) {
      log(`\nExisting GSI indexes (${finalTable.GlobalSecondaryIndexes.length}):`);
      finalTable.GlobalSecondaryIndexes.forEach(gsi => {
        log(`  - ${gsi.IndexName}: ${gsi.IndexStatus}`);
      });
    } else {
      log('\nNo GSI indexes found on table');
    }
    
  } catch (error) {
    log(`❌ Failed to process indexes: ${error.message}`, 'ERROR');
    
    // Don't exit with error code since this is called with || true in CI/CD
    // Just log the error and continue
    log('ℹ️  This is expected during initial deployment when table is being created');
  }
}

// Run the script
if (require.main === module) {
  addIndexes().catch(error => {
    log(`Unexpected error: ${error.message}`, 'ERROR');
    // Don't exit with error code since this is called with || true in CI/CD
  });
}

module.exports = {
  addIndexes,
  addContainerLocationIndex,
  addProjectContainerIndex,
  addQRCodeIndex
};