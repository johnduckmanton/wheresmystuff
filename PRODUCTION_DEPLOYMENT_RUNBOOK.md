# Production Deployment Runbook

## Overview

This runbook provides step-by-step procedures for deploying and managing the Home Inventory System production environment. It focuses on cost-effective deployment using AWS free tier services, GitHub Actions CI/CD, and manual processes to minimize operational costs.

**Cost Target**: Keep monthly costs under $50 using AWS free tier and cost optimization strategies.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Production Deployment Procedures](#production-deployment-procedures)
3. [Cost Monitoring and Optimization](#cost-monitoring-and-optimization)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Disaster Recovery Procedures](#disaster-recovery-procedures)
6. [Security Procedures](#security-procedures)
7. [Maintenance Procedures](#maintenance-procedures)

## Prerequisites

### Required Tools and Access

```bash
# Verify required tools
aws --version          # AWS CLI v2.x
sam --version          # SAM CLI v1.x
node --version         # Node.js 20.x
git --version          # Git for repository access

# Verify AWS access (via OIDC or local credentials)
aws sts get-caller-identity
aws configure list
```

**Important**: This system uses GitHub OIDC for secure authentication. If you haven't set up OIDC yet, follow the [GitHub OIDC Setup Guide](GITHUB_OIDC_SETUP.md) before proceeding.

### Required AWS Permissions

#### OIDC Identity Provider Setup

The system uses GitHub OIDC for secure, keyless authentication. Your AWS account needs:

1. **OIDC Identity Provider** configured for GitHub Actions
2. **IAM Roles** with appropriate permissions for each environment
3. **Trust policies** allowing GitHub repository access

#### Required IAM Permissions for Deployment Roles

The GitHub Actions OIDC roles need these permissions:

- **CloudFormation**: Full access for stack management
- **Lambda**: Full access for function deployment
- **DynamoDB**: Full access for database operations
- **S3**: Full access for storage and static hosting
- **API Gateway**: Full access for API management
- **CloudFront**: Full access for CDN (us-east-1 only)
- **Cognito**: Full access for authentication
- **CloudWatch**: Full access for monitoring and logging
- **WAF**: Full access for security (optional)
- **IAM**: Role creation and policy attachment
- **Budgets**: Create and manage cost budgets
- **SNS**: Create topics and subscriptions for alerts

### Environment Configuration

```bash
# Set production environment variables
export AWS_REGION=eu-west-1
export ENVIRONMENT=prod
export STACK_NAME=home-inventory-system-prod
export CLOUDFRONT_STACK=home-inventory-cloudfront-prod

# Verify OIDC authentication is configured
# See GITHUB_OIDC_SETUP.md for detailed setup instructions

# Verify environment separation
aws cloudformation describe-stacks --stack-name home-inventory-system-dev --region eu-west-1
aws cloudformation describe-stacks --stack-name home-inventory-system-prod --region eu-west-1
```

## Production Deployment Procedures

### Initial Production Deployment

**Estimated Time**: 45-90 minutes  
**Prerequisites**: Development environment deployed and tested

#### Step 1: Pre-Deployment Validation (10 minutes)

```bash
# 1. Validate SAM template
sam validate --template template.yaml

# 2. Check configuration files
cat samconfig-prod.toml
cat samconfig-cloudfront-prod.toml

# 3. Verify GitHub OIDC configuration
# Check that the following are configured in your AWS account:
# - OIDC Identity Provider: token.actions.githubusercontent.com
# - IAM Roles: GitHubActionsRole-Dev and GitHubActionsRole-Prod
# - Trust policies allowing your GitHub repository

# 4. Verify GitHub repository secrets (if using fallback)
# Note: OIDC is preferred, but these may be needed for local deployments:
# - AWS_ACCOUNT_ID
# - AWS_REGION (eu-west-1)

# 5. Test development environment
curl -X GET "https://your-dev-api.execute-api.eu-west-1.amazonaws.com/dev/health"
```

#### Step 2: Deploy Backend Infrastructure (20-30 minutes)

```bash
# 1. Build SAM application
sam build --use-container

# 2. Deploy backend stack
sam deploy --config-file samconfig-prod.toml --config-env prod

# 3. Capture stack outputs
API_URL=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-system-prod \
  --region eu-west-1 \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-system-prod \
  --region eu-west-1 \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-system-prod \
  --region eu-west-1 \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text)

WEBSITE_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-system-prod \
  --region eu-west-1 \
  --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucket'].OutputValue" \
  --output text)

echo "API URL: $API_URL"
echo "User Pool ID: $USER_POOL_ID"
echo "User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "Website Bucket: $WEBSITE_BUCKET"
```

#### Step 3: Deploy CloudFront Distribution (15-20 minutes)

```bash
# 1. Extract API Gateway domain
API_DOMAIN=$(echo $API_URL | sed 's|https://||' | sed 's|/prod||')

# 2. Get S3 website domain
S3_DOMAIN=$(aws s3api get-bucket-website \
  --bucket $WEBSITE_BUCKET \
  --query 'WebsiteConfiguration.IndexDocument.Suffix' \
  --output text 2>/dev/null || echo "${WEBSITE_BUCKET}.s3-website.eu-west-1.amazonaws.com")

# 3. Deploy CloudFront stack
aws cloudformation deploy \
  --template-file cloudfront-template.yaml \
  --stack-name home-inventory-cloudfront-prod \
  --region us-east-1 \
  --parameter-overrides \
    Environment=prod \
    ApiGatewayDomainName=$API_DOMAIN \
    WebsiteBucketDomainName=$S3_DOMAIN \
    EnableWAF=true

# 4. Get CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-cloudfront-prod \
  --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" \
  --output text)

echo "CloudFront URL: $CLOUDFRONT_URL"
```

#### Step 4: Deploy Frontend Application (10-15 minutes)

```bash
cd frontend

# 1. Create production environment file
cat > .env.production << EOF
VITE_API_URL=$API_URL
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_REGION=eu-west-1
VITE_ENVIRONMENT=prod
EOF

# 2. Install dependencies and build
npm ci
npm run build

# 3. Deploy to S3
aws s3 sync dist/ s3://$WEBSITE_BUCKET/ --delete

# 4. Invalidate CloudFront cache
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name home-inventory-cloudfront-prod \
  --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"

cd ..
```

#### Step 5: Post-Deployment Validation (10-15 minutes)

```bash
# 1. Health check
curl -X GET "$API_URL/health"

# 2. Test authentication endpoint
curl -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'

# 3. Verify CloudFront is serving content
curl -I "$CLOUDFRONT_URL"

# 4. Check DynamoDB table
aws dynamodb describe-table \
  --table-name home-inv-prod \
  --region eu-west-1

# 5. Verify S3 bucket configuration
aws s3api get-bucket-versioning --bucket $WEBSITE_BUCKET
aws s3api get-bucket-lifecycle-configuration --bucket $WEBSITE_BUCKET

# 6. Test cost monitoring
aws budgets describe-budgets \
  --account-id $(aws sts get-caller-identity --query Account --output text)
```

### Subsequent Production Deployments

**Estimated Time**: 15-30 minutes  
**Use Case**: Deploying updates to existing production environment

#### Option 1: GitHub Actions Deployment (Recommended)

```bash
# 1. Push changes to main branch
git add .
git commit -m "Production deployment: [description]"
git push origin main

# 2. Monitor GitHub Actions workflow
# Visit: https://github.com/your-repo/actions

# 3. Approve production deployment when prompted
# GitHub will require manual approval for production environment
# OIDC authentication will be used automatically

# 4. Verify deployment success
curl -X GET "$API_URL/health"
```

#### Option 2: Manual Deployment

```bash
# 1. Backend updates only
sam build
sam deploy --config-file samconfig-prod.toml --config-env prod

# 2. Frontend updates only
cd frontend
npm run build
aws s3 sync dist/ s3://$WEBSITE_BUCKET/ --delete
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
cd ..

# 3. Full stack update
./deploy.sh home-inventory-system-prod prod eu-west-1
```

### Rollback Procedures

**Estimated Time**: 10-30 minutes  
**Use Case**: Reverting problematic deployments

#### Quick Rollback (Lambda Functions Only)

```bash
# 1. List recent deployments
aws lambda list-versions-by-function \
  --function-name home-inventory-prod-ContainerFunction \
  --region eu-west-1

# 2. Rollback to previous version
aws lambda update-alias \
  --function-name home-inventory-prod-ContainerFunction \
  --name LIVE \
  --function-version "previous-version-number" \
  --region eu-west-1

# 3. Repeat for all functions
# (Use script: ./scripts/rollback-lambda-functions.sh)
```

#### Full Stack Rollback

```bash
# 1. Rollback using CloudFormation
aws cloudformation cancel-update-stack \
  --stack-name home-inventory-system-prod \
  --region eu-west-1

# 2. If cancellation not possible, deploy previous version
git checkout previous-working-commit
sam deploy --config-file samconfig-prod.toml --config-env prod

# 3. Rollback frontend
git checkout previous-working-commit -- frontend/
cd frontend
npm run build
aws s3 sync dist/ s3://$WEBSITE_BUCKET/ --delete
cd ..
```

## Cost Monitoring and Optimization

### Daily Cost Monitoring (5 minutes)

```bash
# 1. Check current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE

# 2. Check budget status
aws budgets describe-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget-name "home-inventory-prod"

# 3. Monitor free tier usage
./scripts/monthly-cost-report.sh prod
```

### Weekly Cost Optimization (15 minutes)

```bash
# 1. Generate detailed cost report
./scripts/cost-monitoring-report.js prod

# 2. Check for cost optimization opportunities
./scripts/optimize-dynamodb-queries.js prod

# 3. Review S3 storage costs
aws s3api list-objects-v2 \
  --bucket home-inv-photos-prod \
  --query 'sum(Contents[].Size)' \
  --output text

# 4. Optimize CloudWatch log retention
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/home-inventory-prod" \
  --query 'logGroups[?retentionInDays>`7`]'
```

### Monthly Budget Review (30 minutes)

```bash
# 1. Generate comprehensive cost report
./scripts/monthly-cost-report.sh prod

# 2. Update budget thresholds if needed
aws budgets update-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --new-budget file://updated-budget.json

# 3. Implement cost-saving measures if approaching limits
./scripts/implement-budget-limits.sh prod

# 4. Review and optimize resource usage
./scripts/pause-dev-resources.sh  # Pause non-essential dev resources
```

### Cost Containment Procedures

**When approaching 80% of budget**:

```bash
# 1. Immediate cost reduction
./scripts/implement-budget-limits.sh prod emergency

# 2. Reduce log retention
aws logs put-retention-policy \
  --log-group-name "/aws/lambda/home-inventory-prod-ContainerFunction" \
  --retention-in-days 3

# 3. Optimize S3 lifecycle policies
aws s3api put-bucket-lifecycle-configuration \
  --bucket home-inv-photos-prod \
  --lifecycle-configuration file://emergency-lifecycle.json

# 4. Implement additional caching
# (Manual: Update CloudFront cache behaviors)
```

## Troubleshooting Guide

### Common Deployment Issues

#### Issue 1: CloudFormation Stack Fails

**Symptoms**:
- Stack creation/update fails
- Resources in failed state
- Permission errors

**Diagnosis**:
```bash
# Check stack events
aws cloudformation describe-stack-events \
  --stack-name home-inventory-system-prod \
  --region eu-west-1

# Check specific resource failures
aws cloudformation describe-stack-resources \
  --stack-name home-inventory-system-prod \
  --region eu-west-1
```

**Resolution**:
```bash
# Option 1: Retry deployment
sam deploy --config-file samconfig-prod.toml --config-env prod

# Option 2: Delete and recreate stack
aws cloudformation delete-stack \
  --stack-name home-inventory-system-prod \
  --region eu-west-1

# Wait for deletion, then redeploy
aws cloudformation wait stack-delete-complete \
  --stack-name home-inventory-system-prod \
  --region eu-west-1

sam deploy --config-file samconfig-prod.toml --config-env prod
```

#### Issue 2: API Gateway Returns 5xx Errors

**Symptoms**:
- API endpoints return 500/502/503 errors
- Lambda function errors in CloudWatch

**Diagnosis**:
```bash
# Check Lambda function logs
aws logs tail /aws/lambda/home-inventory-prod-ContainerFunction \
  --region eu-west-1 \
  --follow

# Check API Gateway logs
aws logs describe-log-groups \
  --log-group-name-prefix "API-Gateway-Execution-Logs"
```

**Resolution**:
```bash
# Option 1: Redeploy Lambda functions
sam build
sam deploy --config-file samconfig-prod.toml --config-env prod

# Option 2: Check environment variables
aws lambda get-function-configuration \
  --function-name home-inventory-prod-ContainerFunction \
  --region eu-west-1 \
  --query "Environment.Variables"

# Option 3: Test function directly
aws lambda invoke \
  --function-name home-inventory-prod-ContainerFunction \
  --payload '{"httpMethod":"GET","path":"/health"}' \
  --region eu-west-1 \
  response.json
```

#### Issue 3: Authentication Failures (401/403)

**Symptoms**:
- Users cannot sign in
- API returns 401 Unauthorized
- JWT token validation fails

**Diagnosis**:
```bash
# Check Cognito User Pool configuration
aws cognito-idp describe-user-pool \
  --user-pool-id $USER_POOL_ID \
  --region eu-west-1

# Check API Gateway authorizer
aws apigatewayv2 get-authorizers \
  --api-id $API_ID \
  --region eu-west-1
```

**Resolution**:
```bash
# Option 1: Verify environment variables
aws lambda get-function-configuration \
  --function-name home-inventory-prod-ContainerFunction \
  --region eu-west-1 \
  --query "Environment.Variables.USER_POOL_ID"

# Option 2: Update Lambda environment variables
aws lambda update-function-configuration \
  --function-name home-inventory-prod-ContainerFunction \
  --environment Variables="{USER_POOL_ID=$USER_POOL_ID,TABLE_NAME=home-inv-prod}" \
  --region eu-west-1

# Option 3: Redeploy with correct configuration
sam deploy --config-file samconfig-prod.toml --config-env prod
```

#### Issue 4: CORS Errors

**Symptoms**:
- Browser console shows CORS policy errors
- Frontend cannot access API
- Preflight requests fail

**Diagnosis**:
```bash
# Test CORS headers
curl -H "Origin: https://your-cloudfront-domain.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  -X OPTIONS \
  "$API_URL/api/inventories"
```

**Resolution**:
```bash
# Check ALLOWED_ORIGINS environment variable
aws lambda get-function-configuration \
  --function-name home-inventory-prod-ContainerFunction \
  --region eu-west-1 \
  --query "Environment.Variables.ALLOWED_ORIGINS"

# Update CORS configuration
aws lambda update-function-configuration \
  --function-name home-inventory-prod-ContainerFunction \
  --environment Variables="{ALLOWED_ORIGINS=https://your-cloudfront-domain.com,http://localhost:5173}" \
  --region eu-west-1
```

### Performance Issues

#### Issue 1: High Lambda Duration

**Symptoms**:
- Lambda functions taking >10 seconds
- Timeout errors
- High costs due to execution time

**Diagnosis**:
```bash
# Check Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=home-inventory-prod-ContainerFunction \
  --start-time $(date -d '1 hour ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Average,Maximum \
  --region eu-west-1
```

**Resolution**:
```bash
# Option 1: Increase memory allocation
aws lambda update-function-configuration \
  --function-name home-inventory-prod-ContainerFunction \
  --memory-size 1024 \
  --region eu-west-1

# Option 2: Optimize code (requires development)
# Option 3: Enable provisioned concurrency (increases costs)
```

#### Issue 2: DynamoDB Throttling

**Symptoms**:
- ProvisionedThroughputExceededException errors
- High response times
- Failed database operations

**Diagnosis**:
```bash
# Check DynamoDB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ThrottledRequests \
  --dimensions Name=TableName,Value=home-inv-prod \
  --start-time $(date -d '1 hour ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Sum \
  --region eu-west-1
```

**Resolution**:
```bash
# Check current table configuration
aws dynamodb describe-table \
  --table-name home-inv-prod \
  --region eu-west-1

# On-demand billing should handle this automatically
# If using provisioned capacity, increase read/write capacity
```

### Security Issues

#### Issue 1: WAF Blocking Legitimate Traffic

**Symptoms**:
- Users receiving 403 Forbidden errors
- WAF logs show blocked requests
- Legitimate traffic being filtered

**Diagnosis**:
```bash
# Check WAF logs
aws wafv2 get-sampled-requests \
  --web-acl-arn $WAF_ARN \
  --rule-metric-name AWSManagedRulesCommonRuleSetMetric \
  --scope CLOUDFRONT \
  --time-window StartTime=$(date -d '1 hour ago' +%s),EndTime=$(date +%s) \
  --max-items 100 \
  --region us-east-1
```

**Resolution**:
```bash
# Option 1: Add IP to allowlist
# (Manual: Update WAF configuration in AWS Console)

# Option 2: Adjust WAF rules
# (Manual: Modify rule sensitivity in AWS Console)

# Option 3: Temporarily disable WAF
aws wafv2 update-web-acl \
  --scope CLOUDFRONT \
  --id $WAF_ID \
  --default-action Allow={} \
  --region us-east-1
```

## Disaster Recovery Procedures

### Data Recovery Using Point-in-Time Recovery

**Estimated Time**: 30-60 minutes  
**RPO**: 1 second to 35 days  
**Use Case**: Data corruption or accidental deletion

```bash
# 1. Assess the situation
./scripts/disaster-recovery.sh prod assess

# 2. Determine recovery point
# Choose timestamp before the issue occurred
RECOVERY_TIME="2024-01-15T10:30:00.000Z"

# 3. Execute point-in-time recovery
./scripts/rollback-production.sh prod pitr "$RECOVERY_TIME"

# 4. Monitor recovery progress
aws dynamodb describe-table \
  --table-name home-inv-prod-restored-$(date +%Y%m%d) \
  --region eu-west-1

# 5. Validate recovered data
./scripts/rollback-production.sh prod validate "home-inv-prod-restored-$(date +%Y%m%d)"

# 6. Switch to recovered table (manual process)
# Update CloudFormation template to use new table name
# Deploy updated stack
```

### Infrastructure Recovery

**Estimated Time**: 2-4 hours  
**Use Case**: Complete infrastructure failure

```bash
# 1. Full system assessment
./scripts/disaster-recovery.sh prod assess

# 2. Backup current state (if possible)
./scripts/backup-production.sh prod emergency

# 3. Full infrastructure rebuild
./scripts/disaster-recovery.sh prod full-recovery

# 4. Restore data from backups
./scripts/rollback-production.sh prod backup "latest-backup"

# 5. Comprehensive validation
./scripts/disaster-recovery.sh prod validate-recovery
```

### Emergency Procedures

**When all automated recovery fails**:

1. **Contact AWS Support** (if applicable)
2. **Manual resource recreation** using AWS Console
3. **Data export/import** using DynamoDB tools
4. **DNS failover** to maintenance page

## Security Procedures

### Security Monitoring

**Daily Security Checks** (5 minutes):
```bash
# 1. Check CloudTrail for suspicious activity
aws logs filter-log-events \
  --log-group-name CloudTrail/SecurityEvents \
  --start-time $(date -d '24 hours ago' +%s)000

# 2. Review WAF blocked requests
aws wafv2 get-sampled-requests \
  --web-acl-arn $WAF_ARN \
  --rule-metric-name AWSManagedRulesCommonRuleSetMetric \
  --scope CLOUDFRONT \
  --time-window StartTime=$(date -d '24 hours ago' +%s),EndTime=$(date +%s) \
  --max-items 50 \
  --region us-east-1

# 3. Check for failed authentication attempts
aws logs filter-log-events \
  --log-group-name "/aws/lambda/home-inventory-prod-AuthFunction" \
  --filter-pattern "ERROR" \
  --start-time $(date -d '24 hours ago' +%s)000
```

**Weekly Security Review** (15 minutes):
```bash
# 1. Run security verification
./scripts/verify-security-implementation.js prod

# 2. Check IAM policies and roles
aws iam list-roles --query 'Roles[?contains(RoleName, `home-inventory-prod`)]'

# 3. Review S3 bucket policies
aws s3api get-bucket-policy --bucket home-inv-photos-prod

# 4. Validate encryption settings
aws dynamodb describe-table \
  --table-name home-inv-prod \
  --query 'Table.SSEDescription' \
  --region eu-west-1
```

### Security Incident Response

**If security breach detected**:

1. **Immediate Response** (5 minutes):
   ```bash
   # Disable affected resources
   ./scripts/security-incident-response.sh prod isolate
   
   # Enable additional logging
   ./scripts/security-incident-response.sh prod enhance-logging
   ```

2. **Investigation** (30 minutes):
   ```bash
   # Collect evidence
   ./scripts/security-incident-response.sh prod collect-evidence
   
   # Analyze logs
   ./scripts/security-incident-response.sh prod analyze
   ```

3. **Containment** (60 minutes):
   ```bash
   # Implement containment measures
   ./scripts/security-incident-response.sh prod contain
   
   # Update security controls
   ./scripts/security-incident-response.sh prod update-controls
   ```

## Maintenance Procedures

### Daily Maintenance (10 minutes)

```bash
# 1. Health check
curl -X GET "$API_URL/health"

# 2. Check error rates
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=home-inventory-prod-ContainerFunction \
  --start-time $(date -d '24 hours ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 86400 \
  --statistics Sum \
  --region eu-west-1

# 3. Monitor costs
./scripts/cost-monitoring-report.js prod daily

# 4. Check backup status
./scripts/backup-production.sh prod status
```

### Weekly Maintenance (30 minutes)

```bash
# 1. Performance review
./scripts/monthly-cost-report.sh prod performance

# 2. Security scan
./scripts/verify-security-implementation.js prod

# 3. Backup validation
./scripts/backup-validation.sh prod weekly

# 4. Update dependencies (if needed)
cd backend && npm audit && cd ..
cd frontend && npm audit && cd ..

# 5. Review CloudWatch alarms
aws cloudwatch describe-alarms \
  --alarm-names "home-inventory-prod-HighErrorRate" \
  --region eu-west-1
```

### Monthly Maintenance (2 hours)

```bash
# 1. Comprehensive cost review
./scripts/monthly-cost-report.sh prod comprehensive

# 2. Disaster recovery test
./scripts/disaster-recovery-testing.sh prod monthly

# 3. Security audit
./scripts/verify-security-controls.js prod

# 4. Performance optimization
./scripts/optimize-dynamodb-queries.js prod
./scripts/cost-optimization.sh prod

# 5. Documentation updates
# Review and update this runbook
# Update team procedures
# Check compliance requirements
```

### Quarterly Maintenance (4 hours)

```bash
# 1. Full disaster recovery drill
./scripts/disaster-recovery-testing.sh prod quarterly

# 2. Complete security review
./scripts/run-security-verification.sh prod

# 3. Cost optimization analysis
./scripts/cost-optimization.sh prod quarterly

# 4. Compliance audit
./scripts/compliance-monitoring.sh prod audit

# 5. Infrastructure review
# Review CloudFormation templates
# Update SAM configuration
# Plan capacity and scaling
```

## Emergency Contacts and Escalation

### Internal Contacts

- **Primary On-Call**: [Your primary contact]
- **Secondary On-Call**: [Your secondary contact]
- **DevOps Lead**: [DevOps team lead]
- **Security Officer**: [Security team contact]

### External Contacts

- **AWS Support**: [Support case URL if applicable]
- **GitHub Support**: [For CI/CD issues]
- **Domain Registrar**: [For DNS issues]

### Escalation Procedures

1. **Level 1** (0-30 minutes): Development team member
2. **Level 2** (30-60 minutes): Senior developer or DevOps engineer
3. **Level 3** (60+ minutes): System architect or CTO
4. **Level 4** (Critical): External support (AWS, vendors)

## Appendix

### Useful Commands Reference

```bash
# Quick health checks
curl -X GET "$API_URL/health"
aws cloudformation describe-stacks --stack-name home-inventory-system-prod --region eu-west-1

# Cost monitoring
./scripts/monthly-cost-report.sh prod
aws budgets describe-budget --account-id $(aws sts get-caller-identity --query Account --output text) --budget-name "home-inventory-prod"

# Security checks
./scripts/verify-security-implementation.js prod
aws logs filter-log-events --log-group-name CloudTrail/SecurityEvents --start-time $(date -d '24 hours ago' +%s)000

# Backup and recovery
./scripts/backup-production.sh prod backup
./scripts/rollback-production.sh prod list
./scripts/disaster-recovery.sh prod assess
```

### Configuration Files

- `samconfig-prod.toml` - Production SAM configuration
- `samconfig-cloudfront-prod.toml` - CloudFront configuration
- `.env.production` - Frontend environment variables
- `template.yaml` - CloudFormation template
- `cloudfront-template.yaml` - CloudFront template

### Log Locations

- **Lambda Logs**: `/aws/lambda/home-inventory-prod-*`
- **API Gateway Logs**: `API-Gateway-Execution-Logs_*`
- **CloudFront Logs**: S3 bucket (if enabled)
- **WAF Logs**: CloudWatch Logs (if enabled)

---

**Document Version**: 1.0  
**Last Updated**: $(date +%Y-%m-%d)  
**Next Review**: $(date -d '+3 months' +%Y-%m-%d)  
**Environment**: Production  
**Cost Target**: <$50/month