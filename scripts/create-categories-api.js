#!/usr/bin/env node

/**
 * Script to create categories via API
 * Usage: node scripts/create-categories-api.js <API_URL> <JWT_TOKEN> <INVENTORY_ID>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Parse command line arguments
const [,, apiUrl, jwtToken, inventoryId] = process.argv;

if (!apiUrl || !jwtToken || !inventoryId) {
  console.error('Usage: node scripts/create-categories-api.js <API_URL> <JWT_TOKEN> <INVENTORY_ID>');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/create-categories-api.js https://api.example.com eyJ0eXAiOiJKV1Q... inv-123-456');
  process.exit(1);
}

// Read the categories from the JSON file
const categoriesPath = path.join(__dirname, '..', 'household-categories.json');

if (!fs.existsSync(categoriesPath)) {
  console.error('Error: household-categories.json not found');
  process.exit(1);
}

let categories;
try {
  const categoriesData = fs.readFileSync(categoriesPath, 'utf8');
  categories = JSON.parse(categoriesData);
} catch (error) {
  console.error('Error reading categories:', error.message);
  process.exit(1);
}

// Function to make HTTP request
function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    
    const req = lib.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Create categories
async function createCategories() {
  console.log(`Creating ${categories.length} categories...`);
  console.log('');

  const results = [];
  
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    
    try {
      console.log(`Creating: ${category.name}...`);
      
      const categoryData = {
        name: category.name,
        description: category.description,
        color: category.color,
        icon: category.icon,
        inventoryId: inventoryId
      };

      const response = await makeRequest(`${apiUrl}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        }
      }, categoryData);

      if (response.status >= 200 && response.status < 300) {
        console.log(`✓ Created: ${category.name}`);
        results.push({ success: true, category: category.name });
      } else {
        console.log(`✗ Failed: ${category.name} (${response.status})`);
        console.log(`  Error: ${JSON.stringify(response.data)}`);
        results.push({ success: false, category: category.name, error: response.data });
      }
    } catch (error) {
      console.log(`✗ Failed: ${category.name}`);
      console.log(`  Error: ${error.message}`);
      results.push({ success: false, category: category.name, error: error.message });
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('');
  console.log('Summary:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✓ Successful: ${successful}`);
  console.log(`✗ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('');
    console.log('Failed categories:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.category}: ${r.error}`);
    });
  }
}

createCategories().catch(console.error);