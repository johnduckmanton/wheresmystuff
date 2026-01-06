#!/usr/bin/env node

/**
 * Convert categories JSON to CSV format
 * Usage: node scripts/convert-categories-to-csv.js
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = '.kiro/specs/data/household-categories.json';
const OUTPUT_FILE = 'categories.csv';

function convertToCSV() {
  try {
    // Read the JSON file
    const jsonData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    
    // CSV headers
    const headers = ['name', 'description', 'color', 'icon'];
    
    // Convert to CSV rows
    const csvRows = [
      headers.join(','), // Header row
      ...jsonData.map(category => {
        return [
          `"${category.name.replace(/"/g, '""')}"`,
          `"${category.description.replace(/"/g, '""')}"`,
          category.color,
          category.icon
        ].join(',');
      })
    ];
    
    // Write CSV file
    fs.writeFileSync(OUTPUT_FILE, csvRows.join('\n'));
    
    console.log(`✅ Successfully converted ${jsonData.length} categories to ${OUTPUT_FILE}`);
    console.log(`📁 Output file: ${path.resolve(OUTPUT_FILE)}`);
    
  } catch (error) {
    console.error('❌ Error converting categories:', error.message);
    process.exit(1);
  }
}

// Run the conversion
convertToCSV();