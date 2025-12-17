#!/usr/bin/env node

/**
 * Script to populate categories from household-categories.json
 * This script reads the categories from the JSON file and creates them in the system
 */

const fs = require('fs');
const path = require('path');

// Read the categories from the JSON file
const categoriesPath = path.join(__dirname, '..', 'household-categories.json');

if (!fs.existsSync(categoriesPath)) {
  console.error('Error: household-categories.json not found');
  console.error('Please make sure the file exists in the project root');
  process.exit(1);
}

let categories;
try {
  const categoriesData = fs.readFileSync(categoriesPath, 'utf8');
  categories = JSON.parse(categoriesData);
} catch (error) {
  console.error('Error reading or parsing household-categories.json:', error.message);
  process.exit(1);
}

console.log(`Found ${categories.length} categories to create:`);
console.log('');

categories.forEach((category, index) => {
  console.log(`${index + 1}. ${category.name}`);
  console.log(`   Description: ${category.description}`);
  console.log(`   Color: ${category.color}`);
  console.log(`   Icon: ${category.icon}`);
  console.log('');
});

console.log('To use this script:');
console.log('1. Make sure you have an inventory selected in the application');
console.log('2. Use the application\'s category creation API to add these categories');
console.log('3. Or copy the data and manually create categories through the UI');
console.log('');
console.log('Example API calls (replace INVENTORY_ID and API_URL):');
console.log('');

categories.slice(0, 3).forEach((category, index) => {
  console.log(`curl -X POST "API_URL/categories" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -H "Authorization: Bearer YOUR_TOKEN" \\`);
  console.log(`  -d '{`);
  console.log(`    "name": "${category.name}",`);
  console.log(`    "description": "${category.description}",`);
  console.log(`    "color": "${category.color}",`);
  console.log(`    "icon": "${category.icon}",`);
  console.log(`    "inventoryId": "INVENTORY_ID"`);
  console.log(`  }'`);
  console.log('');
});

if (categories.length > 3) {
  console.log(`... and ${categories.length - 3} more categories`);
}