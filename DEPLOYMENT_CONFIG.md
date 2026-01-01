# Deployment Configuration Guide

This document explains how to use the environment-specific SAM configuration files for deploying the Home Inventory System.

## Configuration Files

### Backend Deployment (eu-west-1)
- `samconfig-dev.toml` - Development environment configuration
- `samconfig-prod.toml` - Production environment configuration

### CloudFront Deployment (us-east-1)
- `samconfig-cloudfront-dev.toml` - Development CloudFront configuration
- `samconfig-cloudfront-prod.toml` - Production CloudFront configuration

## Environment Differences

### Development Environment
- **Stack Name**: `home-inventory-system-dev`
- **S3 Bucket**: `home-inventory-sam-deployment-dev-1766535400`
- **Resource Naming**: All resources suffixed with `-dev`
- **Protection**: Minimal protection, faster deployments
- **WAF**: Disabled for cost savings
- **Monitoring**: Basic monitoring only
- **Confirmation**: Skipped for faster iteration

### Production Environment
- **Stack Name**: `home-inventory-system-prod`
- **S3 Bucket**: `home-inventory-sam-deployment-prod-1766535400`
- **Resource Naming**: All resources suffixed with `-prod`
- **Protection**: Full protection enabled
- **WAF**: Enabled for security
- **Monitoring**: Enhanced monitoring enabled
- **Confirmation**: Always required
- **Rollback**: Enabled on failure
- **Termination Protection**: Enabled

## Deployment Commands

### Deploy Development Environment
```bash
# Backend (eu-west-1)
sam deploy --config-file samconfig-dev.toml --config-env dev

# CloudFront (us-east-1)
sam deploy --config-file samconfig-cloudfront-dev.toml --config-env dev
```

### Deploy Production Environment
```bash
# Backend (eu-west-1)
sam deploy --config-file samconfig-prod.toml --config-env prod

# CloudFront (us-east-1)
sam deploy --config-file samconfig-cloudfront-prod.toml --config-env prod
```

### Using Default Configuration
```bash
# Development (uses default section)
sam deploy --config-file samconfig-dev.toml

# Production (uses default section)
sam deploy --config-file samconfig-prod.toml
```

## Resource Naming Conventions

### Development Resources
- DynamoDB Tables: `home-inv-{service}-dev`
- S3 Buckets: `{bucket-name}-dev-{account-id}`
- Lambda Functions: `{function-name}-dev`
- CloudFormation Stacks: `home-inventory-system-dev`

### Production Resources
- DynamoDB Tables: `home-inv-{service}-prod`
- S3 Buckets: `{bucket-name}-prod-{account-id}`
- Lambda Functions: `{function-name}-prod`
- CloudFormation Stacks: `home-inventory-system-prod`

## Cost Tracking Tags

All resources are tagged for cost tracking:
- **Environment**: `dev` or `prod`
- **Project**: `home-inventory`
- **CostCenter**: `development` or `production`
- **Component**: `backend` or `cloudfront`
- **DataProtection**: `enabled` (production only)
- **BackupEnabled**: `true` (production only)

## Security Considerations

### Development
- WAF disabled to reduce costs
- Basic monitoring only
- Faster deployment process
- Less restrictive change management

### Production
- WAF enabled with managed rules
- Enhanced monitoring and alerting
- Mandatory change confirmation
- Rollback protection enabled
- Termination protection enabled
- Data protection policies enforced

## Prerequisites

Before using these configurations:

1. **S3 Buckets**: Create deployment buckets in both environments
   ```bash
   aws s3 mb s3://home-inventory-sam-deployment-dev-1766535400 --region eu-west-1
   aws s3 mb s3://home-inventory-sam-deployment-prod-1766535400 --region eu-west-1
   ```

2. **AWS Credentials**: Configure separate AWS profiles for dev and prod
   ```bash
   aws configure --profile home-inventory-dev
   aws configure --profile home-inventory-prod
   ```

3. **Region Setup**: Ensure both eu-west-1 and us-east-1 are available

## Troubleshooting

### Common Issues
1. **S3 Bucket Not Found**: Ensure deployment buckets exist in correct regions
2. **Permission Denied**: Verify AWS credentials have necessary permissions
3. **Stack Already Exists**: Use different stack names for different environments
4. **Region Mismatch**: Backend in eu-west-1, CloudFront in us-east-1

### Validation Commands
```bash
# Validate template
sam validate --config-file samconfig-dev.toml

# Build without deploy
sam build --config-file samconfig-dev.toml

# Generate change set
sam deploy --config-file samconfig-prod.toml --no-execute-changeset
```