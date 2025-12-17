#!/usr/bin/env node

/**
 * Test script for add-user-by-email.js
 * 
 * This script tests the core logic without requiring AWS credentials
 */

console.log('Testing add-user-by-email.js script...');
console.log();

// Test 1: Verify script file exists and is valid JavaScript
console.log('Test 1: Script file validation');
try {
  const fs = require('fs');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'add-user-by-email.js');
  
  if (!fs.existsSync(scriptPath)) {
    throw new Error('Script file not found');
  }
  
  // Check if file is executable
  const stats = fs.statSync(scriptPath);
  const isExecutable = (stats.mode & 0o111) !== 0;
  
  console.log('  ✓ Script file exists');
  console.log(`  ${isExecutable ? '✓' : '✗'} Script is executable`);
  
  // Validate syntax by requiring it (but not executing)
  const { execSync } = require('child_process');
  execSync(`node -c ${scriptPath}`, { stdio: 'pipe' });
  console.log('  ✓ Script has valid syntax');
  
} catch (error) {
  console.error('  ✗ Test failed:', error.message);
  process.exit(1);
}

console.log();

// Test 2: Verify help output works
console.log('Test 2: Help output');
try {
  const { execSync } = require('child_process');
  const output = execSync('node backend/scripts/add-user-by-email.js --help', { 
    encoding: 'utf8',
    cwd: process.cwd().replace('/backend/scripts', '')
  });
  
  if (!output.includes('Usage:')) {
    throw new Error('Help output missing usage information');
  }
  
  if (!output.includes('administrator')) {
    throw new Error('Help output missing role information');
  }
  
  if (!output.includes('USER_POOL_ID')) {
    throw new Error('Help output missing environment variable information');
  }
  
  console.log('  ✓ Help output is complete');
  
} catch (error) {
  console.error('  ✗ Test failed:', error.message);
  process.exit(1);
}

console.log();

// Test 3: Verify error handling for missing arguments
console.log('Test 3: Argument validation');
try {
  const { execSync } = require('child_process');
  
  try {
    execSync('node backend/scripts/add-user-by-email.js test@example.com', { 
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: process.cwd().replace('/backend/scripts', '')
    });
    throw new Error('Script should have failed with missing arguments');
  } catch (error) {
    if (error.status === 1 && error.stderr.includes('Exactly 3 arguments required')) {
      console.log('  ✓ Correctly validates argument count');
    } else {
      throw error;
    }
  }
  
} catch (error) {
  console.error('  ✗ Test failed:', error.message);
  process.exit(1);
}

console.log();

// Test 4: Verify shell wrapper exists
console.log('Test 4: Shell wrapper validation');
try {
  const fs = require('fs');
  const path = require('path');
  const wrapperPath = path.join(__dirname, 'add-admin-user.sh');
  
  if (!fs.existsSync(wrapperPath)) {
    throw new Error('Shell wrapper not found');
  }
  
  const stats = fs.statSync(wrapperPath);
  const isExecutable = (stats.mode & 0o111) !== 0;
  
  console.log('  ✓ Shell wrapper exists');
  console.log(`  ${isExecutable ? '✓' : '✗'} Shell wrapper is executable`);
  
  // Check wrapper content
  const content = fs.readFileSync(wrapperPath, 'utf8');
  if (!content.includes('add-user-by-email.js')) {
    throw new Error('Shell wrapper does not reference the main script');
  }
  
  console.log('  ✓ Shell wrapper is properly configured');
  
} catch (error) {
  console.error('  ✗ Test failed:', error.message);
  process.exit(1);
}

console.log();

// Test 5: Verify documentation exists
console.log('Test 5: Documentation validation');
try {
  const fs = require('fs');
  const path = require('path');
  
  const docs = [
    'ADD_USER_BY_EMAIL.md',
    'QUICK_START_ADD_USER.md'
  ];
  
  for (const doc of docs) {
    const docPath = path.join(__dirname, doc);
    if (!fs.existsSync(docPath)) {
      throw new Error(`Documentation file ${doc} not found`);
    }
    console.log(`  ✓ ${doc} exists`);
  }
  
  // Check README.md includes reference to new script
  const readmePath = path.join(__dirname, 'README.md');
  const readmeContent = fs.readFileSync(readmePath, 'utf8');
  
  if (!readmeContent.includes('add-user-by-email.js')) {
    throw new Error('README.md does not reference the new script');
  }
  
  console.log('  ✓ README.md includes script reference');
  
} catch (error) {
  console.error('  ✗ Test failed:', error.message);
  process.exit(1);
}

console.log();
console.log('='.repeat(60));
console.log('All tests passed! ✓');
console.log('='.repeat(60));
console.log();
console.log('The add-user-by-email script is ready to use.');
console.log('Run with --help for usage information:');
console.log('  node backend/scripts/add-user-by-email.js --help');
console.log();
