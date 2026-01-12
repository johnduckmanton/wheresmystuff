/**
 * Environment Separation Tests
 * 
 * These tests validate that the production deployment system properly
 * separates development and production environments.
 */

const fs = require('fs');
const path = require('path');

describe('Environment Separation Tests', () => {
  let devConfig, prodConfig, templateContent;

  beforeAll(() => {
    // Load SAM configuration files
    const devConfigPath = path.join(__dirname, '../../samconfig-dev.toml');
    const prodConfigPath = path.join(__dirname, '../../samconfig-prod.toml');
    const templatePath = path.join(__dirname, '../../template.yaml');

    // Check if files exist
    expect(fs.existsSync(devConfigPath)).toBe(true);
    expect(fs.existsSync(prodConfigPath)).toBe(true);
    expect(fs.existsSync(templatePath)).toBe(true);

    // Read configuration files as text
    devConfig = fs.readFileSync(devConfigPath, 'utf8');
    prodConfig = fs.readFileSync(prodConfigPath, 'utf8');
    templateContent = fs.readFileSync(templatePath, 'utf8');
  });

  describe('SAM Configuration Separation', () => {
    test('should have different stack names for dev and prod', () => {
      expect(devConfig).toContain('stack_name = "home-inventory-system-dev"');
      expect(prodConfig).toContain('stack_name = "home-inventory-system-prod"');
    });

    test('should have different S3 buckets for dev and prod', () => {
      expect(devConfig).toContain('s3_bucket = "home-inventory-sam-deployment-dev-');
      expect(prodConfig).toContain('s3_bucket = "home-inventory-sam-deployment-prod-');
    });

    test('should have different environment tags', () => {
      expect(devConfig).toContain('Environment=dev');
      expect(prodConfig).toContain('Environment=prod');
    });

    test('should have production-specific protection settings', () => {
      expect(prodConfig).toContain('confirm_changeset = true');
      expect(prodConfig).toContain('disable_rollback = false');
      expect(prodConfig).toContain('termination_protection = true');
    });

    test('should have different cost centers', () => {
      expect(devConfig).toContain('CostCenter=development');
      expect(prodConfig).toContain('CostCenter=production');
    });
  });

  describe('CloudFormation Template Environment Support', () => {
    test('should have Environment parameter', () => {
      expect(templateContent).toContain('Environment:');
      expect(templateContent).toContain('Type: String');
      expect(templateContent).toContain('AllowedValues: [dev, prod]');
    });

    test('should have EnableDeletionProtection parameter', () => {
      expect(templateContent).toContain('EnableDeletionProtection:');
      expect(templateContent).toContain('AllowedValues: [true, false]');
    });

    test('should have LogRetentionDays parameter for cost optimization', () => {
      expect(templateContent).toContain('LogRetentionDays:');
      expect(templateContent).toContain('Type: Number');
    });

    test('should have IsProduction condition', () => {
      expect(templateContent).toContain('IsProduction: !Equals [!Ref Environment, prod]');
    });

    test('should have EnableProtection condition', () => {
      expect(templateContent).toContain('EnableProtection: !Equals [!Ref EnableDeletionProtection, true]');
    });
  });

  describe('Resource Environment Isolation', () => {
    test('should have environment-specific resource naming', () => {
      // Check DynamoDB table naming
      expect(templateContent).toContain('TableName: !Sub home-inv-${Environment}');
      
      // Check User Pool naming
      expect(templateContent).toContain('UserPoolName: !Sub home-inv-${Environment}');
    });

    test('should have production-specific deletion policies', () => {
      expect(templateContent).toContain('DeletionPolicy: !If [IsProduction, Retain, Delete]');
      expect(templateContent).toContain('UpdateReplacePolicy: !If [IsProduction, Retain, Delete]');
    });

    test('should have conditional deletion protection', () => {
      expect(templateContent).toContain('DeletionProtectionEnabled: !If [EnableProtection, true, false]');
    });

    test('should have environment-specific S3 bucket naming', () => {
      expect(templateContent).toContain('BucketName: !Sub home-inv-photos-${AWS::AccountId}-${Environment}');
      expect(templateContent).toContain('BucketName: !Sub home-inv-qr-${AWS::AccountId}-${Environment}');
    });

    test('should have production-specific versioning', () => {
      expect(templateContent).toContain('Status: !If [IsProduction, Enabled, Suspended]');
    });
  });

  describe('Cost Optimization Features', () => {
    test('should have lifecycle policies for cost optimization', () => {
      expect(templateContent).toContain('Id: CostOptimization');
      expect(templateContent).toContain('TransitionInDays: 30');
      expect(templateContent).toContain('StorageClass: STANDARD_IA');
      expect(templateContent).toContain('TransitionInDays: 90');
      expect(templateContent).toContain('StorageClass: GLACIER');
    });

    test('should have environment-specific log retention', () => {
      expect(templateContent).toContain('Id: DeleteOldLogs');
      expect(templateContent).toContain('ExpirationInDays: !Ref LogRetentionDays');
    });

    test('should have environment-specific report retention', () => {
      expect(templateContent).toContain('Id: DeleteOldReports');
      expect(templateContent).toContain('ExpirationInDays: !If [IsProduction, 90, 30]');
    });
  });

  describe('Environment Variable Separation', () => {
    test('should have environment-specific global variables', () => {
      expect(templateContent).toContain('NODE_ENV: !Ref Environment');
    });

    test('should have environment-specific table names', () => {
      expect(templateContent).toContain('TABLE_NAME: !Ref InventoryTable');
    });

    test('should have environment-specific secrets', () => {
      expect(templateContent).toContain('Name: !Sub home-inv-audit-secret-${Environment}');
    });
  });
});