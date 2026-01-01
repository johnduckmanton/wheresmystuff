/**
 * Deployment Validation Tests
 * 
 * These tests validate that the deployment system is ready for production use.
 */

const fs = require('fs');
const path = require('path');

describe('Deployment Validation Tests', () => {
  describe('Required Files Exist', () => {
    test('should have all required configuration files', () => {
      const requiredFiles = [
        'samconfig-dev.toml',
        'samconfig-prod.toml',
        'template.yaml',
        'cloudfront-template.yaml',
        '.github/workflows/ci-cd.yml',
        '.github/workflows/deploy-production.yml',
        'scripts/migrate-to-prod.sh',
        'scripts/validate-schema.sh'
      ];

      requiredFiles.forEach(file => {
        const filePath = path.join(__dirname, '../../', file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    test('should have executable migration scripts', () => {
      const scriptPath = path.join(__dirname, '../../scripts/migrate-to-prod.sh');
      const stats = fs.statSync(scriptPath);
      
      // Check if file is executable (owner execute permission)
      expect(stats.mode & parseInt('100', 8)).toBeTruthy();
    });
  });

  describe('Configuration Validation', () => {
    test('should have different stack names for environments', () => {
      const devConfig = fs.readFileSync(path.join(__dirname, '../../samconfig-dev.toml'), 'utf8');
      const prodConfig = fs.readFileSync(path.join(__dirname, '../../samconfig-prod.toml'), 'utf8');

      expect(devConfig).toContain('home-inventory-system-dev');
      expect(prodConfig).toContain('home-inventory-system-prod');
      expect(devConfig).not.toContain('home-inventory-system-prod');
      expect(prodConfig).not.toContain('home-inventory-system-dev');
    });

    test('should have production-specific protection settings', () => {
      const prodConfig = fs.readFileSync(path.join(__dirname, '../../samconfig-prod.toml'), 'utf8');

      expect(prodConfig).toContain('confirm_changeset = true');
      expect(prodConfig).toContain('termination_protection = true');
      expect(prodConfig).toContain('Environment=prod');
      expect(prodConfig).toContain('DataProtection=enabled');
    });
  });

  describe('GitHub Actions Workflows', () => {
    test('should have proper environment protection in CI/CD workflow', () => {
      const cicdWorkflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/ci-cd.yml'), 'utf8');

      expect(cicdWorkflow).toContain('environment: development');
      expect(cicdWorkflow).toContain('environment: production');
      expect(cicdWorkflow).toContain('workflow_dispatch');
    });

    test('should have production deployment workflow with manual approval', () => {
      const prodWorkflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/deploy-production.yml'), 'utf8');

      expect(prodWorkflow).toContain('workflow_dispatch');
      expect(prodWorkflow).toContain('environment: production');
      expect(prodWorkflow).toContain('security-audit');
      expect(prodWorkflow).toContain('smoke-tests');
    });
  });

  describe('CloudFormation Template Validation', () => {
    test('should have environment-specific conditions and parameters', () => {
      const template = fs.readFileSync(path.join(__dirname, '../../template.yaml'), 'utf8');

      // Check for environment parameters
      expect(template).toContain('Environment:');
      expect(template).toContain('AllowedValues: [dev, prod]');
      expect(template).toContain('EnableDeletionProtection:');
      expect(template).toContain('LogRetentionDays:');

      // Check for conditions
      expect(template).toContain('IsProduction: !Equals [!Ref Environment, prod]');
      expect(template).toContain('EnableProtection: !Equals [!Ref EnableDeletionProtection, true]');

      // Check for conditional resource properties
      expect(template).toContain('DeletionPolicy: !If [IsProduction, Retain, Delete]');
      expect(template).toContain('DeletionProtectionEnabled: !If [EnableProtection, true, false]');
    });

    test('should have cost optimization features', () => {
      const template = fs.readFileSync(path.join(__dirname, '../../template.yaml'), 'utf8');

      // Check for S3 lifecycle policies
      expect(template).toContain('LifecycleConfiguration:');
      expect(template).toContain('CostOptimization');
      expect(template).toContain('STANDARD_IA');
      expect(template).toContain('GLACIER');

      // Check for log retention
      expect(template).toContain('ExpirationInDays: !Ref LogRetentionDays');
    });
  });

  describe('Migration Scripts Validation', () => {
    test('should have comprehensive migration script', () => {
      const migrationScript = fs.readFileSync(path.join(__dirname, '../../scripts/migrate-to-prod.sh'), 'utf8');

      // Check for key functions
      expect(migrationScript).toContain('check_prerequisites');
      expect(migrationScript).toContain('create_production_backup');
      expect(migrationScript).toContain('validate_schema_compatibility');
      expect(migrationScript).toContain('validate_data_integrity');
      expect(migrationScript).toContain('rollback_migration');

      // Check for safety features
      expect(migrationScript).toContain('DRY_RUN');
      expect(migrationScript).toContain('confirm');
      expect(migrationScript).toContain('backup');
    });
  });

  describe('Security Configuration', () => {
    test('should have security audit in workflows', () => {
      const cicdWorkflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/ci-cd.yml'), 'utf8');
      const prodWorkflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/deploy-production.yml'), 'utf8');

      expect(cicdWorkflow).toContain('security-audit');
      expect(cicdWorkflow).toContain('npm audit');
      expect(prodWorkflow).toContain('security-audit');
      expect(prodWorkflow).toContain('audit-level=high');
    });

    test('should have environment-specific secrets configuration', () => {
      const template = fs.readFileSync(path.join(__dirname, '../../template.yaml'), 'utf8');

      expect(template).toContain('AuditLogHMACSecret');
      expect(template).toContain('home-inv-audit-secret-${Environment}');
    });
  });
});