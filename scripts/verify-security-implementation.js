#!/usr/bin/env node

// Security Implementation Verification Script
// This script verifies that security controls are properly implemented in the codebase

const fs = require('fs');
const path = require('path');

class SecurityImplementationVerifier {
  constructor() {
    this.results = [];
    this.backendPath = path.join(__dirname, '..', 'backend');
  }

  log(test, status, message) {
    const result = { test, status, message, timestamp: new Date().toISOString() };
    this.results.push(result);
    
    const colors = {
      PASS: '\x1b[32m✅ PASS\x1b[0m',
      FAIL: '\x1b[31m❌ FAIL\x1b[0m',
      WARN: '\x1b[33m⚠️  WARN\x1b[0m',
      INFO: '\x1b[34mℹ️  INFO\x1b[0m'
    };
    
    console.log(`${colors[status]}: ${test} - ${message}`);
  }

  fileExists(filePath) {
    return fs.existsSync(path.join(this.backendPath, filePath));
  }

  readFile(filePath) {
    try {
      return fs.readFileSync(path.join(this.backendPath, filePath), 'utf8');
    } catch (error) {
      return null;
    }
  }

  verifySecurityHeaders() {
    console.log('\n=== Verifying Security Headers Implementation ===');
    
    const middlewarePath = 'middleware/securityHeaders.js';
    if (!this.fileExists(middlewarePath)) {
      this.log('Security Headers', 'FAIL', 'Security headers middleware not found');
      return;
    }

    const content = this.readFile(middlewarePath);
    if (!content) {
      this.log('Security Headers', 'FAIL', 'Could not read security headers middleware');
      return;
    }

    const requiredHeaders = [
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Strict-Transport-Security',
      'X-XSS-Protection'
    ];

    let allHeadersFound = true;
    requiredHeaders.forEach(header => {
      if (content.includes(header)) {
        this.log('Security Headers', 'PASS', `${header} header implemented`);
      } else {
        this.log('Security Headers', 'FAIL', `${header} header missing`);
        allHeadersFound = false;
      }
    });

    if (allHeadersFound) {
      this.log('Security Headers', 'PASS', 'All required security headers implemented');
    }
  }

  verifyInputValidation() {
    console.log('\n=== Verifying Input Validation Implementation ===');
    
    const validationPath = 'utils/validation.js';
    if (!this.fileExists(validationPath)) {
      this.log('Input Validation', 'FAIL', 'Validation utility not found');
      return;
    }

    const content = this.readFile(validationPath);
    if (!content) {
      this.log('Input Validation', 'FAIL', 'Could not read validation utility');
      return;
    }

    const validationFeatures = [
      { name: 'sanitizeString', pattern: /sanitizeString|sanitize.*string/i },
      { name: 'validateSchema', pattern: /validateSchema|validate.*schema/i },
      { name: 'XSS Protection', pattern: /<script|javascript:|onerror=/i },
      { name: 'SQL Injection Protection', pattern: /drop\s+table|union\s+select|'.*or.*'/i }
    ];

    validationFeatures.forEach(feature => {
      if (content.match(feature.pattern)) {
        this.log('Input Validation', 'PASS', `${feature.name} implemented`);
      } else {
        this.log('Input Validation', 'WARN', `${feature.name} pattern not found`);
      }
    });
  }

  verifyRateLimiting() {
    console.log('\n=== Verifying Rate Limiting Implementation ===');
    
    const rateLimitPath = 'services/rateLimitService.js';
    if (!this.fileExists(rateLimitPath)) {
      this.log('Rate Limiting', 'FAIL', 'Rate limiting service not found');
      return;
    }

    const content = this.readFile(rateLimitPath);
    if (!content) {
      this.log('Rate Limiting', 'FAIL', 'Could not read rate limiting service');
      return;
    }

    const rateLimitFeatures = [
      'checkRateLimit',
      'recordRequest',
      'windowStart',
      'requestsPerMinute'
    ];

    rateLimitFeatures.forEach(feature => {
      if (content.includes(feature)) {
        this.log('Rate Limiting', 'PASS', `${feature} function/variable found`);
      } else {
        this.log('Rate Limiting', 'WARN', `${feature} not found`);
      }
    });

    // Check middleware integration
    const middlewarePath = 'middleware/rateLimit.js';
    if (this.fileExists(middlewarePath)) {
      this.log('Rate Limiting', 'PASS', 'Rate limiting middleware exists');
    } else {
      this.log('Rate Limiting', 'FAIL', 'Rate limiting middleware not found');
    }
  }

  verifyAuditLogging() {
    console.log('\n=== Verifying Audit Logging Implementation ===');
    
    const auditPath = 'services/auditLogService.js';
    if (!this.fileExists(auditPath)) {
      this.log('Audit Logging', 'FAIL', 'Audit logging service not found');
      return;
    }

    const content = this.readFile(auditPath);
    if (!content) {
      this.log('Audit Logging', 'FAIL', 'Could not read audit logging service');
      return;
    }

    const auditFeatures = [
      'logAuth',
      'logDataAccess',
      'logAuthzFailure',
      'logRateLimit'
    ];

    auditFeatures.forEach(feature => {
      if (content.includes(feature)) {
        this.log('Audit Logging', 'PASS', `${feature} function found`);
      } else {
        this.log('Audit Logging', 'FAIL', `${feature} function missing`);
      }
    });
  }

  verifyInventoryAccessControl() {
    console.log('\n=== Verifying Inventory Access Control Implementation ===');
    
    const inventoryServicePath = 'services/inventoryService.js';
    if (!this.fileExists(inventoryServicePath)) {
      this.log('Access Control', 'FAIL', 'Inventory service not found');
      return;
    }

    const content = this.readFile(inventoryServicePath);
    if (!content) {
      this.log('Access Control', 'FAIL', 'Could not read inventory service');
      return;
    }

    const accessControlFeatures = [
      'hasInventoryAccess',
      'createInventory',
      'addInventoryMember',
      'removeInventoryMember'
    ];

    accessControlFeatures.forEach(feature => {
      if (content.includes(feature)) {
        this.log('Access Control', 'PASS', `${feature} function found`);
      } else {
        this.log('Access Control', 'FAIL', `${feature} function missing`);
      }
    });

    // Check middleware integration
    const authPath = 'middleware/auth.js';
    if (this.fileExists(authPath)) {
      const authContent = this.readFile(authPath);
      if (authContent && authContent.includes('inventory')) {
        this.log('Access Control', 'PASS', 'Inventory access control integrated in auth middleware');
      } else {
        this.log('Access Control', 'WARN', 'Inventory access control integration unclear');
      }
    }
  }

  verifyErrorHandling() {
    console.log('\n=== Verifying Error Handling Implementation ===');
    
    const errorHandlerPath = 'utils/errorHandler.js';
    if (!this.fileExists(errorHandlerPath)) {
      this.log('Error Handling', 'FAIL', 'Error handler utility not found');
      return;
    }

    const content = this.readFile(errorHandlerPath);
    if (!content) {
      this.log('Error Handling', 'FAIL', 'Could not read error handler utility');
      return;
    }

    const errorFeatures = [
      'handleError',
      'sanitizeError',
      'logError'
    ];

    errorFeatures.forEach(feature => {
      if (content.includes(feature)) {
        this.log('Error Handling', 'PASS', `${feature} function found`);
      } else {
        this.log('Error Handling', 'WARN', `${feature} function not found`);
      }
    });

    // Check for sensitive information exposure
    if (content.includes('stack') && content.includes('sanitize')) {
      this.log('Error Handling', 'PASS', 'Stack trace sanitization implemented');
    } else {
      this.log('Error Handling', 'WARN', 'Stack trace sanitization unclear');
    }
  }

  verifyPhotoAccessControl() {
    console.log('\n=== Verifying Photo Access Control Implementation ===');
    
    const photoHandlerPath = 'handlers/photo.js';
    if (!this.fileExists(photoHandlerPath)) {
      this.log('Photo Access', 'FAIL', 'Photo handler not found');
      return;
    }

    const content = this.readFile(photoHandlerPath);
    if (!content) {
      this.log('Photo Access', 'FAIL', 'Could not read photo handler');
      return;
    }

    const photoFeatures = [
      'generateUploadUrl',
      'generateDownloadUrl',
      'verifyAccess',
      'inventoryId'
    ];

    photoFeatures.forEach(feature => {
      if (content.includes(feature)) {
        this.log('Photo Access', 'PASS', `${feature} feature found`);
      } else {
        this.log('Photo Access', 'WARN', `${feature} feature not found`);
      }
    });

    // Check for user ID in S3 key path
    if (content.includes('userId') && content.includes('key')) {
      this.log('Photo Access', 'PASS', 'User ID in S3 key path implemented');
    } else {
      this.log('Photo Access', 'WARN', 'User ID in S3 key path unclear');
    }
  }

  verifyCORSProtection() {
    console.log('\n=== Verifying CORS Protection Implementation ===');
    
    const corsPath = 'middleware/corsValidation.js';
    if (!this.fileExists(corsPath)) {
      this.log('CORS Protection', 'FAIL', 'CORS validation middleware not found');
      return;
    }

    const content = this.readFile(corsPath);
    if (!content) {
      this.log('CORS Protection', 'FAIL', 'Could not read CORS validation middleware');
      return;
    }

    const corsFeatures = [
      'validateOrigin',
      'allowedOrigins',
      'Origin',
      'Referer'
    ];

    corsFeatures.forEach(feature => {
      if (content.includes(feature)) {
        this.log('CORS Protection', 'PASS', `${feature} feature found`);
      } else {
        this.log('CORS Protection', 'WARN', `${feature} feature not found`);
      }
    });

    // Check for wildcard rejection
    if (content.includes('*') && content.includes('reject')) {
      this.log('CORS Protection', 'PASS', 'Wildcard origin rejection implemented');
    } else {
      this.log('CORS Protection', 'INFO', 'Wildcard origin handling unclear');
    }
  }

  verifyTestCoverage() {
    console.log('\n=== Verifying Security Test Coverage ===');
    
    const testFiles = [
      'tests/securityHeaders.test.js',
      'tests/validation.test.js',
      'tests/rateLimit.test.js',
      'tests/auditLog.test.js',
      'tests/auth.test.js',
      'tests/corsValidation.test.js',
      'tests/errorHandling.test.js'
    ];

    let testCoverage = 0;
    testFiles.forEach(testFile => {
      if (this.fileExists(testFile)) {
        this.log('Test Coverage', 'PASS', `${testFile} exists`);
        testCoverage++;
      } else {
        this.log('Test Coverage', 'WARN', `${testFile} missing`);
      }
    });

    const coveragePercentage = Math.round((testCoverage / testFiles.length) * 100);
    if (coveragePercentage >= 80) {
      this.log('Test Coverage', 'PASS', `Security test coverage: ${coveragePercentage}%`);
    } else {
      this.log('Test Coverage', 'WARN', `Security test coverage: ${coveragePercentage}% (below 80%)`);
    }
  }

  verifyInfrastructureAsCode() {
    console.log('\n=== Verifying Infrastructure Security Configuration ===');
    
    const templatePath = path.join(__dirname, '..', 'template.yaml');
    if (!fs.existsSync(templatePath)) {
      this.log('Infrastructure', 'FAIL', 'SAM template not found');
      return;
    }

    const content = fs.readFileSync(templatePath, 'utf8');
    
    const infraFeatures = [
      { name: 'CloudFront Distribution', pattern: /AWS::CloudFront::Distribution/i },
      { name: 'WAF WebACL', pattern: /AWS::WAFv2::WebACL/i },
      { name: 'HTTPS Redirect', pattern: /redirect-to-https|ViewerProtocolPolicy/i },
      { name: 'Security Headers', pattern: /ResponseHeadersPolicy|SecurityHeadersConfig/i },
      { name: 'DynamoDB Encryption', pattern: /SSESpecification|PointInTimeRecoveryEnabled/i }
    ];

    infraFeatures.forEach(feature => {
      if (content.match(feature.pattern)) {
        this.log('Infrastructure', 'PASS', `${feature.name} configured`);
      } else {
        this.log('Infrastructure', 'WARN', `${feature.name} not found in template`);
      }
    });
  }

  generateReport() {
    console.log('\n=== Security Implementation Verification Report ===');
    
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      failed: this.results.filter(r => r.status === 'FAIL').length,
      warnings: this.results.filter(r => r.status === 'WARN').length,
      info: this.results.filter(r => r.status === 'INFO').length
    };

    console.log(`\nSummary:`);
    console.log(`  Total Checks: ${summary.total}`);
    console.log(`  Passed: ${summary.passed}`);
    console.log(`  Failed: ${summary.failed}`);
    console.log(`  Warnings: ${summary.warnings}`);
    console.log(`  Info: ${summary.info}`);

    const successRate = Math.round((summary.passed / summary.total) * 100);
    console.log(`  Success Rate: ${successRate}%`);

    if (summary.failed > 0) {
      console.log('\n❌ Failed Checks:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  - ${r.test}: ${r.message}`));
    }

    if (summary.warnings > 0) {
      console.log('\n⚠️  Warnings:');
      this.results
        .filter(r => r.status === 'WARN')
        .forEach(r => console.log(`  - ${r.test}: ${r.message}`));
    }

    // Write detailed report
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: summary,
      results: this.results
    };

    fs.writeFileSync(
      'security-implementation-report.json',
      JSON.stringify(reportData, null, 2)
    );

    console.log('\nDetailed report saved to: security-implementation-report.json');
    
    if (summary.failed === 0 && successRate >= 80) {
      console.log('\n✅ Security implementation verification passed!');
      return true;
    } else {
      console.log('\n❌ Security implementation verification needs attention!');
      return false;
    }
  }

  async runAllVerifications() {
    console.log('🔒 Starting Security Implementation Verification...');
    console.log('================================================');

    this.verifySecurityHeaders();
    this.verifyInputValidation();
    this.verifyRateLimiting();
    this.verifyAuditLogging();
    this.verifyInventoryAccessControl();
    this.verifyErrorHandling();
    this.verifyPhotoAccessControl();
    this.verifyCORSProtection();
    this.verifyTestCoverage();
    this.verifyInfrastructureAsCode();

    const success = this.generateReport();
    process.exit(success ? 0 : 1);
  }
}

// Run verification if called directly
if (require.main === module) {
  const verifier = new SecurityImplementationVerifier();
  verifier.runAllVerifications().catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
}

module.exports = SecurityImplementationVerifier;