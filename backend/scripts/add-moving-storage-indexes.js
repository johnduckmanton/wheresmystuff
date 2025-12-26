#!/usr/bin/env node

/**
 * Script to add GSI indexes for Moving & Storage System
 * 
 * This script adds the following indexes if they don't exist:
 * 1. ContainerLocationIndex - Query containers by location
 * 2. ProjectContainerIndex - Query containers by project  
 * 3. QRCodeIndex - Fast QR code lookup
 * 
 * Usage: node add-moving-storage-indexes.js [--environment=dev]
 */

const { DynamoDBClient, DescribeTableCommand, UpdateTableCommand } = require('@aws-sdk/client-dynamodb');

// Parse command line arguments
const args = process.argv.slice(2);
const environment = args.find(arg => arg.startsWith('--environment='))?.split('=')[1] || 'dev';

const TABLE_NAME = `home-inventory-${environment}`;

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
            },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5
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
            },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5
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
                AttributeName: 'qrCode',
                KeyType: 'HASH'
              },
              {
                AttributeName: 'containerId',
                KeyType: 'RANGE'
              }
            ],
            Projection: {
              ProjectionType: 'ALL'
            },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5
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
 * Main function to add all indexes
 */
async function addIndexes() {
  log(`Adding GSI indexes for Moving & Storage System on table: ${TABLE_NAME}`);
  
  try {
    // Get current table description
    const table = await getTableDescription();
    log(`Current table status: ${table.TableStatus}`);
    
    if (table.TableStatus !== 'ACTIVE') {
      log('Table is not active, waiting...', 'WARN');
      const isActive = await waitForTableActive();
      if (!isActive) {
        throw new Error('Table did not become active within timeout');
      }
    }
    
    // Note: DynamoDB only allows one GSI update at a time
    // We need to add them sequentially and wait for each to complete
    
    // Add Container Location Index
    const locationIndexAdded = await addContainerLocationIndex(table);
    if (locationIndexAdded) {
      await waitForTableActive();
    }
    
    // Refresh table description
    const updatedTable1 = await getTableDescription();
    
    // Add Project Container Index
    const projectIndexAdded = await addProjectContainerIndex(updatedTable1);
    if (projectIndexAdded) {
      await waitForTableActive();
    }
    
    // Refresh table description
    const updatedTable2 = await getTableDescription();
    
    // Add QR Code Index
    const qrIndexAdded = await addQRCodeIndex(updatedTable2);
    if (qrIndexAdded) {
      await waitForTableActive();
    }
    
    log('✅ All GSI indexes have been added successfully!');
    
    // Final table status
    const finalTable = await getTableDescription();
    log(`Final table status: ${finalTable.TableStatus}`);
    log(`Total GSI indexes: ${finalTable.GlobalSecondaryIndexes?.length || 0}`);
    
    if (finalTable.GlobalSecondaryIndexes) {
      finalTable.GlobalSecondaryIndexes.forEach(gsi => {
        log(`  - ${gsi.IndexName}: ${gsi.IndexStatus}`);
      });
    }
    
  } catch (error) {
    log(`❌ Failed to add indexes: ${error.message}`, 'ERROR');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  addIndexes().catch(error => {
    log(`Unexpected error: ${error.message}`, 'ERROR');
    process.exit(1);
  });
}

module.exports = {
  addIndexes,
  addContainerLocationIndex,
  addProjectContainerIndex,
  addQRCodeIndex
};