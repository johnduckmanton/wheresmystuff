#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple YAML syntax validation
function validateYAML(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic YAML validation checks
    const lines = content.split('\n');
    let indentStack = [];
    let lineNumber = 0;
    
    for (const line of lines) {
      lineNumber++;
      
      // Skip empty lines and comments
      if (line.trim() === '' || line.trim().startsWith('#')) {
        continue;
      }
      
      // Check for tabs (YAML should use spaces)
      if (line.includes('\t')) {
        throw new Error(`Line ${lineNumber}: YAML should use spaces, not tabs`);
      }
      
      // Basic indentation check
      const indent = line.match(/^(\s*)/)[1].length;
      const content = line.trim();
      
      // Check for basic YAML structure
      if (content.includes(':') && !content.startsWith('-')) {
        // Key-value pair
        if (indent % 2 !== 0) {
          console.warn(`Line ${lineNumber}: Odd indentation (${indent} spaces) - consider using even numbers`);
        }
      }
    }
    
    console.log(`✅ ${filePath} - YAML syntax appears valid`);
    return true;
  } catch (error) {
    console.error(`❌ ${filePath} - Error: ${error.message}`);
    return false;
  }
}

// Validate workflow files
const workflowDir = '.github/workflows';
const dependabotFile = '.github/dependabot.yml';

let allValid = true;

if (fs.existsSync(workflowDir)) {
  const files = fs.readdirSync(workflowDir);
  for (const file of files) {
    if (file.endsWith('.yml') || file.endsWith('.yaml')) {
      const filePath = path.join(workflowDir, file);
      if (!validateYAML(filePath)) {
        allValid = false;
      }
    }
  }
}

if (fs.existsSync(dependabotFile)) {
  if (!validateYAML(dependabotFile)) {
    allValid = false;
  }
}

if (allValid) {
  console.log('\n🎉 All workflow files appear to have valid YAML syntax!');
  process.exit(0);
} else {
  console.log('\n💥 Some workflow files have syntax issues. Please fix them before committing.');
  process.exit(1);
}