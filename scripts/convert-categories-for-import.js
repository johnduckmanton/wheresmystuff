#!/usr/bin/env node

/**
 * Convert household categories JSON to DynamoDB import format
 */

const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const INVENTORY_ID = '1d9e658e-0680-44c0-933d-7b7776420cd9';
const INPUT_FILE = '.kiro/specs/data/household-categories.json';
const OUTPUT_FILE = './data-export/entities/categories.json';
const METADATA_FILE = './data-export/metadata/export-metadata.json';

function convertCategoriesToDynamoDBFormat() {
  try {
    // Read the household categories
    const categoriesData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    
    console.log(`Converting ${categoriesData.length} categories for inventory ${INVENTORY_ID}`);
    
    const now = new Date().toISOString();
    const dynamoItems = [];
    
    categoriesData.forEach((category, index) => {
      const categoryId = uuidv4();
      
      // Create DynamoDB item structure
      const dynamoItem = {
        pk: { S: `INVENTORY#${INVENTORY_ID}` },
        sk: { S: `CATEGORIES#${categoryId}` },
        entityType: { S: 'CATEGORIES' },
        entityId: { S: categoryId },
        inventoryId: { S: INVENTORY_ID },
        entityData: {
          M: {
            id: { S: categoryId },
            inventoryId: { S: INVENTORY_ID },
            name: { S: category.name },
            description: { S: category.description },
            color: { S: category.color },
            icon: { S: category.icon },
            dateAdded: { S: now },
            createdAt: { S: now },
            updatedAt: { S: now }
          }
        },
        createdAt: { S: now },
        updatedAt: { S: now }
      };
      
      dynamoItems.push(dynamoItem);
      
      console.log(`✓ Converted: ${category.name} (${categoryId})`);
    });
    
    // Create the import file structure
    const importData = {
      Items: dynamoItems
    };
    
    // Write the categories file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(importData, null, 2));
    console.log(`\n✅ Created categories import file: ${OUTPUT_FILE}`);
    
    // Create metadata file
    const metadata = {
      export_timestamp: now,
      environment: 'manual-import',
      table_name: 'home-inv-dev',
      total_items: dynamoItems.length,
      entity_types: {
        categories: dynamoItems.length
      },
      inventory_id: INVENTORY_ID,
      description: 'Household categories import for dev environment'
    };
    
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
    console.log(`✅ Created metadata file: ${METADATA_FILE}`);
    
    console.log(`\n📊 Import Summary:`);
    console.log(`   Categories: ${dynamoItems.length}`);
    console.log(`   Target Inventory: ${INVENTORY_ID}`);
    console.log(`   Ready for import!`);
    
  } catch (error) {
    console.error('❌ Error converting categories:', error.message);
    process.exit(1);
  }
}

// Run the conversion
convertCategoriesToDynamoDBFormat();