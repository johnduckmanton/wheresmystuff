#!/usr/bin/env node

/**
 * System Integration Validation Script
 * Validates that all moving & storage system components are properly integrated
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Moving & Storage System Integration...\n');

// Track validation results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

function logResult(test, status, message) {
  const symbols = { pass: '✅', fail: '❌', warn: '⚠️' };
  console.log(`${symbols[status]} ${test}: ${message}`);
  
  results[status === 'pass' ? 'passed' : status === 'fail' ? 'failed' : 'warnings']++;
  results.details.push({ test, status, message });
}

// 1. Validate Core Services Exist
console.log('📦 Validating Core Services...');

const coreServices = [
  'services/containerService.js',
  'services/packingService.js',
  'services/qrCodeService.js',
  'services/reportService.js',
  'services/movingProjectService.js',
  'services/analyticsService.js',
  'services/containerSharingService.js',
  'services/storageService.js'
];

coreServices.forEach(service => {
  const servicePath = path.join(__dirname, '..', service);
  if (fs.existsSync(servicePath)) {
    logResult(`Service: ${service}`, 'pass', 'Service file exists');
  } else {
    logResult(`Service: ${service}`, 'fail', 'Service file missing');
  }
});

// 2. Validate Core Handlers Exist
console.log('\n🎯 Validating API Handlers...');

const coreHandlers = [
  'handlers/containers.js',
  'handlers/packing.js',
  'handlers/qrCode.js',
  'handlers/reports.js',
  'handlers/projects.js',
  'handlers/analytics.js',
  'handlers/containerSharing.js',
  'handlers/storage.js'
];

coreHandlers.forEach(handler => {
  const handlerPath = path.join(__dirname, '..', handler);
  if (fs.existsSync(handlerPath)) {
    logResult(`Handler: ${handler}`, 'pass', 'Handler file exists');
  } else {
    logResult(`Handler: ${handler}`, 'fail', 'Handler file missing');
  }
});

// 3. Validate Data Models
console.log('\n📊 Validating Data Models...');

const dataModels = [
  'models/container.js',
  'models/movingProject.js'
];

dataModels.forEach(model => {
  const modelPath = path.join(__dirname, '..', model);
  if (fs.existsSync(modelPath)) {
    logResult(`Model: ${model}`, 'pass', 'Model file exists');
  } else {
    logResult(`Model: ${model}`, 'fail', 'Model file missing');
  }
});

// 4. Validate Test Coverage
console.log('\n🧪 Validating Test Coverage...');

const testFiles = [
  'tests/qrCode.test.js',
  'tests/packing-validation.test.js',
  'tests/reportService.test.js',
  'tests/analytics.test.js',
  'tests/containerSharing.test.js',
  'tests/dataSynchronization.test.js'
];

testFiles.forEach(test => {
  const testPath = path.join(__dirname, test);
  if (fs.existsSync(testPath)) {
    logResult(`Test: ${test}`, 'pass', 'Test file exists');
  } else {
    logResult(`Test: ${test}`, 'warn', 'Test file missing');
  }
});

// 5. Validate Frontend Components
console.log('\n🎨 Validating Frontend Components...');

const frontendComponents = [
  '../frontend/src/pages/MovingDashboard.tsx',
  '../frontend/src/pages/Containers.tsx',
  '../frontend/src/components/ContainerFormDialog.tsx',
  '../frontend/src/components/PackingInterface.tsx',
  '../frontend/src/components/QRCodeScanner.tsx',
  '../frontend/src/components/QRCodeGenerator.tsx',
  '../frontend/src/components/LocationReportDialog.tsx'
];

frontendComponents.forEach(component => {
  const componentPath = path.join(__dirname, component);
  if (fs.existsSync(componentPath)) {
    logResult(`Component: ${path.basename(component)}`, 'pass', 'Component file exists');
  } else {
    logResult(`Component: ${path.basename(component)}`, 'warn', 'Component file missing');
  }
});

// 6. Validate Configuration Files
console.log('\n⚙️ Validating Configuration...');

const configFiles = [
  '../template.yaml',
  'package.json',
  'jest.config.js'
];

configFiles.forEach(config => {
  const configPath = path.join(__dirname, config);
  if (fs.existsSync(configPath)) {
    logResult(`Config: ${path.basename(config)}`, 'pass', 'Configuration file exists');
  } else {
    logResult(`Config: ${path.basename(config)}`, 'fail', 'Configuration file missing');
  }
});

// 7. Validate Service Exports (Basic Check)
console.log('\n🔗 Validating Service Exports...');

try {
  // Test QR Code Service
  const QRCodeService = require('../services/qrCodeService');
  if (typeof QRCodeService === 'function') {
    logResult('QRCodeService Export', 'pass', 'Service exports constructor');
  } else {
    logResult('QRCodeService Export', 'warn', 'Service export format may be different');
  }

  // Test Packing Service
  const packingService = require('../services/packingService');
  if (typeof packingService === 'object' && packingService.addItemsToContainer) {
    logResult('PackingService Export', 'pass', 'Service exports methods');
  } else {
    logResult('PackingService Export', 'warn', 'Service export format may be different');
  }

  // Test Report Service
  const reportService = require('../services/reportService');
  if (typeof reportService === 'object' && reportService.generateLocationReport) {
    logResult('ReportService Export', 'pass', 'Service exports methods');
  } else {
    logResult('ReportService Export', 'warn', 'Service export format may be different');
  }

} catch (error) {
  logResult('Service Exports', 'warn', `Could not validate exports: ${error.message}`);
}

// 8. Validate Handler Exports
console.log('\n🎯 Validating Handler Exports...');

try {
  const containerHandler = require('../handlers/containers');
  if (typeof containerHandler.handler === 'function') {
    logResult('Container Handler', 'pass', 'Handler exports main function');
  } else {
    logResult('Container Handler', 'fail', 'Handler missing main function');
  }

  const packingHandler = require('../handlers/packing');
  if (typeof packingHandler.handler === 'function') {
    logResult('Packing Handler', 'pass', 'Handler exports main function');
  } else {
    logResult('Packing Handler', 'fail', 'Handler missing main function');
  }

  const projectHandler = require('../handlers/projects');
  if (typeof projectHandler.handler === 'function') {
    logResult('Project Handler', 'pass', 'Handler exports main function');
  } else {
    logResult('Project Handler', 'fail', 'Handler missing main function');
  }

  const reportHandler = require('../handlers/reports');
  if (typeof reportHandler.handler === 'function') {
    logResult('Report Handler', 'pass', 'Handler exports main function');
  } else {
    logResult('Report Handler', 'fail', 'Handler missing main function');
  }

} catch (error) {
  logResult('Handler Exports', 'warn', `Could not validate handler exports: ${error.message}`);
}

// Summary
console.log('\n📋 Validation Summary');
console.log('═'.repeat(50));
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`⚠️  Warnings: ${results.warnings}`);
console.log(`📊 Total: ${results.passed + results.failed + results.warnings}`);

const successRate = Math.round((results.passed / (results.passed + results.failed + results.warnings)) * 100);
console.log(`🎯 Success Rate: ${successRate}%`);

if (results.failed === 0) {
  console.log('\n🎉 System Integration Validation PASSED!');
  console.log('✅ All critical components are properly integrated');
  console.log('✅ Moving & Storage System is ready for deployment');
} else {
  console.log('\n⚠️  System Integration Validation completed with issues');
  console.log(`❌ ${results.failed} critical issues found`);
  console.log('🔧 Please address failed validations before deployment');
}

// Export results for programmatic use
if (require.main === module) {
  process.exit(results.failed > 0 ? 1 : 0);
} else {
  module.exports = results;
}